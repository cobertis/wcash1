import { storage } from './storage';
import { walgreensAPI } from './services/walgreens';

interface ParallelBulkVerificationJob {
  id: string;
  phoneNumbers: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalNumbers: number;
  processedNumbers: number;
  validNumbers: number;
  invalidNumbers: number;
  results: any[];
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

class ParallelBulkVerificationManager {
  private jobs: Map<string, ParallelBulkVerificationJob> = new Map();
  private activeJobs: Set<string> = new Set();

  generateJobId(): string {
    return `parallel_bulk_verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async startParallelBulkVerification(phoneNumbers: string[]): Promise<string> {
    const jobId = this.generateJobId();
    const startTime = Date.now();
    
    // INTELLIGENT API DETECTION: Automatically detect available API keys
    const availableApiKeys = await walgreensAPI.getActiveApiKeys();
    const totalApiKeys = availableApiKeys.length;
    const maxRequestsPerMinute = totalApiKeys * 300; // 300 requests per minute per API key
    const maxRequestsPerSecond = Math.floor(maxRequestsPerMinute / 60);
    
    console.log(`🚀 INTELLIGENT PARALLEL SYSTEM: Starting with ${phoneNumbers.length} numbers`);
    console.log(`🔑 API Keys Detected: ${totalApiKeys} active keys`);
    console.log(`⚡ Maximum Capacity: ${maxRequestsPerMinute} requests/minute (${maxRequestsPerSecond} req/sec)`);
    console.log(`🎯 Optimal Batch Size: ${totalApiKeys} simultaneous requests`);
    
    // Check if any of these numbers are already processed to avoid duplicates
    console.log('🔍 Pre-filtering phone numbers against database...');
    const allHistory = await storage.getMemberHistory(1, 100000);
    const processedNumbers = new Set(allHistory.map(h => h.phoneNumber));
    
    // Filter out already processed numbers
    const newNumbers = phoneNumbers.filter(num => !processedNumbers.has(num));
    
    console.log(`📊 Pre-filtering results: ${phoneNumbers.length} total, ${newNumbers.length} new numbers to process`);
    
    if (newNumbers.length === 0) {
      console.log('✅ All numbers already processed, no new job needed');
      return 'NO_NEW_NUMBERS';
    }
    
    const job: ParallelBulkVerificationJob = {
      id: jobId,
      phoneNumbers: newNumbers,
      status: 'pending',
      progress: 0,
      totalNumbers: newNumbers.length,
      processedNumbers: 0,
      validNumbers: 0,
      invalidNumbers: 0,
      results: [],
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    
    // Save job to database
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
    this.processParallelBulkVerification(jobId);
    
    return jobId;
  }

  async processParallelBulkVerification(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    this.activeJobs.add(jobId);

    try {
      const startTime = Date.now();
      
      // Create job execution record
      const jobExecutionData = {
        jobId,
        jobName: `Parallel Bulk Verification - ${job.totalNumbers} numbers`,
        description: `High-speed parallel verification using 4 API keys for ${job.totalNumbers} phone numbers`,
        totalPhoneNumbers: job.totalNumbers,
        status: 'processing' as const,
        apiCallsUsed: 0,
        environment: 'production'
      };

      await storage.createJobExecutionHistory(jobExecutionData);

      const results = [];
      const detailedResults: any[] = [];
      let validCount = 0;
      let invalidCount = 0;
      let errorCount = 0;
      let apiCallsUsed = 0;
      
      // INTELLIGENT PARALLEL PROCESSING: Maximum speed optimization
      const availableApiKeys = await apiKeyPool.getActiveApiKeys();
      const BATCH_SIZE = availableApiKeys.length; // Dynamic batch size = number of API keys (4)
      const maxRequestsPerMinute = BATCH_SIZE * 300; // 4 x 300 = 1200 req/min
      const maxRequestsPerSecond = maxRequestsPerMinute / 60; // 1200 ÷ 60 = 20 req/sec
      
      // MAXIMUM SPEED CALCULATION:
      // - 4 APIs simultáneas = 4 requests paralelas por batch
      // - Cada API: 300 req/min = 5 req/sec máximo por API
      // - Total: 20 req/sec = 1 batch cada 200ms para velocidad máxima
      const optimalDelayBetweenBatches = Math.max(200, Math.floor(1000 / (maxRequestsPerSecond / BATCH_SIZE))); // 200ms para máxima velocidad
      
      console.log(`🚀 MAXIMUM SPEED PARALLEL PROCESSING: Processing ${job.phoneNumbers.length} numbers`);
      console.log(`🔑 Active API Keys: ${BATCH_SIZE} keys detected`);
      console.log(`⚡ MAXIMUM THROUGHPUT: ${maxRequestsPerMinute} requests/minute (${maxRequestsPerSecond} req/sec)`);
      console.log(`🎯 Batch Size: ${BATCH_SIZE} simultaneous requests`);
      console.log(`⚡ MAXIMUM SPEED DELAY: ${optimalDelayBetweenBatches}ms between batches (cada API: ${300/60} req/sec)`);
      console.log(`🏆 SPEED OPTIMIZATION: Procesando a ${Math.round(maxRequestsPerSecond * 60)} requests/minuto - VELOCIDAD MÁXIMA`);
      const batches = [];
      
      // Split numbers into batches
      for (let i = 0; i < job.phoneNumbers.length; i += BATCH_SIZE) {
        batches.push(job.phoneNumbers.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`📦 INTELLIGENT BATCHING: Split into ${batches.length} batches of ${BATCH_SIZE} numbers each`);
      console.log(`🔑 API KEY DISTRIBUTION: Each batch uses different API keys automatically`);
      console.log(`💯 PERFECT LOAD BALANCING: ${Math.ceil(job.phoneNumbers.length / 4)} requests per API key máximo`);
      console.log(`🚀 Expected Processing Time: ~${Math.round(batches.length * optimalDelayBetweenBatches / 1000)} seconds`);
      
      // Process each batch in parallel
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();
        
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} numbers)`);
        
