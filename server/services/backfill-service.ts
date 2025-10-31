import { storage } from '../storage';
import { walgreensAPI } from './walgreens';
import { RateLimiterManager } from './rate-limiter-manager';
import { zipCodeToState } from '../storage';
import type { BackfillJob, ApiKeyPool, MemberHistory } from '@shared/schema';

/**
 * BackfillService - Populate ZIP codes, states AND emails for ALL accounts
 * 
 * This service:
 * - Queries ALL accounts (prioritizes by highest balance first)
 * - Re-queries Walgreens API using lookupMember(phoneNumber)
 * - Extracts zipCode, email from profile
 * - Calculates state using zipCodeToState()
 * - Updates member_history SET zip_code = X, state = Y, email_address = Z
 * - Uses RateLimiterManager with 7 parallel workers (one per API key)
 * - Tracks progress in backfill_jobs table
 * - Resumable: Checks for incomplete jobs on startup
 */

export interface BackfillProgress {
  isRunning: boolean;
  currentJobId?: number;
  totalAccounts: number;
  processedAccounts: number;
  updatedAccounts: number;
  failedAccounts: number;
  currentPhone?: string;
  startedAt?: Date;
  estimatedTimeRemaining?: number;
}

export class BackfillService {
  private static instance: BackfillService;
  private isRunning: boolean = false;
  private abortController?: AbortController;
  private currentJob?: BackfillJob;
  private apiKeys: ApiKeyPool[] = [];
  
  // Tracking variables
  private processedCount: number = 0;
  private updatedCount: number = 0;
  private failedCount: number = 0;
  private startTime?: number;
  private currentOffset: number = 0;
  
  // Batch size for fetching accounts (INCREASED for maximum throughput)
  private readonly BATCH_SIZE = 500;
  
  // Number of parallel workers (INCREASED for aggressive parallelism)
  // With 7 API keys, this allows ~4 workers per key for maximum throughput
  private readonly WORKER_COUNT = 30;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BackfillService {
    if (!BackfillService.instance) {
      BackfillService.instance = new BackfillService();
    }
    return BackfillService.instance;
  }

  /**
   * Initialize service - check for incomplete jobs and auto-resume
   */
  async checkAndResume(): Promise<void> {
    console.log('🔍 BackfillService: Checking for incomplete jobs...');
    
    // Load API keys
    this.apiKeys = await storage.getAllApiKeys();
    console.log(`🔑 Loaded ${this.apiKeys.length} API keys for backfill`);
    
    // Check for active or paused job
    const activeJob = await storage.getActiveBackfillJob();
    
    if (activeJob) {
      console.log(`📌 Found existing backfill job (ID: ${activeJob.id}, Status: ${activeJob.status})`);
      
      if (activeJob.status === 'running') {
        console.log('♻️ Auto-resuming backfill job...');
        this.currentJob = activeJob;
        this.processedCount = activeJob.processedAccounts || 0;
        this.updatedCount = activeJob.updatedAccounts || 0;
        this.failedCount = activeJob.failedAccounts || 0;
        await this.start();
      } else if (activeJob.status === 'paused') {
        console.log('⏸️ Job is paused - waiting for manual resume');
        this.currentJob = activeJob;
      }
    } else {
      console.log('✅ No active backfill jobs found');
    }
  }

