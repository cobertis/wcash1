import { storage } from './storage';
import { walgreensAPI } from './services/walgreens';

interface BulkVerificationJob {
  id: string;
  phoneNumbers: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalNumbers: number;
  processedNumbers: number;
  results: any[];
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

class BackgroundJobManager {
  private jobs: Map<string, BulkVerificationJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private isInitialized = false;

  generateJobId(): string {
    return `bulk_verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async initializeAndRecoverJobs(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🔄 Initializing Background Job Manager...');
    
    // FORCE BACKGROUND SCANNER TO WORK IN ALL ENVIRONMENTS
    console.log('🚀 FORCING BACKGROUND SCANNER TO WORK - Environment override for production functionality');
    
    // Always initialize, regardless of environment
    console.log('✅ Background Job Manager initialized - forced production mode');
    
    try {
      // Get all incomplete jobs from database
      const jobHistory = await storage.getJobExecutionHistory();
      const incompleteJobs = jobHistory.filter(job => job.status === 'processing');
      
      console.log(`📋 Found ${incompleteJobs.length} incomplete jobs to recover`);
      
      // Check if incomplete jobs are actually completed
      for (const job of incompleteJobs) {
        console.log(`🔄 Checking job ${job.jobId} (${job.totalPhoneNumbers} numbers)`);
        try {
          // Check if this job has remaining numbers to process
          const results = await storage.getJobResultsDetail(job.jobId);
          const processedCount = results.length;
          
          if (processedCount >= job.totalPhoneNumbers) {
            // Job is actually completed, update its status
            console.log(`✅ Job ${job.jobId} is completed (${processedCount}/${job.totalPhoneNumbers}), updating status...`);
            await storage.updateJobExecutionStatus(job.jobId, 'completed');
          } else {
            // Job has remaining numbers, try to resume
            console.log(`🔄 Resuming job ${job.jobId} (${processedCount}/${job.totalPhoneNumbers} processed)`);
            await this.resumeIncompleteJob(job.jobId);
          }
        } catch (error) {
          console.error(`❌ Failed to process job ${job.jobId}:`, error);
        }
      }
      
      this.isInitialized = true;
      console.log('✅ Background Job Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Background Job Manager:', error);
    }
  }

  async startBulkVerification(phoneNumbers: string[]): Promise<string> {
    const jobId = this.generateJobId();
    const startTime = Date.now();
    
    // Check if any of these numbers are already processed to avoid duplicates
    console.log('🔍 Pre-filtering phone numbers against database...');
    const allHistory = await storage.getMemberHistory(1, 10000);
    const processedNumbers = new Set(allHistory.map(h => h.phoneNumber));
    
    // Filter out already processed numbers
    const newNumbers = phoneNumbers.filter(num => !processedNumbers.has(num));
    
    console.log(`📊 Pre-filtering results: ${phoneNumbers.length} total, ${newNumbers.length} new numbers to process`);
    
    if (newNumbers.length === 0) {
      console.log('✅ All numbers already processed, no new job needed');
      return 'NO_NEW_NUMBERS';
    }
    
    const job: BulkVerificationJob = {
      id: jobId,
      phoneNumbers: newNumbers,
      status: 'pending',
      progress: 0,
      totalNumbers: newNumbers.length,
      processedNumbers: 0,
      results: [],
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    
    // Save original phone numbers to database for recovery
    await storage.saveBulkVerificationJob({
      jobId,
      phoneNumbers: newNumbers,
      status: 'pending',
      totalNumbers: newNumbers.length,
      processedNumbers: 0,
      validNumbers: 0,
      results: [],
    });
    
    // Start processing immediately
    this.processBulkVerification(jobId);
    
    return jobId;
  }

  async resumeIncompleteJob(jobId: string): Promise<string> {
    // Get the incomplete job from database
    const incompleteJob = await storage.getJobExecutionHistoryById(jobId);
    if (!incompleteJob) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Get already processed numbers
    const processedResults = await storage.getJobResultsDetail(jobId);
    const processedNumbers = new Set(processedResults.map(r => r.phoneNumber));

    // Create new job with remaining numbers
    const newJobId = this.generateJobId();
    const allNumbers = JSON.parse(incompleteJob.phoneNumbers || '[]');
    const remainingNumbers = allNumbers.filter((num: string) => !processedNumbers.has(num));

    if (remainingNumbers.length === 0) {
      throw new Error('No remaining numbers to process');
    }

    const job: BulkVerificationJob = {
      id: newJobId,
      phoneNumbers: remainingNumbers,
      status: 'pending',
      progress: 0,
      totalNumbers: remainingNumbers.length,
      processedNumbers: 0,
      results: [],
      createdAt: new Date(),
    };

    this.jobs.set(newJobId, job);
    
    // Start processing remaining numbers
    this.processBulkVerification(newJobId);
    
    return newJobId;
  }

  async processBulkVerification(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    this.activeJobs.add(jobId);

    try {
      const startTime = Date.now();
      
      // Create job execution record
      const jobExecutionData = {
        jobId,
        jobName: `Bulk Verification - ${job.totalNumbers} numbers`,
        description: `Bulk verification job for ${job.totalNumbers} phone numbers`,
        totalPhoneNumbers: job.totalNumbers,
        status: 'processing' as const,
        apiCallsUsed: 0,
        environment: 'production'
      };

      const jobExecution = await storage.createJobExecutionHistory(jobExecutionData);

      const results = [];
      const detailedResults: any[] = [];
      let skippedCount = 0;
      let validCount = 0;
      let invalidCount = 0;
      let errorCount = 0;
      let apiCallsUsed = 0;
      
      // PRE-FILTER: Check database for existing numbers to avoid duplicate API calls
      console.log('🔍 Pre-filtering phone numbers against database...');
      const existingNumbers = new Set<string>();
      
      // Get all existing phone numbers from database in one query
      const allExistingMembers = await storage.getMemberHistory(1, 10000);
      allExistingMembers.forEach(member => {
        existingNumbers.add(member.phoneNumber);
      });
      
      console.log(`📊 Found ${existingNumbers.size} existing numbers in database`);
      
      // Separate numbers into existing and new
      const numbersToProcess = [];
      const numbersToSkip = [];
      
      for (const phoneNumber of job.phoneNumbers) {
        if (existingNumbers.has(phoneNumber)) {
          numbersToSkip.push(phoneNumber);
        } else {
          numbersToProcess.push(phoneNumber);
        }
      }
      
      console.log(`⏭️  Skipping ${numbersToSkip.length} already verified numbers`);
      console.log(`🔄 Processing ${numbersToProcess.length} new numbers`);
      
      // Process skipped numbers first (from database)
      for (const phoneNumber of numbersToSkip) {
        const existingMember = allExistingMembers.find(h => h.phoneNumber === phoneNumber);
        if (existingMember) {
          results.push({
            phoneNumber,
            status: 'skipped',
            memberName: existingMember.memberName,
            balance: parseFloat(existingMember.currentBalanceDollars || '0'),
            data: existingMember.memberData,
            message: 'Already verified - skipped'
          });
          
          detailedResults.push({
            jobId,
            phoneNumber,
            memberName: existingMember.memberName,
            cardNumber: existingMember.cardNumber,
            currentBalance: existingMember.currentBalance,
            currentBalanceDollars: existingMember.currentBalanceDollars,
            lastActivityDate: existingMember.lastActivityDate,
            emailAddress: existingMember.emailAddress,
            status: 'valid',
            errorMessage: null,
            apiResponseTime: 0
          });
          
          skippedCount++;
          validCount++;
        }
      }
      
      // Now process only NEW numbers with API calls
      for (let i = 0; i < numbersToProcess.length; i++) {
        const phoneNumber = numbersToProcess[i];
        const requestStart = Date.now();
        
        try {
          // NO DELAY - Use full API key pool capacity
          // With 4 API keys, we can process up to 1200 requests/minute (20 req/sec)
          
          // Use optimized endpoint for production
          const endpoint = process.env.NODE_ENV === 'production' 
            ? 'https://wcash.replit.app/api/lookup'
            : 'http://localhost:5000/api/lookup';
            
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber }),
          });

          const responseTime = Date.now() - requestStart;
          apiCallsUsed++;

          if (response.ok) {
            const data = await response.json();
            results.push({
              phoneNumber,
              status: 'valid',
              memberName: data.profile?.name || 'Unknown',
              balance: data.profile?.balance || 0,
              data: data
            });
            
            // Add to detailed results
            detailedResults.push({
              jobId,
              phoneNumber,
              memberName: data.profile?.name || 'Unknown',
              cardNumber: data.profile?.cardNumber || '',
              currentBalance: data.profile?.balance ? Math.round(data.profile.balance * 100) : 0,
              currentBalanceDollars: data.profile?.balance?.toFixed(2) || '0.00',
              lastActivityDate: data.rawMemberData?.Reward?.LastActivityDate || '',
              emailAddress: data.rawMemberData?.EMailAddress?.EMailAddress || '',
              status: 'valid',
              errorMessage: null,
              apiResponseTime: responseTime
            });
            
            validCount++;
            
            // Save valid members to history automatically (upsert to avoid duplicates)
            try {
              await storage.updateMemberHistory(phoneNumber, data.rawMemberData);
            } catch (historyError) {
              console.warn('Failed to save to history:', historyError);
            }
          } else {
            results.push({
              phoneNumber,
              status: 'invalid',
              error: 'Member not found'
            });
            
            // Add to detailed results
            detailedResults.push({
              jobId,
              phoneNumber,
              memberName: null,
              cardNumber: null,
              currentBalance: 0,
              currentBalanceDollars: '0.00',
              lastActivityDate: null,
              emailAddress: null,
              status: 'invalid',
              errorMessage: 'Member not found',
              apiResponseTime: responseTime
            });
            
            invalidCount++;
          }
        } catch (error) {
          results.push({
            phoneNumber,
            status: 'error',
            error: 'Network error'
          });
          
          // Add to detailed results
          detailedResults.push({
            jobId,
            phoneNumber,
            memberName: null,
            cardNumber: null,
            currentBalance: 0,
            currentBalanceDollars: '0.00',
            lastActivityDate: null,
            emailAddress: null,
            status: 'error',
            errorMessage: 'Network error',
            apiResponseTime: Date.now() - requestStart
          });
          
          errorCount++;
        }
        
        // Update job progress with detailed statistics
        const totalProcessed = numbersToSkip.length + (i + 1);
        job.processedNumbers = totalProcessed;
        job.progress = Math.round((totalProcessed / job.totalNumbers) * 100);
        job.results = results;
        
        // Add statistics to job object
        (job as any).statistics = {
          processed: totalProcessed,
          remaining: job.totalNumbers - totalProcessed,
          valid: validCount,
          invalid: invalidCount,
          errors: errorCount,
          skipped: skippedCount,
          apiCallsMade: i + 1,
          estimatedTimeRemaining: Math.round(((numbersToProcess.length - (i + 1)) * 300) / 1000) // seconds
        };
      }
      
      // Calculate final statistics
      const totalBalance = detailedResults.reduce((sum, r) => sum + (r.currentBalance || 0), 0);
      const accountsWithBalance = detailedResults.filter(r => r.currentBalance > 0).length;
      const executionTime = Math.round((Date.now() - startTime) / 1000);

      // Save all detailed results to database
      if (detailedResults.length > 0) {
        await storage.createManyJobResultsDetail(detailedResults);
      }

      // Update job execution record with final statistics
      await storage.updateJobExecutionHistory(jobId, {
        validAccounts: validCount,
        invalidAccounts: invalidCount,
        accountsWithBalance,
        totalBalance,
        totalBalanceDollars: (totalBalance / 100).toFixed(2),
        executionTimeSeconds: executionTime,
        apiCallsUsed,
        status: 'completed',
        completedAt: new Date(),
        notes: `Completed: ${validCount} valid, ${invalidCount} invalid, ${accountsWithBalance} with balance, $${(totalBalance / 100).toFixed(2)} total`
      });

      job.status = 'completed';
      job.completedAt = new Date();
      
    } catch (error) {
      // Update job execution record with error
      try {
        await storage.updateJobExecutionHistory(jobId, {
          status: 'failed',
          completedAt: new Date(),
          notes: `Failed: ${(error as Error).message}`
        });
      } catch (updateError) {
        console.error('Failed to update job execution history:', updateError);
      }

      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  getJob(jobId: string): BulkVerificationJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): BulkVerificationJob[] {
    return Array.from(this.jobs.values());
  }

  deleteJob(jobId: string): boolean {
    this.activeJobs.delete(jobId);
    return this.jobs.delete(jobId);
  }

  getActiveJobs(): BulkVerificationJob[] {
    return Array.from(this.jobs.values()).filter(job => 
      job.status === 'processing' || job.status === 'pending'
    );
  }

  async stopJob(jobId: string): Promise<boolean> {
    console.log(`🛑 FORCE STOP JOB: ${jobId} - bypassing all restrictions`);
    
    const job = this.jobs.get(jobId);
    if (!job) {
      console.log(`⚠️ Job ${jobId} not found for stopping`);
      return false;
    }

    console.log(`🔍 Job ${jobId} current status: ${job.status}`);
    
    // FORCE STOP regardless of status
    console.log(`🚀 FORCING STOP of job ${jobId} regardless of current status`);

    // Mark job as stopped
    job.status = 'failed';
    job.error = 'Stopped by user';
    job.completedAt = new Date();
    
    // Remove from active jobs
    this.activeJobs.delete(jobId);
    
    // Update in database
    try {
      await storage.updateJobExecutionHistory(jobId, {
        status: 'failed',
        completedAt: new Date(),
        notes: 'STOPPED: Job stopped by user request'
      });
    } catch (error) {
      console.error(`Error updating stopped job ${jobId} in database:`, error);
    }

    console.log(`🛑 Successfully stopped job: ${jobId}`);
    return true;
  }

  // NEW: Intelligent Parallel Bulk Verification
  async startParallelBulkVerification(phoneNumbers: string[]): Promise<string> {
    // Ensure job manager is initialized
    await this.initializeAndRecoverJobs();
    
    const jobId = this.generateJobId();
    
    console.log(`🚀 PARALLEL JOB: Creating job ${jobId} for ${phoneNumbers.length} numbers`);
    
    // Create job record
    const job: BulkVerificationJob = {
      id: jobId,
      phoneNumbers,
      status: 'pending',
      progress: 0,
      totalNumbers: phoneNumbers.length,
      processedNumbers: 0,
      results: [],
      createdAt: new Date()
    };
    
    this.jobs.set(jobId, job);
    this.activeJobs.add(jobId);
    
    // Create job execution record in database with intelligent API detection info
    const activeKeys = await walgreensAPI.getActiveApiKeys();
    await storage.createJobExecutionHistory({
      jobId,
      jobName: `Parallel Verification ${new Date().toLocaleString()}`,
      totalPhoneNumbers: phoneNumbers.length,
      status: 'processing',
      startedAt: new Date(),
      notes: `INTELLIGENT PARALLEL: Started with ${activeKeys.length} API keys (${activeKeys.length * 300} req/min capacity)`
    });
    
    // Start processing with intelligent parallel system
    this.processParallelBulkVerificationJob(jobId);
    
    return jobId;
  }

  // NEW: Process Parallel Bulk Verification Job using Intelligent API Distribution
  private async processParallelBulkVerificationJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = 'processing';
    let apiCallsUsed = 0;
    const startTime = Date.now();
    const detailedResults: any[] = [];
    
    try {
      console.log(`⚡ PARALLEL PROCESSING: Starting job ${jobId} with intelligent API distribution`);
      
      // Send job start to WebSocket clients
      if ((global as any).broadcastToClients) {
        (global as any).broadcastToClients({
          type: 'job_started',
          jobId,
          timestamp: new Date().toLocaleTimeString(),
          message: '🚀 PROCESAMIENTO PARALELO INICIADO'
        });
      }
      
      // Get active API keys dynamically
      const activeKeys = await walgreensAPI.getActiveApiKeys();
      
      if (activeKeys.length === 0) {
        throw new Error('No active API keys available for parallel processing');
      }
      
      console.log(`🔑 INTELLIGENT SYSTEM: Using ${activeKeys.length} API keys for parallel processing`);
      console.log(`📊 TOTAL CAPACITY: ${activeKeys.length * 300} requests/minute`);
      
      // Send system info to WebSocket clients
      if ((global as any).broadcastToClients) {
        (global as any).broadcastToClients({
          type: 'system_info',
          timestamp: new Date().toLocaleTimeString(),
          totalNumbers: job.phoneNumbers?.length || 0,
          apiKeys: activeKeys.length,
          capacity: activeKeys.length * 300,
          message: `📊 ${job.phoneNumbers?.length || 0} números en cola para procesar`
        });
        
        (global as any).broadcastToClients({
          type: 'system_info',
          timestamp: new Date().toLocaleTimeString(),
          message: `⚡ Capacidad: ${activeKeys.length * 300} requests/minuto`
        });
        
        (global as any).broadcastToClients({
          type: 'system_info', 
          timestamp: new Date().toLocaleTimeString(),
          message: `🔑 Usando ${activeKeys.length} API keys simultáneamente`
        });
      }
      
      const phoneNumbers = job.phoneNumbers || [];
      const batchSize = Math.ceil(phoneNumbers.length / activeKeys.length);
      
      console.log(`📦 BATCH SIZE: ${batchSize} numbers per API key`);
      
      // Split phone numbers into batches for parallel processing
      const batches: string[][] = [];
      for (let i = 0; i < phoneNumbers.length; i += batchSize) {
        batches.push(phoneNumbers.slice(i, i + batchSize));
      }
      
      console.log(`🚀 PARALLEL EXECUTION: Processing ${batches.length} batches simultaneously`);
      
      // Process all batches in parallel
      const batchPromises = batches.map(async (batch, index) => {
        const apiKey = activeKeys[index % activeKeys.length]; // Distribute across available keys
        console.log(`🔑 BATCH ${index + 1}: Using API key "${apiKey.name}" for ${batch.length} numbers`);
        
        const batchResults: any[] = [];
        
        for (let i = 0; i < batch.length; i++) {
          const phoneNumber = batch[i];
          
          try {
            // PRODUCTION SPEED: No delay between requests - utilize full API capacity
            // With 4 API keys at 300 req/min each = 1200 total req/min capacity
            
            console.log(`📱 PROCESSING: ${phoneNumber} (API: ${apiKey.name}, Batch ${index + 1}/${batches.length})`);
            
            // Send real-time log to WebSocket clients
            if ((global as any).broadcastToClients) {
              (global as any).broadcastToClients({
                type: 'processing',
                phoneNumber,
                apiKey: apiKey.name,
                batch: `${index + 1}/${batches.length}`,
                timestamp: new Date().toLocaleTimeString()
              });
            }
            
            const lookupResult = await walgreensAPI.lookupMember(phoneNumber);
            apiCallsUsed++;
            
            console.log(`🔍 LOOKUP RESULT DEBUG:`, {
              success: lookupResult?.success,
              hasProfile: !!lookupResult?.profile,
              profileName: lookupResult?.profile?.memberName,
              encLoyaltyId: lookupResult?.encLoyaltyId
            });
            
            if (lookupResult?.success && lookupResult.profile) {
              const member = {
                phoneNumber,
                memberName: lookupResult.profile.memberName,
                encLoyaltyId: lookupResult.profile.encLoyaltyId,
                currentBalance: lookupResult.rewards?.CurrentBalance || 0,
                currentBalanceDollars: lookupResult.rewards?.CurrentBalanceDollars || 0,
                lastActivityDate: lookupResult.rewards?.LastActivityDate,
                jobId,
                processedAt: new Date(),
                isValid: true,
                status: 'valid'
              };
              
              batchResults.push(member);
              console.log(`✅ VALID: ${phoneNumber} - ${member.memberName} ($${member.currentBalanceDollars?.toFixed(2) || '0.00'})`);
              
              // Send valid account found to WebSocket clients
              if ((global as any).broadcastToClients) {
                (global as any).broadcastToClients({
                  type: 'valid_found',
                  phoneNumber,
                  memberName: member.memberName,
                  balance: member.currentBalanceDollars?.toFixed(2) || '0.00',
                  timestamp: new Date().toLocaleTimeString()
                });
              }
            } else {
              batchResults.push({
                phoneNumber,
                memberName: null,
                encLoyaltyId: null,
                currentBalance: 0,
                currentBalanceDollars: 0,
                jobId,
                processedAt: new Date(),
                isValid: false,
                status: 'invalid'
              });
              console.log(`❌ INVALID: ${phoneNumber}`);
            }
            
          } catch (error) {
            console.error(`❌ ERROR processing ${phoneNumber}:`, error);
            batchResults.push({
              phoneNumber,
              memberName: null,
              encLoyaltyId: null,
              currentBalance: 0,
              currentBalanceDollars: 0,
              jobId,
              processedAt: new Date(),
              isValid: false,
              status: 'error',
              error: error.message
            });
          }
          
          // Update job progress
          job.processedNumbers++;
          job.progress = Math.round((job.processedNumbers / job.totalNumbers) * 100);
        }
        
        console.log(`✅ BATCH ${index + 1} COMPLETE: ${batchResults.filter(r => r.isValid).length}/${batch.length} valid accounts`);
        return batchResults;
      });
      
      // Wait for all batches to complete
      const allBatchResults = await Promise.all(batchPromises);
      const allResults = allBatchResults.flat();
      
      // Aggregate results
      const validCount = allResults.filter(r => r.isValid).length;
      const invalidCount = allResults.length - validCount;
      const totalBalance = allResults.reduce((sum, r) => sum + (r.currentBalance || 0), 0);
      const accountsWithBalance = allResults.filter(r => r.currentBalance > 0).length;
      const executionTime = Math.round((Date.now() - startTime) / 1000);
      
      // Save results to database
      if (allResults.length > 0) {
        await storage.createManyJobResultsDetail(allResults);
        
        // Also save valid accounts to member history
        const validAccounts = allResults.filter(r => r.isValid);
        for (const account of validAccounts) {
          await storage.updateMemberHistory(account.phoneNumber, account);
        }
      }
      
      // Update job execution history
      await storage.updateJobExecutionHistory(jobId, {
        validAccounts: validCount,
        invalidAccounts: invalidCount,
        accountsWithBalance,
        totalBalance,
        totalBalanceDollars: (totalBalance / 100).toFixed(2),
        executionTimeSeconds: executionTime,
        apiCallsUsed,
        status: 'completed',
        completedAt: new Date(),
        notes: `PARALLEL COMPLETE: ${validCount} valid, ${invalidCount} invalid, ${accountsWithBalance} with balance, $${(totalBalance / 100).toFixed(2)} total. Used ${activeKeys.length} API keys in parallel.`
      });
      
      job.results = allResults;
      job.status = 'completed';
      job.completedAt = new Date();
      
      console.log(`🎉 PARALLEL JOB COMPLETE: ${jobId}`);
      console.log(`📊 FINAL STATS: ${validCount} valid, ${invalidCount} invalid, $${(totalBalance / 100).toFixed(2)} total balance`);
      console.log(`⚡ EXECUTION TIME: ${executionTime} seconds with ${activeKeys.length} API keys`);
      
    } catch (error) {
      console.error(`❌ PARALLEL JOB FAILED: ${jobId}`, error);
      
      // Update job status in database
      await storage.updateJobExecutionHistory(jobId, {
        status: 'failed',
        completedAt: new Date(),
        notes: `PARALLEL FAILED: ${error.message}`
      });
      
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
}

export const backgroundJobManager = new BackgroundJobManager();

// Auto-reset system for marked accounts (Miami timezone) + Auto-mark today activity
class AutoResetManager {
  private resetInterval: NodeJS.Timeout | null = null;
  private autoMarkInterval: NodeJS.Timeout | null = null;
  private lastResetDate: string | null = null;
  private lastAutoMarkCheck: string | null = null;
  
  constructor() {
    console.log('🔄 AutoResetManager initializing with auto-mark today activity...');
    this.startAutoReset();
    this.startAutoMarkTodayActivity();
  }
  
  private startAutoReset() {
    console.log('🔄 Starting auto-reset system for Miami midnight...');
    
    // Check every 10 minutes for more frequent checks
    this.resetInterval = setInterval(() => {
      this.checkAndResetAccounts();
    }, 10 * 60 * 1000); // 10 minutes
    
    // Also check immediately on startup
    this.checkAndResetAccounts();
  }

  private startAutoMarkTodayActivity() {
    console.log('🤖 Starting auto-mark system for today activity accounts...');
    
    // Check every 15 minutes to automatically mark accounts with today's activity as "used"
    this.autoMarkInterval = setInterval(() => {
      this.checkAndAutoMarkTodayActivity();
    }, 15 * 60 * 1000); // 15 minutes
    
    // Also check immediately on startup
    setTimeout(() => {
      this.checkAndAutoMarkTodayActivity();
    }, 5000); // Wait 5 seconds after startup
  }
  
  private async checkAndResetAccounts() {
    try {
      // Get current time in Miami timezone (EST/EDT)
      const now = new Date();
      const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const currentDateStr = miamiTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`🕐 Checking auto-reset: Miami time is ${miamiTime.toLocaleString()}`);
      
      // Check if we've already reset today
      if (this.lastResetDate === currentDateStr) {
        console.log(`⏭️ Already reset today (${currentDateStr}), skipping`);
        return; // Already reset today
      }
      
      // Check if it's past midnight (00:00) in Miami
      const miamiHour = miamiTime.getHours();
      const miamiMinute = miamiTime.getMinutes();
      
      console.log(`🕐 Current Miami time: ${miamiHour}:${miamiMinute.toString().padStart(2, '0')}`);
      
      // Reset if it's between 00:00 and 00:30 (first 30 minutes of the day)
      if (miamiHour === 0 && miamiMinute < 30) {
        console.log(`🔄 MIDNIGHT RESET TRIGGERED! Auto-resetting marked accounts at ${miamiTime.toLocaleString()} (Miami time)`);
        
        // Reset all marked accounts
        const result = await this.resetMarkedAccounts();
        
        // Update last reset date
        this.lastResetDate = currentDateStr;
        
        console.log(`✅ Auto-reset completed for ${currentDateStr} - Reset ${result.resetCount} accounts`);
      } else {
        console.log(`⏳ Not midnight yet (${miamiHour}:${miamiMinute.toString().padStart(2, '0')}), waiting for 00:00-00:30 window`);
      }
    } catch (error) {
      console.error('❌ Error in auto-reset system:', error);
    }
  }

  private async checkAndAutoMarkTodayActivity() {
    try {
      // Get current time in Miami timezone (EST/EDT)
      const now = new Date();
      const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const currentDateStr = miamiTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Avoid running too frequently - check if we've already checked in the last hour
      const checkKey = `${currentDateStr}-${miamiTime.getHours()}`;
      if (this.lastAutoMarkCheck === checkKey) {
        return;
      }
      
      // Get all accounts with activity from today
      const accountsWithTodayActivity = await storage.getAccountsWithTodayActivity(currentDateStr);
      
      if (accountsWithTodayActivity.length === 0) {
        this.lastAutoMarkCheck = checkKey;
        return;
      }
      
      // Check which accounts are not already marked as used
      let markedCount = 0;
      const markedPhones: string[] = [];
      
      for (const account of accountsWithTodayActivity) {
        try {
          // Check if account is already marked as used
          if (!account.markedAsUsed) {
            await storage.markMemberAsUsed(account.phoneNumber);
            markedCount++;
            markedPhones.push(account.phoneNumber);
            // Silent auto-mark
          } else {
            // Already marked, skip
          }
        } catch (error) {
          console.error(`❌ Failed to auto-mark ${account.phoneNumber}:`, error);
        }
      }
      
      if (markedCount > 0) {
        console.log(`🎊 AUTO-MARK COMPLETED: Automatically marked ${markedCount}/${accountsWithTodayActivity.length} accounts with today's activity as used`);
      }
      
