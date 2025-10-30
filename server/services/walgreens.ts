import { type Member, type Offer, type ClippedOffer, type RedeemedOffer } from "@shared/schema";
import { RateLimiterManager } from './rate-limiter-manager';
import { Agent } from 'https';
import { networkInterfaces } from 'os';

// Detect if we're running on production server with floating IP
function hasFloatingIP(): boolean {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (addrs) {
      for (const addr of addrs) {
        if (addr.address === '5.161.27.53') {
          return true;
        }
      }
    }
  }
  return false;
}

// Agent to bind requests to specific outbound IP (only if available)
const httpsAgent = new Agent({ 
  ...(hasFloatingIP() ? { localAddress: '5.161.27.53' } : {}),
  keepAlive: true,
  keepAliveMsecs: 30000
});

interface WalgreensAPIConfig {
  apiKey: string;
  affId: string;
  baseUrl: string;
}

interface APIKeyPool {
  apiKey: string;
  affId: string;
  requestCount: number;
  lastResetTime: number;
  isActive: boolean;
  name: string;
  lastTestResult?: {
    success: boolean;
    message: string;
    timestamp: string;
  };
}

interface WalgreensAPIResponse<T = any> {
  status: string;
  data?: T;
  error?: string;
  message?: string;
}

interface LookupMemberResponse {
  phoneNumber: string;
  messages: Array<{
    code: string;
    message: string;
    type: string;
  }>;
  matchProfiles: Array<{
    loyaltyMemberId: string;
    loyaltyCardNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    zipCode: string;
  }>;
}

interface MemberProfileResponse {
  CustomerType: string;
  MemberID: string;
  MemberStatus: string;
  MyWagDateTime: string;
  EMailAddress: {
    EMailAddress: string;
  };
  Name: {
    Prefix: string;
    FirstName: string;
    LastName: string;
    MiddleName: string;
    Suffix: string;
  };
  PhoneList: {
    Phone: Array<{
      AreaCode: string;
      Number: string;
      TypeCode: string;
    }>;
  };
  CardNumber: string;
  Reward: {
    CurrentBalance: number;
    CurrentBalanceDollars: string;
    RedemptionSchedule: Array<{
      AwardID: number;
      Amount: number;
      Points: number;
      Dollars: number;
    }>;
    LastActivityDate: string;
    SmartPrompt: boolean;
    ProjectedForfeitDate: string;
    RedemptionDisabled: boolean;
    LinkedAcctInd: boolean;
    RxThreshold: {
      ScriptsTo: number;
      PointsAwarded: number;
      DollarsAwarded: number;
    };
  };
  [key: string]: any;
}

interface OffersResponse {
  offers: any[];
  totalCount: number;
  page: number;
  size: number;
  message?: string;
}

interface ClipOfferResponse {
  success: boolean;
  message: string;
}

interface ErrorCode {
  code: string;
  type: 'ERROR' | 'INFO' | 'WARNING';
  message: string;
  userFriendlyMessage?: string;
}

interface OfferStats {
  totalSavings: number;
  clippedCount: number;
  redeemedCount: number;
  availableCount: number;
  popularCategories: Array<{
    category: string;
    count: number;
    avgSavings: number;
  }>;
}

interface FilterOptions {
  category?: string;
  minValue?: number;
  maxValue?: number;
  brand?: string;
  expiringBefore?: string;
  offerType?: string;
  sortBy?: 'value' | 'expiry' | 'brand' | 'category';
  sortOrder?: 'asc' | 'desc';
}

interface StoreSearchResponse {
  stores: Store[];
  totalCount: number;
  message?: string;
}

interface Store {
  storeNumber: string;
  storeName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  distance?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  hours: {
    [key: string]: string;
  };
  services: string[];
  isOpen: boolean;
  pharmacy?: {
    phone: string;
    hours: {
      [key: string]: string;
    };
  };
}

class WalgreensAPIService {
  private config: WalgreensAPIConfig;
  private offerCache: Map<string, { offers: any[], timestamp: number }> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private apiKeyPool: APIKeyPool[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 250; // Safe limit: 250/300 to stay below API rate limits
  private useMultipleKeys = false;
  private errorCodes: Map<string, ErrorCode> = new Map([
    ['WAG_E_LOYALTY_1041', { code: 'WAG_E_LOYALTY_1041', type: 'ERROR', message: 'Member not found in database', userFriendlyMessage: 'No pudimos encontrar tu membresía de myWalgreens' }],
    ['WAG_E_LOYALTY_1044', { code: 'WAG_E_LOYALTY_1044', type: 'ERROR', message: 'Invalid phone number format', userFriendlyMessage: 'Formato de número de teléfono inválido' }],
    ['WAG_E_SVC_UNAVAILABLE_1401', { code: 'WAG_E_SVC_UNAVAILABLE_1401', type: 'ERROR', message: 'Service unavailable', userFriendlyMessage: 'Servicio temporalmente no disponible' }],
    ['WAG_E_DO_4011', { code: 'WAG_E_DO_4011', type: 'ERROR', message: 'Internal service error', userFriendlyMessage: 'Error interno del servicio' }],
    ['WAG_E_DO_4020', { code: 'WAG_E_DO_4020', type: 'ERROR', message: 'Balance Rewards membership issue', userFriendlyMessage: 'Problema con tu membresía Balance Rewards' }],
    ['WAG_I_DO_4023', { code: 'WAG_I_DO_4023', type: 'INFO', message: 'No coupons available', userFriendlyMessage: 'No hay cupones disponibles' }],
    ['WAG_I_DO_4061', { code: 'WAG_I_DO_4061', type: 'INFO', message: 'No coupons for category', userFriendlyMessage: 'No hay cupones para esta categoría' }],
    ['905', { code: '905', type: 'ERROR', message: 'Invalid Client ID - SSL Certificate Required', userFriendlyMessage: 'Se requiere certificado SSL válido del equipo de Walgreens para generar Client ID' }],
  ]);

  constructor() {
    this.config = {
      apiKey: '', // Will be loaded from database
      affId: '', // Will be loaded from database
      baseUrl: process.env.WALGREENS_API_BASE_URL || 'https://services.walgreens.com',
    };

    console.log('=== WALGREENS API CONFIG ===');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`API Keys will be loaded from database...`);
    console.log('============================');
    
    // Initialize multiple API keys pool from database
    this.initializeAPIKeyPool().catch(console.error);
  }

  // Add getters for accessing configuration
  public get apiKey() {
    return this.config.apiKey;
  }

  public get affId() {
    return this.config.affId;
  }

  public get baseUrl() {
    return this.config.baseUrl;
  }

  public async reloadAPIKeyPool() {
    await this.initializeAPIKeyPool();
  }

  private async initializeAPIKeyPool() {
    try {
      console.log(`🔑 Loading API keys from database...`);
      
      // Import storage to load keys from database
      const { storage } = await import('../storage');
      const dbApiKeys = await storage.getAllApiKeys();
      
      console.log(`📦 Found ${dbApiKeys.length} API keys in database`);
      
      // Convert database keys to in-memory pool format
      this.apiKeyPool = dbApiKeys.map(dbKey => ({
        name: dbKey.name,
        apiKey: dbKey.apiKey,
        affId: dbKey.affId,
        requestCount: dbKey.requestCount || 0,
        lastResetTime: dbKey.lastResetTime ? dbKey.lastResetTime.getTime() : Date.now(),
        isActive: dbKey.isActive
      }));
      
      // Require at least one API key in database
      if (this.apiKeyPool.length === 0) {
        console.error(`❌ NO API KEYS FOUND IN DATABASE!`);
        console.error(`   Please add API keys through the Settings page in the admin panel.`);
        console.error(`   Navigate to /admin/settings and add at least one API key.`);
        // Initialize with empty pool - will fail gracefully if API calls are attempted
        this.useMultipleKeys = false;
        return;
      }
      
      this.useMultipleKeys = this.apiKeyPool.length > 1;
      
      // NOTE: RateLimiterManager is initialized in scanner-service.ts
      // No need to initialize it here for general API requests
      
      console.log(`🔑 API KEY POOL INITIALIZED FROM DATABASE`);
      console.log(`   Total Keys: ${this.apiKeyPool.length}`);
      console.log(`   Multiple Keys Mode: ${this.useMultipleKeys ? 'ENABLED' : 'DISABLED'}`);
      console.log(`   Max Requests/Minute per Key: ${this.MAX_REQUESTS_PER_MINUTE}`);
      console.log(`   Total Theoretical Throughput: ${this.apiKeyPool.length * this.MAX_REQUESTS_PER_MINUTE} req/min`);
      
      this.apiKeyPool.forEach((key, index) => {
        console.log(`   ${key.name}: ${key.apiKey.slice(0, 10)}... | AffID: ${key.affId} | Active: ${key.isActive}`);
      });
      console.log(`==========================================`);
    } catch (error) {
      console.error(`❌ CRITICAL ERROR: Failed to load API keys from database!`, error);
      console.error(`   API keys MUST be managed through the database.`);
      console.error(`   Please add API keys through /admin/settings`);
      this.apiKeyPool = [];
      this.useMultipleKeys = false;
    }
  }

  private async getNextAPIKey(): Promise<{ apiKey: string; affId: string; keyName: string }> {
    if (this.apiKeyPool.length === 0) {
      throw new Error('No API keys available in database. Please add API keys through /admin/settings');
    }

    const now = Date.now();
    
    // Reset request counts every minute for all keys
    this.apiKeyPool.forEach(key => {
      if (now - key.lastResetTime > 60000) { // 1 minute = 60000ms
        key.requestCount = 0;
        key.lastResetTime = now;
        key.isActive = true;
        console.log(`🔄 Reset ${key.name}: Count reset to 0`);
      }
    });

    // Find available key with lowest request count - STRICT LIMIT ENFORCEMENT
    let selectedKey = null;
    let lowestCount = this.MAX_REQUESTS_PER_MINUTE;

    for (const key of this.apiKeyPool) {
      if (key.isActive && key.requestCount < this.MAX_REQUESTS_PER_MINUTE) {
        if (key.requestCount < lowestCount) {
          selectedKey = key;
          lowestCount = key.requestCount;
        }
      }
    }

    // ⛔ STRICT ENFORCEMENT: Si no hay key disponible, ESPERAR hasta el próximo reset
    if (!selectedKey) {
      // Encontrar la key que se reseteará más pronto
      const nextResetKey = this.apiKeyPool.reduce((prev, curr) => {
        const prevTime = Number.isFinite(prev.lastResetTime) ? prev.lastResetTime : Date.now();
        const currTime = Number.isFinite(curr.lastResetTime) ? curr.lastResetTime : Date.now();
        return currTime > prevTime ? curr : prev;
      });
      
      // Guard against NaN - if lastResetTime is missing, use current time
      const resetBase = Number.isFinite(nextResetKey.lastResetTime) ? nextResetKey.lastResetTime : Date.now();
      const timeUntilReset = 60000 - (now - resetBase);
      const waitTime = Math.max(100, timeUntilReset); // Mínimo 100ms
      
      console.log(`⏳ ALL KEYS AT LIMIT (300/300). Waiting ${waitTime}ms for reset...`);
      
      // Esperar hasta el próximo reset
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reintentar después de esperar
      return this.getNextAPIKey();
    }

    // Incrementar contador SOLO si está bajo el límite
    selectedKey.requestCount++;
    await this.incrementKeyRequestCount(selectedKey.name);
    
    // Log usage statistics
    const usage = `${selectedKey.requestCount}/${this.MAX_REQUESTS_PER_MINUTE}`;
    console.log(`🔑 Using ${selectedKey.name}: ${usage} requests`);
    
    return {
      apiKey: selectedKey.apiKey,
      affId: selectedKey.affId,
      keyName: selectedKey.name
    };
  }

