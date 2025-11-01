/**
 * Token Bucket Rate Limiter - Continuous Smooth Flow
 * 
 * Each API key uses a token bucket that refills continuously.
 * This prevents long pauses and maintains steady throughput.
 * 
 * Design:
 * - 250 requests per minute per API key (safe sustained throughput)
 * - Token bucket with 2 token capacity (prevents bursts)
 * - Starts with 0 tokens (anti-burst design)
 * - Refills at 1 token every 240ms (250/min = 1 token per 240ms)
 * - Workers never wait more than 240ms for a token
 * - Smooth, continuous flow without 60-second pauses
 * 
 * Benefits vs Fixed Window:
 * - No 60s pauses when limit reached
 * - Continuous steady flow
 * - Better utilization (96% capacity vs bursts + pauses)
 * - Predictable request timing
 */

interface TokenBucket {
  tokens: number;              // Current available tokens (0-2)
  capacity: number;            // Max tokens (2 to prevent bursts)
  refillRate: number;          // ms per token (240ms = ~250 req/min)
  lastRefill: number;          // Last refill timestamp
}

class ApiKeyTokenBucket {
  private bucket: TokenBucket;
  private readonly keyName: string;
  private totalRequests = 0;
  private totalWaitTime = 0;
  private requestCount = 0;
  
  // Real-time tracking for requests per minute
  private requestTimestamps: number[] = [];
  private lastMinuteReport = Date.now();

  constructor(keyName: string, requestsPerMinute: number = 250) {
    this.keyName = keyName;
    
    // Calculate refill rate: 60000ms / requestsPerMinute
    const refillRate = Math.floor(60000 / requestsPerMinute); // 240ms for 250 req/min
    
    this.bucket = {
      tokens: 0,              // START WITH ZERO (anti-burst)
      capacity: 2,            // Small capacity prevents bursts
      refillRate,             // 240ms per token
      lastRefill: Date.now()
    };
    
    console.log(`🪣 Token Bucket created for ${keyName}: ${requestsPerMinute} req/min (${refillRate}ms/token)`);
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.bucket.lastRefill;
    
    // Calculate how many tokens to add
    const tokensToAdd = Math.floor(elapsed / this.bucket.refillRate);
    
    if (tokensToAdd > 0) {
      this.bucket.tokens = Math.min(
        this.bucket.capacity,
        this.bucket.tokens + tokensToAdd
      );
      
      // Update last refill time (account for fractional tokens)
      this.bucket.lastRefill = now - (elapsed % this.bucket.refillRate);
    }
  }

  /**
   * Check if a token is available (non-blocking)
   */
  canAcquire(): boolean {
    this.refillTokens();
    return this.bucket.tokens >= 1;
  }

