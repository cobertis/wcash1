import { 
  members, 
  offers, 
  clippedOffers, 
  redeemedOffers,
  memberHistory,
  jobExecutionHistory,
  jobResultsDetail,
  bulkVerificationJobs,
  balanceRewardsActivities,
  balanceRewardsTokens,
  apiKeyPool,
  scanFiles,
  scanSessions,
  scanQueue,
  scanResults,
  backfillJobs,
  type Member, 
  type InsertMember,
  type Offer,
  type InsertOffer,
  type ClippedOffer,
  type InsertClippedOffer,
  type RedeemedOffer,
  type InsertRedeemedOffer,
  type MemberHistory,
  type InsertMemberHistory,
  type JobExecutionHistory,
  type InsertJobExecutionHistory,
  type JobResultsDetail,
  type InsertJobResultsDetail,
  type BalanceRewardsActivity,
  type InsertBalanceRewardsActivity,
  type BalanceRewardsToken,
  type InsertBalanceRewardsToken,
  type ApiKeyPool,
  type InsertApiKeyPool,
  type ScanFile,
  type InsertScanFile,
  type ScanSession,
  type InsertScanSession,
  type ScanQueue,
  type InsertScanQueue,
  type ScanResult,
  type InsertScanResult,
  type BackfillJob,
  type InsertBackfillJob
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, gte, lte, lt, isNotNull, ne, or } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import zipcodes from "zipcodes";

// Cache invalidation system for optimized endpoints
class CacheInvalidator {
  private static instance: CacheInvalidator;
  private cacheKeys: Set<string> = new Set();
  
  static getInstance(): CacheInvalidator {
    if (!CacheInvalidator.instance) {
      CacheInvalidator.instance = new CacheInvalidator();
    }
    return CacheInvalidator.instance;
  }
  
  invalidateAll() {
    console.log('🔄 CACHE INVALIDATION: Clearing all optimized endpoint caches');
    this.cacheKeys.clear();
    // Force refresh of optimized endpoints by clearing any in-memory caches
    if (typeof global !== 'undefined') {
      (global as any).optimizedCacheCleared = Date.now();
    }
  }
  
  invalidateAccountsCache() {
    console.log('📊 CACHE INVALIDATION: Clearing accounts cache (100+, 50+, etc.)');
    this.invalidateAll(); // For now, invalidate all when accounts change
  }
}

const cacheInvalidator = CacheInvalidator.getInstance();

// Load ZIP to State mapping
let zipStateMapping: { stateToZips: Record<string, string[]>; zipToState: Record<string, string> } | null = null;

function loadZipStateMapping() {
  if (!zipStateMapping) {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const mappingPath = join(__dirname, 'zip-state-mapping.json');
      const data = JSON.parse(readFileSync(mappingPath, 'utf-8'));
      
      // Create reverse mapping (zipToState)
      const zipToState: Record<string, string> = {};
      for (const [state, zips] of Object.entries(data.stateToZips as Record<string, string[]>)) {
        for (const zip of zips) {
          const cleanZip = zip.split('-')[0];
          zipToState[cleanZip] = state;
        }
      }
      
      zipStateMapping = {
        stateToZips: data.stateToZips,
        zipToState
      };
      
      console.log(`✅ Loaded ZIP-State mapping: ${Object.keys(zipStateMapping.stateToZips).length} states, ${Object.keys(zipToState).length} ZIP codes`);
    } catch (error) {
      console.error('❌ Failed to load ZIP-State mapping:', error);
      zipStateMapping = { stateToZips: {}, zipToState: {} };
    }
  }
  return zipStateMapping;
}

// Initialize mapping on module load
loadZipStateMapping();

/**
 * Helper function to convert ZIP code to state abbreviation
 * Uses the "zipcodes" npm library for complete US ZIP code coverage (42,000+ ZIP codes)
 * @param zipCode - ZIP code string (handles formats like "33185" or "33185-5422")
 * @returns State abbreviation (e.g., "FL") or empty string if not found
 */
export function zipCodeToState(zipCode: string): string {
  if (!zipCode) {
    return '';
  }
  
  try {
    // Clean the ZIP code (remove suffix like -5422)
    const cleanZip = zipCode.toString().split('-')[0].trim();
    
    // Use zipcodes library for complete coverage
    const result = zipcodes.lookup(cleanZip);
    
    if (result && result.state) {
      return result.state;
    }
    
    // Fallback to local mapping if zipcodes library fails
    const mapping = loadZipStateMapping();
    if (mapping && mapping.zipToState) {
      return mapping.zipToState[cleanZip] || '';
    }
    
    return '';
  } catch (error) {
    console.error(`Error looking up state for ZIP ${zipCode}:`, error);
    return '';
  }
}