  /**
   * Start backfill process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Backfill is already running');
      return;
    }

    console.log('🟢 Starting backfill service...');
    
    // Initialize abort controller
    this.abortController = new AbortController();
    
    // Initialize RateLimiterManager with API keys
    const rateLimiter = RateLimiterManager.getInstance();
    rateLimiter.initialize(this.apiKeys, 250); // 250 req/min per key
    
    // Create or resume job
    if (!this.currentJob) {
      // Get total count of ALL accounts (prioritize by balance)
      const totalCount = await storage.getAllAccountsForBackfillCount();
      
      console.log(`📊 Processing ALL ${totalCount} accounts to update ZIP + State + Email`);
      
      this.currentJob = await storage.createBackfillJob({
        status: 'running',
        totalAccounts: totalCount,
        processedAccounts: 0,
        updatedAccounts: 0,
        failedAccounts: 0,
        startedAt: new Date()
      });
      
      console.log(`📊 Created backfill job: ${this.currentJob.id}`);
    } else {
      // Resume existing job
      await storage.updateBackfillJob(this.currentJob.id, {
        status: 'running',
        startedAt: this.currentJob.startedAt || new Date()
      });
      
      console.log(`📊 Resumed backfill job: ${this.currentJob.id}`);
    }
    
    // Reset counters for new run
    this.startTime = Date.now();
    this.isRunning = true;
    
    // Start the backfill loop
    this.backfillLoop().catch(error => {
      console.error('❌ Backfill loop error:', error);
      this.stop();
    });
    
    console.log('✅ Backfill service started successfully');
  }

  /**
   * Stop backfill process
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Backfill is not running');
      return;
    }

    console.log('🔴 Stopping backfill service...');
    
    // Signal abort
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Update job status
    if (this.currentJob) {
      await storage.updateBackfillJob(this.currentJob.id, {
        status: 'paused',
        processedAccounts: this.processedCount,
        updatedAccounts: this.updatedCount,
        failedAccounts: this.failedCount
      });
      
      console.log(`📊 Job ${this.currentJob.id} paused:`, {
        processed: this.processedCount,
        updated: this.updatedCount,
        failed: this.failedCount
      });
    }
    
    this.isRunning = false;
    console.log('✅ Backfill service stopped');
  }

  /**
   * Resume paused backfill
   */
  async resume(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Backfill is already running');
      return;
    }

    if (!this.currentJob || this.currentJob.status !== 'paused') {
      console.log('⚠️ No paused job to resume');
      return;
    }

