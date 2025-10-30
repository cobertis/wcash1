import { storage } from '../storage';
import { walgreensAPI } from './walgreens';
import { db } from '../db';
import { scanFiles, scanQueue } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { RateLimiterManager } from './rate-limiter-manager';
import type { 
  ApiKeyPool, 
  ScanSession, 
  ScanQueue, 
  ScanFile, 
  InsertScanResult 
} from '@shared/schema';

// Progress interface for tracking scanner status
export interface ScanProgress {
  isScanning: boolean;
  currentSessionId?: number;
  totalPending: number;
  totalProcessed: number;
  totalValid: number;
  totalInvalid: number;
  apiKeysActive: number;
  requestsPerSecond: number;
  estimatedTimeRemaining?: number;
  lastProcessedNumbers?: string[];
  currentFileId?: number;
  errorCount?: number;
}

/**
 * Main Scanner Service - Singleton pattern
 */
export class ScannerService {
  private static instance: ScannerService;
  private isScanning: boolean = false;
  private abortController?: AbortController;
  private currentSession?: ScanSession;
  private apiKeys: ApiKeyPool[] = [];
  
  // Tracking variables
  private processedCount: number = 0;
  private validCount: number = 0;
  private invalidCount: number = 0;
  private errorCount: number = 0;
  private lastProcessedNumbers: string[] = [];
  private startTime?: number;
  private currentFileId?: number;
  private currentKeyIndex: number = 0; // Round-robin API key index

  // Progress update interval
  private progressUpdateInterval?: NodeJS.Timeout;
  
  // Watchdog timer for automatic recovery of stuck numbers
  private recoveryWatchdogInterval?: NodeJS.Timeout;
  
  // WebSocket clients for real-time updates
  private wsClients: Set<any> = new Set();