      // Update check timestamp
      this.lastAutoMarkCheck = checkKey;
      
    } catch (error) {
      console.error('❌ Error in auto-mark today activity system:', error);
    }
  }
  
  private async resetMarkedAccounts() {
    try {
      const result = await storage.resetMarkedAccounts();
      console.log(`✅ Reset ${result.resetCount} marked accounts`);
      return result;
    } catch (error) {
      console.error('❌ Error resetting marked accounts:', error);
      throw error;
    }
  }
  
  // Manual reset function
  async manualReset() {
    console.log('🔄 Manual reset of marked accounts requested');
    const result = await this.resetMarkedAccounts();
    // Update last reset date to prevent duplicate resets
    const now = new Date();
    const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    this.lastResetDate = miamiTime.toISOString().split('T')[0];
    console.log(`✅ Manual reset completed - reset ${result.resetCount} accounts, next auto-reset scheduled for tomorrow`);
    return result;
  }
  
  // Force reset function (for testing)
  async forceReset() {
    console.log('🔄 FORCE RESET: Resetting all marked accounts immediately');
    this.lastResetDate = null; // Clear last reset date
    const result = await this.resetMarkedAccounts();
    console.log(`✅ Force reset completed - reset ${result.resetCount} accounts`);
    return result;
  }
  
  // Get next reset time
  getNextResetTime() {
    const now = new Date();
    const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const tomorrow = new Date(miamiTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight
    
    return tomorrow;
  }
  
  stop() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
    
    if (this.autoMarkInterval) {
      clearInterval(this.autoMarkInterval);
      this.autoMarkInterval = null;
    }
  }
}