    console.log('▶️ Resuming backfill job...');
    await this.start();
  }

  /**
   * Main backfill loop - processes accounts in batches with parallel workers
   */
  private async backfillLoop(): Promise<void> {
    console.log('🔄 Starting backfill loop...');
    
    try {
      while (this.isRunning && !this.abortController?.signal.aborted) {
        // Fetch next batch of ALL accounts (prioritized by balance)
        const accounts = await storage.getAllAccountsForBackfill(
          this.BATCH_SIZE,
          this.currentOffset
        );
        
        if (accounts.length === 0) {
          console.log('✅ No more accounts to process - backfill complete!');
          await this.complete();
          break;
        }
        
        console.log(`📦 Processing batch: ${accounts.length} accounts (offset: ${this.currentOffset})`);
        
        // Process batch with parallel workers
        await this.processBatch(accounts);
        
        // Update offset for next batch
        this.currentOffset += accounts.length;
        
        // Log progress every 100 accounts
        if (this.processedCount % 100 === 0 || this.processedCount < 100) {
          await this.logProgress();
        }
      }
      
    } catch (error) {
      console.error('❌ Backfill loop error:', error);
      
      if (this.currentJob) {
        await storage.updateBackfillJob(this.currentJob.id, {
          status: 'failed',
          errorMessage: (error as Error).message,
          processedAccounts: this.processedCount,
          updatedAccounts: this.updatedCount,
          failedAccounts: this.failedCount,
          completedAt: new Date()
        });
      }
      
      this.isRunning = false;
    }
  }

  /**
   * Process a batch of accounts with parallel workers
   */
  private async processBatch(accounts: MemberHistory[]): Promise<void> {
    // Split accounts into chunks for parallel processing
    const chunkSize = Math.ceil(accounts.length / this.WORKER_COUNT);
    const chunks: MemberHistory[][] = [];
    
    for (let i = 0; i < accounts.length; i += chunkSize) {
      chunks.push(accounts.slice(i, i + chunkSize));
    }
    
    // Process chunks in parallel with workers
    const workers = chunks.map((chunk, index) => 
      this.worker(chunk, index)
    );
    
    await Promise.allSettled(workers);
  }

  /**
   * Worker function - processes a chunk of accounts
   */
  private async worker(accounts: MemberHistory[], workerIndex: number): Promise<void> {
    const apiKey = this.apiKeys[workerIndex % this.apiKeys.length];
    
    for (const account of accounts) {
      if (!this.isRunning || this.abortController?.signal.aborted) {
        break;
      }
      
      try {
        await this.processAccount(account, apiKey);
      } catch (error) {
        console.error(`❌ Worker ${workerIndex} error processing ${account.phoneNumber}:`, error);
        this.failedCount++;
      }
      
      this.processedCount++;
      
      // Update current phone in job
      if (this.currentJob && this.processedCount % 10 === 0) {
        await storage.updateBackfillJob(this.currentJob.id, {
          currentPhone: account.phoneNumber,
          processedAccounts: this.processedCount,
          updatedAccounts: this.updatedCount,
          failedAccounts: this.failedCount
        });
      }
    }
  }

  /**
   * Process a single account - fetch ZIP code, state, and email
   */
  private async processAccount(account: MemberHistory, apiKey: ApiKeyPool): Promise<void> {
    try {
      // Acquire rate limit token before making API call
      const rateLimiter = RateLimiterManager.getInstance();
      await rateLimiter.acquire(apiKey.name);
      
      // Query Walgreens API for member data
      const lookupData = await walgreensAPI.lookupMember(account.phoneNumber);
      
      if (!lookupData || !lookupData.matchProfiles || lookupData.matchProfiles.length === 0) {
        console.log(`⚠️ No profile found for ${account.phoneNumber}`);
        this.failedCount++;
        return;
      }
      
      // Extract ZIP code and email from profile
      const profile = lookupData.matchProfiles[0];
      const zipCode = profile.zipCode;
      const email = profile.email || '';
      
      if (!zipCode) {
        console.log(`⚠️ No ZIP code in profile for ${account.phoneNumber}`);
        this.failedCount++;
        return;
      }
      
      // Calculate state from ZIP code
      const state = zipCodeToState(zipCode);
      
      // Update member_history with ZIP code, state, AND email
      await storage.updateMemberZipStateEmail(account.phoneNumber, zipCode, state, email);
      
      console.log(`✅ Updated ${account.phoneNumber}: ZIP=${zipCode}, State=${state}, Email=${email ? 'YES' : 'NO'}`);
      this.updatedCount++;
      
    } catch (error: any) {
      // Handle API errors
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        console.log(`⚠️ Account deleted/not found: ${account.phoneNumber}`);
        this.failedCount++;
      } else {
        console.error(`❌ Error processing ${account.phoneNumber}:`, error.message);
        this.failedCount++;
      }
    }
  }

  /**
   * Log progress
   */
  private async logProgress(): Promise<void> {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const rate = elapsed > 0 ? this.processedCount / elapsed : 0;
    const remaining = this.currentJob ? this.currentJob.totalAccounts - this.processedCount : 0;
    const estimatedSeconds = rate > 0 ? remaining / rate : 0;
    
    console.log(`📊 Backfill Progress:`, {
      processed: this.processedCount,
      updated: this.updatedCount,
      failed: this.failedCount,
      total: this.currentJob?.totalAccounts || 0,
      rate: `${rate.toFixed(2)} accounts/s`,
      estimatedRemaining: `${Math.round(estimatedSeconds / 60)} minutes`
    });
    
    // Update job progress
    if (this.currentJob) {
      await storage.updateBackfillJob(this.currentJob.id, {
        processedAccounts: this.processedCount,
        updatedAccounts: this.updatedCount,
        failedAccounts: this.failedCount
      });
    }
  }

  /**
   * Complete backfill job
   */
  private async complete(): Promise<void> {
    console.log('🎉 Backfill complete!');
    
    if (this.currentJob) {
      await storage.updateBackfillJob(this.currentJob.id, {
        status: 'completed',
        processedAccounts: this.processedCount,
        updatedAccounts: this.updatedCount,
        failedAccounts: this.failedCount,
        completedAt: new Date()
      });
      
      console.log(`📊 Final stats:`, {
        processed: this.processedCount,
        updated: this.updatedCount,
        failed: this.failedCount,
        successRate: `${((this.updatedCount / this.processedCount) * 100).toFixed(2)}%`
      });
    }
    
    this.isRunning = false;
    this.currentJob = undefined;
  }

  /**
   * Get current progress
   */
  getProgress(): BackfillProgress {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const rate = elapsed > 0 ? this.processedCount / elapsed : 0;
    const remaining = this.currentJob ? this.currentJob.totalAccounts - this.processedCount : 0;
    const estimatedSeconds = rate > 0 ? remaining / rate : 0;
    
    return {
      isRunning: this.isRunning,
      currentJobId: this.currentJob?.id,
      totalAccounts: this.currentJob?.totalAccounts || 0,
      processedAccounts: this.processedCount,
      updatedAccounts: this.updatedCount,
      failedAccounts: this.failedCount,
      currentPhone: this.currentJob?.currentPhone,
      startedAt: this.currentJob?.startedAt || undefined,
      estimatedTimeRemaining: estimatedSeconds
    };
  }

  /**
   * Retry failed accounts - Process only accounts without ZIP or state
   */
  async retryFailed(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Cannot retry failed accounts while backfill is running');
      throw new Error('Backfill is already running');
    }

    console.log('🔄 Starting retry of failed accounts...');
    
    // Initialize abort controller
    this.abortController = new AbortController();
    
    // Initialize RateLimiterManager with API keys
    const rateLimiter = RateLimiterManager.getInstance();
    rateLimiter.initialize(this.apiKeys, 250); // 250 req/min per key
    
    // Get accounts without ZIP or state (failed accounts)
    const failedAccounts = await storage.getAccountsWithoutZipOrState();
    
    console.log(`📊 Found ${failedAccounts.length} accounts to retry`);
    
    if (failedAccounts.length === 0) {
      console.log('✅ No failed accounts to retry');
      return;
    }
    
    // Create a retry job
    this.currentJob = await storage.createBackfillJob({
      status: 'running',
      totalAccounts: failedAccounts.length,
      processedAccounts: 0,
      updatedAccounts: 0,
      failedAccounts: 0,
      startedAt: new Date()
    });
    
    // Reset counters
    this.processedCount = 0;
    this.updatedCount = 0;
    this.failedCount = 0;
    this.currentOffset = 0;
    this.startTime = Date.now();
    this.isRunning = true;
    
    // Process failed accounts
    try {
      const accountQueue = [...failedAccounts];
      const workers = [];
      
      for (let i = 0; i < this.WORKER_COUNT; i++) {
        workers.push(this.retryWorker(i, accountQueue, rateLimiter));
      }
      
      await Promise.all(workers);
      
      // Complete job
      await this.complete();
      
    } catch (error) {
      console.error('❌ Retry failed accounts error:', error);
      
      if (this.currentJob) {
        await storage.updateBackfillJob(this.currentJob.id, {
          status: 'failed',
          errorMessage: (error as Error).message,
          processedAccounts: this.processedCount,
          updatedAccounts: this.updatedCount,
          failedAccounts: this.failedCount,
          completedAt: new Date()
        });
      }
      
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Worker for retry process
   */
  private async retryWorker(
    workerIndex: number,
    accountQueue: MemberHistory[],
    rateLimiter: RateLimiterManager
  ): Promise<void> {
    const apiKey = this.apiKeys[workerIndex % this.apiKeys.length];
    
    while (accountQueue.length > 0 && !this.abortController?.signal.aborted) {
      const account = accountQueue.shift();
      if (!account) break;
      
      try {
        await this.processAccount(account, apiKey);
      } catch (error) {
        console.error(`❌ Retry worker ${workerIndex} error processing ${account.phoneNumber}:`, error);
        this.failedCount++;
      }
      
      this.processedCount++;
      
      // Update progress every 10 accounts
      if (this.processedCount % 10 === 0) {
        await storage.updateBackfillJob(this.currentJob!.id, {
          currentPhone: account.phoneNumber,
          processedAccounts: this.processedCount,
          updatedAccounts: this.updatedCount,
          failedAccounts: this.failedCount
        });
      }
    }
  }
}
