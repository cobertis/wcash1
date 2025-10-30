/**
 * Fixed Window Rate Limiter - Maximum Safe Throughput
 * 
 * Each API key can make up to 250 requests per minute (safe limit).
 * When the limit is reached, the key is paused until the next minute starts.
 * 
 * Design:
 * - 250 requests per minute per API key (stays below 300 limit for safety)
 * - Counters reset every minute (00 seconds)
 * - Automatic pause/resume when limit reached
 * - Scales automatically: N keys × 250 = total capacity
 * - Example: 4 keys × 250 = 1,000 req/min | 20 keys × 250 = 5,000 req/min
 */

interface RateLimitWindow {
  count: number;           // Requests made in current minute
  windowStart: number;     // Timestamp of current minute start
  maxRequests: number;     // 300 req/min limit
  isPaused: boolean;       // True when limit reached
}

class ApiKeyRateLimiter {
  private window: RateLimitWindow;
  private readonly keyName: string;
  private totalRequests = 0;
  private pauseCount = 0;

  constructor(keyName: string, maxRequests: number = 250) {
    this.keyName = keyName;
    const now = Date.now();
    this.window = {
      count: 0,
      windowStart: this.getMinuteStart(now),
      maxRequests,
      isPaused: false
    };
  }

  /**
   * Get the start of the current minute (seconds = 0)
   */
  private getMinuteStart(timestamp: number): number {
    const date = new Date(timestamp);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.getTime();
  }

  /**
   * Check if we're in a new minute and reset if needed
   */
  private checkAndResetWindow(): void {
    const now = Date.now();
    const currentMinuteStart = this.getMinuteStart(now);
    
    // If we're in a new minute, reset the counter
    if (currentMinuteStart > this.window.windowStart) {
      this.window.count = 0;
      this.window.windowStart = currentMinuteStart;
      this.window.isPaused = false;
    }
  }

  /**
   * Check if key can make a request (non-blocking)
   */
  canAcquire(): boolean {
    this.checkAndResetWindow();
    return this.window.count < this.window.maxRequests;
  }

  /**
   * Wait until we can make a request (blocking - waits for next minute if needed)
   */
  async acquire(): Promise<void> {
    while (true) {
      this.checkAndResetWindow();
      
      // If we haven't reached the limit, allow the request
      if (this.window.count < this.window.maxRequests) {
        this.window.count++;
        this.totalRequests++;
        return;
      }
      
      // We've reached the limit - pause until next minute
      if (!this.window.isPaused) {
        this.window.isPaused = true;
        this.pauseCount++;
        const nextMinute = this.window.windowStart + 60000;
        const waitMs = nextMinute - Date.now();
        console.log(`⏸️  API key ${this.keyName} reached ${this.window.maxRequests} req/min limit - pausing for ${Math.ceil(waitMs/1000)}s`);
      }
      
      // Calculate time until next minute
      const nextMinute = this.window.windowStart + 60000;
      const waitMs = Math.max(100, nextMinute - Date.now() + 100); // Add 100ms buffer
      
      // Wait until next minute
      await new Promise(resolve => setTimeout(resolve, waitMs));
      
      // Loop will re-check and reset window
    }
  }

  /**
   * Get current stats for monitoring
   */
  getStats() {
    this.checkAndResetWindow();
    return {
      keyName: this.keyName,
      currentCount: this.window.count,
      maxRequests: this.window.maxRequests,
      isPaused: this.window.isPaused,
      availableRequests: this.window.maxRequests - this.window.count,
      utilizationPercent: Math.round((this.window.count / this.window.maxRequests) * 100),
      totalRequests: this.totalRequests,
      pauseCount: this.pauseCount,
      windowResetIn: Math.ceil((this.window.windowStart + 60000 - Date.now()) / 1000)
    };
  }

  /**
   * Reset stats (for monitoring/testing)
   */
  resetStats(): void {
    this.totalRequests = 0;
    this.pauseCount = 0;
  }
}

export class RateLimiterManager {
  private static instance: RateLimiterManager;
  private limiters = new Map<string, ApiKeyRateLimiter>();
  private maxRequestsPerMinute: number = 250;

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
  initialize(apiKeys: Array<{ name: string }>, maxRequestsPerMinute: number = 250) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.limiters.clear();
    for (const key of apiKeys) {
      this.limiters.set(key.name, new ApiKeyRateLimiter(key.name, maxRequestsPerMinute));
    }
    console.log(`🚦 Fixed Window Rate Limiter initialized with ${apiKeys.length} API keys`);
    console.log(`   Max requests per key: ${maxRequestsPerMinute} req/min`);
    console.log(`   Auto-pause when limit reached, auto-resume next minute`);
    console.log(`   Total capacity: ${apiKeys.length * maxRequestsPerMinute} req/min (${apiKeys.length} keys × ${maxRequestsPerMinute} req/min)`);
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
   * Acquire permission to make a request (will wait if limit reached)
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
   * Reset all stats
   */
  resetAllStats(): void {
    for (const limiter of Array.from(this.limiters.values())) {
      limiter.resetStats();
    }
  }
}