  /**
   * Acquire a token - waits if necessary (but never more than refillRate ms)
   */
  async acquire(): Promise<void> {
    const startTime = Date.now();
    
    while (true) {
      this.refillTokens();
      
      // If we have a token, consume it and proceed
      if (this.bucket.tokens >= 1) {
        this.bucket.tokens -= 1;
        this.totalRequests++;
        this.requestCount++;
        
        const now = Date.now();
        const waitTime = now - startTime;
        this.totalWaitTime += waitTime;
        
        // Track timestamp for req/min calculation
        this.requestTimestamps.push(now);
        
        // Clean up old timestamps (older than 60 seconds)
        const oneMinuteAgo = now - 60000;
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
        
        // Report real req/min every 60 seconds
        if (now - this.lastMinuteReport >= 60000) {
          const actualReqPerMin = this.requestTimestamps.length;
          const avgWait = Math.round(this.totalWaitTime / this.requestCount);
          console.log(`📊 ${this.keyName}: ${actualReqPerMin} req/min (actual), avg wait: ${avgWait}ms`);
          this.lastMinuteReport = now;
        }
        
        return;
      }
      
      // Calculate how long until next token is available
      const now = Date.now();
      const timeSinceLastRefill = now - this.bucket.lastRefill;
      const timeUntilNextToken = this.bucket.refillRate - timeSinceLastRefill;
      
      // Wait for next token (with small buffer)
      const waitMs = Math.max(10, timeUntilNextToken + 10);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  /**
   * Get actual requests per minute (last 60 seconds)
   */
  getActualReqPerMin(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    return this.requestTimestamps.length;
  }

  /**
   * Get current stats for monitoring
   */
  getStats() {
    this.refillTokens();
    
    const avgWait = this.requestCount > 0 
      ? Math.round(this.totalWaitTime / this.requestCount) 
      : 0;
    
    return {
      keyName: this.keyName,
      availableTokens: this.bucket.tokens.toFixed(2),
      capacity: this.bucket.capacity,
      refillRate: this.bucket.refillRate,
      totalRequests: this.totalRequests,
      requestCount: this.requestCount,
      avgWaitMs: avgWait,
      requestsPerMinute: Math.round(60000 / this.bucket.refillRate)
    };
  }

  /**
   * Reset stats (for monitoring/testing)
   */
  resetStats(): void {
    this.totalRequests = 0;
    this.totalWaitTime = 0;
    this.requestCount = 0;
  }
}

export class RateLimiterManager {
  private static instance: RateLimiterManager;
  private limiters = new Map<string, ApiKeyTokenBucket>();
  private maxRequestsPerMinute: number = 280;

  private constructor() {}

  static getInstance(): RateLimiterManager {
    if (!RateLimiterManager.instance) {
      RateLimiterManager.instance = new RateLimiterManager();
    }
    return RateLimiterManager.instance;
  }

  /**
   * Initialize rate limiters for all API keys
   */
  initialize(apiKeys: Array<{ name: string }>, maxRequestsPerMinute: number = 280) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.limiters.clear();
    for (const key of apiKeys) {
      this.limiters.set(key.name, new ApiKeyTokenBucket(key.name, maxRequestsPerMinute));
    }
    console.log(`🪣 Token Bucket Rate Limiter initialized with ${apiKeys.length} API keys`);
    console.log(`   Refill rate: ${maxRequestsPerMinute} req/min per key (${Math.floor(60000/maxRequestsPerMinute)}ms per token)`);
    console.log(`   Bucket capacity: 2 tokens (anti-burst)`);
    console.log(`   Initial tokens: 0 (prevents startup burst)`);
    console.log(`   Total capacity: ${apiKeys.length * maxRequestsPerMinute} req/min (${apiKeys.length} keys × ${maxRequestsPerMinute} req/min)`);
    console.log(`   ✅ Smooth continuous flow - NO 60-second pauses`);
  }

  /**
   * Check if a key can make a request without waiting
   */
  canAcquire(keyName: string): boolean {
    const limiter = this.limiters.get(keyName);
    if (!limiter) {
      throw new Error(`Rate limiter not found for key: ${keyName}`);
    }
    return limiter.canAcquire();
  }

  /**
   * Acquire permission to make a request (will wait if no tokens available)
   */
  async acquire(keyName: string): Promise<void> {
    const limiter = this.limiters.get(keyName);
    if (!limiter) {
      throw new Error(`Rate limiter not found for key: ${keyName}`);
    }
    return limiter.acquire();
  }

  /**
   * Get stats for all keys
   */
  getAllStats() {
    const stats: any[] = [];
    for (const limiter of Array.from(this.limiters.values())) {
      stats.push(limiter.getStats());
    }
    return stats;
  }

  /**
   * Get stats for a specific key
   */
  getKeyStats(keyName: string) {
    const limiter = this.limiters.get(keyName);
    if (!limiter) {
      throw new Error(`Rate limiter not found for key: ${keyName}`);
    }
    return limiter.getStats();
  }

  /**
   * Get actual requests per minute across all keys
   */
  getTotalActualReqPerMin(): number {
    let total = 0;
    for (const limiter of Array.from(this.limiters.values())) {
      total += limiter.getActualReqPerMin();
    }
    return total;
  }

  /**
   * Get detailed breakdown of actual req/min per key
   */
  getActualReqPerMinBreakdown(): { keyName: string; reqPerMin: number }[] {
    const breakdown: { keyName: string; reqPerMin: number }[] = [];
    for (const limiter of Array.from(this.limiters.values())) {
      const stats = limiter.getStats();
      breakdown.push({
        keyName: stats.keyName,
        reqPerMin: limiter.getActualReqPerMin()
      });
    }
    return breakdown;
  }

  /**
   * Reset all stats
   */
  resetAllStats(): void {
    for (const limiter of Array.from(this.limiters.values())) {
      limiter.resetStats();
    }
  }
}