  private constructor() {
    // RateLimiterManager is a singleton, no initialization needed here
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  /**
   * Initialize service and recover any active session
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Scanner Service...');
    
    // Load API keys from database
    this.apiKeys = await storage.getAllApiKeys();
    console.log(`🔑 Loaded ${this.apiKeys.length} API keys for scanner`);
    
    // ✅ AUTO-RESUME: Complete recovery of ALL stuck states (BEFORE any workers start)
    // NOTE: This assumes SINGLE SERVER INSTANCE (Replit context). For multi-instance
    // deployments, would need distributed coordination (Redis locks, worker IDs, etc.)
    console.log('🔍 Scanning for stuck files and queue numbers...');
    
    // STEP 1: CRITICAL - Reset ALL queue numbers stuck in "processing" FIRST
    // This runs BEFORE any workers can start, preventing race conditions
    const stuckQueueNumbers = await db.update(scanQueue)
      .set({ 
        status: 'pending',
        scannedAt: null  // Clear lock metadata
      })
      .where(eq(scanQueue.status, 'processing'))
      .returning();
    
    if (stuckQueueNumbers.length > 0) {
      console.log(`♻️ Reset ${stuckQueueNumbers.length} queue numbers stuck in 'processing'`);
    }
    
    // STEP 2: Reset files stuck in "processing" + clear their metadata
    const stuckFiles = await db.select()
      .from(scanFiles)
      .where(eq(scanFiles.status, 'processing'));
    
    if (stuckFiles.length > 0) {
      console.log(`♻️ Found ${stuckFiles.length} files stuck in 'processing', resetting...`);
      
      for (const file of stuckFiles) {
        await db.update(scanFiles)
          .set({ 
            status: 'pending',
            processingStartedAt: null  // Clear lock metadata
          })
          .where(eq(scanFiles.id, file.id));
        
        console.log(`   ↺ Reset file: ${file.filename} (ID: ${file.id})`);
      }
      
      console.log(`✅ ${stuckFiles.length} files reset to 'pending'`);
    }
    
    console.log('✅ Recovery complete - all stuck items reset before workers start');
    
    // Start automatic recovery watchdog (runs every 2 minutes)
    this.startRecoveryWatchdog();
    
    // Check for active session
    const activeSession = await storage.getActiveScanSession();
    if (activeSession) {
      console.log(`📌 Found active session: ${activeSession.id}`);
      this.currentSession = activeSession;
      
      // Restore counters from session
      this.processedCount = activeSession.totalScanned || 0;
      this.validCount = activeSession.validFound || 0;
      this.invalidCount = activeSession.invalidFound || 0;
      
      // Auto-resume if it was active
      if (activeSession.status === 'active') {
        console.log('♻️ Auto-resuming previous scan session...');
        await this.start();
      }
    }
    
    console.log('✅ Scanner Service initialized successfully');
  }

  /**
   * Start automatic recovery watchdog
   * Runs every 2 minutes to detect and reset stuck numbers
   */
  private startRecoveryWatchdog(): void {
    // Clear any existing watchdog
    if (this.recoveryWatchdogInterval) {
      clearInterval(this.recoveryWatchdogInterval);
    }
    
    console.log('🐕 Starting automatic recovery watchdog (checks every 2 minutes)');
    
    // Run recovery check every 2 minutes (120000ms)
    this.recoveryWatchdogInterval = setInterval(async () => {
      await this.recoverStuckNumbers();
    }, 120000);
  }

  /**
   * Stop automatic recovery watchdog
   */
  private stopRecoveryWatchdog(): void {
    if (this.recoveryWatchdogInterval) {
      clearInterval(this.recoveryWatchdogInterval);
      this.recoveryWatchdogInterval = undefined;
      console.log('🐕 Stopped automatic recovery watchdog');
    }
  }

  /**
   * Recover stuck numbers - automatically reset numbers that have been
   * in 'processing' state for more than 5 minutes
   */
  private async recoverStuckNumbers(): Promise<void> {
    try {
      // Find numbers stuck in 'processing' for more than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const stuckNumbers = await db.execute(sql`
        UPDATE ${scanQueue}
        SET status = 'pending', processed_at = NULL
        WHERE status = 'processing' 
          AND processed_at < ${fiveMinutesAgo}
        RETURNING phone_number
      `);
      
      const resetCount = stuckNumbers.rows.length;
      
      if (resetCount > 0) {
        console.log(`🔧 WATCHDOG: Auto-recovered ${resetCount} stuck numbers (in 'processing' > 5 min)`);
      }
    } catch (error) {
      console.error('❌ Recovery watchdog error:', error);
    }
  }

  /**
   * Start scanning
   */
  async start(): Promise<void> {
    if (this.isScanning) {
      console.log('⚠️ Scanner is already running');
      return;
    }

    console.log('🟢 Starting scanner service...');
    
    // Initialize abort controller for clean stop
    this.abortController = new AbortController();
    
    // 🔧 RESET STUCK NUMBERS BEFORE STARTING (prevent blocking)
    // This ensures any numbers stuck in 'processing' from previous aborted scans are reset
    const stuckQueueNumbers = await db.update(scanQueue)
      .set({ 
        status: 'pending',
        scannedAt: null
      })
      .where(eq(scanQueue.status, 'processing'))
      .returning();
    
    if (stuckQueueNumbers.length > 0) {
      console.log(`♻️ Reset ${stuckQueueNumbers.length} stuck numbers before starting scanner`);
    }
    
    // Load/reload API keys and initialize RateLimiterManager
    this.apiKeys = await storage.getAllApiKeys();
    const rateLimiter = RateLimiterManager.getInstance();
    rateLimiter.initialize(this.apiKeys);
    console.log(`🔑 Initialized RateLimiterManager with ${this.apiKeys.length} API keys`);
    
    // Create or reuse session
    if (!this.currentSession) {
      this.currentSession = await storage.createScanSession();
      console.log(`📊 Created new scan session: ${this.currentSession.id}`);
    } else {
      // Update existing session to active
      await storage.updateScanSession(this.currentSession.id, { 
        status: 'active' 
      });
      console.log(`📊 Resumed scan session: ${this.currentSession.id}`);
    }
    
    // Reset counters for new session
    this.startTime = Date.now();
    this.isScanning = true;
    
    // Emit scanner started event
    this.sendWebSocketMessage({
      type: 'scanner:started',
      data: {
        sessionId: this.currentSession.id,
        timestamp: new Date().toISOString()
      }
    });
    
    // Start progress updater (every 5 seconds)
    this.startProgressUpdater();
    
    // Start the main scan loop
    this.scanLoop().catch(error => {
      console.error('❌ Scanner loop error:', error);
      this.stop();
    });
    
    console.log('✅ Scanner service started successfully');
  }

  /**
   * Stop scanning
   */
  async stop(): Promise<void> {
    if (!this.isScanning) {
      console.log('⚠️ Scanner is not running');
      return;
    }

    console.log('🔴 Stopping scanner service...');
    
    // Signal abort
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Stop progress updater
    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval);
      this.progressUpdateInterval = undefined;
    }
    
    // Update session status
    if (this.currentSession) {
      await storage.updateScanSession(this.currentSession.id, {
        status: 'completed',
        endTime: new Date(),
        totalScanned: this.processedCount,
        validFound: this.validCount,
        invalidFound: this.invalidCount
      });
      
      console.log(`📊 Session ${this.currentSession.id} completed:`, {
        totalScanned: this.processedCount,
        validFound: this.validCount,
        invalidFound: this.invalidCount,
        duration: this.startTime ? `${Math.round((Date.now() - this.startTime) / 1000)}s` : 'unknown'
      });
    }
    
    this.isScanning = false;
    
    // Emit scanner stopped event
    this.sendWebSocketMessage({
      type: 'scanner:stopped',
      data: {
        sessionId: this.currentSession?.id,
        totalScanned: this.processedCount,
        validFound: this.validCount,
        invalidFound: this.invalidCount,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Scanner service stopped successfully');
  }

  /**
   * Main scan loop - Worker Pool Architecture
   * Each worker is permanently assigned to ONE API key to prevent conflicts
   */
  private async scanLoop(): Promise<void> {
    console.log('🔄 Scanner loop started with Worker Pool architecture');
    
    const activeKeys = this.apiKeys.filter(k => k.isActive);
    const WORKERS_COUNT = activeKeys.length; // 1 worker per API key
    
    console.log(`🔧 Starting ${WORKERS_COUNT} workers (1 per API key)`);
    
    // Create worker promises - each worker processes numbers sequentially with its assigned key
    const workers = activeKeys.map((apiKeyConfig, workerIndex) => {
      return this.worker(workerIndex, apiKeyConfig);
    });
    
    // Wait for all workers to complete
    await Promise.allSettled(workers);
    
    console.log('🔄 Scanner loop ended - all workers completed');
  }

  /**
   * Worker function - processes numbers sequentially using ONE API key
   * This prevents multiple workers from using the same key simultaneously
   */
  private async worker(
    workerIndex: number, 
    apiKeyConfig: { name: string; apiKey: string; affId: string }
  ): Promise<void> {
    // CRITICAL: Universal 2s delay + staggered startup
    // Token bucket starts with 0 tokens and refills at 1.67 tokens/sec
    // ALL workers wait 2s base delay to let tokens accumulate (prevents Worker 0 burst)
    // Then add 500ms * workerIndex for smooth staggered distribution
    const baseDelay = 2000; // 2s for ALL workers (even Worker 0)
    const staggerDelay = workerIndex * 500; // Additional stagger between workers
    const totalDelay = baseDelay + staggerDelay;
    
    await new Promise(resolve => setTimeout(resolve, totalDelay));
    
    console.log(`👷 Worker ${workerIndex} started with key: ${apiKeyConfig.name}`);
    
    while (this.isScanning && !this.abortController?.signal.aborted) {
      try {
        // Get BATCH of numbers for this worker (reduces database calls)
        const BATCH_SIZE = 50; // Process 50 numbers before going back to DB
        console.log(`🔍 Worker ${workerIndex} (${apiKeyConfig.name}): Fetching ${BATCH_SIZE} numbers from queue...`);
        const pendingNumbers = await storage.getNextPendingNumbers(BATCH_SIZE);
        console.log(`📥 Worker ${workerIndex} (${apiKeyConfig.name}): Received ${pendingNumbers.length} numbers from queue`);
        
        if (pendingNumbers.length === 0) {
          // No more numbers to process
          console.log(`👷 Worker ${workerIndex} (${apiKeyConfig.name}): No more pending numbers`);
          break;
        }
        
        // Process each number in the batch sequentially
        for (const queueItem of pendingNumbers) {
          // Check if scanning was stopped mid-batch
          if (!this.isScanning || this.abortController?.signal.aborted) {
            break;
          }
          
          // Process this number with the assigned API key
          // Token bucket will handle rate limiting automatically
          await this.processNumber(queueItem, apiKeyConfig);
        }
        
      } catch (error) {
        console.error(`❌ Worker ${workerIndex} (${apiKeyConfig.name}) error:`, error);
        this.errorCount++;
        
        // Don't stop worker on individual errors, continue processing
        if (this.errorCount > 100) {
          console.error(`❌ Worker ${workerIndex}: Too many global errors, stopping`);
          break;
        }
      }
    }
    
    console.log(`👷 Worker ${workerIndex} (${apiKeyConfig.name}) stopped`);
  }

  /**
   * Get next API key in round-robin fashion
   */
  private getNextApiKey(): { name: string; apiKey: string; affId: string } {
    const activeKeys = this.apiKeys.filter(k => k.isActive);
    if (activeKeys.length === 0) {
      throw new Error('No active API keys available');
    }
    
    // TRUE round-robin: rotate through all keys
    const selectedKey = activeKeys[this.currentKeyIndex % activeKeys.length];
    this.currentKeyIndex++;
    
    // Reset index if it gets too large (prevent overflow)
    if (this.currentKeyIndex > 1000000) {
      this.currentKeyIndex = 0;
    }
    
    return {
      name: selectedKey.name,
      apiKey: selectedKey.apiKey,
      affId: selectedKey.affId
    };
  }

  /**
   * Process a single phone number with retry logic for 403 errors
   */
  private async processNumber(
    queueItem: ScanQueue, 
    apiKeyConfig: { name: string; apiKey: string; affId: string }
  ): Promise<void> {
    const phoneNumber = queueItem.phoneNumber;
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s exponential backoff
    
    let lastError: any = null;
    
    // Retry loop for 403 errors
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const retryInfo = attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '';
        console.log(`📞 Processing ${phoneNumber} with API key ${apiKeyConfig.name}${retryInfo}`);
        
        // OPTIMIZED: Reserve 1 token for lookup only
        // We'll acquire second token conditionally if account is valid
        const rateLimiter = RateLimiterManager.getInstance();
        await rateLimiter.acquire(apiKeyConfig.name); // 1 for lookup
        
        // Step 1: Lookup member
        const lookupResult = await walgreensAPI.lookupMember(
          phoneNumber, 
          apiKeyConfig.apiKey, 
          apiKeyConfig.affId,
          apiKeyConfig.name
        );
        
        if (!lookupResult || !lookupResult.matchProfiles || lookupResult.matchProfiles.length === 0) {
          // Permanent error - member not found (invalid number)
          // No need to acquire second token - saves capacity for valid accounts
          await storage.markNumberAsProcessed(
            phoneNumber, 
            'invalid', 
            { error: 'Member not found' },
            'MEMBER_NOT_FOUND',
            'Member not found in database',
            false // not retryable
          );
          this.invalidCount++;
          this.processedCount++;
          
          console.log(`❌ Invalid: ${phoneNumber} - Member not found`);
          return;
        }
        
        // Step 2: Account is valid - acquire second token for getMember
        await rateLimiter.acquire(apiKeyConfig.name); // 1 for getMember
        
        const profile = lookupResult.matchProfiles[0];
        const encLoyaltyId = profile.loyaltyMemberId;
        
        // Get full member details
        const memberDetails = await walgreensAPI.getMember(encLoyaltyId);
        
        // Step 3: Save to scan_results
        let currentBalance = 0;
        let currentBalanceDollars = '0.00';
        
        if (memberDetails.balance !== undefined && memberDetails.balance !== null) {
          const balanceStr = String(memberDetails.balance);
          currentBalance = parseInt(balanceStr.replace(/[^\d]/g, '') || '0');
          
          if (balanceStr.includes('$') || balanceStr.includes('.')) {
            currentBalanceDollars = balanceStr;
          } else {
            currentBalanceDollars = `${(currentBalance / 100).toFixed(2)}`;
          }
        }
        
        const memberDetailsAny = memberDetails as any;
        if (memberDetailsAny.CurrentBalanceDollars) {
          currentBalanceDollars = memberDetailsAny.CurrentBalanceDollars;
        }
        
        const scanResult: InsertScanResult = {
          phoneNumber,
          memberName: memberDetails.name || `${profile.firstName} ${profile.lastName}`.trim(),
          encLoyaltyId: encLoyaltyId,
          currentBalance: currentBalance,
          currentBalanceDollars: currentBalanceDollars,
          lastActivityDate: memberDetails.profile?.Reward?.LastActivityDate || null,
          fileId: queueItem.fileId || undefined,
          sessionId: this.currentSession?.id
        };
        
        await storage.addScanResult(scanResult);
        
        // Step 4: Mark as completed in queue
        await storage.markNumberAsProcessed(phoneNumber, 'completed', scanResult);
        
        this.validCount++;
        this.processedCount++;
        this.lastProcessedNumbers.push(phoneNumber);
        
        if (this.lastProcessedNumbers.length > 10) {
          this.lastProcessedNumbers.shift();
        }
        
        console.log(`✅ Valid: ${phoneNumber} - ${memberDetails.name || `${profile.firstName} ${profile.lastName}`.trim()} - $${currentBalanceDollars}`);
        
        // Emit WebSocket event for valid account found
        this.sendWebSocketMessage({
          type: 'scanner:valid_found',
          data: {
            phoneNumber: phoneNumber,
            memberName: memberDetails.name || `${profile.firstName} ${profile.lastName}`.trim(),
            balance: currentBalanceDollars,
            lastActivity: memberDetails.profile?.Reward?.LastActivityDate || null,
            timestamp: new Date().toISOString()
          }
        });
        
        // Update file progress if needed
        if (queueItem.fileId && this.processedCount % 10 === 0) {
          await this.updateFileProgress(queueItem.fileId);
        }
        
        // Success - exit retry loop
        return;
        
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const statusCode = error.statusCode || error.status;
        const is403 = statusCode === 403 || 
                      errorMessage.toLowerCase().includes('403') || 
                      errorMessage.toLowerCase().includes('rate limit') ||
                      errorMessage.toLowerCase().includes('forbidden');
        
        lastError = error;
        
        // If it's a 403 error and we have retries left, retry with exponential backoff
        if (is403 && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`⚠️  403 Rate limit for ${phoneNumber} - Retrying ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        }
        
        // If we've exhausted all retries or it's not a 403 error, handle the error
        console.error(`❌ Error processing ${phoneNumber} after ${attempt + 1} attempt(s):`, errorMessage);
        
        // Classify error as retryable or permanent
        const isRetryable = this.isRetryableError(error);
        const errorCode = this.getErrorCode(error);
        
        if (isRetryable) {
          // Retryable errors (403 after all retries, timeouts, network issues, etc.)
          // IMPORTANT: 403 errors are rate limiting, NOT invalid accounts
          await storage.markNumberAsProcessed(
            phoneNumber, 
            'error_retryable', 
            { error: errorMessage, attempts: attempt + 1 },
            errorCode,
            errorMessage,
            true // is retryable
          );
          console.log(`⚠️  Retryable error for ${phoneNumber} after ${attempt + 1} attempts: ${errorMessage}`);
        } else {
          // Permanent errors (invalid format, member not found, etc.)
          await storage.markNumberAsProcessed(
            phoneNumber, 
            'error_permanent', 
            { error: errorMessage },
            errorCode,
            errorMessage,
            false // not retryable
          );
          this.invalidCount++;
          console.log(`❌ Permanent error for ${phoneNumber}: ${errorMessage}`);
        }
        
        this.errorCount++;
        this.processedCount++;
        break; // Exit retry loop
      }
    }
  }
  
  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status;
    
    // 403 Forbidden - rate limit exceeded (retryable)
    if (statusCode === 403 || message.includes('403') || message.includes('forbidden')) {
      return true;
    }
    
    // Timeout errors (retryable)
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }
    
    // Network errors (retryable)
    if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
      return true;
    }
    
    // Service unavailable (retryable)
    if (statusCode === 503 || message.includes('service unavailable')) {
      return true;
    }
    
    // Too many requests (retryable)
    if (statusCode === 429 || message.includes('too many requests')) {
      return true;
    }
    
    // Default: not retryable
    return false;
  }
  
  /**
   * Get error code from error
   */
  private getErrorCode(error: any): string {
    const statusCode = error.statusCode || error.status;
    if (statusCode) {
      return `HTTP_${statusCode}`;
    }
    
    const message = error.message?.toLowerCase() || '';
    if (message.includes('forbidden') || message.includes('403')) return 'HTTP_403';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('network')) return 'NETWORK_ERROR';
    if (message.includes('member not found')) return 'MEMBER_NOT_FOUND';
    if (message.includes('invalid format')) return 'INVALID_FORMAT';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Update file progress
   */
  private async updateFileProgress(fileId: number): Promise<void> {
    try {
      const fileInfo = await storage.updateScanFileProgress(
        fileId,
        this.processedCount,
        this.validCount,
        this.invalidCount
      );
      
      // Check if file is completed
      // Note: getPendingNumbersForFile method not yet implemented in storage
      // TODO: Implement file-specific completion tracking
      // const pendingForFile = await storage.getPendingNumbersForFile(fileId);
      // if (pendingForFile === 0) {
      //   this.sendWebSocketMessage({
      //     type: 'scanner:file_completed',
      //     data: {
      //       fileId: fileId,
      //       totalProcessed: this.processedCount,
      //       validFound: this.validCount,
      //       invalidFound: this.invalidCount,
      //       timestamp: new Date().toISOString()
      //     }
      //   });
      //   console.log(`📁 File ${fileId} processing completed`);
      // }
    } catch (error) {
      console.error('Error updating file progress:', error);
    }
  }

  /**
   * Start progress updater
   */
  private startProgressUpdater(): void {
    // Update progress every 5 seconds
    this.progressUpdateInterval = setInterval(async () => {
      if (!this.isScanning || !this.currentSession) return;
      
      try {
        // Emit progress via WebSocket
        await this.emitProgress();
        
        // Calculate rate for logging
        const elapsed = (Date.now() - (this.startTime || Date.now())) / 1000;
        const rate = elapsed > 0 ? Math.round(this.processedCount / elapsed) : 0;
        
        // Update session
        await storage.updateScanSession(this.currentSession.id, {
          totalScanned: this.processedCount,
          validFound: this.validCount,
          invalidFound: this.invalidCount,
          ratePerSecond: rate
        });
        
        // Log progress
        console.log(`📊 Progress: ${this.processedCount} scanned, ${this.validCount} valid, ${this.invalidCount} invalid, ${rate} req/s`);
        
        // Log Token Bucket stats every 30 seconds (every 6th iteration)
        if (this.processedCount % 6 === 0) {
          const rateLimiter = RateLimiterManager.getInstance();
          const bucketStats = rateLimiter.getAllStats();
          console.log(`🪣 Token Bucket Stats:`);
          for (const stat of bucketStats) {
            console.log(`   ${stat.keyName}: ${stat.availableTokens}/${stat.capacity} tokens, ${stat.utilizationPercent}% used, ${stat.totalRequests} total requests`);
          }
        }
        
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }, 5000);
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): ScanProgress {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const rate = elapsed > 0 ? this.processedCount / elapsed : 0;
    const activeKeys = this.apiKeys.filter(k => k.isActive).length;
    
    return {
      isScanning: this.isScanning,
      currentSessionId: this.currentSession?.id,
      totalPending: 0, // Would need to query database
      totalProcessed: this.processedCount,
      totalValid: this.validCount,
      totalInvalid: this.invalidCount,
      apiKeysActive: activeKeys,
      requestsPerSecond: Math.round(rate * 10) / 10,
      lastProcessedNumbers: this.lastProcessedNumbers,
      currentFileId: this.currentFileId,
      errorCount: this.errorCount
    };
  }

  /**
   * Add numbers to scan queue
   */
  async addNumbersToQueue(phoneNumbers: string[], fileId?: number): Promise<{ added: number; skipped: number }> {
    console.log(`📥 Adding ${phoneNumbers.length} numbers to scan queue...`);
    
    this.currentFileId = fileId;
    const result = await storage.addNumbersToScanQueue(phoneNumbers, fileId);
    
    console.log(`✅ Added ${result.added} numbers, skipped ${result.skipped} duplicates`);
    return result;
  }

  /**
   * Get API key stats from RateLimiterManager
   */
  getApiKeyStats() {
    const rateLimiter = RateLimiterManager.getInstance();
    return rateLimiter.getAllStats();
  }

  /**
   * Get current scanner progress
   */
  private getProgress() {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const requestsPerSecond = elapsed > 0 ? Math.round((this.processedCount / elapsed) * 10) / 10 : 0;
    
    return {
      totalPending: 0, // Will be updated by database query
      totalProcessed: this.processedCount,
      totalValid: this.validCount,
      totalInvalid: this.invalidCount,
      requestsPerSecond: requestsPerSecond,
      apiKeysActive: this.apiKeys.filter(k => k.isActive).length
    };
  }

  /**
   * Add WebSocket client
   */
  addWebSocketClient(ws: any): void {
    this.wsClients.add(ws);
    console.log(`🔌 Added WebSocket client. Total clients: ${this.wsClients.size}`);
    
    // Send current status immediately to new client
    const progress = this.getProgress();
    this.sendWebSocketMessage({
      type: 'scanner:progress',
      data: {
        isScanning: this.isScanning,
        totalPending: progress.totalPending,
        totalProcessed: progress.totalProcessed,
        validFound: progress.totalValid,
        invalidFound: progress.totalInvalid,
        currentRate: progress.requestsPerSecond,
        apiKeysActive: progress.apiKeysActive
      }
    });
  }
  
  /**
   * Remove WebSocket client
   */
  removeWebSocketClient(ws: any): void {
    this.wsClients.delete(ws);
    console.log(`🔌 Removed WebSocket client. Total clients: ${this.wsClients.size}`);
  }
  
  /**
   * Send WebSocket message to all connected clients
   */
  private sendWebSocketMessage(message: any): void {
    const data = JSON.stringify(message);
    const deadClients: any[] = [];
    
    this.wsClients.forEach((ws: any) => {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(data);
        } else if (ws.readyState > 1) { // CLOSING or CLOSED
          deadClients.push(ws);
        }
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
        deadClients.push(ws);
      }
    });
    
    // Clean up dead clients
    deadClients.forEach(ws => this.wsClients.delete(ws));
  }
  
  /**
   * Emit WebSocket progress event
   */
  private async emitProgress(): Promise<void> {
    // Get current progress including pending count from database
    const pendingCount = await storage.getPendingCount();
    const activeKeys = this.apiKeys.filter(k => k.isActive).length;
    
    const rate = this.startTime ? 
      this.processedCount / ((Date.now() - this.startTime) / 1000) : 0;
    
    // Send WebSocket update
    this.sendWebSocketMessage({
      type: 'scanner:progress',
      data: {
        isScanning: this.isScanning,
        totalPending: pendingCount,
        totalProcessed: this.processedCount,
        validFound: this.validCount,
        invalidFound: this.invalidCount,
        currentRate: Math.round(rate * 10) / 10,
        apiKeysActive: activeKeys
      }
    });
    
    // Log progress every 100 records
    if (this.processedCount % 100 === 0) {
      console.log('📡 Scanner progress:', {
        processed: this.processedCount,
        valid: this.validCount,
        invalid: this.invalidCount,
        rate: `${Math.round(rate * 10) / 10} req/s`
      });
    }
  }
}

// Export singleton instance
export const scannerService = ScannerService.getInstance();