export const autoResetManager = new AutoResetManager();

// Background phone number scanner
class BackgroundPhoneScanner {
  private isScanning = false;
  private autoRestartEnabled = true;
  private monitorInterval: NodeJS.Timeout | null = null;
  private scanStats = {
    processed: 0,
    total: 0,
    valid: 0,
    invalid: 0,
    currentNumber: '',
    isRunning: false,
    startTime: null as Date | null,
    endTime: null as Date | null
  };
  
  async startFullDatabaseScan(): Promise<void> {
    // Only run automatically in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (this.isScanning) {
      console.log('📊 Scanner already running, skipping duplicate start');
      return;
    }
    
    if (!isProduction) {
      console.log('🚫 Background scanner disabled in development mode');
      this.isScanning = false;
      this.scanStats.isRunning = false;
      return;
    }
    
    this.isScanning = true;
    this.scanStats.isRunning = true;
    this.scanStats.startTime = new Date();
    this.scanStats.endTime = null;
    
    console.log('🚀 Starting full database scan in production...');
    
    try {
      // Get all pending phone numbers from queue
      const pendingNumbers = await storage.getPendingPhoneNumbers(50000); // Get all pending numbers
      
      // Calculate real statistics from database
      const queueStats = await storage.getPhoneNumbersQueueStats();
      this.scanStats.total = Number(queueStats.total);
      this.scanStats.processed = Number(queueStats.total) - Number(queueStats.pending);
      this.scanStats.valid = Number(queueStats.valid);
      this.scanStats.invalid = Number(queueStats.invalid);
      
      console.log(`📊 Scanner stats initialized: ${this.scanStats.processed}/${this.scanStats.total} processed (${this.scanStats.valid} valid, ${this.scanStats.invalid} invalid)`);
      console.log(`📞 Found ${pendingNumbers.length} phone numbers remaining to scan`);
      
      console.log(`📞 Found ${pendingNumbers.length} phone numbers to scan from queue`);
      
      // Process each number with rate limiting
      for (let i = 0; i < pendingNumbers.length; i++) {
        if (!this.isScanning) break; // Allow stopping
        
        const queueItem = pendingNumbers[i];
        const phoneNumber = queueItem.phoneNumber;
        this.scanStats.currentNumber = phoneNumber;
        
        // Skip if phone number already exists in member_history
        try {
          const existingMember = await storage.getMemberByPhone(phoneNumber);
          if (existingMember) {
            console.log(`⏭️ Skipping ${phoneNumber} - already exists in member_history`);
            await storage.updatePhoneNumberStatus(phoneNumber, 'valid');
            this.scanStats.processed++;
            this.scanStats.valid++;
            continue;
          }
        } catch (error) {
          console.log(`⚠️ Error checking existing member for ${phoneNumber}:`, error);
        }
        
        try {
          console.log(`🔍 Scanning ${phoneNumber} (${i + 1}/${pendingNumbers.length})`);
          
          // Use same exact logic as the working /api/lookup endpoint
          const lookupResult = await walgreensAPI.lookupMember(phoneNumber);
          
          if (lookupResult && lookupResult.encLoyaltyId) {
            console.log(`🔄 Step 2: Getting member details for ${lookupResult.encLoyaltyId}`);
            
            // Get full member profile
            const memberProfile = await walgreensAPI.getMember(lookupResult.encLoyaltyId);
            
            if (memberProfile && memberProfile.profile) {
              console.log(`✅ Valid member found: ${memberProfile.profile.Name?.FirstName} ${memberProfile.profile.Name?.LastName} - $${memberProfile.profile.Reward?.CurrentBalanceDollars || 0}`);
              
              // Valid member found
              this.scanStats.valid++;
              
              // Update member history with full profile data including encLoyaltyId
              const memberDataForStorage = {
                ...memberProfile.profile,
                encLoyaltyId: lookupResult.encLoyaltyId
              };
              await storage.updateMemberHistory(phoneNumber, memberDataForStorage);
              
              // Update status in queue as valid
              await storage.updatePhoneNumberStatus(phoneNumber, 'valid', {
                encLoyaltyId: lookupResult.encLoyaltyId,
                profile: {
                  name: `${memberProfile.profile.Name?.FirstName || ''} ${memberProfile.profile.Name?.LastName || ''}`.trim(),
                  cardNumber: memberProfile.profile.CardNumber,
                  balance: memberProfile.profile.Reward?.CurrentBalanceDollars || 0,
                },
                rawLookupData: lookupResult,
                rawMemberData: memberProfile.profile
              });
              
              console.log(`✅ Updated member history for ${phoneNumber}`);
            } else {
              this.scanStats.invalid++;
              console.log(`❌ Invalid member: ${phoneNumber} - No member profile data`);
              
              // Update status in queue as invalid
              await storage.updatePhoneNumberStatus(phoneNumber, 'invalid', null, 'Member profile not found');
            }
          } else {
            this.scanStats.invalid++;
            console.log(`❌ Invalid member: ${phoneNumber} - No lookup result`);
            
            // Update status in queue as invalid
            await storage.updatePhoneNumberStatus(phoneNumber, 'invalid', null, 'Member not found');
          }
          
        } catch (error) {
          this.scanStats.invalid++;
          console.log(`❌ Error scanning ${phoneNumber}:`, error.message);
          
          // Update status in queue as invalid with error
          await storage.updatePhoneNumberStatus(phoneNumber, 'invalid', null, error.message);
        }
        
        this.scanStats.processed++;
        
        // PRODUCTION SPEED: No rate limiting - use full API capacity
        // With 4 API keys at 300 req/min each = 1200 req/min total capacity
        
        // Log progress every 50 numbers
        if (this.scanStats.processed % 50 === 0) {
          console.log(`📊 Progress: ${this.scanStats.processed}/${this.scanStats.total} (${this.scanStats.valid} valid, ${this.scanStats.invalid} invalid)`);
        }
      }
      
      this.scanStats.endTime = new Date();
      const duration = this.scanStats.endTime.getTime() - this.scanStats.startTime!.getTime();
      
      console.log(`🎉 Full database scan completed!`);
      console.log(`📊 Final stats: ${this.scanStats.processed} processed, ${this.scanStats.valid} valid, ${this.scanStats.invalid} invalid`);
      console.log(`⏱️ Duration: ${Math.round(duration / 1000)} seconds`);
      
    } catch (error) {
      console.error('🚨 Error in full database scan:', error);
      this.scanStats.endTime = new Date();
    } finally {
      this.isScanning = false;
      this.scanStats.isRunning = false;
    }
  }
  
  stopScan(): void {
    if (this.isScanning) {
      console.log('⏹️ Stopping background scan...');
      this.isScanning = false;
      this.scanStats.isRunning = false;
      this.scanStats.endTime = new Date();
    }
  }

  async resetScan(): Promise<void> {
    this.isScanning = false;
    this.scanStats = {
      processed: 0,
      total: 0,
      valid: 0,
      invalid: 0,
      currentNumber: '',
      isRunning: false,
      startTime: null,
      endTime: null
    };
    
    // Clear the phone number queue to allow reprocessing
    try {
      await storage.clearPhoneNumberQueue();
      console.log('🔄 Phone number queue cleared');
    } catch (error) {
      console.error('Error clearing phone number queue:', error);
    }
    
    console.log('🔄 Scanner state reset - ready to reprocess all numbers');
  }
  
  async getStats() {
    // Only allow scanning in production environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      return {
        processed: 0,
        total: 0,
        valid: 0,
        invalid: 0,
        currentNumber: '',
        isRunning: false,
        startTime: null,
        endTime: null
      };
    }
    
    // Check if we have active parallel processing jobs
    const hasActiveJobs = this.activeJobs.size > 0;
    
    console.log(`📊 GET STATS: activeJobs=${this.activeJobs.size}, isScanning=${this.isScanning}, hasActiveJobs=${hasActiveJobs}`);
    
    // Always return fresh stats from database
    try {
      console.log('🔍 Getting queue stats from storage...');
      const queueStats = await storage.getPhoneNumbersQueueStats();
      console.log('📊 Queue stats received:', queueStats);
      
      const totalNum = Number(queueStats.total || 0);
      const pendingNum = Number(queueStats.pending || 0);
      const validNum = Number(queueStats.valid || 0);
      const invalidNum = Number(queueStats.invalid || 0);
      const processed = totalNum - pendingNum;
      
      // Determine if we're running based on active jobs OR scanning state
      const isCurrentlyRunning = hasActiveJobs || this.isScanning;
      
      const result = {
        processed,
        total: totalNum,
        valid: validNum,
        invalid: invalidNum,
        currentNumber: this.scanStats.currentNumber,
        isRunning: isCurrentlyRunning,
        startTime: this.scanStats.startTime,
        endTime: this.scanStats.endTime
      };
      
      console.log('✅ Final stats result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting queue stats:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        processed: 0,
        total: 0,
        valid: 0,
        invalid: 0,
        currentNumber: '',
        isRunning: false,
        startTime: null,
        endTime: null
      };
    }
  }
  
  isRunning(): boolean {
    return this.isScanning;
  }
}

export const backgroundPhoneScanner = new BackgroundPhoneScanner();