export interface IStorage {
  // Member operations
  getMemberByPhone(phoneNumber: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  assignStoreToMember(phoneNumber: string, storeData: {
    storeNumber: string;
    storeName: string;
    storeAddress: any;
    storePhone: string;
  }): Promise<Member>;
  
  // Offer operations
  getOfferById(offerId: string): Promise<Offer | undefined>;
  getOffers(page: number, size: number, category?: string): Promise<Offer[]>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOffer(offerId: string, offer: Partial<InsertOffer>): Promise<Offer>;
  
  // Clipped offer operations
  getClippedOffers(encLoyaltyId: string, page: number, size: number): Promise<ClippedOffer[]>;
  createClippedOffer(clippedOffer: InsertClippedOffer): Promise<ClippedOffer>;
  removeClippedOffer(encLoyaltyId: string, offerId: string): Promise<boolean>;
  
  // Redeemed offer operations
  getRedeemedOffers(encLoyaltyId: string, startDate?: string, endDate?: string, page?: number, size?: number): Promise<RedeemedOffer[]>;
  createRedeemedOffer(redeemedOffer: InsertRedeemedOffer): Promise<RedeemedOffer>;
  
  // Member history operations (optimized)
  getMemberHistory(page?: number, size?: number): Promise<MemberHistory[]>;
  getMemberHistoryCount(): Promise<number>;
  getMemberHistoryValidCount(): Promise<number>;
  getMemberHistoryFast(limit?: number): Promise<MemberHistory[]>; // Fast query for production
  getMemberHistoryByDate(date: Date): Promise<MemberHistory[]>; // Get accounts by specific date
  getAccountsWithTodayActivity(todayString: string): Promise<MemberHistory[]>; // Get accounts with today's activity
  getMemberHistorySummary(): Promise<{
    accounts100Plus: number;
    accounts50Plus: number;
    accounts20Plus: number;
    accounts10Plus: number;
    accounts5Plus: number;
    newAccounts: number;
    total: number;
  }>; // Ultra-fast summary for sidebar
  createMemberHistory(memberHistory: InsertMemberHistory): Promise<MemberHistory>;
  updateMemberHistory(phoneNumber: string, memberData: any): Promise<MemberHistory>;
  
  // Job execution history operations
  getJobExecutionHistory(): Promise<JobExecutionHistory[]>;
  getJobExecutionHistoryById(jobId: string): Promise<JobExecutionHistory | undefined>;
  createJobExecutionHistory(jobHistory: InsertJobExecutionHistory): Promise<JobExecutionHistory>;
  updateJobExecutionHistory(jobId: string, updates: Partial<InsertJobExecutionHistory>): Promise<JobExecutionHistory>;
  updateJobExecutionStatus(jobId: string, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void>;
  
  // Job results detail operations
  getJobResultsDetail(jobId: string): Promise<JobResultsDetail[]>;
  createJobResultsDetail(jobResult: InsertJobResultsDetail): Promise<JobResultsDetail>;
  createManyJobResultsDetail(jobResults: InsertJobResultsDetail[]): Promise<JobResultsDetail[]>;
  
  // Duplicate cleanup operations
  cleanupDuplicates(): Promise<number>;
  
  // Phone numbers queue operations
  getPhoneNumbersQueue(status?: 'pending' | 'valid' | 'invalid', page?: number, size?: number): Promise<PhoneNumbersQueue[]>;
  getPhoneNumbersQueueCount(status?: 'pending' | 'valid' | 'invalid'): Promise<number>;
  addPhoneNumbersToQueue(phoneNumbers: string[]): Promise<PhoneNumbersQueue[]>;
  addPhoneNumbersToQueueBatch(phoneNumbers: string[], batchSize?: number): Promise<{
    processed: number;
    added: number;
    skipped: number;
    total: number;
  }>;
  updatePhoneNumberStatus(phoneNumber: string, status: 'valid' | 'invalid', memberData?: any, errorMessage?: string): Promise<PhoneNumbersQueue | undefined>;
  getPendingPhoneNumbers(limit?: number): Promise<PhoneNumbersQueue[]>;
  getValidPhoneNumbers(limit?: number): Promise<PhoneNumbersQueue[]>;
  resetRecentProcessedNumbers(count: number): Promise<number>;
  getPhoneNumbersQueueStats(): Promise<{
    total: number;
    pending: number;
    valid: number;
    invalid: number;
  }>;
  clearPhoneNumberQueue(): Promise<void>;
  
  // Member marking operations
  markMemberAsUsed(phoneNumber: string): Promise<void>;
  unmarkMemberAsUsed(phoneNumber: string): Promise<void>;
  resetMidnightMarkedAccounts(): Promise<void>;
  resetMarkedAccounts(): Promise<{ resetCount: number }>;
  
  // Background scanner operations
  getAllPhoneNumbers(): Promise<string[]>;
  
  // Phone numbers queue cleanup operations
  cleanPhoneNumbersQueue(existingPhones: string[]): Promise<number>;
  
  // Bulk verification job operations
  saveBulkVerificationJob(job: any): Promise<void>;
  getBulkVerificationJob(jobId: string): Promise<any | undefined>;
  updateBulkVerificationJobStatus(jobId: string, status: string): Promise<void>;
  updateBulkVerificationJobProgress(jobId: string, processedNumbers: number, validNumbers: number, results: any[]): Promise<void>;
  
  // Balance Rewards operations
  createBalanceRewardsActivity(activity: InsertBalanceRewardsActivity): Promise<BalanceRewardsActivity>;
  getBalanceRewardsActivities(memberPhone: string): Promise<BalanceRewardsActivity[]>;
  updateBalanceRewardsActivity(id: number, updates: Partial<InsertBalanceRewardsActivity>): Promise<BalanceRewardsActivity>;
  
  // OAuth Token operations
  createBalanceRewardsToken(token: InsertBalanceRewardsToken): Promise<BalanceRewardsToken>;
  getBalanceRewardsToken(memberPhone: string): Promise<BalanceRewardsToken | undefined>;
  updateBalanceRewardsToken(memberPhone: string, updates: Partial<InsertBalanceRewardsToken>): Promise<BalanceRewardsToken>;
  
  // API Key Pool operations
  getAllApiKeys(): Promise<ApiKeyPool[]>;
  getApiKeyByName(name: string): Promise<ApiKeyPool | undefined>;
  createApiKey(apiKey: InsertApiKeyPool): Promise<ApiKeyPool>;
  updateApiKey(name: string, updates: Partial<ApiKeyPool>): Promise<boolean>;
  updateApiKeyRequestCount(name: string, requestCount: number): Promise<void>;
  updateApiKeyLastReset(name: string): Promise<void>;
  removeApiKey(name: string): Promise<void>;
  bulkReplaceApiKeys(apiKeys: string[], affId: string): Promise<{ count: number }>;
  
  // Scanner file management
  addScanFile(filename: string, fileContent: string, totalNumbers: number): Promise<ScanFile>;
  getScanFiles(): Promise<ScanFile[]>;
  updateScanFileProgress(id: number, processed: number, valid: number, invalid: number): Promise<void>;
  
  // Scanner queue operations
  addNumbersToScanQueue(phoneNumbers: string[], fileId?: number): Promise<{added: number; skipped: number}>;
  getNextPendingNumbers(limit: number): Promise<ScanQueue[]>;
  markNumberAsProcessed(phoneNumber: string, status: 'completed' | 'invalid' | 'error_retryable' | 'error_permanent', result?: any, errorCode?: string, errorMessage?: string, errorIsRetryable?: boolean): Promise<void>;
  
  // Scanner results operations
  addScanResult(result: InsertScanResult): Promise<void>;
  getScanResults(limit?: number, offset?: number): Promise<ScanResult[]>;
  
  // Scanner sessions operations
  createScanSession(): Promise<ScanSession>;
  updateScanSession(id: number, data: Partial<ScanSession>): Promise<void>;
  getActiveScanSession(): Promise<ScanSession | null>;
  
  // Downloads system operations
  getAccountsWithFilters(filters: {
    downloaded?: boolean;
    zipCode?: string;
    state?: string;
    minBalance?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ accounts: MemberHistory[]; total: number }>;
  getAllAccountIdsWithFilters(filters: {
    downloaded?: boolean;
    zipCode?: string;
    state?: string;
  }): Promise<number[]>;
  markAccountsAsDownloaded(accountIds: number[]): Promise<void>;
  getAvailableStates(): string[];
  getZipToStateMapping(): Record<string, string>;
  
  // Backfill operations
  createBackfillJob(data: Partial<InsertBackfillJob>): Promise<BackfillJob>;
  updateBackfillJob(id: number, data: Partial<BackfillJob>): Promise<void>;
  getActiveBackfillJob(): Promise<BackfillJob | null>;
  getAccountsWithoutZipCode(limit: number, offset: number): Promise<MemberHistory[]>;
  getAccountsWithoutZipCodeCount(): Promise<number>;
  updateMemberZipAndState(phoneNumber: string, zipCode: string, state: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private members: Map<string, Member>;
  private membersByPhone: Map<string, Member>;
  private offers: Map<string, Offer>;
  private clippedOffers: Map<string, ClippedOffer[]>;
  private redeemedOffers: Map<string, RedeemedOffer[]>;
  private memberHistoryMap: Map<string, MemberHistory>;
  private hiddenOffers: Map<string, Set<string>>; // encLoyaltyId -> Set of hidden offer IDs
  private balanceRewardsActivities: Map<string, BalanceRewardsActivity[]>;
  private balanceRewardsTokens: Map<string, BalanceRewardsToken>;
  private apiKeys: Map<string, ApiKeyPool>;
  private currentMemberId: number = 1;
  private currentOfferId: number = 1;
  private currentClippedId: number = 1;
  private currentRedeemedId: number = 1;
  private currentHistoryId: number = 1;
  private currentActivityId: number = 1;
  private currentTokenId: number = 1;
  private currentApiKeyId: number = 1;

  constructor() {
    this.members = new Map();
    this.membersByPhone = new Map();
    this.offers = new Map();
    this.clippedOffers = new Map();
    this.redeemedOffers = new Map();
    this.memberHistoryMap = new Map();
    this.hiddenOffers = new Map();
    this.balanceRewardsActivities = new Map();
    this.balanceRewardsTokens = new Map();
    this.apiKeys = new Map();
  }



  async getMemberByPhone(phoneNumber: string): Promise<Member | undefined> {
    return this.membersByPhone.get(phoneNumber);
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const member: Member = {
      id: this.currentMemberId++,
      phoneNumber: insertMember.phoneNumber,
      assignedStoreNumber: insertMember.assignedStoreNumber ?? null,
      assignedStoreName: insertMember.assignedStoreName ?? null,
      assignedStoreAddress: insertMember.assignedStoreAddress ?? null,
      assignedStorePhone: insertMember.assignedStorePhone ?? null,
      storeAssignedAt: insertMember.storeAssignedAt ?? null,
      createdAt: new Date(),
    };
    this.membersByPhone.set(member.phoneNumber, member);
    return member;
  }

  async assignStoreToMember(phoneNumber: string, storeData: {
    storeNumber: string;
    storeName: string;
    storeAddress: any;
    storePhone: string;
  }): Promise<Member> {
    let existingMember = this.membersByPhone.get(phoneNumber);
    if (!existingMember) {
      // Create new member if doesn't exist
      existingMember = await this.createMember({
        phoneNumber: phoneNumber,
        assignedStoreNumber: storeData.storeNumber,
        assignedStoreName: storeData.storeName,
        assignedStoreAddress: storeData.storeAddress,
        assignedStorePhone: storeData.storePhone,
        storeAssignedAt: new Date(),
      });
    } else {
      // Update existing member
      const updatedMember = { 
        ...existingMember, 
        assignedStoreNumber: storeData.storeNumber,
        assignedStoreName: storeData.storeName,
        assignedStoreAddress: storeData.storeAddress,
        assignedStorePhone: storeData.storePhone,
        storeAssignedAt: new Date(),
      };
      this.membersByPhone.set(phoneNumber, updatedMember);
      return updatedMember;
    }
    return existingMember;
  }



  async getOfferById(offerId: string): Promise<Offer | undefined> {
    return this.offers.get(offerId);
  }

  async getOffers(page: number, size: number, category?: string): Promise<Offer[]> {
    const allOffers = Array.from(this.offers.values());
    let filteredOffers = allOffers;
    
    if (category) {
      filteredOffers = allOffers.filter(offer => offer.category === category);
    }
    
    const start = (page - 1) * size;
    const end = start + size;
    return filteredOffers.slice(start, end);
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const offer: Offer = {
      id: this.currentOfferId++,
      offerId: insertOffer.offerId,
      title: insertOffer.title,
      description: insertOffer.description ?? null,
      discount: insertOffer.discount ?? null,
      category: insertOffer.category ?? null,
      imageUrl: insertOffer.imageUrl ?? null,
      expiryDate: insertOffer.expiryDate ?? null,
      status: insertOffer.status ?? "active",
      offerData: insertOffer.offerData ?? null,
      createdAt: new Date(),
    };
    this.offers.set(offer.offerId, offer);
    return offer;
  }

  async updateOffer(offerId: string, updateData: Partial<InsertOffer>): Promise<Offer> {
    const existingOffer = this.offers.get(offerId);
    if (!existingOffer) {
      throw new Error("Offer not found");
    }
    
    const updatedOffer = { ...existingOffer, ...updateData };
    this.offers.set(offerId, updatedOffer);
    return updatedOffer;
  }

  async getClippedOffers(encLoyaltyId: string, page: number, size: number): Promise<ClippedOffer[]> {
    const userClippedOffers = this.clippedOffers.get(encLoyaltyId) || [];
    const start = (page - 1) * size;
    const end = start + size;
    return userClippedOffers.slice(start, end);
  }

  async createClippedOffer(insertClippedOffer: InsertClippedOffer): Promise<ClippedOffer> {
    const clippedOffer: ClippedOffer = {
      id: this.currentClippedId++,
      encLoyaltyId: insertClippedOffer.encLoyaltyId,
      offerId: insertClippedOffer.offerId,
      channel: insertClippedOffer.channel ?? "web",
      status: insertClippedOffer.status ?? "active",
      clippedAt: new Date(),
    };
    
    const userClippedOffers = this.clippedOffers.get(insertClippedOffer.encLoyaltyId) || [];
    userClippedOffers.push(clippedOffer);
    this.clippedOffers.set(insertClippedOffer.encLoyaltyId, userClippedOffers);
    
    return clippedOffer;
  }

  async removeClippedOffer(encLoyaltyId: string, offerId: string): Promise<boolean> {
    const userClippedOffers = this.clippedOffers.get(encLoyaltyId) || [];
    const initialLength = userClippedOffers.length;
    
    const filteredOffers = userClippedOffers.filter(offer => offer.offerId !== offerId);
    this.clippedOffers.set(encLoyaltyId, filteredOffers);
    
    return filteredOffers.length < initialLength;
  }

  async getRedeemedOffers(encLoyaltyId: string, startDate?: string, endDate?: string, page: number = 1, size: number = 20): Promise<RedeemedOffer[]> {
    const userRedeemedOffers = this.redeemedOffers.get(encLoyaltyId) || [];
    let filteredOffers = userRedeemedOffers;
    
    if (startDate || endDate) {
      filteredOffers = userRedeemedOffers.filter(offer => {
        const offerDate = new Date(offer.redeemedDate);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        return offerDate >= start && offerDate <= end;
      });
    }
    
    const start = (page - 1) * size;
    const end = start + size;
    return filteredOffers.slice(start, end);
  }

  async createRedeemedOffer(insertRedeemedOffer: InsertRedeemedOffer): Promise<RedeemedOffer> {
    const redeemedOffer: RedeemedOffer = {
      id: this.currentRedeemedId++,
      encLoyaltyId: insertRedeemedOffer.encLoyaltyId,
      offerId: insertRedeemedOffer.offerId,
      redeemedDate: insertRedeemedOffer.redeemedDate,
      storeLocation: insertRedeemedOffer.storeLocation ?? null,
      savings: insertRedeemedOffer.savings ?? null,
      redemptionData: insertRedeemedOffer.redemptionData ?? null,
      createdAt: new Date(),
    };
    
    const userRedeemedOffers = this.redeemedOffers.get(insertRedeemedOffer.encLoyaltyId) || [];
    userRedeemedOffers.push(redeemedOffer);
    this.redeemedOffers.set(insertRedeemedOffer.encLoyaltyId, userRedeemedOffers);
    
    return redeemedOffer;
  }

  async getMemberHistory(page: number = 1, size: number = 20): Promise<MemberHistory[]> {
    const allHistory = Array.from(this.memberHistoryMap.values());
    const sorted = allHistory.sort((a, b) => {
      // Ordenar por recompensas disponibles (más dinero arriba)
      const balanceA = a.currentBalance || 0;
      const balanceB = b.currentBalance || 0;
      if (balanceB !== balanceA) {
        return balanceB - balanceA;
      }
      // Si las recompensas son iguales, ordenar por fecha de acceso
      return new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime();
    });
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return sorted.slice(startIndex, endIndex);
  }

  async getMemberHistoryCount(): Promise<number> {
    return this.memberHistoryMap.size;
  }

  async createMemberHistory(insertMemberHistory: InsertMemberHistory): Promise<MemberHistory> {
    const memberHistory: MemberHistory = {
      id: this.currentHistoryId++,
      phoneNumber: insertMemberHistory.phoneNumber,
      encLoyaltyId: insertMemberHistory.encLoyaltyId,
      memberName: insertMemberHistory.memberName ?? null,
      cardNumber: insertMemberHistory.cardNumber ?? null,
      currentBalance: insertMemberHistory.currentBalance ?? null,
      currentBalanceDollars: insertMemberHistory.currentBalanceDollars ?? null,
      lastActivityDate: insertMemberHistory.lastActivityDate ?? null,
      emailAddress: insertMemberHistory.emailAddress ?? null,
      memberData: insertMemberHistory.memberData ?? null,
      lastAccessedAt: new Date(),
      createdAt: new Date(),
      markedAsUsed: insertMemberHistory.markedAsUsed ?? false,
      markedAsUsedAt: insertMemberHistory.markedAsUsedAt ?? null,
    };
    this.memberHistoryMap.set(memberHistory.phoneNumber, memberHistory);
    return memberHistory;
  }

  async updateMemberHistory(phoneNumber: string, memberData: any): Promise<MemberHistory> {
    const existing = this.memberHistoryMap.get(phoneNumber);
    if (existing) {
      existing.memberData = memberData;
      existing.lastAccessedAt = new Date();
      existing.currentBalance = memberData.Reward?.CurrentBalance || 0;
      existing.currentBalanceDollars = memberData.Reward?.CurrentBalanceDollars?.toString() || "0.00";
      existing.lastActivityDate = memberData.Reward?.LastActivityDate || null;
      existing.emailAddress = memberData.Email?.EMailAddress || null;
      existing.memberName = memberData.Name ? `${memberData.Name.FirstName} ${memberData.Name.LastName}` : null;
      existing.cardNumber = memberData.CardNumber || null;
      this.memberHistoryMap.set(phoneNumber, existing);
      return existing;
    }
    
    const newHistory: MemberHistory = {
      id: this.currentHistoryId++,
      phoneNumber,
      encLoyaltyId: memberData.encLoyaltyId || '',
      memberName: memberData.Name ? `${memberData.Name.FirstName} ${memberData.Name.LastName}` : null,
      cardNumber: memberData.CardNumber || null,
      currentBalance: memberData.Reward?.CurrentBalance || 0,
      currentBalanceDollars: memberData.Reward?.CurrentBalanceDollars?.toString() || "0.00",
      lastActivityDate: memberData.Reward?.LastActivityDate || null,
      emailAddress: memberData.Email?.EMailAddress || null,
      memberData,
      lastAccessedAt: new Date(),
      createdAt: new Date(),
      markedAsUsed: false,
      markedAsUsedAt: null,
    };
    this.memberHistoryMap.set(phoneNumber, newHistory);
    return newHistory;
  }

  // Balance Rewards operations (in-memory implementation)
  async createBalanceRewardsActivity(activity: InsertBalanceRewardsActivity): Promise<BalanceRewardsActivity> {
    const newActivity: BalanceRewardsActivity = {
      id: this.currentActivityId++,
      memberPhone: activity.memberPhone,
      encLoyaltyId: activity.encLoyaltyId ?? null,
      activityType: activity.activityType,
      activityData: activity.activityData,
      pointsAwarded: activity.pointsAwarded ?? 0,
      status: activity.status ?? "pending",
      submittedAt: new Date(),
      responseData: activity.responseData ?? null,
      createdAt: new Date()
    };
    
    const memberActivities = this.balanceRewardsActivities.get(activity.memberPhone) || [];
    memberActivities.push(newActivity);
    this.balanceRewardsActivities.set(activity.memberPhone, memberActivities);
    
    return newActivity;
  }

  async getBalanceRewardsActivities(memberPhone: string): Promise<BalanceRewardsActivity[]> {
    return this.balanceRewardsActivities.get(memberPhone) || [];
  }

  async updateBalanceRewardsActivity(id: number, updates: Partial<InsertBalanceRewardsActivity>): Promise<BalanceRewardsActivity> {
    for (const [memberPhone, activities] of this.balanceRewardsActivities) {
      const activity = activities.find(a => a.id === id);
      if (activity) {
        Object.assign(activity, updates);
        return activity;
      }
    }
    throw new Error('Activity not found');
  }

  // OAuth Token operations (in-memory implementation)
  async createBalanceRewardsToken(token: InsertBalanceRewardsToken): Promise<BalanceRewardsToken> {
    const newToken: BalanceRewardsToken = {
      id: this.currentTokenId++,
      memberPhone: token.memberPhone,
      encLoyaltyId: token.encLoyaltyId ?? null,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? null,
      tokenType: token.tokenType ?? "bearer",
      expiresAt: token.expiresAt ?? null,
      scope: token.scope ?? null,
      state: token.state ?? null,
      transactionId: token.transactionId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.balanceRewardsTokens.set(token.memberPhone, newToken);
    return newToken;
  }

  async getBalanceRewardsToken(memberPhone: string): Promise<BalanceRewardsToken | undefined> {
    return this.balanceRewardsTokens.get(memberPhone);
  }

  async updateBalanceRewardsToken(memberPhone: string, updates: Partial<InsertBalanceRewardsToken>): Promise<BalanceRewardsToken> {
    const existing = this.balanceRewardsTokens.get(memberPhone);
    if (!existing) {
      throw new Error('Token not found');
    }
    
    Object.assign(existing, updates, { updatedAt: new Date() });
    return existing;
  }

  // Placeholder methods for compatibility - these would need real implementations
  async getMemberHistoryValidCount(): Promise<number> { return 0; }
  async getMemberHistoryFast(): Promise<MemberHistory[]> { return []; }
  async getMemberHistoryByDate(): Promise<MemberHistory[]> { return []; }
  async getAccountsWithTodayActivity(): Promise<MemberHistory[]> { return []; }
  async getMemberHistorySummary(): Promise<{ accounts100Plus: number; accounts50Plus: number; accounts20Plus: number; accounts10Plus: number; accounts5Plus: number; newAccounts: number; total: number; }> { 
    return { accounts100Plus: 0, accounts50Plus: 0, accounts20Plus: 0, accounts10Plus: 0, accounts5Plus: 0, newAccounts: 0, total: 0 }; 
  }
  async getJobExecutionHistory(): Promise<JobExecutionHistory[]> { return []; }
  async getJobExecutionHistoryById(): Promise<JobExecutionHistory | undefined> { return undefined; }
  async createJobExecutionHistory(): Promise<JobExecutionHistory> { throw new Error('Not implemented'); }
  async updateJobExecutionHistory(): Promise<JobExecutionHistory> { throw new Error('Not implemented'); }
  async updateJobExecutionStatus(): Promise<void> { throw new Error('Not implemented'); }
  async getJobResultsDetail(): Promise<JobResultsDetail[]> { return []; }
  async createJobResultsDetail(): Promise<JobResultsDetail> { throw new Error('Not implemented'); }
  async createManyJobResultsDetail(): Promise<JobResultsDetail[]> { throw new Error('Not implemented'); }
  async cleanupDuplicates(): Promise<number> { return 0; }
  async getPhoneNumbersQueue(): Promise<PhoneNumbersQueue[]> { return []; }
  async getPhoneNumbersQueueCount(): Promise<number> { return 0; }
  async addPhoneNumbersToQueue(): Promise<PhoneNumbersQueue[]> { return []; }
  async addPhoneNumbersToQueueBatch(): Promise<any> { return { processed: 0, added: 0, skipped: 0, total: 0 }; }
  async updatePhoneNumberStatus(phoneNumber: string, status: 'valid' | 'invalid' | 'processed', memberData?: any, errorMessage?: string): Promise<PhoneNumbersQueue | undefined> { return undefined; }
  async getPendingPhoneNumbers(): Promise<PhoneNumbersQueue[]> { return []; }
  async getValidPhoneNumbers(): Promise<PhoneNumbersQueue[]> { return []; }
  async resetRecentProcessedNumbers(count: number): Promise<number> { return 0; }
  async getPhoneNumbersQueueStats(): Promise<any> { return { total: 0, pending: 0, valid: 0, invalid: 0 }; }
  async clearPhoneNumberQueue(): Promise<void> { return; }
  
  // API Key Pool methods
  async getAllApiKeys(): Promise<ApiKeyPool[]> { return Array.from(this.apiKeys.values()); }
  async getApiKeyByName(name: string): Promise<ApiKeyPool | undefined> { return this.apiKeys.get(name); }
  async createApiKey(apiKey: InsertApiKeyPool): Promise<ApiKeyPool> {
    const newKey: ApiKeyPool = {
      id: this.currentApiKeyId++,
      name: apiKey.name,
      apiKey: apiKey.apiKey,
      affId: apiKey.affId,
      requestCount: apiKey.requestCount ?? 0,
      isActive: apiKey.isActive ?? true,
      lastResetTime: apiKey.lastResetTime ?? new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.apiKeys.set(newKey.name, newKey);
    return newKey;
  }
  async updateApiKey(name: string, updates: Partial<ApiKeyPool>): Promise<boolean> {
    const existing = this.apiKeys.get(name);
    if (!existing) return false;
    Object.assign(existing, updates, { updatedAt: new Date() });
    this.apiKeys.set(name, existing);
    return true;
  }
  async updateApiKeyRequestCount(name: string, requestCount: number): Promise<void> {
    const existing = this.apiKeys.get(name);
    if (existing) {
      existing.requestCount = requestCount;
      existing.updatedAt = new Date();
      this.apiKeys.set(name, existing);
    }
  }
  async updateApiKeyLastReset(name: string): Promise<void> {
    const existing = this.apiKeys.get(name);
    if (existing) {
      existing.lastResetTime = new Date();
      existing.updatedAt = new Date();
      this.apiKeys.set(name, existing);
    }
  }
  async removeApiKey(name: string): Promise<void> {
    this.apiKeys.delete(name);
  }
  async bulkReplaceApiKeys(apiKeys: string[], affId: string): Promise<{ count: number }> {
    // Clear all existing API keys
    this.apiKeys.clear();
    
    // Add new API keys
    apiKeys.forEach((apiKey, index) => {
      const newKey: ApiKeyPool = {
        id: index + 1,
        name: `API_KEY_${index + 1}`,
        apiKey: apiKey.trim(),
        affId: affId.trim(),
        requestCount: 0,
        maxRequests: 300,
        lastResetTime: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.apiKeys.set(newKey.name, newKey);
    });
    
    return { count: apiKeys.length };
  }
  async markMemberAsUsed(phoneNumber: string): Promise<void> {
    const member = this.memberHistoryMap.get(phoneNumber);
    if (member) {
      member.markedAsUsed = true;
      member.markedAsUsedAt = new Date();
      this.memberHistoryMap.set(phoneNumber, member);
    }
  }
  async unmarkMemberAsUsed(phoneNumber: string): Promise<void> {
    const member = this.memberHistoryMap.get(phoneNumber);
    if (member) {
      member.markedAsUsed = false;
      member.markedAsUsedAt = null;
      this.memberHistoryMap.set(phoneNumber, member);
    }
  }
  async resetMidnightMarkedAccounts(): Promise<void> { return; }
  async resetMarkedAccounts(): Promise<any> { return { resetCount: 0 }; }
  async getAllPhoneNumbers(): Promise<string[]> { return []; }
  async cleanPhoneNumbersQueue(): Promise<number> { return 0; }
  async saveBulkVerificationJob(): Promise<void> { return; }
  async getBulkVerificationJob(): Promise<any> { return undefined; }
  async updateBulkVerificationJobStatus(): Promise<void> { return; }
  async updateBulkVerificationJobProgress(): Promise<void> { return; }
  
  // Scanner file management stubs
  async addScanFile(filename: string, fileContent: string, totalNumbers: number): Promise<ScanFile> {
    throw new Error("Scanner not implemented in MemStorage");
  }
  async getScanFiles(): Promise<ScanFile[]> {
    return [];
  }
  async updateScanFileProgress(id: number, processed: number, valid: number, invalid: number): Promise<void> {
    // Stub implementation
  }
  
  // Scanner queue operations stubs
  async addNumbersToScanQueue(phoneNumbers: string[], fileId?: number): Promise<{added: number; skipped: number}> {
    return { added: 0, skipped: phoneNumbers.length };
  }
  async getNextPendingNumbers(limit: number): Promise<ScanQueue[]> {
    return [];
  }
  async markNumberAsProcessed(
    phoneNumber: string, 
    status: 'completed' | 'invalid' | 'error_retryable' | 'error_permanent', 
    result?: any,
    errorCode?: string,
    errorMessage?: string,
    errorIsRetryable?: boolean
  ): Promise<void> {
    // Stub implementation
  }
  
  // Scanner results operations stubs
  async addScanResult(result: InsertScanResult): Promise<void> {
    // Stub implementation
  }
  async getScanResults(limit?: number, offset?: number): Promise<ScanResult[]> {
    return [];
  }
  
  // Scanner sessions operations stubs
  async createScanSession(): Promise<ScanSession> {
    throw new Error("Scanner not implemented in MemStorage");
  }
  async updateScanSession(id: number, data: Partial<ScanSession>): Promise<void> {
    // Stub implementation
  }
  async getActiveScanSession(): Promise<ScanSession | null> {
    return null;
  }
  
  // Downloads system operations stubs
  async getAccountsWithFilters(filters: {
    downloaded?: boolean;
    zipCode?: string;
    state?: string;
    minBalance?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ accounts: MemberHistory[]; total: number }> {
    // Stub implementation - returns empty results
    // System uses DatabaseStorage in production
    return { accounts: [], total: 0 };
  }
  
  async getAllAccountIdsWithFilters(filters: {
    downloaded?: boolean;
    zipCode?: string;
    state?: string;
  }): Promise<number[]> {
    // Stub implementation - returns empty array
    // System uses DatabaseStorage in production
    return [];
  }
  
  async markAccountsAsDownloaded(accountIds: number[]): Promise<void> {
    // Stub implementation - does nothing
    // System uses DatabaseStorage in production
    return;
  }
  
  getAvailableStates(): string[] {
    const mapping = loadZipStateMapping();
    return Object.keys(mapping.stateToZips).sort();
  }
  
  getZipToStateMapping(): Record<string, string> {
    const mapping = loadZipStateMapping();
    return mapping.zipToState;
  }
  
  // Backfill operations stubs
  async createBackfillJob(data: Partial<InsertBackfillJob>): Promise<BackfillJob> {
    throw new Error("Backfill not implemented in MemStorage");
  }
  
  async updateBackfillJob(id: number, data: Partial<BackfillJob>): Promise<void> {
    return;
  }
  
  async getActiveBackfillJob(): Promise<BackfillJob | null> {
    return null;
  }
  
  async getAccountsWithoutZipCode(limit: number, offset: number): Promise<MemberHistory[]> {
    return [];
  }
  
  async getAccountsWithoutZipCodeCount(): Promise<number> {
    return 0;
  }
  
  async updateMemberZipAndState(phoneNumber: string, zipCode: string, state: string): Promise<void> {
    return;
  }
}

export class DatabaseStorage implements IStorage {
  async getMemberByPhone(phoneNumber: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.phoneNumber, phoneNumber));
    return member;
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const [member] = await db.insert(members).values(insertMember).returning();
    return member;
  }

  async assignStoreToMember(phoneNumber: string, storeData: {
    storeNumber: string;
    storeName: string;
    storeAddress: any;
    storePhone: string;
  }): Promise<Member> {
    // Try to update existing member
    const [updatedMember] = await db
      .update(members)
      .set({
        assignedStoreNumber: storeData.storeNumber,
        assignedStoreName: storeData.storeName,
        assignedStoreAddress: storeData.storeAddress,
        assignedStorePhone: storeData.storePhone,
        storeAssignedAt: new Date()
      })
      .where(eq(members.phoneNumber, phoneNumber))
      .returning();
    
    if (updatedMember) {
      return updatedMember;
    }
    
    // If no existing member, create new one
    const [newMember] = await db
      .insert(members)
      .values({
        phoneNumber: phoneNumber,
        assignedStoreNumber: storeData.storeNumber,
        assignedStoreName: storeData.storeName,
        assignedStoreAddress: storeData.storeAddress,
        assignedStorePhone: storeData.storePhone,
        storeAssignedAt: new Date()
      })
      .returning();
    
    return newMember;
  }

  async getOfferById(offerId: string): Promise<Offer | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.offerId, offerId));
    return offer;
  }

  async getOffers(page: number, size: number, category?: string): Promise<Offer[]> {
    const offset = (page - 1) * size;
    
    if (category) {
      return await db.select().from(offers)
        .where(eq(offers.category, category))
        .limit(size)
        .offset(offset);
    }
    
    return await db.select().from(offers).limit(size).offset(offset);
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const [offer] = await db.insert(offers).values(insertOffer).returning();
    return offer;
  }

  async updateOffer(offerId: string, updateData: Partial<InsertOffer>): Promise<Offer> {
    const [offer] = await db
      .update(offers)
      .set(updateData)
      .where(eq(offers.offerId, offerId))
      .returning();
    return offer;
  }

  async getClippedOffers(encLoyaltyId: string, page: number, size: number): Promise<ClippedOffer[]> {
    const offset = (page - 1) * size;
    
    return await db.select().from(clippedOffers)
      .where(eq(clippedOffers.encLoyaltyId, encLoyaltyId))
      .orderBy(desc(clippedOffers.clippedAt))
      .limit(size)
      .offset(offset);
  }

  async createClippedOffer(insertClippedOffer: InsertClippedOffer): Promise<ClippedOffer> {
    const [clippedOffer] = await db.insert(clippedOffers).values(insertClippedOffer).returning();
    return clippedOffer;
  }

  async removeClippedOffer(encLoyaltyId: string, offerId: string): Promise<boolean> {
    const result = await db
      .delete(clippedOffers)
      .where(and(
        eq(clippedOffers.encLoyaltyId, encLoyaltyId),
        eq(clippedOffers.offerId, offerId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getRedeemedOffers(encLoyaltyId: string, startDate?: string, endDate?: string, page: number = 1, size: number = 20): Promise<RedeemedOffer[]> {
    const offset = (page - 1) * size;
    
    return await db.select().from(redeemedOffers)
      .where(eq(redeemedOffers.encLoyaltyId, encLoyaltyId))
      .orderBy(desc(redeemedOffers.createdAt))
      .limit(size)
      .offset(offset);
  }

  async createRedeemedOffer(insertRedeemedOffer: InsertRedeemedOffer): Promise<RedeemedOffer> {
    const [redeemedOffer] = await db.insert(redeemedOffers).values(insertRedeemedOffer).returning();
    return redeemedOffer;
  }

  // AI Coupon Analysis functionality removed - methods removed

  async getMemberHistory(page: number = 1, size: number = 20): Promise<MemberHistory[]> {
    // TODAS LAS CUENTAS: Si el size es muy grande (999999), devolver todo sin límites
    if (size >= 999999) {
      console.log(`💾 UNLIMITED Database query - Loading ALL records (no limits)`);
      const history = await db.select().from(memberHistory)
        .orderBy(desc(memberHistory.currentBalance), desc(memberHistory.lastAccessedAt));
      console.log(`💾 UNLIMITED Database returned ${history.length} records`);
      return history;
    }
    
    // Para tamaños normales, usar paginación
    const offset = (page - 1) * size;
    console.log(`💾 Paginated Database query - Page: ${page}, Size: ${size}, Offset: ${offset}`);
    
    const history = await db.select().from(memberHistory)
      .orderBy(desc(memberHistory.currentBalance), desc(memberHistory.lastAccessedAt))
      .limit(size)
      .offset(offset);
    
    console.log(`💾 Paginated Database returned ${history.length} records`);
    return history;
  }

  // Fast query for production - minimal logging, optimized for performance
  async getMemberHistoryFast(limit?: number): Promise<MemberHistory[]> {
    try {
      console.log(`🚀 Production fast query starting - limit: ${limit || 'NO LIMIT'}`);
      
      let query = db.select({
        id: memberHistory.id,
        phoneNumber: memberHistory.phoneNumber,
        encLoyaltyId: memberHistory.encLoyaltyId,
        memberName: memberHistory.memberName,
        cardNumber: memberHistory.cardNumber,
        currentBalance: memberHistory.currentBalance,
        currentBalanceDollars: memberHistory.currentBalanceDollars,
        lastActivityDate: memberHistory.lastActivityDate,
        emailAddress: memberHistory.emailAddress,
        memberData: memberHistory.memberData,
        lastAccessedAt: memberHistory.lastAccessedAt,
        createdAt: memberHistory.createdAt,
        markedAsUsed: memberHistory.markedAsUsed,
        markedAsUsedAt: memberHistory.markedAsUsedAt
      }).from(memberHistory)
        .orderBy(desc(memberHistory.currentBalance));
        
      // Only apply limit if provided
      if (limit) {
        query = query.limit(limit);
      }
      
      const result = await query;
        
      console.log(`🚀 Production fast query completed - found ${result.length} records`);
      return result;
    } catch (error) {
      console.error('❌ Production fast query failed:', error);
      throw error;
    }
  }

  async getMemberHistoryCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`COUNT(*)` }).from(memberHistory);
    return Number(result[0].count);
  }

  async getMemberHistoryValidCount(): Promise<number> {
    try {
      console.log('🔍 Getting valid member count...');
      const result = await db.select({ count: sql<number>`COUNT(DISTINCT phone_number)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined')
        ));
      console.log('✅ Valid member count result:', result[0]);
      return Number(result[0].count);
    } catch (error) {
      console.error('❌ Error getting valid member count:', error);
      // Fallback: count all records with valid member names
      try {
        const allRecords = await db.select()
          .from(memberHistory)
          .where(and(
            isNotNull(memberHistory.memberName),
            ne(memberHistory.memberName, ''),
            ne(memberHistory.memberName, 'null'),
            ne(memberHistory.memberName, 'undefined')
          ));
        
        const uniquePhones = new Set(allRecords.map(r => r.phoneNumber));
        console.log('✅ Fallback valid member count:', uniquePhones.size);
        return uniquePhones.size;
      } catch (fallbackError) {
        console.error('❌ Fallback count also failed:', fallbackError);
        return 0;
      }
    }
  }

  async getMemberHistoryByDate(date: Date): Promise<MemberHistory[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log(`📅 Getting accounts for date: ${date.toISOString().split('T')[0]}`);
      
      const accounts = await db.select().from(memberHistory)
        .where(and(
          gte(memberHistory.createdAt, startOfDay),
          lte(memberHistory.createdAt, endOfDay),
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined')
        ))
        .orderBy(desc(memberHistory.currentBalance));
        
      console.log(`📅 Found ${accounts.length} accounts for ${date.toISOString().split('T')[0]}`);
      return accounts;
    } catch (error) {
      console.error('❌ Error getting accounts by date:', error);
      return [];
    }
  }

  async getAccountsWithTodayActivity(todayString: string): Promise<MemberHistory[]> {
    try {
      console.log(`🔍 SEARCHING FOR ACCOUNTS WITH TODAY'S ACTIVITY: ${todayString}`);
      
      // Query accounts where lastActivityDate matches today's date
      const accounts = await db.select().from(memberHistory)
        .where(and(
          isNotNull(memberHistory.lastActivityDate),
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          // Check if lastActivityDate starts with today's date (YYYY-MM-DD)
          sql`DATE(${memberHistory.lastActivityDate}) = ${todayString}`
        ))
        .orderBy(desc(memberHistory.currentBalance));
      
      console.log(`🎯 FOUND ${accounts.length} accounts with activity from today (${todayString})`);
      
      // Log some examples for debugging
      if (accounts.length > 0) {
        accounts.slice(0, 3).forEach(account => {
          console.log(`  📱 ${account.phoneNumber} - ${account.memberName} - Activity: ${account.lastActivityDate}`);
        });
      }
      
      return accounts;
    } catch (error) {
      console.error('❌ Error getting accounts with today\'s activity:', error);
      return [];
    }
  }

  async testDatabaseConnection(): Promise<boolean> {
    try {
      const result = await db.select().from(memberHistory).limit(1);
      console.log('✅ Database connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  async createMemberHistory(insertMemberHistory: InsertMemberHistory): Promise<MemberHistory> {
    const [history] = await db.insert(memberHistory)
      .values(insertMemberHistory)
      .returning();
    return history;
  }

  // Método específico para el fast-scanner que evita errores de límites de campo
  async insertValidMemberForScanner(phoneNumber: string, memberName: string, encLoyaltyId: string, zipCode: string): Promise<void> {
    try {
      // CRITICAL FIX: Extract state from zipCode using helper function
      const state = zipCodeToState(zipCode);
      
      // Use INSERT ... ON CONFLICT para manejar duplicados
      await db.insert(memberHistory)
        .values({
          phoneNumber,
          encLoyaltyId: encLoyaltyId.substring(0, 100), // Limitar a 100 caracteres
          memberName: memberName.substring(0, 50), // Limitar a 50 caracteres
          currentBalance: 0,
          currentBalanceDollars: "0.00",
          zipCode: zipCode || null, // CRITICAL: Save to table field
          state: state || null, // CRITICAL: Save to table field
          lastAccessedAt: new Date(),
          memberData: { scannerDetected: true, fullName: memberName, fullEncId: encLoyaltyId, zipCode: zipCode }
        })
        .onConflictDoUpdate({
          target: memberHistory.phoneNumber,
          set: {
            encLoyaltyId: encLoyaltyId.substring(0, 100),
            memberName: memberName.substring(0, 50),
            zipCode: zipCode || null, // CRITICAL: Update table field
            state: state || null, // CRITICAL: Update table field
            lastAccessedAt: new Date(),
            memberData: { scannerDetected: true, fullName: memberName, fullEncId: encLoyaltyId, zipCode: zipCode, updated: new Date() }
          }
        });
      console.log(`✅ Scanner member saved: ${memberName} (${phoneNumber}) - ZIP: ${zipCode}, State: ${state}`);
    } catch (error) {
      console.error(`❌ Scanner member save failed: ${memberName} (${phoneNumber})`, error);
      throw error;
    }
  }

  async updateMemberHistory(phoneNumber: string, memberData: any): Promise<MemberHistory> {
    try {
      // Handle both old format (from getMember) and new format (from background jobs)
      const isNewFormat = memberData?.memberName && memberData?.encLoyaltyId;
      
      // CRITICAL FIX: Extract zipCode from multiple possible sources
      let extractedZipCode = null;
      if (memberData?.zipCode) {
        extractedZipCode = memberData.zipCode;
      } else if (memberData?.Address?.ZipCode) {
        extractedZipCode = memberData.Address.ZipCode;
      } else if (memberData?.Address?.zipCode) {
        extractedZipCode = memberData.Address.zipCode;
      }
      
      // CRITICAL FIX: Calculate state from zipCode
      const extractedState = extractedZipCode ? zipCodeToState(extractedZipCode) : null;
      
      // Use INSERT ... ON CONFLICT to handle upsert atomically
      const [result] = await db.insert(memberHistory)
        .values({
          phoneNumber,
          encLoyaltyId: isNewFormat ? memberData.encLoyaltyId : (memberData?.encLoyaltyId || ''),
          memberName: isNewFormat ? memberData.memberName : (memberData?.Name ? `${memberData.Name.FirstName} ${memberData.Name.LastName}` : null),
          cardNumber: isNewFormat ? memberData.cardNumber : (memberData?.CardNumber || null),
          currentBalance: isNewFormat ? (memberData.currentBalance || 0) : (memberData?.Reward?.CurrentBalance || memberData?.currentBalance || 0),
          currentBalanceDollars: isNewFormat ? (memberData.currentBalanceDollars?.toString() || "0.00") : (memberData?.Reward?.CurrentBalanceDollars?.toString() || memberData?.currentBalanceDollars?.toString() || "0.00"),
          lastActivityDate: isNewFormat ? memberData.lastActivityDate : (memberData?.Reward?.LastActivityDate || memberData?.lastActivityDate || null),
          emailAddress: isNewFormat ? (memberData.email || null) : (memberData?.Email?.EMailAddress || null),
          zipCode: extractedZipCode, // CRITICAL: Save to table field
          state: extractedState, // CRITICAL: Save to table field
          memberData,
        })
        .onConflictDoUpdate({
          target: memberHistory.phoneNumber,
          set: {
            memberData,
            encLoyaltyId: isNewFormat ? memberData.encLoyaltyId : (memberData?.encLoyaltyId || ''),
            currentBalance: isNewFormat ? (memberData.currentBalance || 0) : (memberData?.Reward?.CurrentBalance || memberData?.currentBalance || 0),
            currentBalanceDollars: isNewFormat ? (memberData.currentBalanceDollars?.toString() || "0.00") : (memberData?.Reward?.CurrentBalanceDollars?.toString() || memberData?.currentBalanceDollars?.toString() || "0.00"),
            lastActivityDate: isNewFormat ? memberData.lastActivityDate : (memberData?.Reward?.LastActivityDate || memberData?.lastActivityDate || null),
            emailAddress: isNewFormat ? (memberData.email || null) : (memberData?.Email?.EMailAddress || null),
            memberName: isNewFormat ? memberData.memberName : (memberData?.Name ? `${memberData.Name.FirstName} ${memberData.Name.LastName}` : null),
            cardNumber: isNewFormat ? memberData.cardNumber : (memberData?.CardNumber || null),
            zipCode: extractedZipCode, // CRITICAL: Update table field
            state: extractedState, // CRITICAL: Update table field
            lastAccessedAt: new Date(),
          }
        })
        .returning();
      return result;
    } catch (error) {
      console.error('Error in updateMemberHistory:', error);
      throw error;
    }
  }

  // NEW METHOD: Update only balance without affecting marked status
  async updateMemberBalanceOnly(phoneNumber: string, memberData: any): Promise<MemberHistory> {
    try {
      // Handle both old format (from getMember) and new format (from background jobs)
      const isNewFormat = memberData?.memberName && memberData?.encLoyaltyId;
      
      // Get existing record to preserve marked status
      const existingRecord = await db.select()
        .from(memberHistory)
        .where(eq(memberHistory.phoneNumber, phoneNumber))
        .limit(1);
      
      if (existingRecord.length === 0) {
        // If record doesn't exist, use regular updateMemberHistory
        return await this.updateMemberHistory(phoneNumber, memberData);
      }
      
      console.log(`🔄 PRESERVING MARKED STATUS: Updating balance for ${phoneNumber} while keeping marked status intact`);
      
      // CRITICAL FIX: Extract zipCode from multiple possible sources
      let extractedZipCode = null;
      if (memberData?.zipCode) {
        extractedZipCode = memberData.zipCode;
      } else if (memberData?.Address?.ZipCode) {
        extractedZipCode = memberData.Address.ZipCode;
      } else if (memberData?.Address?.zipCode) {
        extractedZipCode = memberData.Address.zipCode;
      }
      
      // CRITICAL FIX: Calculate state from zipCode
      const extractedState = extractedZipCode ? zipCodeToState(extractedZipCode) : null;
      
      // Extract last activity date from multiple possible sources
      let lastActivity = null;
      
      // Try to get last activity date from various API response locations
      if (memberData?.Reward?.LastActivityDate) {
        lastActivity = new Date(memberData.Reward.LastActivityDate);
        console.log(`📅 LAST ACTIVITY from Reward.LastActivityDate: ${lastActivity}`);
      } else if (memberData?.lastActivityDate) {
        lastActivity = new Date(memberData.lastActivityDate);
        console.log(`📅 LAST ACTIVITY from lastActivityDate: ${lastActivity}`);
      } else if (memberData?.LastActivityDate) {
        lastActivity = new Date(memberData.LastActivityDate);
        console.log(`📅 LAST ACTIVITY from LastActivityDate: ${lastActivity}`);
      } else {
        // If no real activity date available, keep null instead of using current date
        lastActivity = null;
        console.log(`📅 LAST ACTIVITY: No real activity date found, keeping null`);
      }

      // Update only balance-related fields, preserving marked status
      const [result] = await db.update(memberHistory)
        .set({
          memberData,
          encLoyaltyId: isNewFormat ? memberData.encLoyaltyId : (memberData?.encLoyaltyId || ''),
          currentBalance: isNewFormat ? (memberData.currentBalance || 0) : (memberData?.Reward?.CurrentBalance || memberData?.currentBalance || 0),
          currentBalanceDollars: isNewFormat ? (memberData.currentBalanceDollars?.toString() || "0.00") : (memberData?.Reward?.CurrentBalanceDollars?.toString() || memberData?.currentBalanceDollars?.toString() || "0.00"),
          lastActivityDate: lastActivity, // Always set a valid date
          emailAddress: isNewFormat ? (memberData.email || null) : (memberData?.Email?.EMailAddress || null),
          memberName: isNewFormat ? memberData.memberName : (memberData?.Name ? `${memberData.Name.FirstName} ${memberData.Name.LastName}` : null),
          cardNumber: isNewFormat ? memberData.cardNumber : (memberData?.CardNumber || null),
          zipCode: extractedZipCode, // CRITICAL: Update table field
          state: extractedState, // CRITICAL: Update table field
          lastAccessedAt: new Date(),
          // CRITICAL: Do NOT update markedAsUsed or markedAsUsedAt - preserve existing values
        })
        .where(eq(memberHistory.phoneNumber, phoneNumber))
        .returning();
      
      console.log(`✅ BALANCE UPDATED: Preserved marked status for ${phoneNumber}`);
      return result;
    } catch (error) {
      console.error('Error in updateMemberBalanceOnly:', error);
      throw error;
    }
  }

  // Job execution history operations
  async getJobExecutionHistory(): Promise<JobExecutionHistory[]> {
    return await db.select().from(jobExecutionHistory)
      .orderBy(desc(jobExecutionHistory.executedAt));
  }

  async getJobExecutionHistoryById(jobId: string): Promise<JobExecutionHistory | undefined> {
    const [job] = await db.select().from(jobExecutionHistory)
      .where(eq(jobExecutionHistory.jobId, jobId));
    return job;
  }

  async createJobExecutionHistory(jobHistory: InsertJobExecutionHistory): Promise<JobExecutionHistory> {
    const [job] = await db.insert(jobExecutionHistory)
      .values(jobHistory)
      .returning();
    return job;
  }

  async updateJobExecutionHistory(jobId: string, updates: Partial<InsertJobExecutionHistory>): Promise<JobExecutionHistory> {
    const [job] = await db.update(jobExecutionHistory)
      .set(updates)
      .where(eq(jobExecutionHistory.jobId, jobId))
      .returning();
    return job;
  }

  async updateJobExecutionStatus(jobId: string, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
    await db.update(jobExecutionHistory)
      .set({ 
        status,
        completedAt: status === 'completed' ? new Date() : null 
      })
      .where(eq(jobExecutionHistory.jobId, jobId));
  }

  // Job results detail operations
  async getJobResultsDetail(jobId: string): Promise<JobResultsDetail[]> {
    return await db.select().from(jobResultsDetail)
      .where(eq(jobResultsDetail.jobId, jobId))
      .orderBy(desc(jobResultsDetail.currentBalance));
  }

  async createJobResultsDetail(jobResult: InsertJobResultsDetail): Promise<JobResultsDetail> {
    const [result] = await db.insert(jobResultsDetail)
      .values(jobResult)
      .returning();
    return result;
  }

  async createManyJobResultsDetail(jobResults: InsertJobResultsDetail[]): Promise<JobResultsDetail[]> {
    return await db.insert(jobResultsDetail)
      .values(jobResults)
      .returning();
  }

  async cleanupDuplicates(): Promise<number> {
    try {
      console.log('🧹 Starting duplicate cleanup...');
      
      // Get all member history records
      const allRecords = await db.select().from(memberHistory)
        .orderBy(desc(memberHistory.lastAccessedAt));
      
      console.log(`Found ${allRecords.length} total records`);
      
      // Group by phone number and keep only the most recent
      const phoneNumberMap = new Map<string, any>();
      const duplicatesToDelete: number[] = [];
      
      allRecords.forEach(record => {
        const existing = phoneNumberMap.get(record.phoneNumber);
        if (!existing) {
          phoneNumberMap.set(record.phoneNumber, record);
        } else {
          // Keep the more recent record, mark the older one for deletion
          if (new Date(record.lastAccessedAt) > new Date(existing.lastAccessedAt)) {
            duplicatesToDelete.push(existing.id);
            phoneNumberMap.set(record.phoneNumber, record);
          } else {
            duplicatesToDelete.push(record.id);
          }
        }
      });
      
      console.log(`Found ${duplicatesToDelete.length} duplicates to delete`);
      console.log(`Will keep ${phoneNumberMap.size} unique records`);
      
      // Delete duplicates in batches
      let deletedCount = 0;
      const batchSize = 100;
      
      for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
        const batch = duplicatesToDelete.slice(i, i + batchSize);
        if (batch.length > 0) {
          const result = await db.delete(memberHistory)
            .where(sql`id = ANY(${batch})`);
          deletedCount += result.rowCount || 0;
          
          console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}: ${result.rowCount || 0} records`);
        }
      }
      
      console.log(`✅ Cleanup completed. Deleted ${deletedCount} duplicate records`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  async saveBulkVerificationJob(job: any): Promise<void> {
    await db.insert(bulkVerificationJobs)
      .values({
        jobId: job.jobId,
        phoneNumbers: job.phoneNumbers,
        status: job.status,
        totalNumbers: job.totalNumbers,
        processedNumbers: job.processedNumbers,
        validNumbers: job.validNumbers,
        results: job.results,
      });
  }

  async getBulkVerificationJob(jobId: string): Promise<any | undefined> {
    const [job] = await db.select().from(bulkVerificationJobs)
      .where(eq(bulkVerificationJobs.jobId, jobId));
    return job;
  }

  async updateBulkVerificationJobStatus(jobId: string, status: string): Promise<void> {
    await db.update(bulkVerificationJobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(bulkVerificationJobs.jobId, jobId));
  }

  async updateBulkVerificationJobProgress(jobId: string, processedNumbers: number, validNumbers: number, results: any[]): Promise<void> {
    await db.update(bulkVerificationJobs)
      .set({ 
        processedNumbers,
        validNumbers,
        results,
        updatedAt: new Date()
      })
      .where(eq(bulkVerificationJobs.jobId, jobId));
  }

  // Member marking operations
  async markMemberAsUsed(phoneNumber: string): Promise<void> {
    try {
      console.log(`🔄 DATABASE: Marking ${phoneNumber} as used in memberHistory table`);
      
      const result = await db.update(memberHistory)
        .set({ 
          markedAsUsed: true,
          markedAsUsedAt: new Date()
        })
        .where(eq(memberHistory.phoneNumber, phoneNumber));
      
      console.log(`✅ DATABASE: Successfully marked ${phoneNumber} as used`);
      return;
    } catch (error) {
      console.error(`❌ DATABASE ERROR in markMemberAsUsed for ${phoneNumber}:`, error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  async updateMemberLastActivity(phoneNumber: string): Promise<void> {
    console.log(`📍 Updating lastAccessedAt for ${phoneNumber} to move to end of pages`);
    await db.update(memberHistory)
      .set({ 
        lastAccessedAt: new Date()
      })
      .where(eq(memberHistory.phoneNumber, phoneNumber));
  }

  async unmarkMemberAsUsed(phoneNumber: string): Promise<void> {
    await db.update(memberHistory)
      .set({ 
        markedAsUsed: false,
        markedAsUsedAt: null
      })
      .where(eq(memberHistory.phoneNumber, phoneNumber));
  }

  async resetMidnightMarkedAccounts(): Promise<void> {
    await db.update(memberHistory)
      .set({ 
        markedAsUsed: false,
        markedAsUsedAt: null
      })
      .where(eq(memberHistory.markedAsUsed, true));
  }

  async resetMarkedAccounts(): Promise<{ resetCount: number }> {
    const result = await db.update(memberHistory)
      .set({ 
        markedAsUsed: false,
        markedAsUsedAt: null
      })
      .where(eq(memberHistory.markedAsUsed, true));
    
    return { resetCount: result.rowCount || 0 };
  }

  async getMarkedAccountsCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(memberHistory)
      .where(eq(memberHistory.markedAsUsed, true));
    
    return result[0]?.count || 0;
  }

  // Ultra-fast summary method for sidebar counters - SINGLE QUERY VERSION
  async getMemberHistorySummary(): Promise<{
    accounts100Plus: number;
    accounts50Plus: number;
    accounts20Plus: number;
    accounts10Plus: number;
    accounts5Plus: number;
    newAccounts: number;
    total: number;
  }> {
    try {
      // MEGA-OPTIMIZED: Simplified query without complex operations
      const [result] = await db.select({
        total: sql<number>`COUNT(*)`,
        accounts100Plus: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric >= 100 THEN 1 ELSE 0 END)`,
        accounts50Plus: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric >= 50 AND current_balance_dollars::numeric < 100 THEN 1 ELSE 0 END)`,
        accounts20Plus: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric >= 20 AND current_balance_dollars::numeric < 50 THEN 1 ELSE 0 END)`,
        accounts10Plus: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric >= 10 AND current_balance_dollars::numeric < 20 THEN 1 ELSE 0 END)`,
        accounts5Plus: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric >= 5 AND current_balance_dollars::numeric < 10 THEN 1 ELSE 0 END)`,
        newAccounts: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric < 5 THEN 1 ELSE 0 END)`
      })
      .from(memberHistory)
      .where(and(
        isNotNull(memberHistory.memberName),
        ne(memberHistory.memberName, '')
      ));

      return {
        accounts100Plus: Number(result.accounts100Plus || 0),
        accounts50Plus: Number(result.accounts50Plus || 0),
        accounts20Plus: Number(result.accounts20Plus || 0),
        accounts10Plus: Number(result.accounts10Plus || 0),
        accounts5Plus: Number(result.accounts5Plus || 0),
        newAccounts: Number(result.newAccounts || 0),
        total: Number(result.total || 0)
      };
      
    } catch (error) {
      // Return zeros for empty database - no fake data
      console.log('⚠️ Database empty or error in getMemberHistorySummary, returning zeros');
      return { 
        accounts100Plus: 0, 
        accounts50Plus: 0, 
        accounts20Plus: 0, 
        accounts10Plus: 0, 
        accounts5Plus: 0, 
        newAccounts: 0, 
        total: 0 
      };
    }
  }

  // Phone numbers queue operations
  async getPhoneNumbersQueue(status?: 'pending' | 'valid' | 'invalid', page = 1, size = 25): Promise<PhoneNumbersQueue[]> {
    const offset = (page - 1) * size;
    
    if (status) {
      return await db.select().from(phoneNumbersQueue)
        .where(eq(phoneNumbersQueue.status, status))
        .orderBy(desc(phoneNumbersQueue.createdAt))
        .limit(size)
        .offset(offset);
    }
    
    return await db.select().from(phoneNumbersQueue)
      .orderBy(desc(phoneNumbersQueue.createdAt))
      .limit(size)
      .offset(offset);
  }

  async getPhoneNumbersQueueCount(status?: 'pending' | 'valid' | 'invalid'): Promise<number> {
    if (status) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(phoneNumbersQueue)
        .where(eq(phoneNumbersQueue.status, status));
      return result[0].count;
    }
    
    const result = await db.select({ count: sql<number>`count(*)` }).from(phoneNumbersQueue);
    return result[0].count;
  }

  async addPhoneNumbersToQueue(phoneNumbers: string[]): Promise<PhoneNumbersQueue[]> {
    const uniqueNumbers = [...new Set(phoneNumbers)]; // Remove duplicates
    const results: PhoneNumbersQueue[] = [];
    
    for (const phoneNumber of uniqueNumbers) {
      try {
        const [existing] = await db.select().from(phoneNumbersQueue)
          .where(eq(phoneNumbersQueue.phoneNumber, phoneNumber));
        
        if (!existing) {
          const [inserted] = await db.insert(phoneNumbersQueue)
            .values({ phoneNumber })
            .returning();
          results.push(inserted);
        } else {
          results.push(existing);
        }
      } catch (error) {
        // Handle duplicate key error - just skip
        console.log(`Phone number ${phoneNumber} already exists in queue`);
      }
    }
    
    return results;
  }

  async addPhoneNumbersToQueueBatch(phoneNumbers: string[], batchSize: number = 100): Promise<{
    processed: number;
    added: number;
    skipped: number;
    total: number;
  }> {
    const uniqueNumbers = [...new Set(phoneNumbers)]; // Remove duplicates
    const totalNumbers = uniqueNumbers.length;
    let processed = 0;
    let added = 0;
    let skipped = 0;
    
    // Process in batches
    for (let i = 0; i < uniqueNumbers.length; i += batchSize) {
      const batch = uniqueNumbers.slice(i, i + batchSize);
      
      // Process batch
      const batchInserts = [];
      for (const phoneNumber of batch) {
        try {
          const [existing] = await db.select().from(phoneNumbersQueue)
            .where(eq(phoneNumbersQueue.phoneNumber, phoneNumber));
          
          if (!existing) {
            batchInserts.push({ phoneNumber });
          } else {
            skipped++;
          }
        } catch (error) {
          console.log(`Error checking phone number ${phoneNumber}:`, error);
          skipped++;
        }
      }
      
      // Bulk insert new numbers
      if (batchInserts.length > 0) {
        try {
          await db.insert(phoneNumbersQueue).values(batchInserts);
          added += batchInserts.length;
        } catch (error) {
          console.error('Batch insert error:', error);
          // Try individual inserts as fallback
          for (const item of batchInserts) {
            try {
              await db.insert(phoneNumbersQueue).values(item);
              added++;
            } catch (individualError) {
              console.log(`Individual insert failed for ${item.phoneNumber}:`, individualError);
              skipped++;
            }
          }
        }
      }
      
      processed += batch.length;
    }
    
    return {
      processed,
      added,
      skipped,
      total: totalNumbers
    };
  }

  async updatePhoneNumberStatus(phoneNumber: string, status: 'valid' | 'invalid' | 'processed', memberData?: any, errorMessage?: string): Promise<PhoneNumbersQueue | undefined> {
    const [updated] = await db.update(phoneNumbersQueue)
      .set({
        status,
        verifiedAt: new Date(),
        memberData,
        errorMessage,
        updatedAt: new Date()
      })
      .where(eq(phoneNumbersQueue.phoneNumber, phoneNumber))
      .returning();
    
    return updated;
  }

  async getPendingPhoneNumbers(limit = 100): Promise<PhoneNumbersQueue[]> {
    return await db.select().from(phoneNumbersQueue)
      .where(eq(phoneNumbersQueue.status, 'pending'))
      .orderBy(asc(phoneNumbersQueue.createdAt))
      .limit(limit);
  }

  async getValidPhoneNumbers(limit = 1000): Promise<PhoneNumbersQueue[]> {
    return await db.select().from(phoneNumbersQueue)
      .where(eq(phoneNumbersQueue.status, 'valid'))
      .limit(limit);
  }

  async getPhoneNumbersQueueStats(): Promise<{
    total: number;
    pending: number;
    valid: number;
    invalid: number;
  }> {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(phoneNumbersQueue);
    const [pendingResult] = await db.select({ count: sql<number>`count(*)` }).from(phoneNumbersQueue)
      .where(eq(phoneNumbersQueue.status, 'pending'));
    const [validResult] = await db.select({ count: sql<number>`count(*)` }).from(phoneNumbersQueue)
      .where(eq(phoneNumbersQueue.status, 'valid'));
    const [invalidResult] = await db.select({ count: sql<number>`count(*)` }).from(phoneNumbersQueue)
      .where(eq(phoneNumbersQueue.status, 'invalid'));
    
    return {
      total: totalResult.count,
      pending: pendingResult.count,
      valid: validResult.count,
      invalid: invalidResult.count
    };
  }

  async getAllPhoneNumbers(): Promise<string[]> {
    const memberHistoryPhones = await db.select({ phoneNumber: memberHistory.phoneNumber }).from(memberHistory);
    const jobResultsPhones = await db.select({ phoneNumber: jobResultsDetail.phoneNumber }).from(jobResultsDetail);
    
    const allPhones = [
      ...memberHistoryPhones.map(m => m.phoneNumber),
      ...jobResultsPhones.map(j => j.phoneNumber)
    ];
    
    // Remove duplicates
    return [...new Set(allPhones)];
  }

  async cleanPhoneNumbersQueue(existingPhones: string[]): Promise<number> {
    if (existingPhones.length === 0) return 0;
    
    const result = await db.delete(phoneNumbersQueue)
      .where(inArray(phoneNumbersQueue.phoneNumber, existingPhones));
    
    return result.rowCount || 0;
  }

  async clearPhoneNumberQueue(): Promise<void> {
    await db.delete(phoneNumbersQueue);
    console.log('✅ Phone number queue cleared');
  }

  async resetProcessedNumbers(): Promise<number> {
    // Resetear todos los números procesados a pending para reprocesarlos
    const result = await db.update(phoneNumbersQueue)
      .set({
        status: 'pending',
        verifiedAt: null,
        memberData: null,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(phoneNumbersQueue.status, 'processed'));
    
    console.log(`✅ Reset ${result.rowCount} números procesados a pendientes`);
    return result.rowCount || 0;
  }

  async resetRecentProcessedNumbers(count: number): Promise<number> {
    // Resetear los últimos X números procesados (que tuvieron errores) a pending
    const recentProcessed = await db.select().from(phoneNumbersQueue)
      .where(or(eq(phoneNumbersQueue.status, 'processed'), eq(phoneNumbersQueue.status, 'invalid')))
      .orderBy(desc(phoneNumbersQueue.updatedAt))
      .limit(count);
    
    if (recentProcessed.length === 0) {
      console.log('⚠️ No hay números procesados recientes para resetear');
      return 0;
    }
    
    const phoneNumbers = recentProcessed.map(r => r.phoneNumber);
    
    const result = await db.update(phoneNumbersQueue)
      .set({
        status: 'pending',
        verifiedAt: null,
        memberData: null,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(inArray(phoneNumbersQueue.phoneNumber, phoneNumbers));
    
    console.log(`✅ Reset ${result.rowCount} números recientes a pendientes para reprocesamiento`);
    return result.rowCount || 0;
  }

  // Balance Rewards operations
  async createBalanceRewardsActivity(activity: InsertBalanceRewardsActivity): Promise<BalanceRewardsActivity> {
    const [newActivity] = await db.insert(balanceRewardsActivities)
      .values(activity)
      .returning();
    return newActivity;
  }

  async getBalanceRewardsActivities(memberPhone: string): Promise<BalanceRewardsActivity[]> {
    return await db.select()
      .from(balanceRewardsActivities)
      .where(eq(balanceRewardsActivities.memberPhone, memberPhone))
      .orderBy(desc(balanceRewardsActivities.createdAt));
  }

  async updateBalanceRewardsActivity(id: number, updates: Partial<InsertBalanceRewardsActivity>): Promise<BalanceRewardsActivity> {
    const [updated] = await db.update(balanceRewardsActivities)
      .set(updates)
      .where(eq(balanceRewardsActivities.id, id))
      .returning();
    return updated;
  }

  // OAuth Token operations
  async createBalanceRewardsToken(token: InsertBalanceRewardsToken): Promise<BalanceRewardsToken> {
    const [newToken] = await db.insert(balanceRewardsTokens)
      .values(token)
      .returning();
    return newToken;
  }

  async getBalanceRewardsToken(memberPhone: string): Promise<BalanceRewardsToken | undefined> {
    const [token] = await db.select()
      .from(balanceRewardsTokens)
      .where(eq(balanceRewardsTokens.memberPhone, memberPhone))
      .orderBy(desc(balanceRewardsTokens.createdAt))
      .limit(1);
    return token;
  }

  async updateBalanceRewardsToken(memberPhone: string, updates: Partial<InsertBalanceRewardsToken>): Promise<BalanceRewardsToken> {
    const [updated] = await db.update(balanceRewardsTokens)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(balanceRewardsTokens.memberPhone, memberPhone))
      .returning();
    return updated;
  }

  // API Key Pool operations
  async getAllApiKeys(): Promise<ApiKeyPool[]> {
    return await db.select().from(apiKeyPool)
      .orderBy(asc(apiKeyPool.name));
  }

  async getApiKeyByName(name: string): Promise<ApiKeyPool | undefined> {
    const [apiKey] = await db.select().from(apiKeyPool)
      .where(eq(apiKeyPool.name, name))
      .limit(1);
    return apiKey;
  }

  async createApiKey(apiKeyData: InsertApiKeyPool): Promise<ApiKeyPool> {
    const [newApiKey] = await db.insert(apiKeyPool)
      .values({
        ...apiKeyData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newApiKey;
  }

  async updateApiKey(name: string, updates: Partial<ApiKeyPool>): Promise<boolean> {
    try {
      const result = await db.update(apiKeyPool)
        .set({ 
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(apiKeyPool.name, name));
      return true;
    } catch (error) {
      console.error('Error updating API key:', error);
      return false;
    }
  }

  async updateApiKeyRequestCount(name: string, requestCount: number): Promise<void> {
    await db.update(apiKeyPool)
      .set({ 
        requestCount,
        updatedAt: new Date()
      })
      .where(eq(apiKeyPool.name, name));
  }

  async updateApiKeyLastReset(name: string): Promise<void> {
    await db.update(apiKeyPool)
      .set({ 
        lastResetTime: new Date(),
        requestCount: 0,
        updatedAt: new Date()
      })
      .where(eq(apiKeyPool.name, name));
  }

  async removeApiKey(name: string): Promise<void> {
    await db.delete(apiKeyPool)
      .where(eq(apiKeyPool.name, name));
  }

  async bulkReplaceApiKeys(apiKeys: string[], affId: string): Promise<{ count: number }> {
    console.log(`🔄 Bulk replacing API keys: ${apiKeys.length} keys`);
    
    // Step 1: Delete all existing API keys
    await db.delete(apiKeyPool);
    console.log('🗑️  Deleted all existing API keys');
    
    // Step 2: Insert new API keys
    const keyData = apiKeys.map((apiKey, index) => ({
      name: `API_KEY_${index + 1}`,
      apiKey: apiKey.trim(),
      affId: affId.trim(),
      requestCount: 0,
      isActive: true
    }));
    
    await db.insert(apiKeyPool).values(keyData);
    console.log(`✅ Created ${keyData.length} new API keys`);
    
    return { count: keyData.length };
  }

  // Get member history by date range for "Hoy" and "Ayer" functionality
  async getMemberHistoryByDateRange(startDate: Date, endDate: Date): Promise<MemberHistory[]> {
    try {
      const memberHistories = await db.select()
        .from(memberHistory)
        .where(
          and(
            gte(memberHistory.lastAccessedAt, startDate),
            lt(memberHistory.lastAccessedAt, endDate)
          )
        )
        .orderBy(desc(memberHistory.currentBalanceDollars));
      
      return memberHistories;
    } catch (error) {
      console.error('Error getting member history by date range:', error);
      return [];
    }
  }
  
  // Scanner file management
  async addScanFile(filename: string, fileContent: string, totalNumbers: number): Promise<ScanFile> {
    const [scanFile] = await db.insert(scanFiles)
      .values({
        filename,
        fileContent,
        totalNumbers,
        processedNumbers: 0,
        validNumbers: 0,
        invalidNumbers: 0,
        status: "pending"
      })
      .returning();
    
    console.log(`📁 Created scan file: ${filename} with ${totalNumbers} numbers`);
    return scanFile;
  }
  
  async getScanFiles(): Promise<ScanFile[]> {
    // Optimized: Don't load fileContent (can be 1MB+ per file with millions of numbers)
    return await db.select({
      id: scanFiles.id,
      filename: scanFiles.filename,
      fileContent: sql<string>`''`, // Return empty string instead of loading huge content
      totalNumbers: scanFiles.totalNumbers,
      processedNumbers: scanFiles.processedNumbers,
      validNumbers: scanFiles.validNumbers,
      invalidNumbers: scanFiles.invalidNumbers,
      status: scanFiles.status,
      errorMessage: scanFiles.errorMessage,
      uploadedAt: scanFiles.uploadedAt,
      processingStartedAt: scanFiles.processingStartedAt,
      completedAt: scanFiles.completedAt,
    })
      .from(scanFiles)
      .orderBy(desc(scanFiles.uploadedAt));
  }
  
  async updateScanFileProgress(id: number, processed: number, valid: number, invalid: number): Promise<void> {
    await db.update(scanFiles)
      .set({
        processedNumbers: processed,
        validNumbers: valid,
        invalidNumbers: invalid,
        status: processed === 0 ? "pending" : 
                processed < valid + invalid ? "processing" : "completed"
      })
      .where(eq(scanFiles.id, id));
  }
  
  // Scanner queue operations
  async addNumbersToScanQueue(phoneNumbers: string[], fileId?: number): Promise<{added: number; skipped: number}> {
    if (phoneNumbers.length === 0) {
      return { added: 0, skipped: 0 };
    }
    
    console.log(`📲 Processing ${phoneNumbers.length} phone numbers in batches...`);
    
    // DEDUPLICATION: Filter out numbers that were already processed (in scan_queue with final status)
    console.log(`🔍 Checking for already-processed numbers in scan_queue...`);
    const alreadyProcessed = await db
      .select({ phoneNumber: scanQueue.phoneNumber, status: scanQueue.status })
      .from(scanQueue)
      .where(inArray(scanQueue.phoneNumber, phoneNumbers));
    
    const processedSet = new Set(
      alreadyProcessed
        .filter(r => ['completed', 'invalid', 'error_permanent'].includes(r.status || ''))
        .map(r => r.phoneNumber)
    );
    const newNumbers = phoneNumbers.filter(p => !processedSet.has(p));
    
    console.log(`✅ Deduplication: ${phoneNumbers.length} total, ${processedSet.size} already processed (${alreadyProcessed.length} in queue), ${newNumbers.length} new to process`);
    
    if (newNumbers.length === 0) {
      console.log(`⚠️  All ${phoneNumbers.length} numbers were already processed. Skipping.`);
      return { added: 0, skipped: phoneNumbers.length };
    }
    
    // Get count BEFORE inserting
    const beforeCount = await db.select({ count: sql<number>`count(*)` })
      .from(scanQueue);
    const countBefore = Number(beforeCount[0]?.count) || 0;
    
    const BATCH_SIZE = 5000; // Process 5000 numbers at a time to avoid stack overflow
    const totalBatches = Math.ceil(newNumbers.length / BATCH_SIZE);
    
    // Process numbers in batches - CREATE FRESH INSERT FOR EACH BATCH
    for (let i = 0; i < newNumbers.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = newNumbers.slice(i, i + BATCH_SIZE);
      
      const values = batch.map(phoneNumber => ({
        phoneNumber,
        fileId: fileId || null,
        status: "pending" as const,
        attempts: 0
      }));
      
      // CRITICAL FIX: Create FRESH insert builder for each batch
      // This prevents Drizzle from merging queries and overflowing the stack
      await db.insert(scanQueue).values(values).onConflictDoNothing();
      
      console.log(`   ✓ Batch ${batchNumber}/${totalBatches}: Inserted ${batch.length} numbers`);
    }
    
    // Get count AFTER inserting
    const afterCount = await db.select({ count: sql<number>`count(*)` })
      .from(scanQueue);
    const countAfter = Number(afterCount[0]?.count) || 0;
    
    const totalAdded = countAfter - countBefore;
    const totalSkipped = phoneNumbers.length - totalAdded;
    
    console.log(`✅ TOTAL: Added ${totalAdded} new numbers to scan queue, skipped ${totalSkipped} duplicates`);
    return { added: totalAdded, skipped: totalSkipped };
  }
  
  async getNextPendingNumbers(limit: number): Promise<ScanQueue[]> {
    // ULTRA-FAST: Direct UPDATE with partial index scan
    // NO ORDER BY = instant with 87M records (uses scan_queue_pending_idx)
    // FOR UPDATE SKIP LOCKED prevents race conditions between workers
    const result = await db.execute(sql`
      UPDATE ${scanQueue}
      SET status = 'processing', processed_at = NOW()
      WHERE id IN (
        SELECT id
        FROM ${scanQueue}
        WHERE status = 'pending'
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING 
        id,
        phone_number as "phoneNumber",
        file_id as "fileId",
        status,
        attempts,
        last_attempt_at as "lastAttemptAt",
        processed_at as "processedAt",
        last_status_change_at as "lastStatusChangeAt",
        error_code as "errorCode",
        error_message as "errorMessage",
        error_is_retryable as "errorIsRetryable",
        created_at as "createdAt"
    `);
    
    return result.rows as ScanQueue[];
  }
  
  async getPendingCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(scanQueue)
      .where(eq(scanQueue.status, "pending"));
    return result[0]?.count || 0;
  }
  
  async markNumberAsProcessed(
    phoneNumber: string, 
    status: 'completed' | 'invalid' | 'error_retryable' | 'error_permanent', 
    result?: any,
    errorCode?: string,
    errorMessage?: string,
    errorIsRetryable?: boolean
  ): Promise<void> {
    await db.update(scanQueue)
      .set({
        status,
        processedAt: new Date(),
        attempts: sql`${scanQueue.attempts} + 1`,
        lastAttemptAt: new Date(),
        lastStatusChangeAt: new Date(),
        errorCode: errorCode || null,
        errorMessage: errorMessage || null,
        errorIsRetryable: errorIsRetryable !== undefined ? errorIsRetryable : null
      })
      .where(eq(scanQueue.phoneNumber, phoneNumber));
  }
  
  // Scanner results operations
  async addScanResult(result: InsertScanResult): Promise<void> {
    try {
      // Calculate state from zipCode
      const zipCode = result.zipCode || null;
      const state = zipCode ? zipCodeToState(zipCode) : null;
      
      // 1. Save to scan_results table
      await db.insert(scanResults)
        .values(result)
        .onConflictDoUpdate({
          target: scanResults.phoneNumber,
          set: {
            memberName: result.memberName,
            encLoyaltyId: result.encLoyaltyId,
            currentBalance: result.currentBalance,
            currentBalanceDollars: result.currentBalanceDollars,
            lastActivityDate: result.lastActivityDate,
            zipCode: result.zipCode,
            state: state,
            fileId: result.fileId,
            sessionId: result.sessionId,
            scannedAt: new Date()
          }
        });
      
      // 2. ALSO save to member_history so it appears in sidebar by balance
      await db.insert(memberHistory)
        .values({
          phoneNumber: result.phoneNumber,
          memberName: result.memberName || 'Unknown',
          encLoyaltyId: result.encLoyaltyId || '',
          currentBalance: result.currentBalance || 0,
          currentBalanceDollars: result.currentBalanceDollars || 0,
          lastActivityDate: result.lastActivityDate || null,
          zipCode: zipCode,
          state: state,
          isMarked: false,
          markedAt: null
        })
        .onConflictDoUpdate({
          target: memberHistory.phoneNumber,
          set: {
            memberName: result.memberName || 'Unknown',
            encLoyaltyId: result.encLoyaltyId || '',
            currentBalance: result.currentBalance || 0,
            currentBalanceDollars: result.currentBalanceDollars || 0,
            lastActivityDate: result.lastActivityDate || null,
            zipCode: zipCode,
            state: state,
            updatedAt: new Date()
          }
        });
      
      console.log(`✅ Saved scan result for ${result.phoneNumber} (balance: $${result.currentBalanceDollars}, zip: ${zipCode}, state: ${state})`);
    } catch (error) {
      console.error(`❌ Error saving scan result for ${result.phoneNumber}:`, error);
    }
  }
  
  async getScanResults(limit: number = 100, offset: number = 0): Promise<ScanResult[]> {
    return await db.select()
      .from(scanResults)
      .orderBy(desc(scanResults.currentBalance), desc(scanResults.scannedAt))
      .limit(limit)
      .offset(offset);
  }
  
  // Scanner sessions operations
  async createScanSession(): Promise<ScanSession> {
    const [session] = await db.insert(scanSessions)
      .values({
        status: "active",
        totalScanned: 0,
        validFound: 0,
        invalidFound: 0,
        apiKeysUsed: 0
      })
      .returning();
    
    console.log(`🔄 Created new scan session: ${session.id}`);
    return session;
  }
  
  async updateScanSession(id: number, data: Partial<ScanSession>): Promise<void> {
    await db.update(scanSessions)
      .set(data)
      .where(eq(scanSessions.id, id));
  }
  
  async getActiveScanSession(): Promise<ScanSession | null> {
    const [session] = await db.select()
      .from(scanSessions)
      .where(eq(scanSessions.status, "active"))
      .orderBy(desc(scanSessions.startTime))
      .limit(1);
    
    return session || null;
  }
  
  // Downloads system operations
  async getAccountsWithFilters(filters: {
    downloaded?: boolean;
    zipCode?: string;
    state?: string;
    minBalance?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ accounts: MemberHistory[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    
    // Build WHERE conditions
    const conditions = [];
    
    // Filter by downloaded status
    if (filters.downloaded !== undefined) {
      conditions.push(eq(memberHistory.downloaded, filters.downloaded));
    }
    
    // Filter by zip code (exact match)
    if (filters.zipCode) {
      conditions.push(eq(memberHistory.zipCode, filters.zipCode));
    }
    
    // Filter by state (using ZIP code list from mapping)
    if (filters.state && !filters.zipCode) {
      const mapping = loadZipStateMapping();
      const stateZips = mapping.stateToZips[filters.state];
      
      if (stateZips && stateZips.length > 0) {
        // Clean ZIP codes (remove suffix like -9740)
        const cleanZips = stateZips.map(zip => zip.split('-')[0]);
        
        // Use SQL to extract first 5 digits from ZIP code for comparison
        // This handles ZIP codes with suffixes like "33196-9740"
        conditions.push(
          sql`LEFT(COALESCE(${memberHistory.zipCode}, ''), 5) IN (${sql.join(
            cleanZips.map(z => sql`${z}`), 
            sql`, `
          )})`
        );
        console.log(`🗺️ STATE FILTER: Filtering by state ${filters.state} (${cleanZips.length} ZIP codes)`);
      } else {
        // State not found, return empty results
        console.warn(`⚠️ STATE FILTER: State ${filters.state} not found in mapping`);
        return { accounts: [], total: 0 };
      }
    }
    
    // Filter by minimum balance
    if (filters.minBalance !== undefined) {
      const minBalanceCents = Math.floor(filters.minBalance * 100);
      conditions.push(gte(memberHistory.currentBalance, minBalanceCents));
    }
    
    // Filter by date range
    if (filters.dateFrom) {
      conditions.push(gte(memberHistory.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999); // End of day
      conditions.push(lte(memberHistory.createdAt, dateTo));
    }
    
    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memberHistory)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = Number(countResult?.count || 0);
    
    // Get accounts with pagination
    const accounts = await db
      .select()
      .from(memberHistory)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(memberHistory.currentBalance), desc(memberHistory.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { accounts, total };
  }
  
  async getAllAccountIdsWithFilters(filters: {
    downloaded?: boolean;
    zipCode?: string;
    state?: string;
  }): Promise<number[]> {
    // Build WHERE conditions (same logic as getAccountsWithFilters)
    const conditions = [];
    
    // Filter by downloaded status
    if (filters.downloaded !== undefined) {
      conditions.push(eq(memberHistory.downloaded, filters.downloaded));
    }
    
    // Filter by zip code (exact match)
    if (filters.zipCode) {
      conditions.push(eq(memberHistory.zipCode, filters.zipCode));
    }
    
    // Filter by state (using ZIP code list from mapping)
    if (filters.state && !filters.zipCode) {
      const mapping = loadZipStateMapping();
      const stateZips = mapping.stateToZips[filters.state];
      
      if (stateZips && stateZips.length > 0) {
        // Clean ZIP codes (remove suffix like -9740)
        const cleanZips = stateZips.map(zip => zip.split('-')[0]);
        
        // Use SQL to extract first 5 digits from ZIP code for comparison
        conditions.push(
          sql`LEFT(COALESCE(${memberHistory.zipCode}, ''), 5) IN (${sql.join(
            cleanZips.map(z => sql`${z}`), 
            sql`, `
          )})`
        );
        console.log(`🗺️ ALL IDS STATE FILTER: Filtering by state ${filters.state} (${cleanZips.length} ZIP codes)`);
      } else {
        // State not found, return empty results
        console.warn(`⚠️ ALL IDS STATE FILTER: State ${filters.state} not found in mapping`);
        return [];
      }
    }
    
    // Get all IDs matching the filters (no pagination)
    const results = await db
      .select({ id: memberHistory.id })
      .from(memberHistory)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return results.map(r => r.id);
  }
  
  async markAccountsAsDownloaded(accountIds: number[]): Promise<void> {
    if (accountIds.length === 0) return;
    
    await db
      .update(memberHistory)
      .set({
        downloaded: true,
        downloadedAt: new Date(),
      })
      .where(inArray(memberHistory.id, accountIds));
    
    console.log(`✅ Marked ${accountIds.length} accounts as downloaded`);
  }
  
  getAvailableStates(): string[] {
    const mapping = loadZipStateMapping();
    return Object.keys(mapping.stateToZips).sort();
  }
  
  getZipToStateMapping(): Record<string, string> {
    const mapping = loadZipStateMapping();
    return mapping.zipToState;
  }
  
  // Backfill operations
  async createBackfillJob(data: Partial<InsertBackfillJob>): Promise<BackfillJob> {
    const [job] = await db.insert(backfillJobs).values({
      status: data.status || 'pending',
      totalAccounts: data.totalAccounts || 0,
      processedAccounts: data.processedAccounts || 0,
      updatedAccounts: data.updatedAccounts || 0,
      failedAccounts: data.failedAccounts || 0,
      currentPhone: data.currentPhone,
      startedAt: data.startedAt,
      errorMessage: data.errorMessage
    }).returning();
    
    return job;
  }
  
  async updateBackfillJob(id: number, data: Partial<BackfillJob>): Promise<void> {
    await db.update(backfillJobs)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(backfillJobs.id, id));
  }
  
  async getActiveBackfillJob(): Promise<BackfillJob | null> {
    const [job] = await db.select()
      .from(backfillJobs)
      .where(or(
        eq(backfillJobs.status, 'running'),
        eq(backfillJobs.status, 'paused')
      ))
      .orderBy(desc(backfillJobs.createdAt))
      .limit(1);
    
    return job || null;
  }
  
  async getAccountsWithoutZipCode(limit: number, offset: number): Promise<MemberHistory[]> {
    const accounts = await db.select()
      .from(memberHistory)
      .where(or(
        eq(memberHistory.zipCode, ''),
        sql`${memberHistory.zipCode} IS NULL`
      ))
      .limit(limit)
      .offset(offset);
    
    return accounts;
  }
  
  async getAccountsWithoutZipCodeCount(): Promise<number> {
    const result = await db.select({
      count: sql<number>`count(*)`
    })
    .from(memberHistory)
    .where(or(
      eq(memberHistory.zipCode, ''),
      sql`${memberHistory.zipCode} IS NULL`
    ));
    
    return result[0]?.count || 0;
  }
  
  async updateMemberZipAndState(phoneNumber: string, zipCode: string, state: string): Promise<void> {
    await db.update(memberHistory)
      .set({
        zipCode,
        state
      })
      .where(eq(memberHistory.phoneNumber, phoneNumber));
  }
}

export const storage = new DatabaseStorage();