  private async makeRequest<T>(endpoint: string, body: any, apiKey?: string, affId?: string, keyName?: string): Promise<T> {
    try {
      // Check if this is a products search API (use form-urlencoded)
      const isProductsSearchAPI = endpoint.includes('/products/search') || endpoint.includes('/products/barcode');
      // Check if this is inventory API (use JSON)
      const isInventoryAPI = endpoint.includes('/products/inventory');
      
      let response;
      let requestBody;
      
      // Use provided API key OR get from pool
      let apiKeyToUse: string;
      let affIdToUse: string;
      let keyNameToUse: string;
      
      if (apiKey && affId) {
        // Use the API key passed by caller (Scanner has already selected one)
        apiKeyToUse = apiKey;
        affIdToUse = affId;
        keyNameToUse = keyName || 'External';
      } else {
        // Get the next available API key from the pool
        const keyConfig = await this.getNextAPIKey();
        apiKeyToUse = keyConfig.apiKey;
        affIdToUse = keyConfig.affId;
        keyNameToUse = keyConfig.keyName;
      }
      
      // CRITICAL: Acquire rate limiter token BEFORE making request
      // Acquire 1 token per API call (not 2), so each phone number scan costs 2 tokens total
      const rateLimiter = RateLimiterManager.getInstance();
      await rateLimiter.acquire(keyNameToUse);
      
      if (isProductsSearchAPI) {
        // For products search API, use form-urlencoded with lowercase keys
        requestBody = {
          ...body,
          apikey: apiKeyToUse,
          affid: affIdToUse,
          svcRequestor: "ECOMMTP",
        };
        
        const formData = new URLSearchParams();
        Object.keys(requestBody).forEach(key => {
          if (requestBody[key] !== undefined && requestBody[key] !== null) {
            formData.append(key, requestBody[key]);
          }
        });
        
        response = await fetch(`https://services-qa.walgreens.com${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.walgreens.com',
            'Referer': 'https://www.walgreens.com/',
          },
          body: formData,
          agent: httpsAgent,
        });
      } else if (isInventoryAPI) {
        // For inventory API, use JSON format with camelCase keys and products API key
        requestBody = {
          ...body,
          apiKey: apiKeyToUse,
          affId: affIdToUse,
        };
        
        response = await fetch(`https://services-qa.walgreens.com${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.walgreens.com',
            'Referer': 'https://www.walgreens.com/',
          },
          body: JSON.stringify(requestBody),
          agent: httpsAgent,
        });
      } else {
        // For other APIs (offers, member, etc.), use JSON format with pool key
        requestBody = {
          ...body,
          apiKey: apiKeyToUse,
          affId: affIdToUse,
          svcRequestor: "ECOMMTP",
        };
        
        response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://www.walgreens.com',
            'Referer': 'https://www.walgreens.com/',
          },
          body: JSON.stringify(requestBody),
          agent: httpsAgent,
        });
      }

      // Check response status
      if (!response.ok) {
        // 403 Forbidden - rate limit or authentication issue (retryable)
        if (response.status === 403) {
          const error: any = new Error(`Rate limit exceeded or forbidden (HTTP 403)`);
          error.statusCode = 403;
          error.status = 403;
          throw error;
        }
        
        // Other HTTP errors
        const error: any = new Error(`HTTP error! status: ${response.status}`);
        error.statusCode = response.status;
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      
      // Log successful API key usage (only for regular APIs, not products)
      if (!isProductsSearchAPI && !isInventoryAPI) {
        console.log(`✅ API Success: ${keyNameToUse}`);
      }
      
      // Check for API error codes in response
      if (data.messages && Array.isArray(data.messages)) {
        const errorMessage = data.messages.find((msg: any) => msg.type === 'ERROR');
        if (errorMessage) {
          const errorInfo = this.errorCodes.get(errorMessage.code);
          throw new Error(errorInfo?.userFriendlyMessage || errorMessage.message);
        }
      }
      
      return data;
    } catch (error) {
      console.error(`Walgreens API request failed:`, error);
      throw new Error(`API request failed: ${(error as Error).message}`);
    }
  }

  private handleAPIError(error: any): never {
    if (error.message && this.errorCodes.has(error.message)) {
      const errorInfo = this.errorCodes.get(error.message);
      throw new Error(errorInfo?.userFriendlyMessage || error.message);
    }
    throw error;
  }

  // Get API Key Pool Statistics
  public getAPIKeyPoolStats() {
    return {
      totalKeys: this.apiKeyPool.length,
      multipleKeysEnabled: this.useMultipleKeys,
      totalThroughput: this.apiKeyPool.length * this.MAX_REQUESTS_PER_MINUTE,
      poolStats: this.apiKeyPool.map(key => ({
        name: key.name,
        apiKey: key.apiKey,
        affId: key.affId,
        requestCount: key.requestCount,
        maxRequests: this.MAX_REQUESTS_PER_MINUTE,
        isActive: key.isActive,
        lastResetTime: new Date(key.lastResetTime).toISOString(),
        lastTestResult: key.lastTestResult
      }))
    };
  }

  // Get Rate Limiter Statistics - Individual stats for each API key
  public getRateLimiterStats() {
    const rateLimiterManager = RateLimiterManager.getInstance();
    const stats = rateLimiterManager.getAllStats();
    
    return {
      timestamp: new Date().toISOString(),
      totalKeys: stats.length,
      keyStats: stats
    };
  }

  // Get Active API Keys for Intelligent Parallel Processing
  public async getActiveApiKeys() {
    if (!this.useMultipleKeys || this.apiKeyPool.length === 0) {
      // Return primary key as single active key
      return [{
        name: 'PRIMARY',
        apiKey: this.config.apiKey,
        affId: this.config.affId,
        isActive: true,
        requestCount: 0
      }];
    }

    const now = Date.now();
    
    // Reset request counts for keys that are past their reset time
    this.apiKeyPool.forEach(key => {
      if (now - key.lastResetTime > 60000) { // 1 minute = 60000ms
        key.requestCount = 0;
        key.lastResetTime = now;
        key.isActive = true;
      }
    });

    // Return all active API keys
    return this.apiKeyPool
      .filter(key => key.isActive)
      .map(key => ({
        name: key.name,
        apiKey: key.apiKey,
        affId: key.affId,
        isActive: key.isActive,
        requestCount: key.requestCount,
        maxRequests: this.MAX_REQUESTS_PER_MINUTE,
        availableRequests: this.MAX_REQUESTS_PER_MINUTE - key.requestCount
      }));
  }

  // Add new API key to pool
  public addAPIKey(apiKey: string, affId: string, name: string) {
    // Check if name already exists
    if (this.apiKeyPool.some(key => key.name === name)) {
      throw new Error(`API key with name "${name}" already exists`);
    }

    // Add new key to pool
    const newKey = {
      name,
      apiKey,
      affId,
      requestCount: 0,
      isActive: true,
      lastResetTime: Date.now() // Use timestamp in milliseconds, not ISO string
    };

    this.apiKeyPool.push(newKey);
    
    // Update multiple keys mode
    this.useMultipleKeys = this.apiKeyPool.length > 1;
    
    console.log(`✅ Added API key: ${name} to pool (Total: ${this.apiKeyPool.length})`);
    if (this.useMultipleKeys) {
      console.log('🔄 Multiple keys mode ENABLED');
    }
    
    return {
      success: true,
      message: `API key "${name}" added successfully`,
      totalKeys: this.apiKeyPool.length
    };
  }

  // Remove API key from pool
  public async removeAPIKey(keyName: string) {
    try {
      const keyIndex = this.apiKeyPool.findIndex(key => key.name === keyName);
      if (keyIndex === -1) {
        throw new Error(`API key "${keyName}" not found in pool`);
      }

      // Import storage for database operations
      const { storage } = await import('../storage');
      
      // Remove from database
      await storage.removeApiKey(keyName);
      
      // Remove from in-memory pool
      this.apiKeyPool.splice(keyIndex, 1);
      
      // Update multiple keys mode
      this.useMultipleKeys = this.apiKeyPool.length > 1;
      
      const remainingKeys = this.apiKeyPool.length;
      console.log(`🗑️ Removed API key: ${keyName} from database and memory pool (Remaining: ${remainingKeys})`);
      
      if (remainingKeys === 0) {
        console.warn('⚠️ WARNING: No API keys remaining! Add new keys through /admin/settings to use the API.');
      }
      
      return {
        success: true,
        message: `API key "${keyName}" removed successfully from database`,
        totalKeys: remainingKeys
      };
    } catch (error) {
      console.error(`❌ Error removing API key:`, error);
      throw error;
    }
  }

  // Reload all API keys from database
  public async reloadAPIKeys() {
    try {
      // Import storage for database operations
      const { storage } = await import('../storage');
      
      // Load all API keys from database
      const dbKeys = await storage.getAllApiKeys();
      
      // Clear current pool and load from database
      this.apiKeyPool = dbKeys.map(key => ({
        name: key.name,
        apiKey: key.apiKey,
        affId: key.affId,
        requestCount: 0,
        isActive: key.isActive,
        lastResetTime: Date.now()
      }));
      
      // Update multiple keys mode
      this.useMultipleKeys = this.apiKeyPool.length > 1;
      
      console.log(`🔄 Reloaded ${this.apiKeyPool.length} API keys from database`);
      
      if (this.apiKeyPool.length === 0) {
        console.warn('⚠️ WARNING: No API keys found in database! Add new keys through /admin/settings to use the API.');
      } else if (this.useMultipleKeys) {
        console.log('🔄 Multiple keys mode ENABLED');
      }
      
      return {
        success: true,
        message: `Reloaded ${this.apiKeyPool.length} API keys from database`,
        totalKeys: this.apiKeyPool.length
      };
    } catch (error) {
      console.error(`❌ Error reloading API keys:`, error);
      throw error;
    }
  }

  // Test specific API key
  public async testAPIKey(keyName: string) {
    let targetKey;
    
    if (!this.useMultipleKeys) {
      if (keyName !== 'API_KEY_1') {
        throw new Error(`API key "${keyName}" not found`);
      }
      targetKey = {
        name: 'API_KEY_1',
        apiKey: this.apiKey,
        affId: this.affId
      };
    } else {
      targetKey = this.apiKeyPool.find(key => key.name === keyName);
      if (!targetKey) {
        throw new Error(`API key "${keyName}" not found in pool`);
      }
    }

    console.log(`🧪 Testing API key: ${keyName}`);
    
    try {
      // Use the exact same lookup process as /admin/search
      const testPhoneNumber = '6024461135';
      console.log(`📞 Testing with member lookup for: ${testPhoneNumber}`);

      // Create a temporary instance with the target API key for testing
      const tempConfig = {
        apiKey: targetKey.apiKey,
        affId: targetKey.affId,
        baseUrl: this.config.baseUrl,
      };

      // Use the exact same makeRequest approach as the main lookupMember function
      const requestBody = {
        phoneNumber: testPhoneNumber,
        apiKey: targetKey.apiKey,
        affId: targetKey.affId,
        svcRequestor: "ECOMMTP",
      };

      console.log(`🧪 Making request to: ${tempConfig.baseUrl}/api/offers/lookup/v1`);
      console.log(`🧪 Request body:`, { ...requestBody, apiKey: '***', affId: targetKey.affId });

      const response = await fetch(`${tempConfig.baseUrl}/api/offers/lookup/v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      console.log(`🧪 API Response:`, responseData);

      let success = false;
      let message = '';

      // Check for authentication failures first
      if (responseData.errCode === '403' || responseData.errCode === '401') {
        success = false;
        message = `❌ Member Lookup: ${responseData.errMsg || 'No autorizado'}`;
      } else if (!response.ok) {
        success = false;
        message = `❌ HTTP Error: ${response.status}`;
      } else if (responseData.messages || responseData.matchProfiles !== undefined) {
        // Valid response structure indicates API key is working
        if (responseData.matchProfiles && responseData.matchProfiles.length > 0) {
          // Member found - API key is definitely valid
          success = true;
          message = `✅ API key válida - Miembro encontrado (${responseData.matchProfiles[0].memberName})`;
        } else if (responseData.messages) {
          // Check for expected "member not found" errors which still indicate valid API key
          const hasExpectedErrors = responseData.messages.some((msg: any) => 
            ['WAG_E_LOYALTY_1041', 'WAG_E_LOYALTY_1044'].includes(msg.code)
          );
          
          const hasAuthErrors = responseData.messages.some((msg: any) => 
            msg.type === 'ERROR' && msg.code && !['WAG_E_LOYALTY_1041', 'WAG_E_LOYALTY_1044'].includes(msg.code)
          );
          
          if (hasExpectedErrors && !hasAuthErrors) {
            // "Member not found" but no auth errors = API key is valid
            success = true;
            message = '✅ API key válida - Respuesta de API correcta (miembro no encontrado es normal)';
          } else if (hasAuthErrors) {
            const authError = responseData.messages.find((msg: any) => 
              msg.type === 'ERROR' && msg.code && !['WAG_E_LOYALTY_1041', 'WAG_E_LOYALTY_1044'].includes(msg.code)
            );
            success = false;
            message = `❌ Error de autenticación: ${authError?.message || 'Error desconocido'}`;
          } else {
            success = true;
            message = '✅ API key válida - Respuesta de API recibida';
          }
        } else {
          success = true;
          message = '✅ API key válida - Estructura de respuesta correcta';
        }
      } else {
        success = false;
        message = '❌ Respuesta inesperada de la API';
      }
      
      const testResult = {
        success,
        message,
        timestamp: new Date().toISOString()
      };

      // Update the key with test result if in multiple keys mode
      if (this.useMultipleKeys) {
        const keyInPool = this.apiKeyPool.find(key => key.name === keyName);
        if (keyInPool) {
          keyInPool.lastTestResult = testResult;
        }
      }

      console.log(`🧪 Test result for ${keyName}:`, testResult);
      return testResult;
      
    } catch (error) {
      const testResult = {
        success: false,
        message: `Error de conexión: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };

      // Update the key with test result if in multiple keys mode
      if (this.useMultipleKeys) {
        const keyInPool = this.apiKeyPool.find(key => key.name === keyName);
        if (keyInPool) {
          keyInPool.lastTestResult = testResult;
        }
      }

      console.log(`🧪 Test failed for ${keyName}:`, testResult);
      return testResult;
    }
  }

  // Edit specific API key
  public editAPIKey(keyName: string, newApiKey: string, newAffId: string) {
    if (!this.useMultipleKeys) {
      if (keyName !== 'API_KEY_1') {
        throw new Error(`API key "${keyName}" not found`);
      }
      // Update primary key
      this.config.apiKey = newApiKey;
      this.config.affId = newAffId;
      console.log(`✏️ Updated primary API key: ${keyName}`);
      
      return {
        success: true,
        message: `API key "${keyName}" updated successfully`
      };
    } else {
      const keyIndex = this.apiKeyPool.findIndex(key => key.name === keyName);
      if (keyIndex === -1) {
        throw new Error(`API key "${keyName}" not found in pool`);
      }

      // Update key in pool
      this.apiKeyPool[keyIndex].apiKey = newApiKey;
      this.apiKeyPool[keyIndex].affId = newAffId;
      
      console.log(`✏️ Updated API key in pool: ${keyName}`);
      
      return {
        success: true,
        message: `API key "${keyName}" updated successfully`
      };
    }
  }

  // Normalize phone number to 10 digits by removing country code prefixes
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different country code formats
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      // Remove leading "1" from 11-digit numbers (e.g., "16024461135" -> "6024461135")
      cleaned = cleaned.substring(1);
    } else if (cleaned.length > 10) {
      // For numbers longer than 10 digits, take the last 10 digits
      cleaned = cleaned.slice(-10);
    }
    
    return cleaned;
  }

  async lookupMember(phoneNumber: string, apiKey?: string, affId?: string, keyName?: string): Promise<any> {
    // Normalize phone number first
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    
    console.log(`=== LOOKUP MEMBER REQUEST ===`);
    console.log(`Original Phone: ${phoneNumber}`);
    console.log(`Normalized Phone: ${normalizedPhone}`);
    console.log(`Endpoint: /api/offers/lookup/v1`);
    if (keyName) {
      console.log(`Using API Key: ${keyName}`);
    }
    
    try {
      // Rate limiting is now handled by RateLimiterManager BEFORE this call
      // This method only makes the HTTP request
      const response = await this.makeRequest<LookupMemberResponse>('/api/offers/lookup/v1', {
        phoneNumber: normalizedPhone,
      }, apiKey, affId, keyName);

      console.log(`=== LOOKUP MEMBER RESPONSE ===`);
      console.log(`Full Response:`, JSON.stringify(response, null, 2));
      console.log(`Match Profiles Count:`, response.matchProfiles?.length || 0);
      console.log(`Messages:`, response.messages);
      console.log(`Phone Number in Response:`, response.phoneNumber);
      console.log(`===============================`);

      if (!response.matchProfiles || response.matchProfiles.length === 0) {
        // Para el fast scanner, devolver null significa no encontrada
        return null;
      }

      const profile = response.matchProfiles[0];
      console.log(`Selected Profile:`, JSON.stringify(profile, null, 2));
      console.log(`✅ PROFILE FOUND: ${profile.firstName} ${profile.lastName}`);
      
      // Devolver la respuesta completa para el fast scanner
      return response;
    } catch (error) {
      // Cuando la API arroja un error (ej: "We couldn't find your myWalgreens membership"), 
      // devolver null para que el fast-scanner sepa que no se encontró
      console.log(`❌ LOOKUP FAILED: ${error.message}`);
      return null;
    }
  }

  async getMember(encLoyaltyId: string): Promise<{ name: string; cardNumber: string; balance: string; profile: any }> {
    console.log(`=== GET MEMBER REQUEST ===`);
    console.log(`Enc Loyalty ID: ${encLoyaltyId}`);
    console.log(`Endpoint: /api/offers/member/v2`);
    
    const response = await this.makeRequest<MemberProfileResponse>('/api/offers/member/v2', {
      encLoyaltyId,
      sendPIIData: true,
    });

    console.log(`=== GET MEMBER RESPONSE ===`);
    console.log(`Full Response:`, JSON.stringify(response, null, 2));
    console.log(`Name:`, response.Name);
    console.log(`Card Number:`, response.CardNumber);
    console.log(`Reward:`, response.Reward);
    console.log(`Email:`, response.EMailAddress);
    console.log(`Phone List:`, response.PhoneList);
    console.log(`===========================`);

    return {
      name: `${response.Name.FirstName} ${response.Name.LastName}`.trim(),
      cardNumber: response.CardNumber,
      balance: response.Reward.CurrentBalanceDollars,
      profile: response,
    };
  }

  async updateMemberProfile(encLoyaltyId: string, updates: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    zipCode?: string;
    email?: string;
  }): Promise<{ success: boolean; message: string; data?: any; apiKeyUsed?: string }> {
    console.log(`=== UPDATE MEMBER PROFILE REQUEST ===`);
    console.log(`Enc Loyalty ID: ${encLoyaltyId}`);
    console.log(`Updates:`, updates);
    
    // Use API key from database pool
    const keyConfig = await this.getNextAPIKey();
    console.log(`\n=== USING ${keyConfig.keyName} FROM DATABASE ===`);
    
    try {
      // Strategy 1: Try the standard member update endpoint
      const updatePayload = {
        encLoyaltyId,
        ...updates,
        svcRequestor: 'ECOMMTP',
        appVer: '1.0',
        devInf: 'WebApp,1.0'
      };

      console.log(`Trying endpoint: /api/offers/member/update`);
      console.log(`Payload:`, JSON.stringify(updatePayload, null, 2));

      const response = await this.makeRequest('/api/offers/member/update', updatePayload, 'POST');
      
      console.log(`=== UPDATE RESPONSE ===`);
      console.log(`Response:`, JSON.stringify(response, null, 2));
      console.log(`=============================================`);

      // Check if this is actually an error response
      const responseData = response as any;
      if (responseData.errCode && responseData.errMsg) {
        console.log(`ERROR: ${responseData.errCode} - ${responseData.errMsg}`);
        throw new Error(`API returned error: ${responseData.errCode} - ${responseData.errMsg}`);
      }

      return {
        success: true,
        message: `Profile updated successfully with ${keyConfig.keyName}`,
        data: response,
        apiKeyUsed: keyConfig.keyName
      };
    } catch (error) {
      console.log(`First endpoint failed:`, error.message);
      
      try {
        // Strategy 2: Try alternative endpoint structure
        const altPayload = {
          encLoyaltyId,
          profile: updates,
          svcRequestor: 'ECOMMTP'
        };

        console.log(`Trying alternative endpoint: /api/member/profile/update`);
        const altResponse = await this.makeRequest('/api/member/profile/update', altPayload, 'POST');
        
        console.log(`=== ALT UPDATE RESPONSE ===`);
        console.log(`Response:`, JSON.stringify(altResponse, null, 2));
        console.log(`===============================================`);

        // Check if this is actually an error response
        const altResponseData = altResponse as any;
        if (altResponseData.errCode && altResponseData.errMsg) {
          console.log(`ERROR: ${altResponseData.errCode} - ${altResponseData.errMsg}`);
          throw new Error(`API returned error: ${altResponseData.errCode} - ${altResponseData.errMsg}`);
        }

        return {
          success: true,
          message: `Profile updated successfully (alternative endpoint) with ${keyConfig.keyName}`,
          data: altResponse,
          apiKeyUsed: keyConfig.keyName
        };
      } catch (altError) {
        console.log(`Alternative endpoint failed:`, altError.message);
        
        try {
          // Strategy 3: Try preferences/contact update endpoint
          const prefPayload = {
            encLoyaltyId,
            contactInfo: {
              firstName: updates.firstName,
              lastName: updates.lastName,
              phoneNumber: updates.phoneNumber,
              zipCode: updates.zipCode,
              email: updates.email
            },
            svcRequestor: 'ECOMMTP'
          };

          console.log(`Trying preferences endpoint: /api/offers/member/preferences`);
          const prefResponse = await this.makeRequest('/api/offers/member/preferences', prefPayload, 'PUT');
          
          console.log(`=== PREFERENCES UPDATE RESPONSE ===`);
          console.log(`Response:`, JSON.stringify(prefResponse, null, 2));
          console.log(`==================================================`);

          // Check if this is actually an error response
          const prefResponseData = prefResponse as any;
          if (prefResponseData.errCode && prefResponseData.errMsg) {
            console.log(`ERROR: ${prefResponseData.errCode} - ${prefResponseData.errMsg}`);
            throw new Error(`API returned error: ${prefResponseData.errCode} - ${prefResponseData.errMsg}`);
          }

          return {
            success: true,
            message: `Profile updated via preferences endpoint with ${keyConfig.keyName}`,
            data: prefResponse,
            apiKeyUsed: keyConfig.keyName
          };
        } catch (prefError) {
          console.log(`Preferences endpoint failed:`, prefError.message);
        }
      }
    }

    // If we reach here, all API keys and endpoints failed
    return {
      success: false,
      message: 'Profile update not supported - all API keys and endpoints failed',
      data: {
        message: 'Tried both API keys with multiple endpoints but all returned unauthorized or failed'
      }
    };
  }

  async getCategoryCounts(encLoyaltyId: string): Promise<{ category: string; count: number }[]> {
    const categories = [
      'Personal Care',
      'Medicines & Treatments',
      'Household',
      'Beauty',
      'Grocery',
      'Baby, Kids & Toys',
      'Vitamins & Supplements',
      'Sexual Wellness',
      'Home Medical'
    ];

    console.log('=== GETTING CATEGORY COUNTS ===');
    console.log('encLoyaltyId:', encLoyaltyId);

    const promises = categories.map(async cat => {
      const requestBody = {
        encLoyaltyId,
        cat,
        recSize: 100, // Get all offers to count them properly
        recStartIndex: 0,
        svcRequestor: "ECOMMTP",
        appVer: "1.0",
        devInf: "WebApp,1.0",
        storeNumber: "5609",
      };

      try {
        const response = await this.makeRequest<any>('/api/offers/fetch/v1', requestBody);
        // Use the actual count from the response
        const count = response.coupons ? response.coupons.length : 0;
        console.log(`Category ${cat} has ${count} offers`);
        return { category: cat, count };
      } catch (error) {
        console.error(`Error fetching count for ${cat}:`, error);
        return { category: cat, count: 0 };
      }
    });

    const results = await Promise.all(promises);
    return results;
  }

  async fetchOffers(encLoyaltyId: string, options: { page?: number; size?: number; category?: string } = {}): Promise<OffersResponse> {
    console.log('=== FETCH OFFERS DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('options:', options);

    try {
      let categoryToUse = options.category;
      let allOffers: any[] = [];
      let totalAvailableOffers = 0;
      
      // If no category specified, fetch from multiple categories
      if (!categoryToUse) {
        // ALWAYS fetch fresh data - cache disabled for real-time updates
        console.log('Fetching fresh offers data from API (cache disabled)');
        
        // STEP 1: Get all clipped offers first to filter them out
        console.log('🔍 Getting clipped offers to filter from available...');
        const clippedResponse = await this.listClipped(encLoyaltyId, 1, 500);
        const clippedOfferIds = new Set(clippedResponse.clippedOffers.map(offer => offer.offerId));
        console.log(`Found ${clippedOfferIds.size} clipped offers to exclude`);
        
        // STEP 2: Get all available offers from API
        {
          // Use exact category names from Walgreens with priority based on offer count
          const categories = [
            'Personal Care', // 110 offers - highest count
            'Medicines & Treatments', // 77 offers
            'Household', // 50 offers  
            'Beauty', // 44 offers
            'Grocery', // 16 offers
            'Baby, Kids & Toys', // 13 offers
            'Vitamins & Supplements', // 12 offers
            'Sexual Wellness', // 4 offers
            'Home Medical' // 3 offers
          ];
          
          // First pass: get all offers to determine total count
          const promises = categories.map(cat => {
            const requestBody = {
              encLoyaltyId,
              cat,
              recSize: 100, // Get more offers per category to build a larger pool
              recStartIndex: 0,
              svcRequestor: "ECOMMTP",
              appVer: "1.0",
              devInf: "WebApp,1.0",
              storeNumber: "5609",
            };
            
            console.log(`Fetching offers from category: ${cat}`);
            return this.makeRequest<any>('/api/offers/fetch/v1', requestBody)
              .then(response => {
                if (response.coupons && response.coupons.length > 0) {
                  console.log(`Found ${response.coupons.length} offers in ${cat}`);
                  return response.coupons;
                }
                return [];
              });
          });
          
          // Wait for all requests to complete
          const results = await Promise.all(promises);
          const rawOffers = results.flat();
          
          // STEP 3: Filter out clipped offers to get truly available ones
          allOffers = rawOffers.filter(offer => {
            const offerId = offer.id || offer.offerId;
            const isClipped = clippedOfferIds.has(offerId);
            if (isClipped) {
              console.log(`🚫 Filtering out clipped offer: ${offerId} - ${offer.brandName}`);
            }
            return !isClipped;
          });
          
          console.log(`Raw offers: ${rawOffers.length}, After filtering clipped: ${allOffers.length}`);
          
          // Cache disabled for real-time updates
          // this.offerCache.set(cacheKey, { offers: allOffers, timestamp: now });
        }
        
        totalAvailableOffers = allOffers.length;
        console.log(`Total offers available: ${totalAvailableOffers}`);
        
        // Apply pagination to all offers
        const pageSize = options.size || 20;
        const pageNumber = options.page || 1;
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        // Slice the offers for the current page
        const paginatedOffers = allOffers.slice(startIndex, endIndex);
        
        console.log(`Returning page ${pageNumber} with ${paginatedOffers.length} offers (${startIndex}-${endIndex} of ${totalAvailableOffers})`);
        
        // Transform the response to match our expected format
        const mappedOffers = paginatedOffers.map((offer: any) => ({
          offerId: offer.id || offer.offerId,
          title: offer.brandName || offer.title || offer.name || 'Oferta especial',
          description: offer.description || offer.summary || offer.desc || 'Oferta disponible',
          discount: offer.summary || (offer.offerValue ? `$${offer.offerValue} off ${offer.minQty || 1}` : 'Descuento especial'),
          category: offer.categoryName || offer.category || 'general',
          categoryName: offer.categoryName || offer.category || 'general', // Add categoryName for filtering
          brandName: offer.brandName || offer.brand || 'General', // Add brandName for filtering
          summary: offer.summary || offer.offerValue || offer.discount || 'Oferta especial', // Add summary for value filtering
          imageUrl: offer.image || offer.image2 || offer.imageUrl,
          expiryDate: offer.expiryDate || offer.expiry,
          status: offer.status || 'active',
        }));
        
        return {
          offers: mappedOffers,
          totalCount: totalAvailableOffers,
          page: pageNumber,
          size: pageSize,
        };
        
      } else {
        // First, get the total count for this category
        const totalCountRequest = {
          encLoyaltyId,
          cat: categoryToUse,
          recSize: 100, // Get a large number to count all offers
          recStartIndex: 0,
          svcRequestor: "ECOMMTP",
          appVer: "1.0",
          devInf: "WebApp,1.0",
          storeNumber: "5609",
        };
        
        const totalResponse = await this.makeRequest<any>('/api/offers/fetch/v1', totalCountRequest);
        const totalCount = totalResponse.coupons ? totalResponse.coupons.length : 0;
        
        // Now fetch for the specific page
        const requestBody = {
          encLoyaltyId,
          cat: categoryToUse,
          recSize: options.size || 20,
          recStartIndex: ((options.page || 1) - 1) * (options.size || 20),
          svcRequestor: "ECOMMTP",
          appVer: "1.0",
          devInf: "WebApp,1.0",
          storeNumber: "5609",
        };
        
        console.log('Request body:', requestBody);
        const response = await this.makeRequest<any>('/api/offers/fetch/v1', requestBody);
        allOffers = response.coupons || [];
        
        // Transform the response to match our expected format
        const mappedOffers = allOffers.map((offer: any) => ({
          offerId: offer.id || offer.offerId,
          title: offer.brandName || offer.title || offer.name || 'Oferta especial',
          description: offer.description || offer.summary || offer.desc || 'Oferta disponible',
          discount: offer.summary || (offer.offerValue ? `$${offer.offerValue} off ${offer.minQty || 1}` : 'Descuento especial'),
          category: offer.categoryName || offer.category || 'general',
          categoryName: offer.categoryName || offer.category || 'general', // Add categoryName for filtering
          brandName: offer.brandName || offer.brand || 'General', // Add brandName for filtering
          summary: offer.summary || offer.offerValue || offer.discount || 'Oferta especial', // Add summary for value filtering
          imageUrl: offer.image || offer.image2 || offer.imageUrl,
          expiryDate: offer.expiryDate || offer.expiry,
          status: offer.status || 'active',
        }));
        
        return {
          offers: mappedOffers,
          totalCount: totalCount,
          page: options.page || 1,
          size: options.size || 20,
        };
      }
    } catch (error) {
      console.error('Error fetching offers from Walgreens API:', error);
      console.error('Error details:', error.message);
      
      return {
        offers: [],
        totalCount: 0,
        page: options.page || 1,
        size: options.size || 20,
      };
    }
  }

  private getDemoOffers(category?: string): any[] {
    const allOffers = [
      {
        offerId: 'demo-001',
        title: '20% de descuento en vitaminas',
        description: 'Ahorra 20% en todas las vitaminas y suplementos Walgreens',
        discount: '20% OFF',
        category: 'health',
        imageUrl: null,
        expiryDate: '2025-08-15',
        status: 'active',
      },
      {
        offerId: 'demo-002',
        title: 'Compra 1 llévate 1 gratis - Cosméticos',
        description: 'Compra cualquier producto de belleza y llévate otro gratis',
        discount: 'BOGO',
        category: 'beauty',
        imageUrl: null,
        expiryDate: '2025-07-30',
        status: 'active',
      },
      {
        offerId: 'demo-003',
        title: '$5 de descuento en compras mayores a $20',
        description: 'Ahorra $5 cuando gastes $20 o más en productos para el hogar',
        discount: '$5 OFF',
        category: 'household',
        imageUrl: null,
        expiryDate: '2025-08-01',
        status: 'active',
      },
      {
        offerId: 'demo-004',
        title: '30% de descuento en snacks',
        description: 'Descuento especial en toda la sección de snacks y bebidas',
        discount: '30% OFF',
        category: 'food',
        imageUrl: null,
        expiryDate: '2025-07-25',
        status: 'active',
      },
      {
        offerId: 'demo-005',
        title: 'Puntos dobles en medicamentos',
        description: 'Gana puntos dobles en todos los medicamentos de venta libre',
        discount: '2x Points',
        category: 'health',
        imageUrl: null,
        expiryDate: '2025-08-10',
        status: 'active',
      },
    ];

    if (category && category !== 'all') {
      return allOffers.filter(offer => offer.category === category);
    }
    return allOffers;
  }

  async searchOffers(encLoyaltyId: string, query: string, type?: string, page: number = 1, size: number = 20): Promise<OffersResponse> {
    console.log('=== SEARCH OFFERS DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('query:', query);
    console.log('type:', type);
    console.log('page:', page, 'size:', size);

    try {
      // Get all offers first to search through them
      const allOffersResponse = await this.fetchOffers(encLoyaltyId, { size: 500 }); // Get a large set to search through
      const allOffers = allOffersResponse.offers || [];
      
      console.log(`Searching through ${allOffers.length} total offers`);
      
      // Filter offers based on query
      const filteredOffers = allOffers.filter(offer => {
        const searchableText = `${offer.title} ${offer.description} ${offer.category}`.toLowerCase();
        return searchableText.includes(query.toLowerCase());
      });
      
      console.log(`Found ${filteredOffers.length} offers matching query: "${query}"`);
      
      // Apply pagination
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedOffers = filteredOffers.slice(startIndex, endIndex);
      
      return {
        offers: paginatedOffers,
        totalCount: filteredOffers.length,
        page,
        size,
      };
    } catch (error) {
      console.error('Error searching offers:', error);
      console.error('Error details:', error.message);
      
      return {
        offers: [],
        totalCount: 0,
        page,
        size,
      };
    }
  }

  // NEW: Search for products through Digital Offers API by description
  async searchProductsThroughOffers(encLoyaltyId: string, productQuery: string, page: number = 1, size: number = 20): Promise<any> {
    console.log('=== SEARCH PRODUCTS THROUGH OFFERS ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('productQuery:', productQuery);
    console.log('page:', page, 'size:', size);

    try {
      // Get all offers to search for products
      const allOffersResponse = await this.fetchOffers(encLoyaltyId, { size: 1000 }); // Get a large set
      const allOffers = allOffersResponse.offers || [];
      
      console.log(`Searching through ${allOffers.length} total offers for products`);
      
      // Filter offers that contain product-related information
      const productOffers = allOffers.filter(offer => {
        const searchableText = `${offer.title} ${offer.description} ${offer.brandName || ''}`.toLowerCase();
        return searchableText.includes(productQuery.toLowerCase());
      });
      
      console.log(`Found ${productOffers.length} offers containing product query: "${productQuery}"`);
      
      // Extract product information from offers
      const products = productOffers.map(offer => ({
        id: offer.offerId,
        name: offer.title,
        brand: offer.brandName || 'General',
        description: offer.description,
        category: offer.category || 'general',
        hasActiveOffer: true,
        offerDetails: {
          discount: offer.discount || offer.summary,
          expiryDate: offer.expiryDate,
          offerId: offer.offerId
        },
        imageUrl: offer.imageUrl,
        source: 'digital_offers'
      }));
      
      // Apply pagination
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedProducts = products.slice(startIndex, endIndex);
      
      return {
        products: paginatedProducts,
        totalCount: products.length,
        page,
        size,
        query: productQuery,
        source: 'digital_offers'
      };
    } catch (error) {
      console.error('Error searching products through offers:', error);
      console.error('Error details:', error.message);
      
      return {
        products: [],
        totalCount: 0,
        page,
        size,
        query: productQuery,
        source: 'digital_offers'
      };
    }
  }

  async clipOffer(encLoyaltyId: string, offerId: string, channel: string = 'web'): Promise<ClipOfferResponse> {
    console.log('=== CLIP OFFER DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('offerId:', offerId);
    console.log('channel:', channel);

    try {
      const requestBody = {
        encLoyaltyId,
        id: offerId,
        channel,
        svcRequestor: "ECOMMTP",
        appVer: "1.0",
        devInf: "WebApp,1.0",
      };
      console.log('Request body:', requestBody);

      const response = await this.makeRequest<any>('/api/offers/clip/v1', requestBody);
      console.log('Raw API response:', JSON.stringify(response, null, 2));

      // Log the message from API
      if (response.messages) {
        console.log('API Messages:', response.messages);
      }

      const success = response.messages && response.messages.some((msg: any) => msg.code === 'WAG_I_DO_4003');
      const message = response.messages ? response.messages[0]?.message : 'Unknown response';

      return {
        success,
        message,
      };
    } catch (error) {
      console.error('Error clipping offer from Walgreens API:', error);
      console.error('Error details:', error.message);
      
      return {
        success: false,
        message: 'Failed to clip offer',
      };
    }
  }

  async clipAllOffers(encLoyaltyId: string): Promise<{ 
    success: boolean; 
    message: string; 
    clippedCount: number; 
    failedCount: number; 
    totalOffers: number; 
    results: any[] 
  }> {
    console.log('=== CLIP ALL OFFERS DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);

    try {
      // Clear cache for this member to get fresh data
      this.offerCache.delete(encLoyaltyId);
      
      // First, get all available offers to clip
      const allOffers = await this.fetchOffers(encLoyaltyId, { page: 1, size: 1000 });
      
      console.log(`Found ${allOffers.offers.length} offers to process`);
      
      if (allOffers.offers.length === 0) {
        return {
          success: false,
          message: 'No offers available to clip',
          clippedCount: 0,
          failedCount: 0,
          totalOffers: 0,
          results: []
        };
      }

      let clippedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const results: any[] = [];

      // Track actual clipped offers for accurate counting
      const actuallyClippedIds = new Set<string>();
      
      // Clip each offer with delay to avoid rate limiting
      for (const offer of allOffers.offers) {
        try {
          console.log(`Clipping offer: ${offer.offerId} - ${offer.title}`);
          
          const clipResult = await this.clipOffer(encLoyaltyId, offer.offerId, 'web');
          
          if (clipResult.success) {
            clippedCount++;
            actuallyClippedIds.add(offer.offerId);
            results.push({
              offerId: offer.offerId,
              title: offer.title,
              status: 'success',
              message: clipResult.message
            });
          } else {
            // Check if it's already clipped
            if (clipResult.message.includes('already clipped')) {
              skippedCount++;
              results.push({
                offerId: offer.offerId,
                title: offer.title,
                status: 'skipped',
                message: 'Already clipped'
              });
            } else {
              failedCount++;
              results.push({
                offerId: offer.offerId,
                title: offer.title,
                status: 'failed',
                message: clipResult.message
              });
            }
          }
          
          // Add delay between requests to avoid rate limiting (300 requests/minute = 200ms minimum)
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          failedCount++;
          results.push({
            offerId: offer.offerId,
            title: offer.title,
            status: 'error',
            message: error.message
          });
        }
      }

      // Clear cache again after clipping to ensure fresh data
      this.offerCache.delete(encLoyaltyId);

      const totalProcessed = clippedCount + skippedCount;
      const successMessage = clippedCount > 0 
        ? `✅ ${clippedCount} ofertas nuevas clipped${skippedCount > 0 ? `, ${skippedCount} ya estaban clipped` : ''}${failedCount > 0 ? `, ${failedCount} fallaron` : ''}`
        : skippedCount > 0 
          ? `ℹ️ Todas las ofertas ya estaban clipped (${skippedCount} ofertas)`
          : `❌ ${failedCount} ofertas fallaron`;

      return {
        success: clippedCount > 0 || skippedCount > 0,
        message: successMessage,
        clippedCount,
        failedCount,
        totalOffers: allOffers.offers.length,
        results
      };

    } catch (error) {
      console.error('Error in clipAllOffers:', error);
      return {
        success: false,
        message: 'Failed to clip all offers',
        clippedCount: 0,
        failedCount: 0,
        totalOffers: 0,
        results: []
      };
    }
  }

  async listClipped(encLoyaltyId: string, page: number = 1, size: number = 20): Promise<{ clippedOffers: any[] }> {
    console.log('=== LIST CLIPPED DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('page:', page, 'size:', size);

    try {
      // First get all clipped offers (max 500 to ensure we get everything)
      // Multiple attempts to handle Walgreens API sync delays
      let allClippedOffers = [];
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        const requestBody = {
          encLoyaltyId,
          recSize: 500, // Get all clipped offers first
          recStartIndex: 0,
          svcRequestor: "ECOMMTP",
        };
        console.log(`Request body (attempt ${attempts + 1}):`, requestBody);

        const response = await this.makeRequest<any>('/api/offers/clipped/v1', requestBody);
        console.log('Raw API response summary:', {
          clippedCount: response.summary?.clippedCount || 0,
          availableToClipCount: response.summary?.availableToClipCount || 0,
          couponsLength: response.coupons?.length || 0,
          messagesLength: response.messages?.length || 0
        });

        allClippedOffers = response.coupons || [];
        console.log(`Attempt ${attempts + 1}: Total clipped offers from API: ${allClippedOffers.length}`);
        
        // If we got a reasonable number of offers, break
        if (allClippedOffers.length > 50) {
          console.log('✅ Got sufficient offers, breaking from retry loop');
          break;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`⏳ Only got ${allClippedOffers.length} offers, waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`Final result: ${allClippedOffers.length} total clipped offers after ${attempts + 1} attempts`);
      
      // Apply pagination locally
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedOffers = allClippedOffers.slice(startIndex, endIndex);
      console.log(`Returning page ${page}: ${paginatedOffers.length} offers (${startIndex}-${endIndex} of ${allClippedOffers.length})`);
      
      return {
        clippedOffers: paginatedOffers.map((offer: any) => ({
          offerId: offer.id || offer.offerId,
          title: offer.brandName || offer.name || offer.title,
          description: offer.description || offer.summary || offer.desc,
          discount: offer.summary || `$${offer.offerValue} off ${offer.minQty || 1}` || offer.discount || offer.value,
          expiryDate: offer.expiryDate || offer.expiry,
          status: offer.status || 'clipped',
          clippedAt: offer.activationDate || offer.clippedAt || offer.dateClipped,
          category: offer.categoryName || offer.category || 'general',
          imageUrl: offer.image || offer.image2 || offer.imageUrl,
        })),
      };
    } catch (error) {
      console.error('Error getting clipped offers from Walgreens API:', error);
      console.error('Error details:', error.message);
      
      // Return empty array to see actual API behavior
      return {
        clippedOffers: [],
      };
    }
  }

  async unclipOffer(encLoyaltyId: string, offerId: string): Promise<ClipOfferResponse> {
    console.log('=== UNCLIP OFFER DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('offerId:', offerId);

    // NOTE: Walgreens API doesn't appear to have a direct unclip endpoint
    // The /api/offers/unclip/v1 endpoint returns a 500 error
    // For now, we'll return a success message and rely on local storage management
    console.log('WARNING: Walgreens API does not support unclipping offers directly.');
    console.log('This is a limitation of the Walgreens API. The offer will be removed from the local display only.');

    return {
      success: true,
      message: 'Oferta eliminada de la vista local. Nota: La API de Walgreens no soporta eliminar ofertas directamente.',
    };
  }

  async listRedeemed(encLoyaltyId: string, startDate?: string, endDate?: string, page: number = 1, size: number = 20): Promise<{ redeemedOffers: any[], totalCount: number, page: number, size: number }> {
    console.log('=== LIST REDEEMED DEBUG ===');
    console.log('encLoyaltyId:', encLoyaltyId);
    console.log('startDate:', startDate, 'endDate:', endDate);
    console.log('page:', page, 'size:', size);

    try {
      const requestBody = {
        encLoyaltyId,
        startDate: startDate || '2023-01-01',
        endDate: endDate || '2025-12-31',
        recSize: 500, // Get all redeemed offers first, then paginate locally
        recStartIndex: 0,
        svcRequestor: "ECOMMTP",
        appVer: "1.0",
        devInf: "WebApp,1.0",
      };
      console.log('Request body:', requestBody);

      const response = await this.makeRequest<any>('/api/offers/redeemed/v1', requestBody);
      console.log('Raw API response:', JSON.stringify(response, null, 2));

      // Log the message from API
      if (response.messages) {
        console.log('API Messages:', response.messages);
      }

      const allRedeemedOffers = response.coupons || response.redeemedOffers || response.offers || [];
      const totalCount = allRedeemedOffers.length;
      console.log('Extracted redeemed offers:', totalCount);
      
      // Implement local pagination
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedOffers = allRedeemedOffers.slice(startIndex, endIndex);
      console.log(`Returning page ${page} with ${paginatedOffers.length} offers (${startIndex}-${endIndex-1} of ${totalCount})`);
      
      return {
        redeemedOffers: paginatedOffers.map((offer: any) => ({
          offerId: offer.id || offer.offerId,
          title: offer.brandName || offer.title || offer.name,
          description: offer.description || offer.summary || offer.desc,
          redeemedDate: offer.redeemedDate || offer.dateRedeemed,
          storeLocation: offer.storeLocation || offer.store,
          savings: offer.summary || offer.offerValue || offer.savings || offer.value,
        })),
        totalCount, // Total count of all redeemed offers
        page,
        size,
      };
    } catch (error) {
      console.error('Error getting redeemed offers from Walgreens API:', error);
      console.error('Error details:', error.message);
      
      // Return empty array to see actual API behavior
      return {
        redeemedOffers: [],
        totalCount: 0,
        page,
        size,
      };
    }
  }

  async getOfferStats(encLoyaltyId: string): Promise<OfferStats> {
    try {
      // Get all offers and calculate statistics
      const allOffers = await this.fetchOffers(encLoyaltyId, { page: 1, size: 50 });
      const clippedOffers = await this.listClipped(encLoyaltyId, 1, 50);
      const redeemedOffers = await this.listRedeemed(encLoyaltyId, undefined, undefined, 1, 50);

      // Calculate category statistics
      const categoryStats = new Map<string, { count: number, totalValue: number }>();
      
      allOffers.offers.forEach(offer => {
        const category = offer.categoryName || 'Other';
        const value = parseFloat(offer.summary?.replace(/[^0-9.]/g, '') || '0');
        
        if (!categoryStats.has(category)) {
          categoryStats.set(category, { count: 0, totalValue: 0 });
        }
        
        const stats = categoryStats.get(category)!;
        stats.count++;
        stats.totalValue += value;
      });

      const popularCategories = Array.from(categoryStats.entries())
        .map(([category, stats]) => ({
          category,
          count: stats.count,
          avgSavings: stats.totalValue / stats.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate total savings from redeemed offers
      const totalSavings = redeemedOffers.redeemedOffers.reduce((sum, offer) => {
        const savings = parseFloat(offer.savings?.replace(/[^0-9.]/g, '') || '0');
        return sum + savings;
      }, 0);

      return {
        totalSavings,
        clippedCount: clippedOffers.clippedOffers.length,
        redeemedCount: redeemedOffers.redeemedOffers.length,
        availableCount: allOffers.totalCount,
        popularCategories
      };
    } catch (error) {
      console.error('Error getting offer stats:', error);
      return {
        totalSavings: 0,
        clippedCount: 0,
        redeemedCount: 0,
        availableCount: 0,
        popularCategories: []
      };
    }
  }

  async getFilteredOffers(encLoyaltyId: string, filters: FilterOptions, page: number = 1, size: number = 20): Promise<OffersResponse> {
    try {
      // Get all offers first
      const allOffers = await this.fetchOffers(encLoyaltyId, { page: 1, size: 500 });
      let filteredOffers = allOffers.offers;

      // Apply filters
      if (filters.category) {
        filteredOffers = filteredOffers.filter(offer => 
          offer.categoryName?.toLowerCase().includes(filters.category!.toLowerCase())
        );
      }

      if (filters.brand) {
        filteredOffers = filteredOffers.filter(offer => 
          offer.brandName?.toLowerCase().includes(filters.brand!.toLowerCase())
        );
      }

      if (filters.minValue || filters.maxValue) {
        filteredOffers = filteredOffers.filter(offer => {
          const value = parseFloat(offer.summary?.replace(/[^0-9.]/g, '') || '0');
          if (filters.minValue && value < filters.minValue) return false;
          if (filters.maxValue && value > filters.maxValue) return false;
          return true;
        });
      }

      if (filters.expiringBefore) {
        const expiryDate = new Date(filters.expiringBefore);
        filteredOffers = filteredOffers.filter(offer => {
          const offerExpiry = new Date(offer.expiryDate);
          return offerExpiry <= expiryDate;
        });
      }

      // Apply sorting
      if (filters.sortBy) {
        filteredOffers.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (filters.sortBy) {
            case 'value':
              aValue = parseFloat(a.summary?.replace(/[^0-9.]/g, '') || '0');
              bValue = parseFloat(b.summary?.replace(/[^0-9.]/g, '') || '0');
              break;
            case 'expiry':
              aValue = new Date(a.expiryDate);
              bValue = new Date(b.expiryDate);
              break;
            case 'brand':
              aValue = a.brandName || '';
              bValue = b.brandName || '';
              break;
            case 'category':
              aValue = a.categoryName || '';
              bValue = b.categoryName || '';
              break;
            default:
              return 0;
          }
          
          const result = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          return filters.sortOrder === 'desc' ? -result : result;
        });
      }

      // Paginate results
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedOffers = filteredOffers.slice(startIndex, endIndex);

      return {
        offers: paginatedOffers,
        totalCount: filteredOffers.length,
        page,
        size
      };
    } catch (error) {
      console.error('Error getting filtered offers:', error);
      throw error;
    }
  }
  // Store Locator API Methods
  async searchStoresByLocation(lat: number, lng: number, radius: number = 10, page: number = 1, size: number = 20, filterOptions: string[] = []): Promise<StoreSearchResponse> {
    try {
      console.log('=== SEARCH STORES BY LOCATION ===');
      console.log('lat:', lat, 'lng:', lng, 'radius:', radius);
      console.log('filterOptions:', filterOptions);
      
      const body = {
        apiKey: this.config.apiKey,
        affId: this.config.affId,
        lat,
        lng,
        r: radius,
        s: size,
        p: page,
        requestType: "locator",
        filterOptions: filterOptions.length > 0 ? filterOptions : undefined,
        appVer: "1.0",
        devInf: "web,1.0"
      };

      const response = await this.makeRequest<any>('/api/stores/search/v2', body);
      
      if (!response.results || !Array.isArray(response.results)) {
        return { stores: [], totalCount: 0 };
      }

      const stores = response.results.map((result: any) => this.mapStoreFromAPI(result));
      
      return {
        stores,
        totalCount: response.results.length,
        message: response.message
      };
    } catch (error) {
      console.error('Error searching stores by location:', error);
      throw this.handleAPIError(error);
    }
  }

  async searchStoresByAddress(address: string, radius: number = 10, page: number = 1, size: number = 20, filterOptions: string[] = []): Promise<StoreSearchResponse> {
    try {
      console.log('=== SEARCH STORES BY ADDRESS ===');
      console.log('address:', address, 'radius:', radius);
      console.log('filterOptions:', filterOptions);
      
      const body = {
        apiKey: this.config.apiKey,
        affId: this.config.affId,
        address,
        r: radius,
        s: size,
        p: page,
        requestType: "locator",
        filterOptions: filterOptions.length > 0 ? filterOptions : undefined,
        appVer: "1.0",
        devInf: "web,1.0"
      };

      const response = await this.makeRequest<any>('/api/stores/search/v2', body);
      
      if (!response.results || !Array.isArray(response.results)) {
        return { stores: [], totalCount: 0 };
      }

      const stores = response.results.map((result: any) => this.mapStoreFromAPI(result));
      
      return {
        stores,
        totalCount: response.results.length,
        message: response.message
      };
    } catch (error) {
      console.error('Error searching stores by address:', error);
      throw this.handleAPIError(error);
    }
  }

  async searchStoresByZipCode(zipCode: string, radius: number = 10, page: number = 1, size: number = 20, filterOptions: string[] = []): Promise<StoreSearchResponse> {
    try {
      console.log('=== SEARCH STORES BY ZIP CODE ===');
      console.log('zipCode:', zipCode, 'radius:', radius);
      console.log('filterOptions:', filterOptions);
      
      const body = {
        apiKey: this.config.apiKey,
        affId: this.config.affId,
        zip: zipCode,
        r: radius,
        s: size,
        p: page,
        requestType: "locator",
        filterOptions: filterOptions.length > 0 ? filterOptions : undefined,
        appVer: "1.0",
        devInf: "web,1.0"
      };

      const response = await this.makeRequest<any>('/api/stores/search/v2', body);
      
      if (!response.results || !Array.isArray(response.results)) {
        return { stores: [], totalCount: 0 };
      }

      const stores = response.results.map((result: any) => this.mapStoreFromAPI(result));
      
      return {
        stores,
        totalCount: response.results.length,
        message: response.message
      };
    } catch (error) {
      console.error('Error searching stores by zip code:', error);
      throw this.handleAPIError(error);
    }
  }

  async getStoreDetails(storeNumber: string): Promise<Store> {
    try {
      console.log('=== GET STORE DETAILS ===');
      console.log('storeNumber:', storeNumber);
      
      const body = {
        apiKey: this.config.apiKey,
        affId: this.config.affId,
        storeNo: storeNumber,
        appVer: "1.0",
        devInf: "web,1.0"
      };

      const response = await this.makeRequest<any>('/api/stores/details/v1', body);
      
      return this.mapStoreDetailsFromAPI(response);
    } catch (error) {
      console.error('Error getting store details:', error);
      throw this.handleAPIError(error);
    }
  }

  async getAllStoreNumbers(): Promise<string[]> {
    try {
      console.log('=== GET ALL STORE NUMBERS ===');
      
      const body = {
        apiKey: this.config.apiKey,
        affId: this.config.affId,
        act: "storenumber",
        appVer: "1.0",
        devInf: "web,1.0"
      };

      const response = await this.makeRequest<any>('/api/util/storenumber/v1', body);
      
      return response.store || [];
    } catch (error) {
      console.error('Error getting store numbers:', error);
      throw this.handleAPIError(error);
    }
  }

  private mapStoreFromAPI(apiResult: any): Store {
    const store = apiResult.store || apiResult;
    
    return {
      storeNumber: store.storeNumber || apiResult.storeNumber,
      storeName: store.name || store.storeName || `Walgreens #${store.storeNumber || apiResult.storeNumber}`,
      address: {
        street: store.address?.street || '',
        city: store.address?.city || '',
        state: store.address?.state || '',
        zipCode: store.address?.zip || ''
      },
      phone: this.formatPhoneNumber(store.phone),
      distance: apiResult.distance || 0,
      coordinates: {
        latitude: parseFloat(apiResult.latitude || store.latitude || '0'),
        longitude: parseFloat(apiResult.longitude || store.longitude || '0')
      },
      hours: this.parseStoreHours(store.storeInfo || store),
      services: this.parseServices(store.serviceIndicators || []),
      isOpen: this.isStoreOpen(store, apiResult),
      pharmacy: store.pharmacy?.avail === 'Y' ? {
        phone: this.formatPhoneNumber(store.pharmacyPhoneNumber || store.phone),
        hours: this.parsePharmacyHours(store.pharmacy || store)
      } : undefined
    };
  }

  private mapStoreDetailsFromAPI(apiStore: any): Store {
    return {
      storeNumber: apiStore.storeNumber,
      storeName: apiStore.address?.locationName || `Walgreens #${apiStore.storeNumber}`,
      address: {
        street: apiStore.address?.street || '',
        city: apiStore.address?.city || '',
        state: apiStore.address?.state || '',
        zipCode: apiStore.address?.zip || ''
      },
      phone: this.formatPhoneNumber(apiStore.phone),
      distance: 0,
      coordinates: {
        latitude: parseFloat(apiStore.latitude || '0'),
        longitude: parseFloat(apiStore.longitude || '0')
      },
      hours: this.parseStoreHours(apiStore.storeInfo || apiStore),
      services: this.parseDetailedServices(apiStore.serviceIndicators || {}),
      isOpen: this.isStoreOpen(apiStore, apiStore),
      pharmacy: apiStore.pharmacy?.avail === 'Y' ? {
        phone: this.formatPhoneNumber(apiStore.pharmacyPhoneNumber || apiStore.phone),
        hours: this.parsePharmacyHours(apiStore.pharmacy || apiStore)
      } : undefined
    };
  }

  private formatPhoneNumber(phone: any): string {
    if (!phone) return '';
    
    if (phone.areaCode && phone.number) {
      return `(${phone.areaCode}) ${phone.number}`;
    }
    
    return phone.toString();
  }

  private parseStoreHours(storeInfo: any): { [key: string]: string } {
    const hours: { [key: string]: string } = {};
    
    if (storeInfo.hours && Array.isArray(storeInfo.hours)) {
      storeInfo.hours.forEach((hour: any) => {
        const day = hour.day?.toLowerCase();
        if (day) {
          if (hour['24Hrs']) {
            hours[day] = '24 horas';
          } else {
            hours[day] = `${hour.open || '8:00 AM'} - ${hour.close || '10:00 PM'}`;
          }
        }
      });
    }
    
    // Fill in missing days with default hours
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    daysOfWeek.forEach(day => {
      if (!hours[day]) {
        hours[day] = `${storeInfo.storeOpenTime || '8:00 AM'} - ${storeInfo.storeCloseTime || '10:00 PM'}`;
      }
    });
    
    return hours;
  }

  private parsePharmacyHours(pharmacy: any): { [key: string]: string } {
    const hours: { [key: string]: string } = {};
    
    if (pharmacy.hours && Array.isArray(pharmacy.hours)) {
      pharmacy.hours.forEach((hour: any) => {
        const day = hour.day?.toLowerCase();
        if (day) {
          if (hour['24Hrs']) {
            hours[day] = '24 horas';
          } else {
            hours[day] = `${hour.open || '9:00 AM'} - ${hour.close || '9:00 PM'}`;
          }
        }
      });
    }
    
    // Fill in missing days with default hours
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    daysOfWeek.forEach(day => {
      if (!hours[day]) {
        hours[day] = `${pharmacy.pharmacyOpenTime || '9:00 AM'} - ${pharmacy.pharmacyCloseTime || '9:00 PM'}`;
      }
    });
    
    return hours;
  }

  private parseServices(serviceIndicators: any): string[] {
    const services: string[] = [];
    
    if (Array.isArray(serviceIndicators)) {
      serviceIndicators.forEach((service: any) => {
        if (service.available === 'Y' || service.available === true) {
          services.push(service.name || service.description || 'Servicio Disponible');
        }
      });
    }
    
    return services;
  }

  private parseDetailedServices(serviceIndicators: any): string[] {
    const services: string[] = [];
    
    if (serviceIndicators.shop) {
      services.push(...serviceIndicators.shop.map((s: string) => `Tienda: ${s}`));
    }
    
    if (serviceIndicators.pharmacy) {
      services.push(...serviceIndicators.pharmacy.map((s: string) => `Farmacia: ${s}`));
    }
    
    if (serviceIndicators.photo) {
      services.push(...serviceIndicators.photo.map((s: string) => `Fotos: ${s}`));
    }
    
    if (serviceIndicators.otherPhotoServices) {
      services.push(...serviceIndicators.otherPhotoServices.map((s: string) => `Fotos Especiales: ${s}`));
    }
    
    return services;
  }

  private isStoreOpen(store: any, apiResult: any): boolean {
    // Check emergency status first
    if (apiResult.emerStatusValue === 'Temporarily Closed') {
      return false;
    }
    
    if (apiResult.emerStatusValue === 'Open with Restricted Hours') {
      return true; // Still open, but with restrictions
    }
    
    // Check if store is 24 hours
    if (store.twentyFourHr === 'Y' || store['24Hrs']) {
      return true;
    }
    
    // Default to checking current time (simplified)
    const now = new Date();
    const currentHour = now.getHours();
    
    // Assume most stores are open between 8 AM and 10 PM
    return currentHour >= 8 && currentHour < 22;
  }

  // Helper method to get available filter options
  static getAvailableFilterOptions(): { [key: string]: string } {
    return {
      "t4hr": "Tiendas abiertas 24 horas",
      "t4hr_rx": "Farmacias abiertas 24 horas",
      "dt": "Farmacia con Drive-Thru",
      "tc": "Clínica de Salud",
      "phi": "Laboratorio de Fotos",
      "cbw": "Cerveza y Vino",
      "cdr": "Duane Reade",
      "evc": "Estaciones de Carga Eléctrica",
      "rb": "Alquiler de DVD Redbox",
      "cpge": "Intercambio de Gas Propano Blue Rhino",
      "fs": "Vacunas contra la Gripe",
      "icp": "Vacuna contra la Varicela",
      "fsim": "Vacuna contra la Influenza",
      "iha": "Vacuna contra Hepatitis A",
      "ihb": "Vacuna contra Hepatitis B",
      "ihc": "Vacuna contra Hepatitis A/B",
      "ihpv": "Vacuna contra VPH",
      "ije": "Vacuna contra Encefalitis Japonesa",
      "imn": "Vacuna contra Meningitis",
      "immr": "Vacuna Triple Viral (MMR)",
      "ipn": "Vacuna contra Neumonía",
      "ipol": "Vacuna contra Polio",
      "irb": "Vacuna contra Rabia",
      "sv": "Vacuna contra Herpes Zóster",
      "iwc": "Vacuna Tdap",
      "itd": "Vacuna Td",
      "ity": "Vacuna contra Tifoidea",
      "iyf": "Vacuna contra Fiebre Amarilla",
      "hhs": "Apoyo para Hepatitis",
      "hiv": "Apoyo para VIH/SIDA",
      "chhc": "Soluciones de Cuidado en Casa",
      "his": "Apoyo para Infertilidad",
      "mc": "Preparación de Medicamentos",
      "hos": "Servicios Ópticos",
      "hts": "Apoyo para Trasplantes",
      "thsv_ind": "Consultas de Salud para Viajes"
    };
  }

  // Product Search API - Search products by name or barcode
  async searchProducts(query: string, page: number = 1, size: number = 20): Promise<any> {
    console.log('=== SEARCH PRODUCTS ===');
    console.log('query:', query);
    console.log('page:', page, 'size:', size);
    
    try {
      // Check if this is a barcode search
      if (this.isBarcode(query)) {
        console.log('Barcode detected, searching by UPC/EAN');
        // Try barcode-specific search first
        const barcodeBody = {
          upc: query,
          recSize: size,
          recStartIndex: page
        };

        try {
          const barcodeResponse = await this.makeRequest<any>('/api/products/barcode/v1', barcodeBody);
          if (barcodeResponse.product) {
            const product = barcodeResponse.product;
            return {
              products: [{
                id: product.id || product.productId || product.wic || query,
                name: product.name || product.productName || product.title || 'Producto encontrado',
                brand: product.brand || product.brandName || product.manufacturer,
                category: product.category || product.categoryName || 'General',
                price: product.price || product.regularPrice || product.salePrice,
                image: product.image || product.imageUrl || product.thumbnail,
                barcode: query,
                description: product.description || product.shortDescription
              }],
              totalCount: 1,
              page,
              size,
              query
            };
          }
        } catch (barcodeError) {
          console.log('Barcode search failed, trying general search');
        }
      }

      // General product search
      const body = {
        query: query,
        recSize: size,
        recStartIndex: page
      };

      const response = await this.makeRequest<any>('/api/products/search/v2', body);
      
      if (response.products && response.products.length > 0) {
        return {
          products: response.products.map((product: any) => ({
            id: product.id || product.productId || product.wic || query,
            name: product.name || product.productName || product.title || 'Producto encontrado',
            brand: product.brand || product.brandName || product.manufacturer,
            category: product.category || product.categoryName || 'General',
            price: product.price || product.regularPrice || product.salePrice,
            image: product.image || product.imageUrl || product.thumbnail,
            barcode: product.barcode || product.upc || product.ean || query,
            description: product.description || product.shortDescription
          })),
          totalCount: response.totalCount || response.total || response.products.length,
          page,
          size,
          query
        };
      } else {
        console.log('No products found in API response');
        // If no products found, return empty results - NO DEMO DATA
        return {
          products: [],
          totalCount: 0,
          page,
          size,
          query
        };
      }
    } catch (error) {
      console.error('Error searching products via API:', error);
      console.error('API Error details:', error.message);
      
      // NO DEMO FALLBACK - Only real API data
      if (error.message.includes('403') || error.message.includes('Unauthorised') || error.message.includes("Key doesn't Exists")) {
        throw new Error('Las credenciales API no tienen permisos para acceder a la búsqueda de productos. Contacta a Walgreens para obtener credenciales válidas para la API de productos.');
      }
      throw new Error(`Error en la API: ${error.message}`);
    }
  }

  // REMOVED: No demo products - only real API data

  // Store Inventory API - Check inventory for specific store
  async getStoreInventory(storeNumber: string, productIds?: string[]): Promise<any> {
    console.log('=== GET STORE INVENTORY ===');
    console.log('storeNumber:', storeNumber);
    console.log('productIds:', productIds);
    
    const body = {
      store: storeNumber,
      appVer: "1.0"
    };

    // Note: According to API docs, this endpoint returns inventory for ALL products in the store
    // Product filtering happens on the client side after receiving the response

    try {
      const response = await this.makeRequest<any>('/api/products/inventory/v4', body);
      
      console.log('Store inventory response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Error getting store inventory:', error);
      if (error.message.includes('403') || error.message.includes('Unauthorised') || error.message.includes("Key doesn't Exists")) {
        throw new Error('Las credenciales API no tienen permisos para acceder al inventario de la tienda. Contacta a Walgreens para obtener credenciales válidas para la API de inventario.');
      }
      throw new Error(`Error en la API de inventario: ${error.message}`);
    }
  }

  // Combined search and inventory check
  async searchProductsWithInventory(query: string, storeNumber: string, page: number = 1, size: number = 20): Promise<any> {
    console.log('=== SEARCH PRODUCTS WITH INVENTORY ===');
    console.log('query:', query, 'store:', storeNumber);
    
    try {
      // DISABLED: Direct UPC search causes false positives
      // Only using inventory-based search with strict filtering
      
      // Fallback to inventory-based search
      console.log('Falling back to inventory-based search...');
      const inventoryData = await this.getStoreInventory(storeNumber);
      
      if (!inventoryData || inventoryData.length === 0) {
        console.log('No inventory data found for store:', storeNumber);
        return {
          products: [],
          totalCount: 0,
          page,
          size,
          query
        };
      }
      
      console.log(`Found ${inventoryData.length} products in store inventory`);
      
      // STRICT filtering - only exact matches to prevent false positives
      const filteredInventory = inventoryData.filter((inv: any) => {
        const productId = inv.id || '';
        
        // For barcode search, use ONLY exact matching strategies
        if (this.isBarcode(query)) {
          console.log(`Testing barcode ${query} against inventory ID ${productId}`);
          
          // Strategy 1: Direct exact match
          if (productId === query) {
            console.log(`✓ Direct exact match: ${productId} === ${query}`);
            return true;
          }
          
          // Strategy 2: Match with standard UPC padding (12 digits)
          const paddedQuery = query.padStart(12, '0');
          if (productId === paddedQuery) {
            console.log(`✓ UPC padding match: ${productId} === ${paddedQuery}`);
            return true;
          }
          
          // Strategy 3: Match with inventory ID padding (18 digits)
          const paddedQueryLong = query.padStart(18, '0');
          if (productId === paddedQueryLong) {
            console.log(`✓ Inventory padding match: ${productId} === ${paddedQueryLong}`);
            return true;
          }
          
          // Strategy 4: Check if inventory ID contains the exact barcode at the end
          if (productId.endsWith(query) && productId.length > query.length) {
            console.log(`✓ Ends with match: ${productId} ends with ${query}`);
            return true;
          }
          
          // NO OTHER STRATEGIES - prevent false positives
          console.log(`✗ No match found for ${query} vs ${productId}`);
          return false;
        }
        
        // For text search, only search if query is long enough to be meaningful
        if (query.length >= 3) {
          const lowerQuery = query.toLowerCase();
          const lowerProductId = productId.toLowerCase();
          
          // Only match if query is a substantial part of the product ID
          if (lowerProductId.includes(lowerQuery) && lowerQuery.length >= 3) {
            console.log(`✓ Text search match: ${lowerProductId} contains ${lowerQuery}`);
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`Filtered to ${filteredInventory.length} products matching query`);
      
      // If no products found, provide detailed analysis
      if (filteredInventory.length === 0) {
        console.log(`=== NO MATCHES FOUND ===`);
        console.log(`Query: ${query}`);
        console.log(`Is barcode: ${this.isBarcode(query)}`);
        console.log(`Query length: ${query.length}`);
        console.log(`Store ${storeNumber} has ${inventoryData.length} total products`);
        
        // Show sample of what's in inventory for debugging
        const sampleInventory = inventoryData.slice(0, 5).map(inv => ({
          id: inv.id,
          quantity: inv.q
        }));
        console.log('Sample inventory IDs:', sampleInventory);
      }
      
      // Convert inventory data to product format and enrich with Add to Cart API data
      const products = await Promise.all(filteredInventory.map(async (inv: any) => {
        const productId = inv.id || 'unknown';
        const shortId = productId.replace(/^0+/, ''); // Remove leading zeros for display
        const quantity = inv.q || 0;
        const lastUpdated = inv.ut ? new Date(inv.ut) : null;
        
        // Try to get detailed product information using Add to Cart API
        let productDetails = null;
        console.log(`Attempting to get product details for ${productId}`);
        try {
          productDetails = await this.getProductDetails(productId);
          console.log(`Got product details for ${productId}:`, productDetails);
        } catch (error) {
          console.log(`Could not get product details for ${productId}:`, error.message);
        }
        
        // Return ONLY authentic data - no simulated product details
        if (productDetails) {
          return {
            id: productId,
            ...productDetails,
            inventory: {
              quantity: quantity,
              lastUpdated: lastUpdated,
              storeNumber: inv.s || storeNumber,
              inStock: quantity > 0,
              status: quantity > 0 ? 'En Stock' : 'Agotado',
              lastUpdatedFormatted: lastUpdated ? lastUpdated.toLocaleDateString('es-ES') : 'No disponible'
            }
          };
        } else {
          // Return only inventory data with product ID - no simulated details
          return {
            id: productId,
            name: `Producto encontrado en inventario`,
            brand: null,
            category: null,
            price: null,
            image: null,
            description: 'Producto encontrado en inventario de tienda. Información detallada no disponible.',
            inventory: {
              quantity: quantity,
              lastUpdated: lastUpdated,
              storeNumber: inv.s || storeNumber,
              inStock: quantity > 0,
              status: quantity > 0 ? 'En Stock' : 'Agotado',
              lastUpdatedFormatted: lastUpdated ? lastUpdated.toLocaleDateString('es-ES') : 'No disponible'
            }
          };
        }
      }));
      
      // Apply pagination
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedProducts = products.slice(startIndex, endIndex);
      
      return {
        products: paginatedProducts,
        totalCount: products.length,
        page,
        size,
        query
      };
      
    } catch (error) {
      console.error('Error searching products with inventory:', error);
      return {
        products: [],
        totalCount: 0,
        page,
        size,
        query
      };
    }
  }

  // Helper method to detect if query is a barcode
  private isBarcode(query: string): boolean {
    // Check if query is numeric and has typical barcode lengths
    const numericQuery = query.replace(/\D/g, '');
    return numericQuery.length >= 8 && numericQuery.length <= 14 && numericQuery === query;
  }

  // Generate a unique client cart ID for Add to Cart API
  private generateClientCartId(): string {
    return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate Client ID for Add to Cart API (requires SSL certificate from Walgreens)
  private generateClientId(clientKey: string, skuId: string, clientCartId: string): string {
    // TODO: Implement when SSL certificate is obtained from Walgreens team
    // Process:
    // 1. Create payload with: affId, apiKey, clientCartId, timestamp
    // 2. Encrypt with RSA using X509 public certificate from Walgreens
    // 3. Base64 encode the encrypted payload
    
    // Check if SSL certificate is available
    const sslCertificate = process.env.WALGREENS_SSL_CERTIFICATE;
    const privateKey = process.env.WALGREENS_PRIVATE_KEY;
    
    if (sslCertificate && privateKey) {
      // Implementation with real SSL certificate
      const payload = JSON.stringify({
        affId: this.config.affId,
        apiKey: this.config.apiKey,
        clientCartId: clientCartId,
        timestamp: Date.now(),
        skuId: skuId
      });
      
      // In production, use crypto module to encrypt with SSL certificate
      // const crypto = require('crypto');
      // const encrypted = crypto.publicEncrypt(sslCertificate, Buffer.from(payload));
      // return encrypted.toString('base64');
      
      console.log('SSL certificate available - would encrypt payload:', payload);
      return "SSL_CERTIFICATE_AVAILABLE_BUT_ENCRYPTION_NOT_IMPLEMENTED";
    }
    
    // Request SSL certificate from Walgreens team
    console.log('=== SSL CERTIFICATE REQUIRED ===');
    console.log('Contact: developers@walgreens.com');
    console.log('Request: Add to Cart API SSL certificate');
    console.log('Include: affId, business purpose, estimated volume');
    
    return "CONTACT_WALGREENS_FOR_SSL_CERTIFICATE";
  }

  // Make request specifically for Add to Cart API with correct parameters
  private async makeAddToCartRequest<T>(skuId: string, qty: number = 1, type: string = "SKU"): Promise<T> {
    const url = 'https://services-qa.walgreens.com/api/cart/addToCart/v1';
    const clientCartId = this.generateClientCartId();
    
    // Create request body with correct parameters as shown in documentation
    const body = {
      affId: this.config.affId,
      apiKey: this.config.apiKey,
      clientId: this.generateClientId("", skuId, clientCartId), // Still needs SSL cert
      clientCartId: clientCartId,
      products: [
        {
          skuId: skuId,
          qty: qty.toString(),
          type: type
        }
      ]
    };
    
    console.log(`Making Add to Cart request to: ${url}`);
    console.log('Request body:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`Add to Cart response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Add to Cart API Error:', errorText);
      throw new Error(`Add to Cart API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Add to Cart response data:', JSON.stringify(data, null, 2));
    
    return data;
  }

  // Get detailed product information using Add to Cart API - ONLY AUTHENTIC DATA
  async getProductDetails(skuId: string): Promise<any> {
    console.log('=== GET PRODUCT DETAILS ===');
    console.log('SKU ID:', skuId);
    
    // Attempt to get authentic product details from Add to Cart API
    try {
      console.log('Attempting Add to Cart API call for authentic product details...');
      const enhancedDetails = await this.makeAddToCartRequest(skuId, 1, "SKU");
      
      // If successful, return ONLY authentic API data
      console.log('Add to Cart API SUCCESS - Authentic details retrieved!');
      return enhancedDetails;
      
    } catch (error) {
      console.log('Add to Cart API failed - no authentic data available:', error.message);
      
      // Return null - NO SIMULATED DATA
      return null;
    }
  }

  // NEW: Check product availability using the v4 endpoint with planograms - CORRECT ENDPOINT
  async checkProductAvailabilityV4(upc: string, storeNumber: string): Promise<any> {
    console.log(`=== CHECK PRODUCT AVAILABILITY V4 ===`);
    console.log(`UPC: ${upc}`);
    console.log(`Store: ${storeNumber}`);
    
    // Get API key from database pool
    const keyConfig = await this.getNextAPIKey();
    
    const body = {
      apiKey: keyConfig.apiKey,
      affId: keyConfig.affId,
      store: storeNumber,
      planograms: [upc]
    };

    try {
      const response = await fetch('https://services.walgreens.com/api/products/inventory/v4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      console.log(`V4 API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('V4 API Error:', errorText);
        throw new Error(`V4 API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('V4 API response:', JSON.stringify(data, null, 2));
      
      // Only return data if it actually contains meaningful product information
      if (data && Array.isArray(data) && data.length > 0) {
        const firstResult = data[0];
        // Check if the result has actual product information
        if (firstResult && firstResult.id && firstResult.q !== undefined) {
          return data;
        }
      }
      
      // If no valid product data found, return null
      console.log('V4 API returned no valid product data');
      return null;
    } catch (error) {
      console.error('Error with V4 API:', error);
      throw error;
    }
  }

  // NEW: Direct UPC search method - Uses V2 endpoint first, then inventory fallback
  async searchProductByUPC(upc: string, storeNumber: string): Promise<any> {
    try {
      console.log(`=== SEARCH PRODUCT BY UPC ===`);
      console.log(`UPC: ${upc}`);
      console.log(`Store: ${storeNumber}`);
      
      // Step 1: Try V4 endpoint with correct API key for products
      console.log(`Step 1: Trying V4 endpoint with correct products API key`);
      try {
        const v4Result = await this.checkProductAvailabilityV4(upc, storeNumber);
        
        if (v4Result) {
          console.log('V4 endpoint returned data:', v4Result);
          
          // Only return result if V4 actually found valid product data
          if (Array.isArray(v4Result) && v4Result.length > 0) {
            return {
              success: true,
              product: v4Result,
              upc: upc,
              searchMethod: 'v4_planograms'
            };
          }
        }
      } catch (error) {
        console.log('V4 endpoint error with products API key, trying inventory fallback:', error);
      }
      
      // Step 2: Fallback to V4 inventory search
      console.log(`Step 2: Getting inventory for store ${storeNumber}`);
      const inventoryData = await this.getStoreInventory(storeNumber);
      
      if (!inventoryData || inventoryData.length === 0) {
        console.log(`No inventory data found for store ${storeNumber}`);
        return null;
      }
      
      // Step 3: Search for UPC in inventory using various matching strategies
      console.log(`Step 3: Searching for UPC ${upc} in ${inventoryData.length} inventory items`);
      
      const inventoryItem = inventoryData.find((inv: any) => {
        const productId = inv.id || '';
        
        console.log(`Testing UPC ${upc} against inventory ID ${productId}`);
        
        // STRICT matching - only exact matches to prevent false positives
        
        // Strategy 1: Direct exact match
        if (productId === upc) {
          console.log(`✓ Direct exact match: ${productId} === ${upc}`);
          return true;
        }
        
        // Strategy 2: Match with standard UPC padding (12 digits)
        const paddedUPC = upc.padStart(12, '0');
        if (productId === paddedUPC) {
          console.log(`✓ UPC padding match: ${productId} === ${paddedUPC}`);
          return true;
        }
        
        // Strategy 3: Match with inventory ID padding (18 digits)
        const paddedUPCLong = upc.padStart(18, '0');
        if (productId === paddedUPCLong) {
          console.log(`✓ Inventory padding match: ${productId} === ${paddedUPCLong}`);
          return true;
        }
        
        // Strategy 4: Check if inventory ID contains the exact UPC at the end
        if (productId.endsWith(upc) && productId.length > upc.length) {
          console.log(`✓ Ends with match: ${productId} ends with ${upc}`);
          return true;
        }
        
        // NO OTHER STRATEGIES - prevent false positives
        console.log(`✗ No match found for ${upc} vs ${productId}`);
        return false;
      });
      
      if (!inventoryItem) {
        console.log(`UPC ${upc} not found in inventory`);
        return null;
      }
      
      const productId = inventoryItem.id;
      const quantity = inventoryItem.q || 0;
      const lastUpdated = inventoryItem.ut ? new Date(inventoryItem.ut) : new Date();
      
      console.log(`Found product in inventory:`, {
        productId: productId,
        quantity: quantity,
        lastUpdated: lastUpdated.toISOString()
      });
      
      // Return ONLY authentic inventory data - NO SIMULATED DATA
      return {
        id: productId,
        inventory: {
          quantity: quantity,
          lastUpdated: lastUpdated.toISOString(),
          storeNumber: storeNumber,
          inStock: quantity > 0,
          status: quantity > 0 ? 'En Stock' : 'Agotado',
          lastUpdatedFormatted: lastUpdated.toLocaleDateString('es-ES')
        },
        foundInInventory: true,
        searchMethod: 'authentic_inventory_only'
      };
      
    } catch (error) {
      console.error('Error in direct UPC search:', error);
      return null;
    }
  }

  // Helper method to increment request count with database persistence
  private async incrementKeyRequestCount(keyName: string): Promise<void> {
    try {
      // Find the key and update in-memory counter
      const key = this.apiKeyPool.find(k => k.name === keyName);
      if (key) {
        // CRITICAL: This increment was already done in getNextAPIKey before making request
        // So we only need to persist to database here
        const { storage } = await import('../storage');
        await storage.updateApiKeyRequestCount(keyName, key.requestCount);
      }
    } catch (error) {
      console.error(`Failed to persist request count for ${keyName}:`, error);
    }
  }
}

export const walgreensAPI = new WalgreensAPIService();

// Helper function to generate SSL certificate request
export function generateSSLCertificateRequest(affId: string, businessPurpose: string, estimatedVolume: number): string {
  const requestTemplate = `
=== WALGREENS ADD TO CART API SSL CERTIFICATE REQUEST ===

Para: developers@walgreens.com
Asunto: Solicitud de Certificado SSL para Add to Cart API

Estimado Equipo de Walgreens API,

Solicito acceso al certificado SSL para integrar el Add to Cart API en mi aplicación.

INFORMACIÓN DE LA APLICACIÓN:
- Affiliate ID: ${affId}
- Propósito: ${businessPurpose}
- Volumen estimado: ${estimatedVolume} requests/día
- Tipo de integración: Add to Cart API v1

REQUERIMIENTOS TÉCNICOS:
- Certificado SSL X.509 público
- Documentación para generar clientId
- Especificaciones de encriptación RSA
- Guía de implementación

INFORMACIÓN ADICIONAL:
- Endpoint actual: https://services-qa.walgreens.com/api/cart/addToCart/v1
- Estado actual: Código 905 (Invalid Client ID - SSL Certificate Required)
- Implementación lista para certificado SSL

Gracias por su asistencia.

=== FIN DE SOLICITUD ===
  `;
  
  return requestTemplate.trim();
}