        // Process all numbers in this batch simultaneously with explicit API key distribution
        const batchPromises = batch.map(async (phoneNumber, index) => {
          const requestStart = Date.now();
          
          try {
            // EXPLICIT API KEY DISTRIBUTION: Each request in batch uses different API key
            // The walgreensAPI.lookupMember() automatically selects lowest-count API key
            // ensuring perfect distribution across all 4 API keys
            console.log(`🔑 Processing ${phoneNumber} (batch ${batchIndex + 1}, request ${index + 1}/${batch.length})`);
            
            const memberData = await walgreensAPI.lookupMember(phoneNumber);
            const responseTime = Date.now() - requestStart;
            apiCallsUsed++;
            
            console.log(`⚡ ${phoneNumber} processed in ${responseTime}ms`);
            
            if (memberData && memberData.profile) {
              results.push({
                phoneNumber,
                status: 'valid',
                memberName: memberData.profile.name || 'Unknown',
                balance: memberData.profile.balance || 0,
                data: memberData
              });
              
              detailedResults.push({
                jobId,
                phoneNumber,
                memberName: memberData.profile.name || 'Unknown',
                cardNumber: memberData.profile.cardNumber || '',
                currentBalance: memberData.profile.balance ? Math.round(memberData.profile.balance * 100) : 0,
                currentBalanceDollars: memberData.profile.balance?.toFixed(2) || '0.00',
                lastActivityDate: memberData.rawMemberData?.Reward?.LastActivityDate || '',
                emailAddress: memberData.rawMemberData?.EMailAddress?.EMailAddress || '',
                status: 'valid',
                errorMessage: null,
                apiResponseTime: responseTime
              });
              
              validCount++;
              
              // Save to history AND broadcast real-time update
              try {
                await storage.updateMemberHistory(phoneNumber, memberData.rawMemberData);
                
                // CRITICAL: Send WebSocket update when NEW member is found
                if ((global as any).broadcastToClients) {
                  (global as any).broadcastToClients({
                    type: 'member_added',
                    timestamp: new Date().toLocaleTimeString(),
                    phoneNumber,
                    memberName: memberData.profile.name,
                    balance: memberData.profile.balance,
                    message: `✅ Nueva cuenta encontrada: ${memberData.profile.name} ($${memberData.profile.balance})`
                  });
                }
              } catch (historyError) {
                console.warn('Failed to save to history:', historyError);
              }
              
              console.log(`✅ Valid: ${phoneNumber} - ${memberData.profile.name} ($${memberData.profile.balance})`);
            } else {
              results.push({
                phoneNumber,
                status: 'invalid',
                message: 'No member found'
              });
              
              detailedResults.push({
                jobId,
                phoneNumber,
                memberName: null,
                cardNumber: '',
                currentBalance: 0,
                currentBalanceDollars: '0.00',
                lastActivityDate: '',
                emailAddress: '',
                status: 'invalid',
                errorMessage: 'No member found',
                apiResponseTime: responseTime
              });
              
              invalidCount++;
            }
          } catch (error) {
            console.error(`❌ Error processing ${phoneNumber}:`, error);
            const responseTime = Date.now() - requestStart;
            
            results.push({
              phoneNumber,
              status: 'error',
              message: (error as Error).message
            });
            
            detailedResults.push({
              jobId,
              phoneNumber,
              memberName: null,
              cardNumber: '',
              currentBalance: 0,
              currentBalanceDollars: '0.00',
              lastActivityDate: '',
              emailAddress: '',
              status: 'error',
              errorMessage: (error as Error).message,
              apiResponseTime: responseTime
            });
            
            errorCount++;
          }
        });
        
        // Wait for all requests in this batch to complete
        await Promise.all(batchPromises);
        
        const batchTime = Date.now() - batchStartTime;
        const processedSoFar = (batchIndex + 1) * BATCH_SIZE;
        job.processedNumbers = Math.min(processedSoFar, job.totalNumbers);
        job.progress = (job.processedNumbers / job.totalNumbers) * 100;
        job.validNumbers = validCount;
        job.invalidNumbers = invalidCount;
        
        const currentThroughput = Math.round((BATCH_SIZE / (batchTime / 1000)) * 60); // requests per minute
        const totalElapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        const estimatedRemainingSeconds = Math.round((job.totalNumbers - job.processedNumbers) / (job.processedNumbers / totalElapsedSeconds));
        
        console.log(`⚡ Batch ${batchIndex + 1} completed in ${batchTime}ms - Progress: ${job.processedNumbers}/${job.totalNumbers} (${job.progress.toFixed(1)}%)`);
        console.log(`📊 Current Throughput: ${currentThroughput} requests/minute`);
        
        // Send real-time progress via WebSocket
        if ((global as any).broadcastToClients) {
          (global as any).broadcastToClients({
            type: 'scanner_progress',
            timestamp: new Date().toLocaleTimeString(),
            jobId,
            progress: Math.round(job.progress),
            processedNumbers: job.processedNumbers,
            totalNumbers: job.totalNumbers,
            validNumbers: validCount,
            invalidNumbers: invalidCount,
            currentThroughput,
            elapsedSeconds: totalElapsedSeconds,
            estimatedRemainingSeconds: estimatedRemainingSeconds > 0 ? estimatedRemainingSeconds : 0,
            message: `🔄 ${job.processedNumbers}/${job.totalNumbers} procesados (${Math.round(job.progress)}%) - ${validCount} válidas encontradas`
          });
        }
        
        // INTELLIGENT DELAY: Automatically calculated optimal delay based on API limits
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, optimalDelayBetweenBatches));
        }
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
        notes: `INTELLIGENT PARALLEL COMPLETED: ${validCount} valid, ${invalidCount} invalid, ${accountsWithBalance} with balance, $${(totalBalance / 100).toFixed(2)} total - APIs Used: ${BATCH_SIZE}, Speed: ${Math.round(job.totalNumbers / executionTime * 60)} numbers/minute`
      });

      job.status = 'completed';
      job.completedAt = new Date();
      job.results = results;
      
      console.log(`🎉 PARALLEL JOB COMPLETED: ${validCount} valid accounts found in ${executionTime} seconds`);
      console.log(`⚡ Average speed: ${Math.round(job.totalNumbers / executionTime * 60)} numbers per minute`);
      
      // Send completion notification via WebSocket
      if ((global as any).broadcastToClients) {
        (global as any).broadcastToClients({
          type: 'scanner_completed',
          timestamp: new Date().toLocaleTimeString(),
          jobId,
          totalProcessed: job.totalNumbers,
          validNumbers: validCount,
          invalidNumbers: invalidCount,
          executionTimeSeconds: executionTime,
          averageSpeed: Math.round(job.totalNumbers / executionTime * 60),
          totalBalance: (totalBalance / 100).toFixed(2),
          accountsWithBalance,
          message: `✅ COMPLETADO: ${validCount} cuentas válidas encontradas en ${executionTime}s (${Math.round(job.totalNumbers / executionTime * 60)} números/min)`
        });
      }
      
    } catch (error) {
      console.error('❌ Parallel bulk verification failed:', error);
      
      // Update job execution record with error
      try {
        await storage.updateJobExecutionHistory(jobId, {
          status: 'failed',
          completedAt: new Date(),
          notes: `PARALLEL FAILED: ${(error as Error).message}`
        });
      } catch (updateError) {
        console.error('Failed to update job execution history:', updateError);
      }

      job.status = 'failed';
      job.error = (error as Error).message;
      job.completedAt = new Date();
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  getJob(jobId: string): ParallelBulkVerificationJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ParallelBulkVerificationJob[] {
    return Array.from(this.jobs.values());
  }

  deleteJob(jobId: string): boolean {
    this.activeJobs.delete(jobId);
    return this.jobs.delete(jobId);
  }

  getActiveJobs(): ParallelBulkVerificationJob[] {
    return Array.from(this.jobs.values()).filter(job => 
      job.status === 'processing' || job.status === 'pending'
    );
  }

  async stopJob(jobId: string): Promise<boolean> {
    console.log(`🛑 FORCE STOP JOB: ${jobId} - bypassing all restrictions`);
    
    const job = this.jobs.get(jobId);
    if (!job) {
      console.log(`⚠️ Parallel job ${jobId} not found for stopping`);
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
        notes: 'STOPPED: Parallel job stopped by user request'
      });
    } catch (error) {
      console.error(`Error updating stopped parallel job ${jobId} in database:`, error);
    }

    console.log(`🛑 Successfully stopped parallel job: ${jobId}`);
    
    // Send stop notification via WebSocket
    if ((global as any).broadcastToClients) {
      (global as any).broadcastToClients({
        type: 'scanner_stopped',
        timestamp: new Date().toLocaleTimeString(),
        jobId,
        message: '⏹️ PROCESAMIENTO PARALELO DETENIDO POR USUARIO'
      });
    }
    
    return true;
  }
}

export const parallelBulkVerificationManager = new ParallelBulkVerificationManager();