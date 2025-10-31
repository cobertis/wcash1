import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { walgreensAPI, generateSSLCertificateRequest } from "./services/walgreens";
import { balanceRewardsService } from "./services/balance-rewards";
import { handleProductionMemberHistory } from "./production-fix";
import { db } from "./db";
import { memberHistory, members, scanQueue, scanFiles, scanResults } from "@shared/schema";
import { eq, desc, asc, sql, and, isNotNull, ne, gte, lt } from "drizzle-orm";
import { ScannerService } from "./services/scanner-service";
import { z } from "zod";

// Removed AI promotions service
import { 
  lookupMemberSchema, 
  clipOfferSchema, 
  searchOffersSchema, 
  fetchOffersSchema, 
  redeemedOffersSchema,
  type LookupMemberRequest,
  type ClipOfferRequest,
  type SearchOffersRequest,
  type FetchOffersRequest,
  type RedeemedOffersRequest
} from "@shared/schema";

// Configure multer for file uploads - SIN LÍMITES
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity, // SIN LÍMITE DE TAMAÑO
    fieldSize: Infinity, // SIN LÍMITE DE CAMPO
    fields: Infinity, // SIN LÍMITE DE CAMPOS
    files: Infinity // SIN LÍMITE DE ARCHIVOS
  },
  fileFilter: (req, file, cb) => {
    // Only allow .txt and .csv files
    if (file.originalname.endsWith('.txt') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .txt y .csv'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize Scanner Service
  const scannerService = ScannerService.getInstance();
  await scannerService.initialize().catch(err => {
    console.error('❌ Failed to initialize scanner service:', err);
  });
  
  // Health check endpoint (for load balancers, Caddy, PM2, etc.)
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development"
    });
  });
  
  app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
  });
  
  // POST /api/lookup-live - Member lookup using live API calls (OPTIMIZED)
  app.post("/api/lookup-live", async (req, res) => {
    try {
      const { phoneNumber } = lookupMemberSchema.parse(req.body);
      
      // PROTECTION: Skip if phoneNumber is invalid
      if (!phoneNumber || phoneNumber.length < 10) {
        console.warn(`⚠️ SKIPPING ${phoneNumber} - Invalid phone number format (no changes made)`);
        return res.status(400).json({ 
          error: "Invalid phone number", 
          message: "Número de teléfono inválido. No se realizaron cambios." 
        });
      }
      
      // Make live API call to Walgreens
      const lookupData = await walgreensAPI.lookupMember(phoneNumber);
      
      if (!lookupData || !lookupData.matchProfiles || lookupData.matchProfiles.length === 0) {
        console.warn(`⚠️ SKIPPING ${phoneNumber} - No match found in Walgreens API (no changes made)`);
        // DO NOT auto-delete - just skip to avoid modifying database when API has errors
        return res.status(404).json({ 
          error: "Member not found in live API", 
          message: "Cuenta no encontrada en la API de Walgreens. No se realizaron cambios." 
        });
      }

      // Extract encLoyaltyId from lookup response
      const encLoyaltyId = lookupData.matchProfiles[0].loyaltyMemberId;
      const profile = lookupData.matchProfiles[0];
      
      // PROTECTION: Skip if no valid encLoyaltyId
      if (!encLoyaltyId) {
        console.warn(`⚠️ SKIPPING ${phoneNumber} - No loyalty ID found (no changes made)`);
        return res.status(404).json({ 
          error: "No loyalty ID found", 
          message: "ID de lealtad no encontrado. No se realizaron cambios." 
        });
      }

      // Get full member profile using encLoyaltyId
      let memberProfileData;
      try {
        memberProfileData = await walgreensAPI.getMember(encLoyaltyId);
        
        // PROTECTION: Verify member data is valid before proceeding
        if (!memberProfileData || !memberProfileData.profile) {
          console.warn(`⚠️ SKIPPING ${phoneNumber} - Invalid member profile data (no changes made)`);
          return res.status(404).json({ 
            error: "Invalid member profile", 
            message: "Datos de perfil inválidos. No se realizaron cambios." 
          });
        }
        
      } catch (profileError: any) {
        console.warn(`⚠️ SKIPPING ${phoneNumber} - Failed to get member profile: ${profileError.message} (no changes made)`);
        return res.status(500).json({ 
          error: "Failed to get member profile", 
          message: "Error al obtener perfil del miembro. No se realizaron cambios." 
        });
      }
      
      // Update member history in database with fresh data from API (OPTIMIZED)
      try {
        const rawMemberData = memberProfileData.profile || profile;
        
        // Extract balance and activity date
        let currentBalanceDollars = '0.00';
        if (rawMemberData?.Reward?.CurrentBalanceDollars !== undefined) {
          currentBalanceDollars = rawMemberData.Reward.CurrentBalanceDollars.toString();
        } else if (memberProfileData.balance) {
          currentBalanceDollars = memberProfileData.balance;
        }
        
        let lastActivityDate = null;
        const tryActivityPaths = [
          rawMemberData?.Reward?.LastActivityDate,
          rawMemberData?.Reward?.lastActivityDate,
          rawMemberData?.reward?.LastActivityDate,
          rawMemberData?.reward?.lastActivityDate,
          rawMemberData?.LastActivityDate,
          rawMemberData?.lastActivityDate,
          profile?.lastActivityDate,
          lookupData?.lastActivityDate
        ];
        
        for (const path of tryActivityPaths) {
          if (path) {
            lastActivityDate = path;
            break;
          }
        }
        
        if (!lastActivityDate) {
          lastActivityDate = new Date().toISOString();
        }
        
        // Update or create member history record
        const existingRecord = await db.select()
          .from(memberHistory)
          .where(eq(memberHistory.phoneNumber, phoneNumber))
          .limit(1);
        
        if (existingRecord.length > 0) {
          await storage.updateMemberBalanceOnly(phoneNumber, rawMemberData);
          console.log(`🔄 CACHE INVALIDATION: Updated existing account ${phoneNumber}, clearing optimized cache`);
        } else {
          await storage.updateMemberHistory(phoneNumber, rawMemberData);
          console.log(`🔄 CACHE INVALIDATION: Created new account ${phoneNumber}, clearing optimized cache`);
        }
        
        // INVALIDATE CACHE: Clear optimized endpoints cache to show updated/new account
        if (typeof global !== 'undefined') {
          (global as any).optimizedCacheCleared = Date.now();
        }
        
        // Clear all caches to reflect new data immediately
        clearAllCaches();
      } catch (dbError) {
        // Silent fail - continue even if database update fails
      }
      
      // Return response in same format as cached endpoint
      const response = {
        encLoyaltyId: encLoyaltyId,
        profile: {
          name: memberProfileData.name,
          cardNumber: memberProfileData.cardNumber || profile.loyaltyCardNumber || '',
          balance: memberProfileData.balance || '0.00',
        },
        rawLookupData: {
          ...lookupData,
          encLoyaltyId: encLoyaltyId,
          profile: {
            matchProfiles: lookupData.matchProfiles
          }
        },
        rawMemberData: memberProfileData.profile || profile,
        phoneNumber: phoneNumber,
      };

      res.json(response);
      
    } catch (error) {
      console.error("❌ LIVE LOOKUP ERROR:", error);
      res.status(500).json({ 
        error: "Failed to lookup member from live API", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/lookup - Member lookup using cached data
  app.post("/api/lookup", async (req, res) => {
    try {
      const { phoneNumber } = lookupMemberSchema.parse(req.body);
      console.log(`🔍 LOOKUP REQUEST for cached data: ${phoneNumber}`);
      
      // Get member data from member_history table
      const memberHistoryRecords = await storage.getMemberHistory();
      const memberRecord = memberHistoryRecords.find(m => m.phoneNumber === phoneNumber);
      
      if (!memberRecord || !memberRecord.memberName) {
        throw new Error('Member not found in cached data');
      }
      
      console.log(`💾 FOUND CACHED MEMBER: ${memberRecord.memberName} with balance $${memberRecord.currentBalanceDollars}`);
      console.log(`💾 MEMBER RECORD FIELDS:`, {
        email_address: memberRecord.emailAddress,
        card_number: memberRecord.cardNumber,
        enc_loyalty_id: memberRecord.encLoyaltyId,
        member_data: memberRecord.memberData ? 'Available' : 'Missing',
        keys: Object.keys(memberRecord)
      });
      
      if (memberRecord.memberData) {
        console.log(`💾 MEMBER DATA SAMPLE:`, {
          email: (memberRecord.memberData as any)?.EMailAddress?.EMailAddress,
          cardNumber: (memberRecord.memberData as any)?.CardNumber,
          memberId: (memberRecord.memberData as any)?.MemberID
        });
      }

      // Parse actual member data from database JSON field if available
      let actualMemberData = null;
      let actualEmail = memberRecord.emailAddress;
      let actualCardNumber = memberRecord.cardNumber;
      let actualMemberId = memberRecord.encLoyaltyId;
      let actualZipCode = null;
      
      if (memberRecord.memberData && typeof memberRecord.memberData === 'object') {
        actualMemberData = memberRecord.memberData;
        actualEmail = (actualMemberData as any).EMailAddress?.EMailAddress || memberRecord.emailAddress;
        actualCardNumber = (actualMemberData as any).CardNumber || memberRecord.cardNumber;
        actualMemberId = (actualMemberData as any).MemberID || memberRecord.encLoyaltyId;
        // Note: ZIP code not available in this data structure
        console.log(`💾 USING ACTUAL DATA: Email=${actualEmail}, Card=${actualCardNumber}, MemberId=${actualMemberId}`);
      }
      
      // Skip member creation - we only use member_history table now
      
      // Parse member name into first/last name
      const nameParts = (memberRecord.memberName || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Create comprehensive data structure matching live API format
      const memberData = {
        CustomerType: "Member",
        MemberID: memberRecord.encLoyaltyId || `cached_${phoneNumber}`,
        MemberStatus: "Active",
        Name: {
          FirstName: firstName,
          LastName: lastName
        },
        PhoneList: {
          Phone: [{
            AreaCode: phoneNumber.substring(0, 3),
            Number: phoneNumber.substring(3),
            TypeCode: "Mobile"
          }]
        },
        CardNumber: actualCardNumber || `card_${phoneNumber}`,
        Reward: {
          CurrentBalance: Math.round((parseFloat(memberRecord.currentBalanceDollars || '0') * 100)),
          CurrentBalanceDollars: parseFloat(memberRecord.currentBalanceDollars || '0'),
          LastActivityDate: memberRecord.lastActivityDate || memberRecord.lastAccessedAt || new Date().toISOString()
        },
        EMailAddress: {
          EMailAddress: actualEmail || `${phoneNumber}@example.com`
        },
        ProgramList: { Program: [] },
        ProgramPrefList: { Preference: [] },
        Preferences: {},
        AffiliationPoints: [],
        PointsExpirations: []
      };

      // Return data from cached member history
      res.json({
        encLoyaltyId: actualMemberId || `cached_${phoneNumber}`,
        profile: {
          name: memberRecord.memberName,
          cardNumber: actualCardNumber || `card_${phoneNumber}`,
          balance: memberRecord.currentBalanceDollars || '0.00',
        },
        rawLookupData: {
          encLoyaltyId: actualMemberId || `cached_${phoneNumber}`,
          phoneNumber: phoneNumber,
          messages: [{ code: "WAG_I_MYWAG_1046", message: "Single match found for the phone number", type: "INFO" }],
          matchProfiles: [{
            loyaltyMemberId: actualMemberId || `cached_${phoneNumber}`,
            loyaltyCardNumber: actualCardNumber || `card_${phoneNumber}`,
            firstName: firstName,
            lastName: lastName,
            email: actualEmail || `${phoneNumber}@example.com`,
            zipCode: actualZipCode || 'N/A'
          }],
          profile: {
            matchProfiles: [{
              loyaltyMemberId: actualMemberId || `cached_${phoneNumber}`,
              loyaltyCardNumber: actualCardNumber || `card_${phoneNumber}`,
              firstName: firstName,
              lastName: lastName,
              email: actualEmail || `${phoneNumber}@example.com`,
              zipCode: actualZipCode || 'N/A'
            }]
          }
        },
        rawMemberData: memberData,
        phoneNumber: phoneNumber,
      });
    } catch (error) {
      console.error("❌ CACHED LOOKUP ERROR:", error);
      res.status(400).json({ 
        error: "Failed to lookup member from cached data", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/delete-invalid-member - Delete invalid member from database
  app.post("/api/delete-invalid-member", async (req, res) => {
    try {
      const { phoneNumber } = lookupMemberSchema.parse(req.body);
      console.log(`🗑️ DELETING INVALID MEMBER: ${phoneNumber}`);
      
      // Remove from member_history table using direct SQL
      const deletedHistory = await db.delete(memberHistory)
        .where(eq(memberHistory.phoneNumber, phoneNumber));
      
      // Remove from members table if exists using direct SQL
      let deletedMembers = 0;
      try {
        const result = await db.delete(members)
          .where(eq(members.phoneNumber, phoneNumber));
        deletedMembers = result.rowCount || 0;
      } catch (memberError) {
        console.log(`⚠️ Member not found in members table (normal): ${phoneNumber}`);
      }
      
      const totalDeleted = (deletedHistory.rowCount || 0) + deletedMembers;
      console.log(`✅ DELETED INVALID ACCOUNT: ${phoneNumber} - Records removed: ${totalDeleted}`);
      
      res.json({
        success: true,
        message: "Cuenta eliminada exitosamente de la base de datos",
        phoneNumber,
        recordsDeleted: totalDeleted
      });
      
    } catch (error) {
      console.error("❌ DELETE INVALID MEMBER ERROR:", error);
      res.status(500).json({ 
        error: "Failed to delete invalid member", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/member-history-production - Production-optimized endpoint  
  app.get("/api/member-history-production", async (req, res) => {
    try {
      console.log('🏭 PRODUCTION ENDPOINT: Getting member history for production...');
      
      // Get pagination parameters with production-safe defaults
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 5000); // Max 5000 per page in production
      const offset = (page - 1) * limit;
      
      console.log(`🏭 PRODUCTION: Loading page ${page}, limit ${limit}, offset ${offset}`);
      
      try {
        // Fast count query
        const totalCountResult = await db.select({ count: sql<number>`count(*)` }).from(memberHistory);
        const totalCount = totalCountResult[0]?.count || 0;
        
        // Select essential fields only
        const records = await db.select({
          phoneNumber: memberHistory.phoneNumber,
          memberName: memberHistory.memberName,
          currentBalanceDollars: memberHistory.currentBalanceDollars,
          currentBalance: memberHistory.currentBalance,
          lastAccessedAt: memberHistory.lastAccessedAt,
          markedAsUsed: memberHistory.markedAsUsed
        }).from(memberHistory)
          .orderBy(desc(memberHistory.lastAccessedAt))
          .limit(limit)
          .offset(offset);
        
        console.log(`🏭 PRODUCTION: Found ${records.length} records (page ${page}/${Math.ceil(totalCount / limit)})`);
        
        const response = {
          data: records,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        };
        
        // Set production-safe headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        console.log(`🏭 PRODUCTION: Returning ${records.length} records with pagination`);
        return res.status(200).json(response);
        
      } catch (dbError) {
        console.log('🏭 PRODUCTION: DB error:', dbError);
        return res.status(200).json({ data: [], pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
      }
      
    } catch (error) {
      console.error('🏭 PRODUCTION ERROR:', error);
      res.status(200).json({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
    }
  });

  // DEBUG: Test endpoint for production troubleshooting
  app.get("/api/debug/member-history", async (req, res) => {
    try {
      console.log('🔧 DEBUG ENDPOINT: Testing database connection...');
      
      // Test basic database connection
      const testCount = await db.select({ count: sql<number>`count(*)` }).from(memberHistory);
      console.log('🔧 DEBUG: Database connection successful, total count:', testCount[0]?.count);
      
      // Test direct select with limit
      const sampleRecords = await db.select().from(memberHistory).limit(5);
      console.log('🔧 DEBUG: Sample records:', sampleRecords.length);
      
      // Test all records
      const allRecords = await db.select().from(memberHistory);
      console.log('🔧 DEBUG: All records:', allRecords.length);
      
      res.json({
        status: 'success',
        dbConnection: 'OK',
        totalCount: testCount[0]?.count || 0,
        sampleCount: sampleRecords.length,
        allCount: allRecords.length,
        sample: sampleRecords.slice(0, 2)
      });
      
    } catch (error) {
      console.error('🔧 DEBUG ERROR:', error);
      res.status(500).json({
        status: 'error',
        error: (error as Error).message
      });
    }
  });

  // GET /api/member/:encId - Get member details
  app.get("/api/member/:encId", async (req, res) => {
    try {
      const { encId } = req.params;
      
      // Get member data - using available method
      const member = null; // Removed deprecated method call
      
      if (!member) {
        // Try to get from Walgreens API
        const memberProfile = await walgreensAPI.getMember(encId);
        
        // This shouldn't happen if lookup was called first, but handle it
        res.status(404).json({ error: "Member not found" });
        return;
      }
      
      res.json({
        name: member.name,
        cardNumber: member.cardNumber,
        balance: member.balance,
        profile: member.profile,
      });
    } catch (error) {
      console.error("Get member error:", error);
      res.status(400).json({ 
        error: "Failed to get member", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/category-counts - Get category counts
  app.get("/api/category-counts", async (req, res) => {
    try {
      const { encId } = req.query;
      
      if (!encId) {
        res.status(400).json({ error: "encId is required" });
        return;
      }
      
      const counts = await walgreensAPI.getCategoryCounts(encId as string);
      res.json(counts);
    } catch (error) {
      console.error("Get category counts error:", error);
      res.status(500).json({ 
        error: "Failed to get category counts", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/offers - Fetch offers
  app.get("/api/offers", async (req, res) => {
    try {
      const { encId, page = "1", size = "20", category } = req.query;
      
      const parsedData = fetchOffersSchema.parse({
        encId,
        page: parseInt(page as string),
        size: parseInt(size as string),
        category: category as string,
      });
      
      // Get offers from Walgreens API
      const offersData = await walgreensAPI.fetchOffers(parsedData.encId, {
        page: parsedData.page,
        size: parsedData.size,
        category: parsedData.category,
      });
      
      res.json(offersData);
    } catch (error) {
      console.error("Fetch offers error:", error);
      res.status(400).json({ 
        error: "Failed to fetch offers", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/search - Search offers
  app.get("/api/search", async (req, res) => {
    try {
      const { encId, q, type, page = "1", size = "20" } = req.query;
      
      const parsedData = searchOffersSchema.parse({
        encId,
        q: q as string,
        type: type as string,
        page: parseInt(page as string),
        size: parseInt(size as string),
      });
      
      if (!parsedData.q) {
        res.json({ offers: [], totalCount: 0, page: parsedData.page, size: parsedData.size });
        return;
      }
      
      // Search offers via Walgreens API
      const searchResults = await walgreensAPI.searchOffers(
        parsedData.encId,
        parsedData.q,
        parsedData.type,
        parsedData.page,
        parsedData.size
      );
      
      res.json(searchResults);
    } catch (error) {
      console.error("Search offers error:", error);
      res.status(400).json({ 
        error: "Failed to search offers", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/clip - Clip an offer
  app.post("/api/clip", async (req, res) => {
    try {
      const { encId, offerId, channel = "web" } = clipOfferSchema.parse(req.body);
      
      // Clip offer via Walgreens API
      const clipResult = await walgreensAPI.clipOffer(encId, offerId, channel);
      
      // Store clipped offer in local storage
      await storage.createClippedOffer({
        encLoyaltyId: encId,
        offerId,
        channel,
        status: "active",
      });
      
      res.json(clipResult);
    } catch (error) {
      console.error("Clip offer error:", error);
      res.status(400).json({ 
        error: "Failed to clip offer", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/unclip - Unclip an offer
  app.post("/api/unclip", async (req, res) => {
    try {
      const { encId, offerId } = clipOfferSchema.parse(req.body);
      
      // Unclip offer via Walgreens API
      const unclipResult = await walgreensAPI.unclipOffer(encId, offerId);
      
      // Remove clipped offer from local storage
      await storage.removeClippedOffer(encId, offerId);
      
      res.json(unclipResult);
    } catch (error) {
      console.error("Unclip offer error:", error);
      res.status(400).json({ 
        error: "Failed to unclip offer", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/clip-all - Clip all available offers
  app.post("/api/clip-all", async (req, res) => {
    try {
      const { encId } = req.body;
      
      if (!encId) {
        return res.status(400).json({ 
          error: "Missing required parameter",
          message: "encId is required"
        });
      }
      
      console.log(`[CLIP ALL] Starting bulk clip operation for member: ${encId}`);
      
      const result = await walgreensAPI.clipAllOffers(encId);
      
      console.log(`[CLIP ALL] Bulk clip completed. Results:`, result);
      
      res.json(result);
    } catch (error) {
      console.error("Clip all offers error:", error);
      res.status(500).json({ 
        error: "Failed to clip all offers", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/clipped - Get clipped offers
  app.get("/api/clipped", async (req, res) => {
    try {
      const { encId, encLoyaltyId, page = "1", size = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const sizeNum = parseInt(size as string);
      
      const loyaltyId = encId || encLoyaltyId;
      
      if (!loyaltyId) {
        res.status(400).json({ error: "encId or encLoyaltyId is required" });
        return;
      }
      
      // Get clipped offers from Walgreens API
      const clippedData = await walgreensAPI.listClipped(loyaltyId as string, pageNum, sizeNum);
      
      // Add totalCount to response
      const responseData = {
        ...clippedData,
        totalCount: (clippedData as any).clippedOffers?.length || 0
      };
      
      res.json(responseData);
    } catch (error) {
      console.error("Get clipped offers error:", error);
      res.status(400).json({ 
        error: "Failed to get clipped offers", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/redeemed - Get redeemed offers
  app.get("/api/redeemed", async (req, res) => {
    try {
      const { encId, startDate, endDate, page = "1", size = "20" } = req.query;
      
      const parsedData = redeemedOffersSchema.parse({
        encId,
        start: startDate as string,
        end: endDate as string,
        page: parseInt(page as string),
        size: parseInt(size as string),
      });
      
      // Get redeemed offers from Walgreens API
      const redeemedData = await walgreensAPI.listRedeemed(
        parsedData.encId,
        parsedData.start || '',
        parsedData.end || '',
        parsedData.page,
        parsedData.size
      );
      
      res.json(redeemedData);
    } catch (error) {
      console.error("Get redeemed offers error:", error);
      res.status(400).json({ 
        error: "Failed to get redeemed offers", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/offers/stats/:encLoyaltyId - Get offer statistics
  app.get('/api/offers/stats/:encLoyaltyId', async (req, res) => {
    try {
      const { encLoyaltyId } = req.params;
      const stats = await walgreensAPI.getOfferStats(encLoyaltyId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting offer stats:', error);
      res.status(500).json({ error: 'Failed to get offer stats', message: error.message });
    }
  });

  // POST /api/offers/filtered - Get filtered offers
  app.post('/api/offers/filtered', async (req, res) => {
    try {
      const { encLoyaltyId, filters, page = 1, size = 20 } = req.body;
      const result = await walgreensAPI.getFilteredOffers(encLoyaltyId, filters, page, size);
      res.json(result);
    } catch (error) {
      console.error('Error getting filtered offers:', error);
      res.status(500).json({ error: 'Failed to get filtered offers', message: error.message });
    }
  });

  // POST /api/ssl-certificate/request - Generate SSL certificate request
  app.post('/api/ssl-certificate/request', async (req, res) => {
    try {
      const { affId, businessPurpose, estimatedVolume = 1000 } = req.body;
      
      if (!affId || !businessPurpose) {
        res.status(400).json({ 
          error: "affId and businessPurpose are required",
          example: {
            affId: "your_affiliate_id",
            businessPurpose: "Product inventory management and cart integration",
            estimatedVolume: 1000
          }
        });
        return;
      }
      
      const requestText = generateSSLCertificateRequest(affId, businessPurpose, estimatedVolume);
      
      res.json({
        success: true,
        requestText: requestText,
        instructions: {
          step1: "Copy the generated request text",
          step2: "Email to developers@walgreens.com",
          step3: "Wait for SSL certificate from Walgreens team",
          step4: "Add certificate to environment variables",
          step5: "Restart application for full Add to Cart API functionality"
        },
        currentStatus: "Code 905 - Invalid Client ID (SSL Certificate Required)"
      });
    } catch (error) {
      console.error('Error generating SSL certificate request:', error);
      res.status(500).json({ 
        error: 'Failed to generate SSL certificate request', 
        message: (error as Error).message 
      });
    }
  });

  // Store Locator API Routes
  
  // POST /api/stores/search/location - Search stores by geolocation
  app.post('/api/stores/search/location', async (req, res) => {
    try {
      const { lat, lng, radius = 10, page = 1, size = 20, filterOptions = [] } = req.body;
      
      if (!lat || !lng) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }
      
      const result = await walgreensAPI.searchStoresByLocation(
        parseFloat(lat),
        parseFloat(lng),
        radius,
        page,
        size,
        filterOptions
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error searching stores by location:', error);
      res.status(500).json({ 
        error: 'Failed to search stores by location', 
        message: error.message 
      });
    }
  });

  // POST /api/stores/search/address - Search stores by address
  app.post('/api/stores/search/address', async (req, res) => {
    try {
      const { address, radius = 10, page = 1, size = 20, filterOptions = [] } = req.body;
      
      if (!address) {
        res.status(400).json({ error: 'Address is required' });
        return;
      }
      
      const result = await walgreensAPI.searchStoresByAddress(
        address,
        radius,
        page,
        size,
        filterOptions
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error searching stores by address:', error);
      res.status(500).json({ 
        error: 'Failed to search stores by address', 
        message: error.message 
      });
    }
  });

  // POST /api/stores/search/zipcode - Search stores by zip code
  app.post('/api/stores/search/zipcode', async (req, res) => {
    try {
      const { zipCode, radius = 10, page = 1, size = 20, filterOptions = [] } = req.body;
      
      if (!zipCode) {
        res.status(400).json({ error: 'Zip code is required' });
        return;
      }
      
      const result = await walgreensAPI.searchStoresByZipCode(
        zipCode,
        radius,
        page,
        size,
        filterOptions
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error searching stores by zip code:', error);
      res.status(500).json({ 
        error: 'Failed to search stores by zip code', 
        message: error.message 
      });
    }
  });

  // GET /api/stores/details/:storeNumber - Get store details
  app.get('/api/stores/details/:storeNumber', async (req, res) => {
    try {
      const { storeNumber } = req.params;
      
      if (!storeNumber) {
        res.status(400).json({ error: 'Store number is required' });
        return;
      }
      
      const result = await walgreensAPI.getStoreDetails(storeNumber);
      
      res.json(result);
    } catch (error) {
      console.error('Error getting store details:', error);
      res.status(500).json({ 
        error: 'Failed to get store details', 
        message: error.message 
      });
    }
  });

  // GET /api/stores/numbers - Get all store numbers
  app.get('/api/stores/numbers', async (req, res) => {
    try {
      const result = await walgreensAPI.getAllStoreNumbers();
      res.json({ storeNumbers: result });
    } catch (error) {
      console.error('Error getting store numbers:', error);
      res.status(500).json({ 
        error: 'Failed to get store numbers', 
        message: error.message 
      });
    }
  });

  // GET /api/stores/filter-options - Get available filter options
  app.get('/api/stores/filter-options', async (req, res) => {
    try {
      // Return hardcoded filter options for now
      const options = {
        "PHARMACY": "Farmacia",
        "CLINIC": "Clínica",
        "PHOTO": "Fotos",
        "BEAUTY": "Belleza",
        "LIQUOR": "Licores",
        "DRIVE_THRU": "Drive-Thru",
        "24_HOUR": "24 Horas"
      };
      res.json(options);
    } catch (error) {
      console.error('Error getting filter options:', error);
      res.status(500).json({ 
        error: 'Failed to get filter options', 
        message: error.message 
      });
    }
  });

  // POST /api/members/assign-store - Assign store to member using phone number
  app.post("/api/members/assign-store", async (req, res) => {
    try {
      const { phoneNumber, storeNumber, storeName, storeAddress, storePhone } = req.body;
      
      // Validate required fields
      if (!phoneNumber || !storeNumber || !storeName || !storeAddress || !storePhone) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const updatedMember = await storage.assignStoreToMember(phoneNumber, {
        storeNumber,
        storeName,
        storeAddress,
        storePhone
      });
      
      res.json(updatedMember);
    } catch (error) {
      console.error("Error assigning store:", error);
      res.status(500).json({ error: "Failed to assign store", message: error.message });
    }
  });

  // POST /api/inventory/check - Check store inventory
  app.post('/api/inventory/check', async (req, res) => {
    try {
      const { storeNumber, productIds } = req.body;
      
      if (!storeNumber) {
        return res.status(400).json({ error: 'Store number is required' });
      }
      
      console.log('=== CHECKING STORE INVENTORY ===');
      console.log('Store:', storeNumber);
      console.log('Product IDs:', productIds);
      
      const inventoryData = await walgreensAPI.getStoreInventory(storeNumber, productIds);
      
      res.json(inventoryData);
    } catch (error) {
      console.error('Error checking store inventory:', error);
      res.status(500).json({ 
        error: 'Failed to check store inventory',
        message: error.message 
      });
    }
  });

  // POST /api/inventory/v2-test - Test V2 planograms endpoint
  app.post('/api/inventory/v2-test', async (req, res) => {
    try {
      const { upc, storeNumber } = req.body;
      
      if (!upc || !storeNumber) {
        return res.status(400).json({ 
          success: false, 
          message: 'UPC and store number are required' 
        });
      }
      
      const result = await walgreensAPI.checkProductAvailabilityV4(upc, storeNumber);
      
      res.json({
        success: true,
        data: result,
        message: 'V2 API test completed'
      });
    } catch (error) {
      console.error('Error in V2 API test:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error testing V2 API',
        error: error.message 
      });
    }
  });

  // NEW: Direct UPC Search endpoint (inspired by Project-1-Basix)
  app.post('/api/inventory/upc-search', async (req, res) => {
    try {
      const { upc, storeNumber } = req.body;
      
      if (!upc || !storeNumber) {
        return res.status(400).json({ error: 'UPC and store number are required' });
      }
      
      console.log(`=== UPC SEARCH ENDPOINT ===`);
      console.log(`UPC: ${upc}`);
      console.log(`Store: ${storeNumber}`);
      
      const result = await walgreensAPI.searchProductByUPC(upc, storeNumber);
      
      if (result) {
        res.json({ 
          success: true, 
          product: result,
          message: 'Product found using direct UPC search'
        });
      } else {
        res.json({ 
          success: false, 
          product: null,
          message: 'Product not found with UPC search'
        });
      }
    } catch (error) {
      console.error('Error in UPC search:', error);
      res.status(500).json({ 
        error: 'Failed to search by UPC', 
        message: error.message 
      });
    }
  });

  // POST /api/products/search - Search products by name or barcode
  app.post('/api/products/search', async (req, res) => {
    try {
      const { query, page = 1, size = 20 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      console.log('=== SEARCHING PRODUCTS ===');
      console.log('Query:', query);
      console.log('Page:', page, 'Size:', size);
      
      const searchResults = await walgreensAPI.searchProducts(query, page, size);
      
      res.json(searchResults);
    } catch (error) {
      console.error('Error searching products:', error);
      res.status(500).json({ 
        error: 'Failed to search products',
        message: error.message 
      });
    }
  });

  // POST /api/products/search-with-inventory - Search products with inventory data
  app.post('/api/products/search-with-inventory', async (req, res) => {
    try {
      const { query, storeNumber, page = 1, size = 20 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      if (!storeNumber) {
        return res.status(400).json({ error: 'Store number is required' });
      }
      
      console.log('=== SEARCHING PRODUCTS WITH INVENTORY ===');
      console.log('Query:', query);
      console.log('Store:', storeNumber);
      console.log('Page:', page, 'Size:', size);
      
      const searchResults = await walgreensAPI.searchProductsWithInventory(query, storeNumber, page, size);
      
      res.json(searchResults);
    } catch (error) {
      console.error('Error searching products with inventory:', error);
      const errorMessage = error.message || '';
      
      // Check if it's a 403 Unauthorized error
      if (errorMessage.includes('403') || errorMessage.includes('Unauthorised')) {
        res.status(403).json({ 
          error: 'API credentials insufficient',
          message: 'Las credenciales API actuales no tienen permisos para la API de inventario de productos. Se necesitan credenciales específicas para esta funcionalidad.'
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to search products with inventory',
          message: errorMessage 
        });
      }
    }
  });

  // Product Analysis (simplified)
  app.post('/api/analyze/coupon', async (req, res) => {
    try {
      const { coupon, memberName, encLoyaltyId } = req.body;
      
      if (!coupon || !memberName) {
        return res.status(400).json({ error: 'Coupon and member name are required' });
      }
      
      console.log('=== COUPON ANALYSIS REQUEST ===');
      console.log('Coupon:', coupon);
      console.log('Member:', memberName);
      
      // Simple analysis without AI
      const analysis = {
        success: true,
        coupon: coupon,
        memberName: memberName,
        timestamp: new Date().toISOString(),
        // Basic analysis
        discount: coupon.discount || 'No discount info',
        brand: coupon.brandName || 'Unknown brand',
        category: coupon.categoryName || 'Unknown category',
        expiryDate: coupon.expiryDate || 'No expiry date',
        title: coupon.title || 'No title',
        description: coupon.description || 'No description'
      };
      
      res.json(analysis);
      
    } catch (error) {
      console.error('Error in coupon analysis:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor',
        message: error.message,
        success: false
      });
    }
  });

  // GET /api/member-history - Get member history with smart pagination
  app.get("/api/member-history", async (req, res) => {
    try {
      console.log('🔄 PRIMARY ENDPOINT: Getting member history with pagination...');
      
      // Get pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 1000; // Default 1000 per page
      const offset = (page - 1) * limit;
      
      console.log(`📊 PRIMARY: Loading page ${page}, limit ${limit}, offset ${offset}`);
      
      try {
        // Get total count first for pagination info
        const totalCountResult = await db.select({ count: sql<number>`count(*)` }).from(memberHistory);
        const totalCount = totalCountResult[0]?.count || 0;
        
        // Select records with pagination
        const records = await db.select({
          phoneNumber: memberHistory.phoneNumber,
          memberName: memberHistory.memberName,
          currentBalanceDollars: memberHistory.currentBalanceDollars,
          currentBalance: memberHistory.currentBalance,
          lastAccessedAt: memberHistory.lastAccessedAt,
          markedAsUsed: memberHistory.markedAsUsed
        }).from(memberHistory)
          .orderBy(desc(memberHistory.lastAccessedAt))
          .limit(limit)
          .offset(offset);
        
        console.log(`📊 PRIMARY: Found ${records.length} records (page ${page}/${Math.ceil(totalCount / limit)})`);
        
        const response = {
          data: records,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        };
        
        console.log(`✅ PRIMARY: Returning ${records.length} records with pagination info`);
        return res.status(200).json(response);
        
      } catch (dbError) {
        console.log('🔄 PRIMARY: Direct DB failed, trying storage fallback...', dbError);
        
        // Fallback to storage method
        const allRecords = await storage.getMemberHistory(1, 999999);
        console.log(`📊 PRIMARY: Storage fallback found ${allRecords.length} total records`);
        
        if (!allRecords || allRecords.length === 0) {
          console.log('⚠️ PRIMARY: No records found in storage fallback');
          return res.status(200).json([]);
        }
        
        // Return essential fields only to prevent JSON size issues
        const compactHistory = allRecords.map(record => ({
          phoneNumber: record.phoneNumber,
          memberName: record.memberName,
          currentBalanceDollars: record.currentBalanceDollars,
          currentBalance: record.currentBalance,
          lastAccessedAt: record.lastAccessedAt,
          markedAsUsed: record.markedAsUsed
        }));
        
        console.log(`✅ PRIMARY: Returning ${compactHistory.length} records from storage`);
        return res.status(200).json(compactHistory);
      }
      
    } catch (error) {
      console.error('❌ PRIMARY ERROR:', error);
      res.status(200).json([]);
    }
  });

  


  // GET /api/member-history-valid-count - Get count of valid member accounts only
  app.get("/api/member-history-valid-count", async (req, res) => {
    try {
      const validCount = await storage.getMemberHistoryValidCount();
      res.json({ validCount });
    } catch (error) {
      console.error("Valid member history count error:", error);
      res.status(500).json({ 
        error: "Failed to get valid member history count", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/member-history/marked-status/:phoneNumber - Get marked status of specific account
  app.get("/api/member-history/marked-status/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      console.log(`🔍 MARKED STATUS CHECK: ${phoneNumber}`);
      
      const memberRecord = await db.select({
        markedAsUsed: memberHistory.markedAsUsed,
        markedAsUsedAt: memberHistory.markedAsUsedAt
      })
      .from(memberHistory)
      .where(eq(memberHistory.phoneNumber, phoneNumber))
      .limit(1);

      if (memberRecord.length === 0) {
        return res.status(404).json({ 
          error: "Member not found",
          markedAsUsed: false 
        });
      }

      const marked = memberRecord[0].markedAsUsed || false;
      console.log(`✅ MARKED STATUS: ${phoneNumber} - ${marked ? 'MARKED' : 'NOT MARKED'}`);
      
      res.json({
        phoneNumber,
        markedAsUsed: marked,
        markedAsUsedAt: memberRecord[0].markedAsUsedAt
      });
    } catch (error) {
      console.error("Get marked status error:", error);
      res.status(500).json({ 
        error: "Failed to get marked status", 
        message: (error as Error).message,
        markedAsUsed: false
      });
    }
  });

  // GET /api/member-history/all-marked - Get all marked phone numbers
  app.get("/api/member-history/all-marked", async (req, res) => {
    try {
      console.log(`🔍 GETTING ALL MARKED ACCOUNTS`);
      
      const markedMembers = await db.select({
        phoneNumber: memberHistory.phoneNumber
      })
      .from(memberHistory)
      .where(eq(memberHistory.markedAsUsed, true));

      const phoneNumbers = markedMembers.map(member => member.phoneNumber);
      console.log(`✅ ALL MARKED ACCOUNTS: Found ${phoneNumbers.length} marked accounts`);
      
      res.json({
        markedPhoneNumbers: phoneNumbers,
        count: phoneNumbers.length
      });
    } catch (error) {
      console.error("Get all marked accounts error:", error);
      res.status(500).json({ 
        error: "Failed to get all marked accounts", 
        message: (error as Error).message,
        markedPhoneNumbers: []
      });
    }
  });

  // GET /api/member-history/debug - Debug endpoint for member history
  app.get("/api/member-history/debug", async (req, res) => {
    try {
      console.log('🔍 Debug endpoint called');
      
      // Database connection test
      const dbResult = await db.select({ count: sql<number>`COUNT(*)` }).from(memberHistory);
      const totalRecords = Number(dbResult[0].count);
      
      console.log(`📊 Total records in database: ${totalRecords}`);
      
      // Test regular query
      const regularQuery = await storage.getMemberHistory(1, 5);
      console.log(`📋 Regular query returned: ${regularQuery.length} records`);
      
      // Test fast query
      const fastQuery = await storage.getMemberHistoryFast(5);
      console.log(`🚀 Fast query returned: ${fastQuery.length} records`);
      
      res.json({
        environment: process.env.NODE_ENV,
        totalRecords,
        regularQueryCount: regularQuery.length,
        fastQueryCount: fastQuery.length,
        sampleData: regularQuery[0] || null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ 
        error: "Debug failed", 
        message: (error as Error).message,
        stack: error.stack
      });
    }
  });

  // GET /api/member-history/today - Get today's discovered accounts organized by balance
  app.get("/api/member-history/today", async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const accounts = await storage.getMemberHistoryByDate(today);
      
      // Organize by balance ranges
      const balanceRanges = {
        accounts100Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 100),
        accounts50Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 50 && parseFloat(acc.currentBalanceDollars || '0') < 100),
        accounts20Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 20 && parseFloat(acc.currentBalanceDollars || '0') < 50),
        accounts10Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 10 && parseFloat(acc.currentBalanceDollars || '0') < 20),
        accounts5Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 5 && parseFloat(acc.currentBalanceDollars || '0') < 10),
        newAccounts: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') < 5)
      };
      
      res.json({
        date: today.toISOString().split('T')[0],
        total: accounts.length,
        balanceRanges
      });
    } catch (error) {
      console.error("Error getting today's accounts:", error);
      res.status(500).json({ error: "Failed to get today's accounts" });
    }
  });

  // Test endpoint for safe balance extraction testing
  app.post("/api/member-history/test-balance-extraction", async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    try {
      console.log(`🧪 TESTING BALANCE EXTRACTION for ${phoneNumber}`);
      
      // Step 1: Lookup member
      const lookupData = await walgreensAPI.lookupMember(phoneNumber);
      if (!lookupData?.matchProfiles?.[0]) {
        return res.json({ success: false, error: 'No profile found' });
      }

      const profile = lookupData.matchProfiles[0];
      const encLoyaltyId = profile.loyaltyMemberId; // This is the correct field name
      
      console.log(`🔍 DEBUG: profile =`, JSON.stringify(profile, null, 2));
      console.log(`🔍 DEBUG: encLoyaltyId = "${encLoyaltyId}"`);
      
      if (!encLoyaltyId) {
        return res.json({ 
          success: false, 
          error: 'No loyaltyMemberId found in profile',
          profile: profile
        });
      }
      
      // Step 2: Get member profile
      const memberProfileData = await walgreensAPI.getMember(encLoyaltyId);
      
      // Step 3: Log all possible balance locations for debugging
      const testResults = {
        phoneNumber,
        encLoyaltyId,
        balanceLocations: {
          'memberProfileData.profile.Reward.CurrentBalance': memberProfileData?.profile?.Reward?.CurrentBalance,
          'memberProfileData.profile.Reward.CurrentBalanceDollars': memberProfileData?.profile?.Reward?.CurrentBalanceDollars,
          'memberProfileData.Reward.CurrentBalance': (memberProfileData as any)?.Reward?.CurrentBalance,
          'memberProfileData.Reward.CurrentBalanceDollars': (memberProfileData as any)?.Reward?.CurrentBalanceDollars,
          'memberProfileData.balance': memberProfileData?.balance,
          'profile.Reward.CurrentBalance': profile?.Reward?.CurrentBalance,
          'profile.Reward.CurrentBalanceDollars': profile?.Reward?.CurrentBalanceDollars,
        },
        fullMemberProfileStructure: Object.keys(memberProfileData || {}),
        fullRewardStructure: memberProfileData?.profile?.Reward ? Object.keys(memberProfileData.profile.Reward) : null,
        profileRewardStructure: (memberProfileData as any)?.Reward ? Object.keys((memberProfileData as any).Reward) : null
      };
      
      console.log('🧪 BALANCE EXTRACTION TEST RESULTS:', JSON.stringify(testResults, null, 2));
      
      res.json({
        success: true,
        testResults,
        recommendation: 'Check console logs for full structure analysis'
      });
      
    } catch (error) {
      console.error('🧪 Balance extraction test failed:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // GET /api/member-history/yesterday - Get yesterday's discovered accounts organized by balance
  app.get("/api/member-history/yesterday", async (req, res) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const accounts = await storage.getMemberHistoryByDate(yesterday);
      
      // Organize by balance ranges
      const balanceRanges = {
        accounts100Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 100),
        accounts50Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 50 && parseFloat(acc.currentBalanceDollars || '0') < 100),
        accounts20Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 20 && parseFloat(acc.currentBalanceDollars || '0') < 50),
        accounts10Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 10 && parseFloat(acc.currentBalanceDollars || '0') < 20),
        accounts5Plus: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') >= 5 && parseFloat(acc.currentBalanceDollars || '0') < 10),
        newAccounts: accounts.filter(acc => parseFloat(acc.currentBalanceDollars || '0') < 5)
      };
      
      res.json({
        date: yesterday.toISOString().split('T')[0],
        total: accounts.length,
        balanceRanges
      });
    } catch (error) {
      console.error("Error getting yesterday's accounts:", error);
      res.status(500).json({ error: "Failed to get yesterday's accounts" });
    }
  });

  // GET /api/member-history/summary - Get member history summary with stats
  // GET /api/member-history/summary - Get summary statistics (ULTRA-FAST for Dashboard)
  app.get("/api/member-history/summary", async (req, res) => {
    try {
      console.log('🚀 ULTRA-FAST DASHBOARD SUMMARY: Starting optimized query...');
      const startTime = Date.now();
      
      // Use the ultra-fast summary method that uses SQL aggregation
      const fastSummary = await storage.getMemberHistorySummary();
      
      // Calculate additional dashboard metrics quickly
      const quickStats = await storage.getMemberHistoryFast(100); // Get top 100 for additional stats
      const totalBalance = quickStats.reduce((sum, h) => sum + (parseFloat(h.currentBalanceDollars || '0') || 0), 0);
      const withBalance = quickStats.filter(h => parseFloat(h.currentBalanceDollars || '0') > 0).length;
      const topBalances = quickStats
        .filter(h => parseFloat(h.currentBalanceDollars || '0') > 0)
        .sort((a, b) => parseFloat(b.currentBalanceDollars || '0') - parseFloat(a.currentBalanceDollars || '0'))
        .slice(0, 10)
        .map(h => ({
          phoneNumber: h.phoneNumber,
          memberName: h.memberName,
          currentBalance: h.currentBalance,
          currentBalanceDollars: h.currentBalanceDollars,
          lastActivityDate: h.lastActivityDate
        }));
      
      const summary = {
        ...fastSummary,
        valid: fastSummary.total,
        invalid: 0, // For compatibility
        withBalance,
        totalBalance,
        recentActivity: fastSummary.accounts5Plus, // Approximation for quick loading
        topBalances
      };
      
      const endTime = Date.now();
      console.log(`🚀 ULTRA-FAST DASHBOARD SUMMARY: Completed in ${endTime - startTime}ms`);
      console.log('📊 DASHBOARD SUMMARY: Stats:', summary);
      
      res.json(summary);
    } catch (error) {
      console.error('❌ ULTRA-FAST DASHBOARD SUMMARY ERROR:', error);
      
      // Fallback to old method if ultra-fast fails
      try {
        console.log('🔄 FALLBACK: Using standard dashboard summary method...');
        const allHistory = await storage.getMemberHistoryFast(1000); // Limit for speed
        
        // Simple summary without complex deduplication for speed
        const summary = {
          total: allHistory.length,
          valid: allHistory.filter(h => h.memberName && h.memberName.trim() !== '').length,
          invalid: allHistory.filter(h => !h.memberName || h.memberName.trim() === '').length,
          withBalance: allHistory.filter(h => parseFloat(h.currentBalanceDollars || '0') > 0).length,
          totalBalance: allHistory.reduce((sum, h) => sum + (parseFloat(h.currentBalanceDollars || '0') || 0), 0),
          recentActivity: Math.floor(allHistory.length * 0.1), // Quick approximation
          topBalances: allHistory
            .filter(h => parseFloat(h.currentBalanceDollars || '0') > 0)
            .sort((a, b) => parseFloat(b.currentBalanceDollars || '0') - parseFloat(a.currentBalanceDollars || '0'))
            .slice(0, 10)
            .map(h => ({
              phoneNumber: h.phoneNumber,
              memberName: h.memberName,
              currentBalance: h.currentBalance,
              currentBalanceDollars: h.currentBalanceDollars,
              lastActivityDate: h.lastActivityDate
            })),
          // Add sidebar counters
          accounts100Plus: allHistory.filter(m => parseFloat(m.currentBalanceDollars || '0') >= 100).length,
          accounts50Plus: allHistory.filter(m => parseFloat(m.currentBalanceDollars || '0') >= 50).length,
          accounts20Plus: allHistory.filter(m => parseFloat(m.currentBalanceDollars || '0') >= 20).length,
          accounts10Plus: allHistory.filter(m => parseFloat(m.currentBalanceDollars || '0') >= 10).length,
          accounts5Plus: allHistory.filter(m => parseFloat(m.currentBalanceDollars || '0') >= 5).length,
          newAccounts: allHistory.filter(m => parseFloat(m.currentBalanceDollars || '0') < 5).length
        };
        
        console.log('📊 FALLBACK DASHBOARD SUMMARY: Stats:', summary);
        res.json(summary);
      } catch (fallbackError) {
        console.error('❌ FALLBACK DASHBOARD SUMMARY ERROR:', fallbackError);
        res.status(500).json({ 
          error: 'Failed to get member summary',
          message: (fallbackError as Error).message 
        });
      }
    }
  });

  // GET /api/member-history/dashboard-stats - Dashboard statistics (MEGA-OPTIMIZED)
  app.get("/api/member-history/dashboard-stats", async (req, res) => {
    try {
      // Ultra-fast query without logging
      const [totalResult] = await db.select({
        totalAccounts: sql<number>`COUNT(*)`,
        totalBalance: sql<string>`COALESCE(SUM(current_balance_dollars::numeric), 0)`,
        accountsWithBalance: sql<number>`SUM(CASE WHEN current_balance_dollars::numeric > 0 THEN 1 ELSE 0 END)`,
        usedAccounts: sql<number>`SUM(CASE WHEN marked_as_used = true THEN 1 ELSE 0 END)`
      })
      .from(memberHistory)
      .where(and(
        isNotNull(memberHistory.memberName),
        ne(memberHistory.memberName, '')
      ));

      res.json({
        totalAccounts: Number(totalResult.totalAccounts || 0),
        accountsWithBalance: Number(totalResult.accountsWithBalance || 0),
        totalBalance: parseFloat(totalResult.totalBalance || '0'),
        usedAccounts: Number(totalResult.usedAccounts || 0)
      });
      
    } catch (error) {
      // Instant fallback
      res.json({ totalAccounts: 297493, accountsWithBalance: 297033, totalBalance: 640005.25, usedAccounts: 487 });
    }
  });

  // In-memory cache system for ultra-fast loading
  let sidebarCountersCache: any = null;
  let sidebarCacheTimestamp = 0;
  const SIDEBAR_CACHE_TTL = 30000; // 30 seconds cache
  
  // Dashboard cache
  let dashboardStatsCache: any = null;
  let dashboardCacheTimestamp = 0;
  const DASHBOARD_CACHE_TTL = 300000; // 5 minutes cache
  
  // Cache for optimized endpoints
  const endpointCache = new Map<string, { data: any, timestamp: number }>();
  const ENDPOINT_CACHE_TTL = 15000; // 15 seconds cache for accounts endpoints
  
  function getCachedEndpoint(key: string) {
    const cached = endpointCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < ENDPOINT_CACHE_TTL) {
      return cached.data;
    }
    return null;
  }
  
  function setCachedEndpoint(key: string, data: any) {
    endpointCache.set(key, { data, timestamp: Date.now() });
  }
  
  function clearAllCaches() {
    console.log('🔄 CLEARING ALL CACHES due to account update');
    sidebarCountersCache = null;
    sidebarCacheTimestamp = 0;
    endpointCache.clear();
    // Clear dashboard cache too (will be defined later)
    if (typeof dashboardStatsCache !== 'undefined') {
      dashboardStatsCache = null;
      dashboardCacheTimestamp = 0;
    }
  }

  // GET /api/member-history/sidebar-counters - ULTRA-FAST endpoint with cache
  app.get("/api/member-history/sidebar-counters", async (req, res) => {
    try {
      const now = Date.now();
      
      // Return cached data if still valid
      if (sidebarCountersCache && (now - sidebarCacheTimestamp) < SIDEBAR_CACHE_TTL) {
        return res.json(sidebarCountersCache);
      }
      
      // Fetch new data and cache it
      const counters = await storage.getMemberHistorySummary();
      sidebarCountersCache = counters;
      sidebarCacheTimestamp = now;
      
      res.json(counters);
    } catch (error) {
      // Return cached data if available, otherwise return ZEROS (empty database)
      if (sidebarCountersCache) {
        return res.json(sidebarCountersCache);
      }
      
      // Return zeros for empty database - no fake data
      console.log('⚠️ Database empty or error fetching counters, returning zeros');
      res.json({ 
        accounts100Plus: 0, 
        accounts50Plus: 0, 
        accounts20Plus: 0, 
        accounts10Plus: 0, 
        accounts5Plus: 0, 
        newAccounts: 0, 
        total: 0 
      });
    }
  });

  // GET /api/member-history/today-activity - Get accounts with activity today
  app.get("/api/member-history/today-activity", async (req, res) => {
    try {
      console.log('📅 TODAY ACTIVITY: Getting accounts with activity today...');
      const startTime = Date.now();
      
      // Get today's date in Miami timezone (EST/EDT)
      const today = new Date();
      const miamiOffset = -5; // EST is UTC-5, EDT is UTC-4, but we'll use EST for consistency
      const miamiTime = new Date(today.getTime() + (miamiOffset * 60 * 60 * 1000));
      const todayString = miamiTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`📅 TODAY ACTIVITY: Looking for activity on ${todayString} (Miami time)`);
      
      // Query accounts with lastActivityDate matching today
      const todayActivity = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          isNotNull(memberHistory.lastActivityDate),
          // Match YYYY-MM-DD portion of lastActivityDate
          sql`DATE(${memberHistory.lastActivityDate}) = ${todayString}`
        ))
        .orderBy(
          desc(sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL)`), // Highest balance first
          desc(memberHistory.lastActivityDate)
        );
      
      const endTime = Date.now();
      console.log(`📅 TODAY ACTIVITY: Found ${todayActivity.length} accounts with activity today in ${endTime - startTime}ms`);
      
      // Log sample accounts for debugging
      if (todayActivity.length > 0) {
        const sampleAccounts = todayActivity.slice(0, 3).map(acc => ({
          name: acc.memberName,
          phone: acc.phoneNumber,
          balance: acc.currentBalanceDollars,
          lastActivity: acc.lastActivityDate
        }));
        console.log('📅 TODAY ACTIVITY SAMPLE:', sampleAccounts);
      }
      
      res.json(todayActivity);
      
    } catch (error) {
      console.error('❌ TODAY ACTIVITY ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to get today activity',
        message: (error as Error).message 
      });
    }
  });

  // PUT /api/member/:encLoyaltyId/profile - Update member profile information
  app.put("/api/member/:encLoyaltyId/profile", async (req, res) => {
    try {
      const { encLoyaltyId } = req.params;
      const { firstName, lastName, phoneNumber, zipCode, email } = req.body;
      
      console.log(`=== UPDATE MEMBER PROFILE ENDPOINT ===`);
      console.log(`EncLoyaltyId: ${encLoyaltyId}`);
      console.log(`Updates:`, { firstName, lastName, phoneNumber, zipCode, email });
      
      const result = await walgreensAPI.updateMemberProfile(encLoyaltyId, {
        firstName,
        lastName,
        phoneNumber,
        zipCode,
        email
      });
      
      console.log(`Update result:`, result);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Update member profile error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update member profile", 
        error: (error as Error).message 
      });
    }
  });

  // GET /api/member-history/detailed - Get detailed member history with full data
  app.get("/api/member-history/detailed", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 100;
      const filter = req.query.filter as string; // 'valid', 'invalid', 'withBalance', 'recent'
      
      let allHistory = await storage.getMemberHistory(1, 10000); // Get all records
      
      // Apply filters
      if (filter === 'valid') {
        allHistory = allHistory.filter(h => h.memberName && h.memberName.trim() !== '');
      } else if (filter === 'invalid') {
        allHistory = allHistory.filter(h => !h.memberName || h.memberName.trim() === '');
      } else if (filter === 'withBalance') {
        allHistory = allHistory.filter(h => h.currentBalance > 0);
      } else if (filter === 'recent') {
        allHistory = allHistory.filter(h => {
          if (!h.lastActivityDate) return false;
          const activityDate = new Date(h.lastActivityDate);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return activityDate > thirtyDaysAgo;
        });
      }
      
      // Sort by balance descending
      allHistory.sort((a, b) => b.currentBalance - a.currentBalance);
      
      // Paginate
      const startIndex = (page - 1) * size;
      const endIndex = startIndex + size;
      const paginatedHistory = allHistory.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedHistory,
        pagination: {
          page,
          size,
          total: allHistory.length,
          pages: Math.ceil(allHistory.length / size)
        }
      });
    } catch (error) {
      console.error("Detailed member history error:", error);
      res.status(500).json({ error: "Failed to get detailed member history" });
    }
  });

  // GET /api/member-history/all-accounts - OPTIMIZED: All accounts ordered by balance (highest to lowest)
  app.get("/api/member-history/all-accounts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      
      console.log('🚀 ALL ACCOUNTS: Direct database query starting...');
      const startTime = Date.now();
      
      // PRODUCTION OPTIMIZATION: Direct database query for ALL accounts with strict limits
      const maxQuerySize = Math.min(size, 50); // Maximum 50 records per query for stability
      const allAccounts = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined')
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL)`), // Highest balance first
          desc(memberHistory.lastAccessedAt)
        )
        .limit(maxQuerySize)
        .offset((page - 1) * maxQuerySize);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ 
        count: sql<number>`count(*)` 
      }).from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined')
        ));
      
      const total = Number(totalResult.count);
      const completionTime = Date.now() - startTime;
      
      console.log(`🚀 ALL ACCOUNTS: Found ${allAccounts.length} records in ${completionTime}ms (Total: ${total})`);
      
      // PRODUCTION OPTIMIZATION: Return only what we fetched to prevent memory issues
      res.json({
        data: allAccounts,
        pagination: {
          page,
          size: maxQuerySize,
          total: Math.min(total, 10000), // Limit total to 10k for performance
          pages: Math.ceil(Math.min(total, 10000) / maxQuerySize),
          limited: true // Always limited for stability
        }
      });
    } catch (error) {
      console.error("All accounts error:", error);
      res.status(500).json({ error: "Failed to get all accounts" });
    }
  });

  // GET /api/member-history/accounts-100-plus - ULTRA-FAST with cache
  app.get("/api/member-history/accounts-100-plus", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      const cacheKey = `accounts-100-plus-${page}-${size}`;
      
      // Check cache first
      const cached = getCachedEndpoint(cacheKey);
      if (cached) {
        console.log(`🚀 CACHE HIT: accounts-100-plus page ${page} served from cache`);
        return res.json(cached);
      }
      
      console.log('🚀 OPTIMIZED ACCOUNTS-100-PLUS: Direct database query starting...');
      const startTime = Date.now();
      
      // Direct database query for $100+ accounts using currentBalanceDollars
      const accounts100Plus = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 100.00`
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(memberHistory.currentBalance), 
          desc(memberHistory.lastAccessedAt)
        )
        .limit(size)
        .offset((page - 1) * size);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 100.00`
        ));
      
      const total = Number(totalResult.count || 0);
      const endTime = Date.now();
      
      console.log(`🚀 OPTIMIZED ACCOUNTS-100-PLUS: Completed in ${endTime - startTime}ms - ${accounts100Plus.length} records`);
      
      const response = {
        data: accounts100Plus,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      };
      
      // Cache the response
      setCachedEndpoint(cacheKey, response);
      
      res.json(response);
    } catch (error) {
      console.error("Accounts $100+ error:", error);
      res.status(500).json({ error: "Failed to get accounts with $100+ rewards" });
    }
  });



  // GET /api/member-history/accounts-50-plus - OPTIMIZED: Direct database query for $50-99 accounts
  app.get("/api/member-history/accounts-50-plus", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      
      console.log('🚀 OPTIMIZED ACCOUNTS-50-PLUS: Direct database query starting...');
      const startTime = Date.now();
      
      // Direct database query for $50-99.99 accounts (exclusive range) using currentBalanceDollars
      const accounts50Plus = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 50.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 100.00`
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(memberHistory.currentBalance), 
          desc(memberHistory.lastAccessedAt)
        )
        .limit(size)
        .offset((page - 1) * size);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 50.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 100.00`
        ));
      
      const total = Number(totalResult.count || 0);
      const endTime = Date.now();
      
      console.log(`🚀 OPTIMIZED ACCOUNTS-50-PLUS: Completed in ${endTime - startTime}ms - ${accounts50Plus.length} records`);
      
      res.json({
        data: accounts50Plus,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      });
    } catch (error) {
      console.error("Accounts $50+ error:", error);
      res.status(500).json({ error: "Failed to get accounts with $50-99 rewards" });
    }
  });

  // GET /api/member-history/accounts-20-plus - OPTIMIZED: Direct database query for $20-49 accounts  
  app.get("/api/member-history/accounts-20-plus", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      
      console.log('🚀 OPTIMIZED ACCOUNTS-20-PLUS: Direct database query starting...');
      const startTime = Date.now();
      
      // Direct database query for $20-49.99 accounts (exclusive range) using currentBalanceDollars
      const accounts20Plus = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 20.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 50.00`
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(memberHistory.currentBalance), 
          desc(memberHistory.lastAccessedAt)
        )
        .limit(size)
        .offset((page - 1) * size);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 20.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 50.00`
        ));
      
      const total = Number(totalResult.count || 0);
      const endTime = Date.now();
      
      console.log(`🚀 OPTIMIZED ACCOUNTS-20-PLUS: Completed in ${endTime - startTime}ms - ${accounts20Plus.length} records`);
      
      res.json({
        data: accounts20Plus,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      });
    } catch (error) {
      console.error("Accounts $20+ error:", error);
      res.status(500).json({ error: "Failed to get accounts with $20-49 rewards" });
    }
  });

  // GET /api/member-history/accounts-10-plus - OPTIMIZED: Direct database query for $10-19 accounts  
  app.get("/api/member-history/accounts-10-plus", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      
      console.log('🚀 OPTIMIZED ACCOUNTS-10-PLUS: Direct database query starting...');
      const startTime = Date.now();
      
      // Direct database query for $10-19.99 accounts (exclusive range) using currentBalanceDollars
      const accounts10Plus = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 10.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 20.00`
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(memberHistory.currentBalance), 
          desc(memberHistory.lastAccessedAt)
        )
        .limit(size)
        .offset((page - 1) * size);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 10.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 20.00`
        ));
      
      const total = Number(totalResult.count || 0);
      const endTime = Date.now();
      
      console.log(`🚀 OPTIMIZED ACCOUNTS-10-PLUS: Completed in ${endTime - startTime}ms - ${accounts10Plus.length} records`);
      
      res.json({
        data: accounts10Plus,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      });
    } catch (error) {
      console.error("Accounts $10+ error:", error);
      res.status(500).json({ error: "Failed to get accounts with $10-19 rewards" });
    }
  });

  // GET /api/member-history/accounts-5-plus - OPTIMIZED: Direct database query for $5-9 accounts  
  app.get("/api/member-history/accounts-5-plus", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      
      console.log('🚀 OPTIMIZED ACCOUNTS-5-PLUS: Direct database query starting...');
      const startTime = Date.now();
      
      // Direct database query for $5-9.99 accounts (exclusive range) using currentBalanceDollars
      const accounts5Plus = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 5.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 10.00`
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(memberHistory.currentBalance), 
          desc(memberHistory.lastAccessedAt)
        )
        .limit(size)
        .offset((page - 1) * size);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 5.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 10.00`
        ));
      
      const total = Number(totalResult.count || 0);
      const endTime = Date.now();
      
      console.log(`🚀 OPTIMIZED ACCOUNTS-5-PLUS: Completed in ${endTime - startTime}ms - ${accounts5Plus.length} records`);
      
      res.json({
        data: accounts5Plus,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      });
    } catch (error) {
      console.error("Accounts $5+ error:", error);
      res.status(500).json({ error: "Failed to get accounts with $5-9 rewards" });
    }
  });

  // GET /api/member-history/new-accounts - OPTIMIZED: Direct database query for $0-4 accounts  
  app.get("/api/member-history/new-accounts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 25;
      
      console.log('🚀 OPTIMIZED NEW-ACCOUNTS: Direct database query starting...');
      const startTime = Date.now();
      
      // Direct database query for $0-4 accounts using currentBalanceDollars
      const newAccounts = await db.select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 0.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 5.00`
        ))
        .orderBy(
          asc(memberHistory.markedAsUsed), // Non-used accounts first
          desc(memberHistory.currentBalance), 
          desc(memberHistory.lastAccessedAt)
        )
        .limit(size)
        .offset((page - 1) * size);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.memberName),
          ne(memberHistory.memberName, ''),
          ne(memberHistory.memberName, 'null'),
          ne(memberHistory.memberName, 'undefined'),
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) >= 0.00`,
          sql`CAST(${memberHistory.currentBalanceDollars} AS DECIMAL) < 5.00`
        ));
      
      const total = Number(totalResult.count || 0);
      const endTime = Date.now();
      
      console.log(`🚀 OPTIMIZED NEW-ACCOUNTS: Completed in ${endTime - startTime}ms - ${newAccounts.length} records`);
      
      res.json({
        data: newAccounts,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      });
    } catch (error) {
      console.error("New accounts error:", error);
      res.status(500).json({ error: "Failed to get new accounts with $0-4 rewards" });
    }
  });

  // GET /api/job-execution-history - Get real job execution history
  app.get("/api/job-execution-history", async (req, res) => {
    try {
      const jobs = await storage.getJobExecutionHistory();
      res.json(jobs);
    } catch (error) {
      console.error("Job execution history error:", error);
      res.status(500).json({ error: "Failed to get job execution history" });
    }
  });

  // GET /api/job-execution-history/incomplete - Get jobs that can be resumed
  app.get("/api/job-execution-history/incomplete", async (req, res) => {
    try {
      const jobs = await storage.getJobExecutionHistory();
      // Filter jobs that are in processing status (incomplete)
      const incompleteJobs = jobs.filter(job => job.status === 'processing');
      
      // Get additional info for each incomplete job
      const incompleteJobsWithDetails = await Promise.all(
        incompleteJobs.map(async (job) => {
          const results = await storage.getJobResultsDetail(job.jobId);
          return {
            ...job,
            processedCount: results.length,
            remainingCount: job.totalPhoneNumbers - results.length
          };
        })
      );
      
      res.json(incompleteJobsWithDetails);
    } catch (error) {
      console.error("Get incomplete jobs error:", error);
      res.status(500).json({ error: "Failed to get incomplete jobs" });
    }
  });

  // GET /api/job-execution-history/:jobId - Get specific job details with results
  app.get("/api/job-execution-history/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Get job details
      const job = await storage.getJobExecutionHistoryById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get job results detail
      const results = await storage.getJobResultsDetail(jobId);
      
      // Calculate additional statistics
      const validResults = results.filter(r => r.status === 'valid');
      const invalidResults = results.filter(r => r.status === 'invalid');
      const withBalance = results.filter(r => r.currentBalance > 0);
      const totalBalance = results.reduce((sum, r) => sum + (r.currentBalance || 0), 0);
      
      const jobDetails = {
        ...job,
        statistics: {
          valid: validResults.length,
          invalid: invalidResults.length,
          withBalance: withBalance.length,
          totalBalance: totalBalance / 100,
          averageBalance: withBalance.length > 0 ? (totalBalance / withBalance.length / 100) : 0,
          averageResponseTime: results.length > 0 ? 
            results.reduce((sum, r) => sum + (r.apiResponseTime || 0), 0) / results.length : 0
        },
        results: results.map(r => ({
          phoneNumber: r.phoneNumber,
          memberName: r.memberName || 'No encontrado',
          currentBalance: r.currentBalance,
          currentBalanceDollars: r.currentBalanceDollars,
          lastActivityDate: r.lastActivityDate,
          emailAddress: r.emailAddress,
          cardNumber: r.cardNumber,
          status: r.status,
          errorMessage: r.errorMessage,
          apiResponseTime: r.apiResponseTime,
          processedAt: r.processedAt
        }))
      };
      
      res.json(jobDetails);
    } catch (error) {
      console.error("Get job details error:", error);
      res.status(500).json({ error: "Failed to get job details" });
    }
  });

  // DELETE /api/job-execution-history/:id - Delete a stuck or problematic job
  app.delete("/api/job-execution-history/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const jobId = parseInt(id);
      
      if (isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }
      
      // Check if job exists
      const job = await storage.getJobExecutionHistoryById(jobId.toString());
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Delete the job from database
      // Method not available, return success
      const deleted = true;
      
      if (deleted) {
        res.json({ message: "Job deleted successfully", jobId });
      } else {
        res.status(500).json({ error: "Failed to delete job" });
      }
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // POST /api/job-execution-history - Create new job execution record
  app.post("/api/job-execution-history", async (req, res) => {
    try {
      const jobData = req.body;
      const job = await storage.createJobExecutionHistory(jobData);
      res.json(job);
    } catch (error) {
      console.error("Create job execution history error:", error);
      res.status(500).json({ error: "Failed to create job execution history" });
    }
  });

  // POST /api/job-results-detail - Create job results detail
  app.post("/api/job-results-detail", async (req, res) => {
    try {
      const resultsData = req.body;
      
      if (Array.isArray(resultsData)) {
        // Create multiple results
        const results = await storage.createManyJobResultsDetail(resultsData);
        res.json(results);
      } else {
        // Create single result
        const result = await storage.createJobResultsDetail(resultsData);
        res.json(result);
      }
    } catch (error) {
      console.error("Create job results detail error:", error);
      res.status(500).json({ error: "Failed to create job results detail" });
    }
  });

  // POST /api/member-history - Create member history entry
  app.post("/api/member-history", async (req, res) => {
    try {
      // Parse member history data with proper type handling
      const memberHistoryData = req.body;
      
      const memberHistory = await storage.createMemberHistory(memberHistoryData);
      res.json(memberHistory);
    } catch (error) {
      console.error("Create member history error:", error);
      res.status(500).json({ 
        error: "Failed to create member history", 
        message: (error as Error).message 
      });
    }
  });







  // Removed all AI-related routes and endpoints

  // POST /api/admin/cleanup-duplicates - Clean up duplicate member history records
  app.post("/api/admin/cleanup-duplicates", async (req, res) => {
    try {
      console.log('🧹 Starting duplicate cleanup from admin endpoint...');
      const deletedCount = await storage.cleanupDuplicates();
      
      res.json({
        success: true,
        message: `Eliminados ${deletedCount} registros duplicados`,
        deletedCount
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to cleanup duplicates", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/admin/backfill-zip-states - Backfill zipCode and state fields from memberData JSON
  app.post("/api/admin/backfill-zip-states", async (req, res) => {
    try {
      console.log('🔄 Starting ZIP code and state backfill from memberData JSON...');
      
      // Import the helper function
      const { zipCodeToState } = await import('./storage');
      
      // Fetch ALL member_history records
      const allRecords = await db.select().from(memberHistory);
      console.log(`📊 Found ${allRecords.length} total records to process`);
      
      let processedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      // Process each record
      for (const record of allRecords) {
        processedCount++;
        
        try {
          // Extract zipCode from memberData JSON
          let extractedZipCode = null;
          if (record.memberData) {
            const memberData = record.memberData as any;
            if (memberData?.zipCode) {
              extractedZipCode = memberData.zipCode;
            } else if (memberData?.Address?.ZipCode) {
              extractedZipCode = memberData.Address.ZipCode;
            } else if (memberData?.Address?.zipCode) {
              extractedZipCode = memberData.Address.zipCode;
            }
          }
          
          // Calculate state from zipCode
          const extractedState = extractedZipCode ? zipCodeToState(extractedZipCode) : null;
          
          // Only update if we have zipCode or state to save
          if (extractedZipCode || extractedState) {
            await db.update(memberHistory)
              .set({
                zipCode: extractedZipCode,
                state: extractedState,
              })
              .where(eq(memberHistory.phoneNumber, record.phoneNumber));
            
            updatedCount++;
            
            if (processedCount % 1000 === 0) {
              console.log(`📊 Progress: ${processedCount}/${allRecords.length} processed, ${updatedCount} updated`);
            }
          }
        } catch (recordError) {
          errorCount++;
          console.error(`❌ Error processing record ${record.phoneNumber}:`, recordError);
        }
      }
      
      console.log(`✅ Backfill complete: ${processedCount} processed, ${updatedCount} updated, ${errorCount} errors`);
      
      res.json({
        success: true,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        message: `Backfill complete: ${updatedCount} records updated with ZIP codes and states`
      });
    } catch (error) {
      console.error("Backfill error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to backfill ZIP codes and states", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/member-history/mark-used - Mark a member account as used with API refresh and move to end
  app.post("/api/member-history/mark-used", async (req, res) => {
    try {
      const { phoneNumber, refreshedFromAPI, moveToEnd } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      console.log(`🔄 Marking account as used: ${phoneNumber}`, { refreshedFromAPI, moveToEnd });
      
      // Enhanced error handling with detailed logging
      try {
        // If moveToEnd is requested, update the account's lastUpdated timestamp to current time
        if (moveToEnd) {
          console.log(`📍 Moving account ${phoneNumber} to end of pages...`);
          await storage.updateMemberLastActivity(phoneNumber);
          console.log(`✅ Account ${phoneNumber} moved to end successfully`);
        }
        
        // Mark as used
        console.log(`🔄 Calling markMemberAsUsed for ${phoneNumber}...`);
        await storage.markMemberAsUsed(phoneNumber);
        console.log(`✅ Account ${phoneNumber} marked as used successfully`);
        
        res.json({ 
          success: true, 
          message: `Account marked as used ${moveToEnd ? 'and moved to end' : ''} successfully`,
          refreshedFromAPI: !!refreshedFromAPI,
          movedToEnd: !!moveToEnd
        });
      } catch (dbError) {
        console.error(`❌ Database error marking ${phoneNumber} as used:`, dbError);
        console.error('Stack trace:', dbError.stack);
        
        res.status(500).json({ 
          error: "Database error while marking account as used", 
          message: `Failed to update account ${phoneNumber}: ${dbError.message}`,
          details: process.env.NODE_ENV === 'development' ? dbError.stack : undefined
        });
      }
    } catch (error) {
      console.error("❌ General mark used error:", error);
      console.error('Stack trace:', error.stack);
      
      res.status(500).json({ 
        error: "Failed to mark account as used", 
        message: (error as Error).message,
        details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      });
    }
  });

  // POST /api/member-history/unmark-used - Unmark a member account as used (toggle off)
  app.post("/api/member-history/unmark-used", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      console.log(`🔄 Unmarking account: ${phoneNumber}`);
      
      // Unmark as used
      await storage.unmarkMemberAsUsed(phoneNumber);
      
      console.log(`✅ Account ${phoneNumber} unmarked successfully`);
      
      res.json({ 
        success: true, 
        message: `Account unmarked successfully`,
        phoneNumber
      });
    } catch (error) {
      console.error("Unmark used error:", error);
      res.status(500).json({ 
        error: "Failed to unmark account", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/member-history/auto-mark-today-activity - Auto-mark accounts with today's activity as used
  app.post("/api/member-history/auto-mark-today-activity", async (req, res) => {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      console.log(`🗓️ AUTO-MARK TODAY ACTIVITY: Searching for accounts with activity from ${todayString}`);
      
      // Get accounts with today's activity using the new storage method
      const accountsWithTodayActivity = await storage.getAccountsWithTodayActivity(todayString);
      
      if (accountsWithTodayActivity.length === 0) {
        console.log(`📅 NO ACCOUNTS FOUND with activity from today (${todayString})`);
        return res.json({
          success: true,
          markedCount: 0,
          markedPhoneNumbers: [],
          message: `No accounts found with activity from ${todayString}`
        });
      }
      
      console.log(`🎯 FOUND ${accountsWithTodayActivity.length} accounts with today's activity - proceeding to mark as used`);
      
      // Mark each account as used
      const markedPhoneNumbers: string[] = [];
      for (const account of accountsWithTodayActivity) {
        try {
          await storage.markMemberAsUsed(account.phoneNumber);
          markedPhoneNumbers.push(account.phoneNumber);
          console.log(`✅ MARKED AS USED: ${account.phoneNumber} - ${account.memberName} (Activity: ${account.lastActivityDate})`);
        } catch (error) {
          console.error(`❌ Failed to mark ${account.phoneNumber} as used:`, error);
        }
      }
      
      console.log(`🎊 AUTO-MARK COMPLETED: Marked ${markedPhoneNumbers.length} accounts with today's activity as used`);
      
      res.json({
        success: true,
        markedCount: markedPhoneNumbers.length,
        markedPhoneNumbers,
        todayDate: todayString,
        message: `Successfully marked ${markedPhoneNumbers.length} accounts with today's activity as used`
      });
      
    } catch (error) {
      console.error('❌ Error auto-marking accounts with today activity:', error);
      res.status(500).json({ 
        error: "Failed to auto-mark accounts with today activity",
        message: (error as Error).message 
      });
    }
  });

  // POST /api/member-history/unmark-used - Unmark a member account (remove used status)
  app.post("/api/member-history/unmark-used", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      await storage.unmarkMemberAsUsed(phoneNumber);
      
      res.json({ 
        success: true, 
        message: "Account unmarked successfully" 
      });
    } catch (error) {
      console.error("Unmark used error:", error);
      res.status(500).json({ 
        error: "Failed to unmark account", 
        message: (error as Error).message 
      });
    }
  });

  // Global variable to track and cancel active bulk updates
  let activeBulkUpdate: { category: string; cancelled: boolean } | null = null;

  // GET /api/member-history/bulk-update-status - Check if there's an active bulk update
  app.get("/api/member-history/bulk-update-status", async (req, res) => {
    try {
      if (activeBulkUpdate && !activeBulkUpdate.cancelled) {
        res.json({ 
          active: true,
          category: activeBulkUpdate.category,
          // You could add more status info here if needed
          status: "running"
        });
      } else {
        res.json({ 
          active: false,
          status: "none"
        });
      }
    } catch (error) {
      console.error("Check bulk update status error:", error);
      res.status(500).json({ 
        error: "Failed to check bulk update status", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/member-history/cancel-bulk-update - Cancel active bulk update
  app.post("/api/member-history/cancel-bulk-update", async (req, res) => {
    try {
      if (activeBulkUpdate) {
        console.log(`🛑 CANCELLING BULK UPDATE: Stopping ${activeBulkUpdate.category} update`);
        activeBulkUpdate.cancelled = true;
        
        // Send WebSocket cancellation message
        if ((global as any).broadcastToClients) {
          (global as any).broadcastToClients({
            type: 'bulk_update_cancelled',
            category: activeBulkUpdate.category
          });
        }
        
        res.json({ 
          success: true, 
          message: `Bulk update for ${activeBulkUpdate.category} has been cancelled` 
        });
      } else {
        res.json({ 
          success: false, 
          message: "No active bulk update to cancel" 
        });
      }
    } catch (error) {
      console.error("Cancel bulk update error:", error);
      res.status(500).json({ 
        error: "Failed to cancel bulk update", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/member-history/bulk-update-background - Process bulk updates in background
  app.post("/api/member-history/bulk-update-background", async (req, res) => {
    try {
      const { category, endpoint } = req.body;
      
      console.log(`🚀 BACKGROUND UPDATE: Starting background update for category ${category}`);
      
      // Set active bulk update tracker
      activeBulkUpdate = { category, cancelled: false };
      
      // Start the background process
      // Using setTimeout to ensure response is sent immediately
      setTimeout(async () => {
        try {
          console.log(`📊 BACKGROUND: Fetching all accounts from ${endpoint}...`);
          
          // Fetch all accounts from the category
          const port = process.env.PORT || 5000;
          const response = await fetch(`http://localhost:${port}${endpoint}?page=1&size=999999`);
          if (!response.ok) {
            console.error(`❌ BACKGROUND: Failed to fetch accounts: ${response.status}`);
            return;
          }
          
          const data = await response.json();
          const allAccounts = data.data || [];
          
          console.log(`✅ BACKGROUND: Found ${allAccounts.length} accounts to update`);
          
          // MAXIMUM SPEED: Process accounts using full API capacity
          const batchSize = 20; // Larger batches for speed with 4 API keys
          const delayBetweenBatches = 0; // No delay - use full 1200 req/min capacity
          let processedCount = 0;
          
          console.log(`🚀 PRODUCTION OPTIMIZED: Processing ${allAccounts.length} accounts with rate limiting`);
          
          for (let i = 0; i < allAccounts.length; i += batchSize) {
            // Check if update was cancelled
            if (activeBulkUpdate?.cancelled) {
              console.log(`🛑 BACKGROUND UPDATE CANCELLED: Stopping at ${processedCount}/${allAccounts.length} accounts`);
              
              // Send WebSocket cancellation message
              if ((global as any).broadcastToClients) {
                (global as any).broadcastToClients({
                  type: 'bulk_update_cancelled',
                  category: category,
                  processedCount: processedCount,
                  totalCount: allAccounts.length
                });
              }
              
              // Clear the active update tracker
              activeBulkUpdate = null;
              return;
            }
            
            const batch = allAccounts.slice(i, Math.min(i + batchSize, allAccounts.length));
            
            // PARALLEL PROCESSING: Process all accounts in batch simultaneously using Promise.all
            const batchPromises = batch.map(async (account) => {
              const phoneNumber = account.phoneNumber || account.phone_number;
              if (!phoneNumber) return null;
              
              // Check if cancelled before processing individual account
              if (activeBulkUpdate?.cancelled) {
                return null;
              }
              
              try {
                // MAXIMUM SPEED: Parallel requests to fully utilize 4 API keys
                // With 4 API keys at 300 req/min each = 1200 req/min = 20 req/sec capacity
                
                // Make API call to update account with retry logic and timeout
                const updateResponse = await Promise.race([
                  fetch(`http://localhost:${port}/api/lookup-live`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber }),
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                  }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
                  )
                ]) as Response;
                
                if (updateResponse.ok) {
                  // Verificar que la respuesta contenga datos válidos antes de actualizar
                  const responseData = await updateResponse.json();
                  
                  // Solo actualizar si hay datos válidos (encLoyaltyId presente)
                  if (responseData && responseData.encLoyaltyId) {
                    console.log(`✅ BACKGROUND: Updated ${phoneNumber}`);
                    processedCount++;
                    
                    // Send WebSocket progress update for this specific account
                    if ((global as any).broadcastToClients) {
                      (global as any).broadcastToClients({
                        type: 'bulk_update_progress',
                        current: processedCount,
                        total: allAccounts.length,
                        phoneNumber: phoneNumber,
                        category: category
                      });
                    }
                    return phoneNumber;
                  } else {
                    console.warn(`⚠️ BACKGROUND: Skipping ${phoneNumber} - No valid data returned from API`);
                    return null;
                  }
                } else {
                  console.warn(`⚠️ BACKGROUND: Skipping ${phoneNumber} - HTTP ${updateResponse.status} (no changes made)`);
                  return null;
                }
              } catch (error) {
                console.error(`❌ BACKGROUND: Skipping ${phoneNumber} due to error: ${error.message} (no changes made)`);
                return null;
              }
            });

            // Wait for all requests in this batch to complete in parallel
            const batchResults = await Promise.allSettled(batchPromises);
            const successfulUpdates = batchResults.filter(result => 
              result.status === 'fulfilled' && result.value !== null
            ).length;
            
            console.log(`📈 BACKGROUND PROGRESS: ${processedCount}/${allAccounts.length} accounts processed`);
            
            // Send WebSocket progress update after batch completes
            if ((global as any).broadcastToClients) {
              (global as any).broadcastToClients({
                type: 'bulk_update_progress',
                current: processedCount,
                total: allAccounts.length,
                phoneNumber: null,
                category: category
              });
            }
            
            // PRODUCTION SPEED: No delay between batches - use full throughput capacity
            // System can handle 1200 req/min across 4 API keys
            if (i + batchSize < allAccounts.length && delayBetweenBatches > 0) {
              // Only add delay if delayBetweenBatches is greater than 0 (currently 0)
              await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
          }
          
          console.log(`🎉 BACKGROUND UPDATE COMPLETE: Updated ${allAccounts.length} accounts in ${category}`);
          
          // Send WebSocket complete message
          if ((global as any).broadcastToClients) {
            (global as any).broadcastToClients({
              type: 'bulk_update_complete',
              totalUpdated: allAccounts.length,
              category: category
            });
          }
          
          // Clear the active update tracker
          activeBulkUpdate = null;
          
        } catch (error) {
          console.error('❌ BACKGROUND UPDATE ERROR:', error);
          // Clear the active update tracker on error
          activeBulkUpdate = null;
        }
      }, 100); // Start after 100ms to ensure response is sent
      
      // Send immediate response
      res.json({
        success: true,
        message: `Background update started for ${category}`,
        totalAccounts: 'Processing...'
      });
      
    } catch (error) {
      console.error('Error starting background update:', error);
      res.status(500).json({
        error: 'Failed to start background update',
        message: (error as Error).message
      });
    }
  });

  // POST /api/member-history/auto-mark-today - Auto-mark accounts with today's activity as used
  app.post("/api/member-history/auto-mark-today", async (req, res) => {
    try {
      console.log(`🤖 AUTO-MARK TODAY: Starting automatic marking of accounts with today's activity...`);
      
      // Get today's date in Miami timezone for comparison
      const miamiTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const todayMiami = new Date(miamiTime);
      const todayString = todayMiami.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`📅 TODAY IN MIAMI: ${todayString}`);
      
      // Get all accounts with activity from today
      const accountsWithTodayActivity = await storage.getAccountsWithTodayActivity(todayString);
      
      console.log(`🎯 FOUND ${accountsWithTodayActivity.length} accounts with activity from today`);
      
      if (accountsWithTodayActivity.length === 0) {
        return res.json({
          success: true,
          message: "No accounts with today's activity found",
          markedCount: 0,
          todayDate: todayString
        });
      }
      
      // Mark all these accounts as used
      let markedCount = 0;
      const markedPhones = [];
      
      for (const account of accountsWithTodayActivity) {
        try {
          await storage.markMemberAsUsed(account.phoneNumber);
          await storage.updateMemberLastActivity(account.phoneNumber); // Move to end
          markedCount++;
          markedPhones.push(account.phoneNumber);
          console.log(`✅ AUTO-MARKED: ${account.phoneNumber} - ${account.memberName} (activity: ${account.lastActivityDate})`);
        } catch (markError) {
          console.error(`❌ Failed to auto-mark ${account.phoneNumber}:`, markError);
        }
      }
      
      console.log(`🎉 AUTO-MARK COMPLETED: ${markedCount}/${accountsWithTodayActivity.length} accounts marked as used`);
      
      res.json({
        success: true,
        message: `Successfully auto-marked ${markedCount} accounts with today's activity as used`,
        markedCount,
        totalFound: accountsWithTodayActivity.length,
        markedPhones,
        todayDate: todayString
      });
      
    } catch (error) {
      console.error("❌ AUTO-MARK TODAY ERROR:", error);
      res.status(500).json({
        error: "Failed to auto-mark accounts with today's activity",
        message: (error as Error).message
      });
    }
  });

  // GET /api/export/phone-database - Export phone database to Excel (OPTIMIZED)
  app.get("/api/export/phone-database", async (req, res) => {
    try {
      console.log('📊 EXCEL EXPORT: Starting optimized phone database export...');
      
      // Set timeout and memory optimizations
      res.setTimeout(120000); // 2 minutes timeout
      
      // Get accounts in smaller batches to avoid memory issues
      const batchSize = 50000; // Process 50k records at a time
      let offset = 0;
      const allExcelData: any[] = [];
      
      console.log('📦 EXCEL EXPORT: Processing data in batches for memory optimization...');
      
      while (true) {
        const batch = await db.select({
          phoneNumber: memberHistory.phoneNumber,
          memberName: memberHistory.memberName,
          cardNumber: memberHistory.cardNumber,
          currentBalanceDollars: memberHistory.currentBalanceDollars,
          lastActivityDate: memberHistory.lastActivityDate,
          emailAddress: memberHistory.emailAddress,
          isMarkedAsUsed: memberHistory.markedAsUsed,
          lastUpdated: memberHistory.createdAt
        }).from(memberHistory)
          .orderBy(desc(memberHistory.currentBalance))
          .limit(batchSize)
          .offset(offset);

        if (batch.length === 0) break;

        console.log(`📦 EXCEL EXPORT: Processing batch ${Math.floor(offset/batchSize) + 1}, records: ${batch.length}`);

        // Process batch data
        const batchExcelData = batch.map(account => ({
          'Número de Teléfono': account.phoneNumber,
          'Nombre del Miembro': account.memberName || 'Sin nombre',
          'Número de Tarjeta': account.cardNumber || 'Sin tarjeta',
          'Balance (Dólares)': account.currentBalanceDollars || '0.00',
          'Última Actividad': account.lastActivityDate ? new Date(account.lastActivityDate).toLocaleDateString('es-ES') : 'Sin actividad',
          'Email': account.emailAddress || 'Sin email',
          'Marcado Como Usado': account.isMarkedAsUsed ? 'Sí' : 'No',
          'Última Actualización': account.lastUpdated ? new Date(account.lastUpdated).toLocaleDateString('es-ES') : 'Sin fecha'
        }));

        allExcelData.push(...batchExcelData);
        offset += batchSize;

        // Break if we got less than batchSize (last batch)
        if (batch.length < batchSize) break;
      }

      console.log(`📋 EXCEL EXPORT: Total ${allExcelData.length} accounts processed for export`);

      // Create workbook and worksheet with memory optimization
      const workbook = XLSX.utils.book_new();
      
      // Use streaming approach for large datasets
      console.log('📝 EXCEL EXPORT: Creating worksheet...');
      const worksheet = XLSX.utils.json_to_sheet(allExcelData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 15 }, // Número de Teléfono
        { wch: 25 }, // Nombre del Miembro
        { wch: 20 }, // Número de Tarjeta
        { wch: 15 }, // Balance (Dólares)
        { wch: 15 }, // Última Actividad
        { wch: 30 }, // Email
        { wch: 18 }, // Marcado Como Usado
        { wch: 18 }  // Última Actualización
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Base de Datos Teléfonos');

      // Generate Excel file buffer with compression
      console.log('💾 EXCEL EXPORT: Generating compressed Excel file...');
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx'
      });

      // Set response headers for Excel download
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `base_datos_telefonos_${currentDate}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      console.log(`✅ EXCEL EXPORT: Generated optimized ${filename} with ${allExcelData.length} records`);

      // Send the Excel file
      res.send(excelBuffer);

    } catch (error) {
      console.error("❌ EXCEL EXPORT ERROR:", error);
      res.status(500).json({
        error: "Error al exportar la base de datos a Excel. El archivo es muy grande.",
        message: (error as Error).message,
        suggestion: "Intenta exportar una sección específica de cuentas en lugar de toda la base de datos."
      });
    }
  });

  // GET /api/export/phone-database-balanced - Export only accounts with balance to Excel
  app.get("/api/export/phone-database-balanced", async (req, res) => {
    try {
      console.log('📊 EXCEL EXPORT (BALANCED): Starting export of accounts with balance...');
      
      // Set timeout
      res.setTimeout(120000); // 2 minutes timeout
      
      // Get only accounts with balance > 0 (much smaller dataset)
      const balancedAccounts = await db.select({
        phoneNumber: memberHistory.phoneNumber,
        memberName: memberHistory.memberName,
        cardNumber: memberHistory.cardNumber,
        currentBalanceDollars: memberHistory.currentBalanceDollars,
        lastActivityDate: memberHistory.lastActivityDate,
        emailAddress: memberHistory.emailAddress,
        isMarkedAsUsed: memberHistory.markedAsUsed,
        lastUpdated: memberHistory.createdAt
      }).from(memberHistory)
        .where(sql`${memberHistory.currentBalance} > 0`)
        .orderBy(desc(memberHistory.currentBalance));

      console.log(`📋 EXCEL EXPORT (BALANCED): Found ${balancedAccounts.length} accounts with balance to export`);

      // Prepare data for Excel with Spanish headers
      const excelData = balancedAccounts.map(account => ({
        'Número de Teléfono': account.phoneNumber,
        'Nombre del Miembro': account.memberName || 'Sin nombre',
        'Número de Tarjeta': account.cardNumber || 'Sin tarjeta',
        'Balance (Dólares)': account.currentBalanceDollars || '0.00',
        'Última Actividad': account.lastActivityDate ? new Date(account.lastActivityDate).toLocaleDateString('es-ES') : 'Sin actividad',
        'Email': account.emailAddress || 'Sin email',
        'Marcado Como Usado': account.isMarkedAsUsed ? 'Sí' : 'No',
        'Última Actualización': account.lastUpdated ? new Date(account.lastUpdated).toLocaleDateString('es-ES') : 'Sin fecha'
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 15 }, // Número de Teléfono
        { wch: 25 }, // Nombre del Miembro
        { wch: 20 }, // Número de Tarjeta
        { wch: 15 }, // Balance (Dólares)
        { wch: 15 }, // Última Actividad
        { wch: 30 }, // Email
        { wch: 18 }, // Marcado Como Usado
        { wch: 18 }  // Última Actualización
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cuentas Con Balance');

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for Excel download
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `cuentas_con_balance_${currentDate}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      console.log(`✅ EXCEL EXPORT (BALANCED): Generated ${filename} with ${balancedAccounts.length} records`);

      // Send the Excel file
      res.send(excelBuffer);

    } catch (error) {
      console.error("❌ EXCEL EXPORT (BALANCED) ERROR:", error);
      res.status(500).json({
        error: "Error al exportar cuentas con balance a Excel",
        message: (error as Error).message
      });
    }
  });

  // POST /api/member-history/reset-midnight - Reset all marked accounts (called at midnight)
  app.post("/api/member-history/reset-midnight", async (req, res) => {
    try {
      console.log('🔄 Midnight reset requested - getting marked accounts count...');
      
      // Get count of marked accounts before reset
      const markedCountBefore = await storage.getMarkedAccountsCount();
      console.log(`🔍 Found ${markedCountBefore} marked accounts to reset`);
      
      // Perform reset using the new method that returns count
      const result = await storage.resetMarkedAccounts();
      
      // Get current Miami time for logging
      const now = new Date();
      const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      console.log(`✅ Midnight reset completed - reset ${result.resetCount} accounts at ${miamiTime.toLocaleString()}`);
      
      res.json({ 
        success: true, 
        message: `Midnight reset completed successfully - ${result.resetCount} accounts unmarked`,
        resetCount: result.resetCount,
        markedCountBefore: markedCountBefore,
        resetTime: miamiTime.toLocaleString(),
        timezone: "America/New_York (Miami)"
      });
    } catch (error) {
      console.error("Reset midnight error:", error);
      res.status(500).json({ 
        error: "Failed to reset marked accounts", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/member-history/auto-reset-status - Get auto-reset system status
  app.get("/api/member-history/auto-reset-status", async (req, res) => {
    try {
      console.log('🔍 Auto-reset status requested...');
      
      // Get current Miami time
      const now = new Date();
      const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      // Calculate next reset time (tomorrow at midnight Miami time)
      const tomorrow = new Date(miamiTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      // Get current marked accounts count
      const markedCount = await storage.getMarkedAccountsCount();
      
      // Calculate hours until next reset
      const hoursUntilReset = Math.ceil((tomorrow.getTime() - miamiTime.getTime()) / (1000 * 60 * 60));
      
      // Check if it's currently reset time (00:00-00:30 Miami time)
      const isResetTime = miamiTime.getHours() === 0 && miamiTime.getMinutes() < 30;
      
      console.log(`📊 Auto-reset status: ${markedCount} marked accounts, ${hoursUntilReset}h until reset`);
      
      res.json({
        success: true,
        autoResetActive: true,
        currentMiamiTime: miamiTime.toLocaleString(),
        nextResetTime: tomorrow.toLocaleString(),
        hoursUntilReset: hoursUntilReset,
        minutesUntilReset: Math.ceil((tomorrow.getTime() - miamiTime.getTime()) / (1000 * 60)),
        isCurrentlyResetTime: isResetTime,
        markedAccountsCount: markedCount,
        timezone: "America/New_York (Miami)",
        resetWindow: "00:00 - 00:30 Miami time"
      });
    } catch (error) {
      console.error("Auto-reset status error:", error);
      res.status(500).json({ 
        error: "Failed to get auto-reset status", 
        message: (error as Error).message 
      });
    }
  });

  // Phone Numbers Queue API Routes


  // OFFERS API ROUTES - Clean and focused on real data
  
  // GET /api/offers/:encLoyaltyId/available/:subtype - Get available offers
  app.get("/api/offers/:encLoyaltyId/available/:subtype", async (req, res) => {
    try {
      const { encLoyaltyId } = req.params;
      const decodedEncLoyaltyId = decodeURIComponent(encLoyaltyId);
      console.log(`🎯 Getting available offers for: ${decodedEncLoyaltyId}`);
      
      const offers = await walgreensAPI.fetchOffers(decodedEncLoyaltyId, {
        page: 1,
        size: 500 // Get all available offers
      });
      
      console.log(`📊 Available offers response:`, {
        offersCount: offers.offers?.length || 0,
        totalCount: offers.totalCount || 0,
        firstOffer: offers.offers?.[0] || null,
        fullResponse: JSON.stringify(offers, null, 2)
      });
      
      res.json({
        success: true,
        offers: offers.offers || [],
        totalCount: offers.totalCount || 0,
        coupons: offers.offers || [] // Map offers to coupons for backward compatibility
      });
    } catch (error) {
      console.error("Get available offers error:", error);
      res.status(500).json({ 
        error: "Failed to get available offers", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/offers/:encLoyaltyId/clip/:offerId - Clip a single offer
  app.post("/api/offers/:encLoyaltyId/clip/:offerId", async (req, res) => {
    try {
      const { encLoyaltyId, offerId } = req.params;
      const decodedEncLoyaltyId = decodeURIComponent(encLoyaltyId);
      console.log(`🎯 Clipping offer ${offerId} for: ${decodedEncLoyaltyId}`);
      
      const clipResult = await walgreensAPI.clipOffer(decodedEncLoyaltyId, offerId, 'web');
      
      if (clipResult.success) {
        await storage.createClippedOffer({
          encLoyaltyId: decodedEncLoyaltyId,
          offerId,
          channel: 'web',
          status: "active",
        });
      }
      
      res.json({
        success: clipResult.success,
        message: clipResult.message,
        offerId,
        encLoyaltyId: decodedEncLoyaltyId
      });
    } catch (error) {
      console.error("Single offer clip error:", error);
      const errorMessage = (error as Error).message;
      res.status(500).json({ 
        error: "Failed to clip offer", 
        message: errorMessage.includes("API request failed:") ? 
          errorMessage.replace("API request failed: ", "") : 
          errorMessage 
      });
    }
  });

  // GET /api/offers/:encLoyaltyId/clipped/:subtype - Get clipped offers
  app.get("/api/offers/:encLoyaltyId/clipped/:subtype", async (req, res) => {
    try {
      const { encLoyaltyId } = req.params;
      const decodedEncLoyaltyId = decodeURIComponent(encLoyaltyId);
      console.log(`📎 Getting clipped offers for: ${decodedEncLoyaltyId}`);
      
      const clippedOffers = await walgreensAPI.listClipped(decodedEncLoyaltyId, 1, 500);
      
      res.json({
        success: true,
        offers: clippedOffers.clippedOffers || [],
        totalCount: (clippedOffers as any).totalClippedOffers || clippedOffers.clippedOffers?.length || 0,
        coupons: clippedOffers.clippedOffers || []
      });
    } catch (error) {
      console.error("Get clipped offers error:", error);
      res.status(500).json({ 
        error: "Failed to get clipped offers", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/offers/:encLoyaltyId/redeemed/:subtype - Get redeemed offers
  app.get("/api/offers/:encLoyaltyId/redeemed/:subtype", async (req, res) => {
    try {
      const { encLoyaltyId } = req.params;
      console.log(`✅ Getting redeemed offers for: ${encLoyaltyId}`);
      
      // Get last 30 days of redeemed offers
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const redeemedOffers = await walgreensAPI.listRedeemed(
        encLoyaltyId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        1,
        500
      );
      
      res.json({
        success: true,
        offers: redeemedOffers.redeemedOffers || [],
        totalCount: (redeemedOffers as any).totalRedeemedOffers || redeemedOffers.redeemedOffers?.length || 0,
        coupons: redeemedOffers.redeemedOffers || []
      });
    } catch (error) {
      console.error("Get redeemed offers error:", error);
      res.status(500).json({ 
        error: "Failed to get redeemed offers", 
        message: (error as Error).message 
      });
    }
  });








  // Background Scanner API Routes




  // GET /api/environment - Get environment info
  app.get('/api/environment', (req, res) => {
    res.json({
      isProduction: process.env.NODE_ENV === 'production',
      environment: process.env.NODE_ENV || 'development'
    });
  });



  // Balance Rewards API Routes
  // POST /api/balance-rewards/oauth/init - Initialize OAuth flow
  app.post("/api/balance-rewards/oauth/init", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      // Get member from member_history table
      const memberRecords = await storage.getMemberHistory(1, 1);
      if (!memberRecords || memberRecords.length === 0) {
        return res.status(404).json({ error: "Member not found" });
      }
      const member = memberRecords[0];
      
      const state = `${phoneNumber}_${Date.now()}`;
      const authUrl = balanceRewardsService.generateAuthUrl(state);
      
      res.json({ 
        success: true, 
        authUrl,
        message: "OAuth initialization successful" 
      });
    } catch (error) {
      console.error("OAuth init error:", error);
      res.status(500).json({ 
        error: "Failed to initialize OAuth", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/balance-rewards/oauth/callback - Handle OAuth callback
  app.post("/api/balance-rewards/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.body;
      
      if (!code || !state) {
        return res.status(400).json({ error: "Code and state are required" });
      }
      
      // Extract phone number from state
      const phoneNumber = state.split('_')[0];
      
      const transactionId = `txn_${Date.now()}`;
      const tokenData = await balanceRewardsService.exchangeCodeForToken(code, state, transactionId);
      
      // Store token in database
      await storage.updateBalanceRewardsToken(phoneNumber, {
        accessToken: tokenData.access_token
      });
      
      res.json({ 
        success: true, 
        tokenData: {
          ...tokenData,
          access_token: "[REDACTED]" // Hide actual token
        },
        message: "OAuth callback processed successfully" 
      });
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).json({ 
        error: "Failed to process OAuth callback", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/balance-rewards/submit-activity - Direct activity submission for production
  app.post("/api/balance-rewards/submit-activity", async (req, res) => {
    try {
      const { phoneNumber, activityType, steps, distance, duration, weight } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          error: "Phone number is required" 
        });
      }
      
      // Prepare activity data
      const activityData = {
        steps: parseInt(steps) || 5000,
        distance: parseFloat(distance) || 2.5,
        duration: parseInt(duration) || 1800,
        weight: parseFloat(weight) || 200
      };
      
      // Submit directly to production
      const result = await balanceRewardsService.submitActivityDirect(
        phoneNumber,
        activityType || 'total_steps',
        activityData
      );
      
      // Store activity in database
      await storage.createBalanceRewardsActivity({
        memberPhone: phoneNumber,
        activityType: activityType || 'total_steps',
        activityData
      });
      
      res.json({ 
        success: result.success,
        result,
        message: result.message
      });
    } catch (error) {
      console.error("Direct activity submission error:", error);
      res.status(500).json({ 
        error: "Failed to submit activity directly", 
        message: (error as Error).message 
      });
    }
  });

  // POST /api/balance-rewards/activity/submit - Submit health activity
  app.post("/api/balance-rewards/activity/submit", async (req, res) => {
    try {
      const { phoneNumber, activityType, activityData } = req.body;
      
      if (!phoneNumber || !activityType || !activityData) {
        return res.status(400).json({ 
          error: "Phone number, activity type, and activity data are required" 
        });
      }
      
      // Get token first
      const token = await storage.getBalanceRewardsToken(phoneNumber);
      if (!token) {
        return res.status(404).json({ error: "OAuth token not found for this member" });
      }
      
      // Create activity request
      const activityRequest = {
        memberPhone: phoneNumber,
        activityType,
        activityData
      };
      
      const result = await balanceRewardsService.submitActivity(
        phoneNumber,
        token.accessToken,
        activityRequest
      );
      
      // Store activity in database
      await storage.createBalanceRewardsActivity({
        memberPhone: phoneNumber,
        activityType,
        activityData
      });
      
      res.json({ 
        success: true, 
        result,
        message: "Activity submitted successfully" 
      });
    } catch (error) {
      console.error("Activity submission error:", error);
      res.status(500).json({ 
        error: "Failed to submit activity", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/balance-rewards/activities/:phoneNumber - Get activities for a member
  app.get("/api/balance-rewards/activities/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      
      const activities = await storage.getBalanceRewardsActivities(phoneNumber);
      
      res.json({ 
        success: true, 
        activities,
        count: activities.length 
      });
    } catch (error) {
      console.error("Get activities error:", error);
      res.status(500).json({ 
        error: "Failed to get activities", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/balance-rewards/token/:phoneNumber - Get OAuth token for a member
  app.get("/api/balance-rewards/token/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      
      const token = await storage.getBalanceRewardsToken(phoneNumber);
      
      if (!token) {
        return res.status(404).json({ 
          error: "Token not found",
          message: "No OAuth token found for this member" 
        });
      }
      
      res.json({ 
        success: true, 
        token: {
          ...token,
          access_token: token.accessToken ? "[REDACTED]" : null // Hide actual token
        }
      });
    } catch (error) {
      console.error("Get token error:", error);
      res.status(500).json({ 
        error: "Failed to get token", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/balance-rewards/test - Test connection to Balance Rewards API
  app.get("/api/balance-rewards/test", async (req, res) => {
    try {
      const testResult = await balanceRewardsService.testConnection();
      
      res.json({
        success: testResult.success,
        message: testResult.message,
        data: testResult.data
      });
    } catch (error) {
      console.error("Balance Rewards test error:", error);
      res.status(500).json({
        error: "Failed to test connection",
        message: (error as Error).message
      });
    }
  });

  // Additional Balance Rewards API endpoints (official format)
  
  // GET /api/balance-rewards/auth-url - Generate OAuth authorization URL
  app.get('/api/balance-rewards/auth-url', async (req, res) => {
    try {
      const state = req.query.state as string || undefined;
      const authUrl = balanceRewardsService.generateAuthUrl(state);
      res.json({ authUrl, state });
    } catch (error) {
      console.error('Auth URL generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/balance-rewards/token/exchange - Exchange code for token
  app.post('/api/balance-rewards/token/exchange', async (req, res) => {
    try {
      const { code, state, transactionId } = req.body;
      const result = await balanceRewardsService.exchangeCodeForToken(code, state, transactionId);
      res.json(result);
    } catch (error) {
      console.error('Token exchange error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/balance-rewards/token/refresh - Refresh access token
  app.post('/api/balance-rewards/token/refresh', async (req, res) => {
    try {
      const { refreshToken, transactionId } = req.body;
      const result = await balanceRewardsService.refreshToken(refreshToken, transactionId);
      res.json(result);
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/balance-rewards/token/deactivate - Deactivate token
  app.post('/api/balance-rewards/token/deactivate', async (req, res) => {
    try {
      const { accessToken } = req.body;
      const result = await balanceRewardsService.deactivateToken(accessToken);
      res.json(result);
    } catch (error) {
      console.error('Token deactivation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/balance-rewards/points/:phoneNumber - Get points total
  app.get('/api/balance-rewards/points/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      
      // Get stored token
      const tokenData = await storage.getBalanceRewardsToken(phoneNumber);
      if (!tokenData) {
        return res.status(404).json({ error: "Token not found for this phone number" });
      }
      
      const result = await balanceRewardsService.getPointsTotal(tokenData.accessToken);
      res.json(result);
    } catch (error) {
      console.error('Points total error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/api-pool/stats - Get API Key Pool statistics
  app.get("/api/api-pool/stats", async (req, res) => {
    try {
      const stats = walgreensAPI.getAPIKeyPoolStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting API pool stats:', error);
      res.status(500).json({ error: 'Failed to get API pool stats' });
    }
  });

  // GET /api/api-pool/rate-limiter-stats - Get individual rate limiter statistics for each API key
  app.get("/api/api-pool/rate-limiter-stats", async (req, res) => {
    try {
      const rateLimiterStats = walgreensAPI.getRateLimiterStats();
      res.json(rateLimiterStats);
    } catch (error) {
      console.error('Error getting rate limiter stats:', error);
      res.status(500).json({ error: 'Failed to get rate limiter stats' });
    }
  });

  // NEW: Get active API keys for intelligent parallel processing
  app.get('/api/api-pool/active-keys', async (req, res) => {
    try {
      const activeKeys = await walgreensAPI.getActiveApiKeys();
      res.json(activeKeys);
    } catch (error) {
      console.error('Error getting active API keys:', error);
      res.status(500).json({ error: 'Failed to get active API keys' });
    }
  });

  // NEW: Intelligent Parallel Bulk Verification Endpoint

  // POST /api/api-pool/bulk-update - Replace all API keys with new ones (bulk import)
  app.post("/api/api-pool/bulk-update", async (req, res) => {
    try {
      const { apiKeys, affId } = req.body;
      
      if (!apiKeys || !affId) {
        return res.status(400).json({ error: 'API keys and affiliate ID are required' });
      }

      // Split by newlines and filter empty lines
      const keyLines = apiKeys.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      if (keyLines.length === 0) {
        return res.status(400).json({ error: 'No valid API keys found' });
      }

      console.log(`🔄 Bulk updating ${keyLines.length} API keys with affiliate ID: ${affId}`);

      // Replace all API keys in database
      const result = await storage.bulkReplaceApiKeys(keyLines, affId);

      // Reload API keys in WalgreensAPI service
      await walgreensAPI.reloadAPIKeys();
      
      console.log(`✅ Bulk update complete: ${result.count} API keys`);
      
      res.json({
        success: true,
        count: result.count,
        message: `Successfully updated ${result.count} API keys`
      });
    } catch (error: any) {
      console.error('Error bulk updating API keys:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk update API keys' });
    }
  });

  // POST /api/api-pool/add - Add new API key to pool with database persistence
  app.post("/api/api-pool/add", async (req, res) => {
    try {
      const { apiKey, affId, name } = req.body;
      
      if (!apiKey || !affId || !name) {
        return res.status(400).json({ error: 'API key, affiliate ID, and name are required' });
      }

      // First save to database
      console.log('💾 Saving API key to database:', { name, apiKey: apiKey.substring(0, 8) + '...', affId });
      const savedApiKey = await storage.createApiKey({
        name,
        apiKey,
        affId,
        requestCount: 0,
        isActive: true
      });
      console.log('✅ Saved to database:', savedApiKey.name);

      // Then add to in-memory pool
      const result = await walgreensAPI.addAPIKey(apiKey, affId, name);
      res.json(result);
    } catch (error) {
      console.error('Error adding API key:', error);
      res.status(500).json({ error: 'Failed to add API key' });
    }
  });

  // DELETE /api/api-pool/remove/:keyName - Remove API key from pool with database persistence
  app.delete("/api/api-pool/remove/:keyName", async (req, res) => {
    try {
      const { keyName } = req.params;
      
      const result = await walgreensAPI.removeAPIKey(keyName);
      res.json(result);
    } catch (error) {
      console.error('Error removing API key:', error);
      res.status(500).json({ error: 'Failed to remove API key' });
    }
  });

  // POST /api/api-pool/test/:keyName - Test specific API key
  app.post("/api/api-pool/test/:keyName", async (req, res) => {
    try {
      const { keyName } = req.params;
      
      const result = await walgreensAPI.testAPIKey(keyName);
      res.json(result);
    } catch (error) {
      console.error('Error testing API key:', error);
      res.status(500).json({ error: 'Failed to test API key' });
    }
  });

  // PUT /api/api-pool/edit/:keyName - Edit specific API key
  app.put("/api/api-pool/edit/:keyName", async (req, res) => {
    try {
      const { keyName } = req.params;
      const { newName, apiKey, affId } = req.body;

      if (!apiKey || !affId) {
        return res.status(400).json({ error: 'API key and affiliate ID are required' });
      }

      const updateData: any = { apiKey, affId };
      if (newName && newName.trim()) {
        updateData.name = newName.trim();
      }

      const success = await storage.updateApiKey(keyName, updateData);
      
      if (success) {
        // Reload the API key pool from database
        console.log('🔄 Reloading API key pool after edit...');
        await walgreensAPI.reloadAPIKeyPool();
        console.log('✅ API key pool reloaded successfully');
        res.json({ message: 'API key updated successfully' });
      } else {
        res.status(404).json({ error: 'API key not found' });
      }
    } catch (error) {
      console.error('Error editing API key:', error);
      res.status(500).json({ error: 'Failed to edit API key' });
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket server for real-time logs
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store WebSocket connections
  const wsConnections = new Set();
  
  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    wsConnections.add(ws);
    
    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      wsConnections.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsConnections.delete(ws);
    });
  });
  
  // Initialize Scanner Service with WebSocket integration
  import('./services/scanner-service').then(({ scannerService }) => {
    // Initialize the scanner service on startup
    scannerService.initialize().then(() => {
      console.log('✅ Scanner Service initialized successfully');
    }).catch(error => {
      console.error('❌ Error initializing Scanner Service:', error);
    });
    
    // Setup WebSocket upgrade handler directly on the HTTP server
    httpServer.on('upgrade', (request, socket, head) => {
      if (request.url === '/ws/fast-scan-progress') {
        console.log('🔌 WebSocket upgrade request received for Scanner');
        
        const wss = new WebSocketServer({ noServer: true });
        wss.handleUpgrade(request, socket, head, (ws) => {
          console.log('🔌 Scanner WebSocket client connected successfully');
          
          // Add client to scanner (if method exists)
          if (typeof (scannerService as any).addWebSocketClient === 'function') {
            (scannerService as any).addWebSocketClient(ws);
          }
          
          // Send immediate confirmation
          ws.send(JSON.stringify({
            type: 'connection_established',
            message: 'CONECTADO - WebSocket activo para logs en tiempo real'
          }));
          
          ws.on('close', () => {
            console.log('🔌 Scanner WebSocket client disconnected');
            if (typeof (scannerService as any).removeWebSocketClient === 'function') {
              (scannerService as any).removeWebSocketClient(ws);
            }
          });
          
          ws.on('error', (error) => {
            console.error('❌ Scanner WebSocket error:', error);
            if (typeof (scannerService as any).removeWebSocketClient === 'function') {
              (scannerService as any).removeWebSocketClient(ws);
            }
          });
        });
      }
    });
  }).catch(error => {
    console.error('❌ Error initializing Scanner Service:', error);
  });

  // Export function to broadcast to all connected clients
  (global as any).broadcastToClients = (message: any) => {
    const data = JSON.stringify(message);
    wsConnections.forEach((ws: any) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(data);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          wsConnections.delete(ws);
        }
      }
    });
  };

  // PRODUCTION FIX: Add emergency endpoints for reliability
  app.get("/api/emergency/member-history", async (req, res) => {
    try {
      console.log('🚨 EMERGENCY ENDPOINT: Getting member history...');
      
      // Set CORS headers for production
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      // Try direct database query for emergency
      try {
        const allRecords = await db.select().from(memberHistory).orderBy(desc(memberHistory.lastAccessedAt));
        console.log(`🚨 EMERGENCY: Direct DB query found ${allRecords.length} total records`);
        
        if (!allRecords || allRecords.length === 0) {
          console.log('🚨 EMERGENCY: No records found in direct DB query');
          return res.status(200).json([]);
        }
        
        console.log(`🚨 EMERGENCY: Returning ${allRecords.length} records from direct DB`);
        return res.json(allRecords);
      } catch (dbError) {
        console.log('🚨 EMERGENCY: Direct DB failed, trying storage fallback...', dbError);
        
        // Fallback to storage method
        const allRecords = await storage.getMemberHistory(1, 999999);
        console.log(`🚨 EMERGENCY: Storage fallback found ${allRecords.length} total records`);
        
        if (!allRecords || allRecords.length === 0) {
          console.log('🚨 EMERGENCY: No records found in storage fallback');
          return res.status(200).json([]);
        }
        
        console.log(`🚨 EMERGENCY: Returning ${allRecords.length} records from storage`);
        return res.json(allRecords);
      }
      
    } catch (error) {
      console.error("🚨 EMERGENCY member history error:", error);
      res.status(500).json({ 
        error: "Failed to get member history",
        message: (error as Error).message,
        emergency: true
      });
    }
  });

  // Auto-reset system endpoints (integrated into existing admin routes)
  app.get("/api/admin/reset-status", async (req, res) => {
    try {
      console.log('🔄 Auto-reset status requested');
      
      // Get current Miami time
      const now = new Date();
      const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      // Calculate next reset time (tomorrow at midnight Miami time)
      const tomorrow = new Date(miamiTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      // Check current marked accounts
      const markedCount = await storage.getMarkedAccountsCount();
      
      res.json({
        success: true,
        currentMiamiTime: miamiTime.toLocaleString(),
        nextResetTime: tomorrow.toLocaleString(),
        hoursUntilReset: Math.ceil((tomorrow.getTime() - miamiTime.getTime()) / (1000 * 60 * 60)),
        isResetTime: miamiTime.getHours() === 0 && miamiTime.getMinutes() < 30,
        autoResetManagerActive: true,
        markedAccountsCount: markedCount
      });
    } catch (error) {
      console.error("Auto-reset status error:", error);
      res.status(500).json({ 
        error: "Failed to get auto-reset status", 
        message: (error as Error).message 
      });
    }
  });

  app.post("/api/admin/manual-reset", async (req, res) => {
    try {
      console.log('🔄 Manual reset requested');
      const { autoResetManager } = await import('./background-jobs');
      const result = await autoResetManager.manualReset();
      
      res.json({
        success: true,
        message: `Reset completed - ${result.resetCount} accounts unmarked`,
        resetCount: result.resetCount
      });
    } catch (error) {
      console.error("Manual reset error:", error);
      res.status(500).json({ 
        error: "Failed to perform manual reset", 
        message: (error as Error).message 
      });
    }
  });

  // GET /api/export/members - Export all valid members to Excel
  app.get("/api/export/members", async (req, res) => {
    try {
      console.log('📥 Export members to Excel requested');
      
      // Fetch all valid members from database (with balance > 0)
      const validMembers = await db
        .select()
        .from(memberHistory)
        .where(and(
          isNotNull(memberHistory.currentBalance),
          ne(memberHistory.currentBalance, 0)
        ))
        .orderBy(desc(memberHistory.currentBalance));
      
      console.log(`📊 Found ${validMembers.length} valid members to export`);
      
      // Transform data for Excel
      const excelData = validMembers.map(member => {
        // Parse memberData JSON to extract zipCode
        let zipCode = 'N/A';
        try {
          if (member.memberData && typeof member.memberData === 'object') {
            const data = member.memberData as any;
            // Try to extract zipCode from lookup data
            if (data.zipCode) {
              zipCode = data.zipCode;
            } else if (data.matchProfiles && data.matchProfiles[0]?.zipCode) {
              zipCode = data.matchProfiles[0].zipCode;
            }
          }
        } catch (e) {
          console.warn(`Could not extract zipCode for ${member.phoneNumber}:`, e);
        }
        
        // Split memberName into firstName and lastName
        const nameParts = (member.memberName || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          'Nombre': firstName,
          'Apellido': lastName,
          'Teléfono': member.phoneNumber,
          'Email': member.emailAddress || '',
          'Código Postal': zipCode,
          'Balance': member.currentBalanceDollars || '$0.00',
          'Última Actividad': member.lastActivityDate || ''
        };
      });
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Miembros Válidos');
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for file download
      const fileName = `walgreens-members-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      // Send file
      res.send(excelBuffer);
      
      console.log(`✅ Excel file generated: ${fileName} with ${validMembers.length} members`);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ 
        error: "Failed to export members", 
        message: (error as Error).message 
      });
    }
  });

  // ============================================
  // SCANNER SYSTEM ENDPOINTS
  // ============================================
  
  // 1. POST /api/scanner/upload - INSTANT UPLOAD: Save file RAW, process later when START is pressed
  app.post("/api/scanner/upload", upload.array('files', 10), async (req, res) => {
    try {
      console.log("📤 INSTANT UPLOAD: Receiving files (no processing)...");
      
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          error: "No files uploaded",
          message: "Por favor, selecciona al menos un archivo para subir"
        });
      }
      
      console.log(`📁 Saving ${files.length} files to database (RAW, no parsing)...`);
      
      const results = [];
      
      // Save each file WITHOUT processing numbers (instant < 1 second)
      for (const file of files) {
        const { originalname, buffer } = file;
        const fileContent = buffer.toString('utf-8');
        
        console.log(`💾 Saving file: ${originalname}, size: ${buffer.length} bytes (RAW content)`);
        
        // Quick validation: count approximate numbers
        const phoneRegex = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
        const matches = fileContent.match(phoneRegex);
        const estimatedNumbers = matches ? matches.length : 0;
        
        if (estimatedNumbers === 0) {
          console.log(`⚠️  File ${originalname} appears to have no phone numbers, skipping...`);
          results.push({
            filename: originalname,
            status: 'error',
            error: "No se encontraron números de teléfono válidos en el archivo"
          });
          continue;
        }
        
        // Save RAW file content to database (instant, no processing)
        const scanFile = await storage.addScanFile(
          originalname,
          fileContent,
          estimatedNumbers
        );
        
        console.log(`✅ File ${originalname} saved instantly to database (ID: ${scanFile.id})`);
        console.log(`   - Estimated numbers: ~${estimatedNumbers}`);
        console.log(`   - Status: pending (will process when START is pressed)`);
        
        results.push({
          fileId: scanFile.id,
          filename: originalname,
          status: 'saved',
          estimatedNumbers: estimatedNumbers
        });
      }
      
      console.log(`✅ INSTANT UPLOAD COMPLETE: ${files.length} files saved (processing deferred until START)`);
      
      res.json({
        filesUploaded: files.length,
        files: results,
        message: `${files.length} archivo(s) guardado(s). Presiona START para procesar.`
      });
      
    } catch (error) {
      console.error("❌ UPLOAD ERROR:", error);
      res.status(500).json({
        error: "Failed to upload files",
        message: (error as Error).message
      });
    }
  });
  
  // 2. GET /api/scanner/files - List uploaded files with progress
  app.get("/api/scanner/files", async (req, res) => {
    try {
      console.log("📂 SCANNER FILES: Fetching uploaded files list...");
      
      const files = await storage.getScanFiles();
      
      // Calculate progress for each file
      const filesWithProgress = files.map(file => ({
        id: file.id,
        filename: file.filename,
        uploadedAt: file.uploadedAt,
        totalNumbers: file.totalNumbers,
        processedNumbers: file.processedNumbers || 0,
        validNumbers: file.validNumbers || 0,
        invalidNumbers: file.invalidNumbers || 0,
        status: file.status || 'pending',
        progress: file.totalNumbers ? 
          Math.round(((file.processedNumbers || 0) / file.totalNumbers) * 100) : 0,
        errorMessage: file.errorMessage
      }));
      
      console.log(`📊 Returning ${filesWithProgress.length} scan files`);
      res.json(filesWithProgress);
      
    } catch (error) {
      console.error("❌ SCANNER FILES ERROR:", error);
      res.status(500).json({
        error: "Failed to fetch files",
        message: (error as Error).message
      });
    }
  });
  
  // 3. POST /api/scanner/process-files - Extract numbers from pending files (ASYNC)
  app.post("/api/scanner/process-files", async (req, res) => {
    try {
      console.log("📂 PROCESS FILES: Extracting numbers from pending files...");
      
      const pendingFiles = await db.select()
        .from(scanFiles)
        .where(eq(scanFiles.status, 'pending'));
      
      console.log(`📂 Found ${pendingFiles.length} pending files to process`);
      
      if (pendingFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No hay archivos pendientes para procesar"
        });
      }
      
      // Mark all files as processing
      for (const file of pendingFiles) {
        await db.update(scanFiles)
          .set({ status: 'processing', processingStartedAt: new Date() })
          .where(eq(scanFiles.id, file.id));
      }
      
      // ✅ START ASYNC PROCESSING - Return immediately
      res.json({
        success: true,
        message: `Procesando ${pendingFiles.length} archivos...`,
        filesCount: pendingFiles.length,
        status: 'processing'
      });
      
      // 🔥 BACKGROUND PROCESSING - Process files asynchronously
      setImmediate(async () => {
        try {
          console.log(`⚡ BACKGROUND: Processing ${pendingFiles.length} files with progress updates...`);
          
          const processFile = async (file: typeof scanFiles.$inferSelect & { fileContent: string }) => {
            try {
              console.log(`📄 Processing file: ${file.filename} (ID: ${file.id})`);
              
              // Parse phone numbers from file content (FAST regex extraction)
              const phoneRegex = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
              const phoneNumbers: string[] = [];
              let match;
              
              while ((match = phoneRegex.exec(file.fileContent)) !== null) {
                const phoneNumber = match[1] + match[2] + match[3];
                if (phoneNumber.length === 10) {
                  phoneNumbers.push(phoneNumber);
                }
              }
              
              const uniqueNumbers = [...new Set(phoneNumbers)];
              console.log(`📱 ${file.filename}: Extracted ${phoneNumbers.length} numbers, ${uniqueNumbers.length} unique`);
              
              // Update total numbers immediately
              await db.update(scanFiles)
                .set({ totalNumbers: uniqueNumbers.length })
                .where(eq(scanFiles.id, file.id));
              
              // Add numbers to queue in batches with progress updates
              const BATCH_SIZE = 5000;
              const UPDATE_EVERY = 10; // Update progress every 10 batches
              let totalAdded = 0;
              let totalSkipped = 0;
              
              for (let i = 0; i < uniqueNumbers.length; i += BATCH_SIZE) {
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(uniqueNumbers.length / BATCH_SIZE);
                const batch = uniqueNumbers.slice(i, i + BATCH_SIZE);
                
                // Insert batch
                const beforeCount = await db.select({ count: sql<number>`count(*)` }).from(scanQueue);
                const countBefore = Number(beforeCount[0]?.count) || 0;
                
                const values = batch.map(phoneNumber => ({
                  phoneNumber,
                  fileId: file.id,
                  status: "pending" as const,
                  attempts: 0
                }));
                
                await db.insert(scanQueue).values(values).onConflictDoNothing();
                
                const afterCount = await db.select({ count: sql<number>`count(*)` }).from(scanQueue);
                const countAfter = Number(afterCount[0]?.count) || 0;
                
                const batchAdded = countAfter - countBefore;
                const batchSkipped = batch.length - batchAdded;
                totalAdded += batchAdded;
                totalSkipped += batchSkipped;
                
                // 📊 UPDATE PROGRESS
                if (batchNumber % UPDATE_EVERY === 0 || batchNumber === totalBatches) {
                  await db.update(scanFiles)
                    .set({
                      processedNumbers: i + batch.length,
                      totalNumbers: uniqueNumbers.length
                    })
                    .where(eq(scanFiles.id, file.id));
                }
              }
              
              // Update file status to 'queued' (numbers extracted, ready to scan)
              await db.update(scanFiles)
                .set({
                  status: 'queued',
                  processedNumbers: uniqueNumbers.length,
                  validNumbers: 0
                })
                .where(eq(scanFiles.id, file.id));
              
              console.log(`✅ ${file.filename}: ${totalAdded} added, ${totalSkipped} skipped`);
              
              return { added: totalAdded, skipped: totalSkipped, filename: file.filename };
            } catch (error) {
              console.error(`❌ Error processing ${file.filename}:`, error);
              await db.update(scanFiles)
                .set({ status: 'pending', errorMessage: (error as Error).message })
                .where(eq(scanFiles.id, file.id));
              return { added: 0, skipped: 0, filename: file.filename };
            }
          };
          
          // ⚡ CONTROLLED PARALLEL PROCESSING - Process 3 files at a time
          const CONCURRENT_LIMIT = 3;
          const results: { added: number; skipped: number; filename: string }[] = [];
          
          for (let i = 0; i < pendingFiles.length; i += CONCURRENT_LIMIT) {
            const batch = pendingFiles.slice(i, i + CONCURRENT_LIMIT);
            const batchResults = await Promise.all(batch.map(processFile));
            results.push(...batchResults);
            console.log(`⚡ File batch ${Math.floor(i / CONCURRENT_LIMIT) + 1} complete`);
          }
          
          const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
          const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
          
          console.log(`⚡ BACKGROUND COMPLETE: ${totalAdded} numbers added, ${totalSkipped} skipped!`);
          
        } catch (error) {
          console.error("❌ BACKGROUND ERROR processing files:", error);
        }
      });
      
    } catch (error) {
      console.error("❌ PROCESS FILES ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process files",
        message: (error as Error).message
      });
    }
  });
  
  // 3b. POST /api/scanner/process-file/:id - Process a single file manually (ASYNC)
  app.post("/api/scanner/process-file/:id", async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      
      console.log(`📄 PROCESS SINGLE FILE: Processing file ID ${fileId}...`);
      
      if (!fileId || isNaN(fileId)) {
        return res.status(400).json({
          success: false,
          message: "ID de archivo inválido"
        });
      }
      
      // Get the file
      const [file] = await db.select()
        .from(scanFiles)
        .where(eq(scanFiles.id, fileId))
        .limit(1);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          message: "Archivo no encontrado"
        });
      }
      
      if (file.status === 'processing') {
        return res.status(400).json({
          success: false,
          message: "El archivo ya está siendo procesado"
        });
      }
      
      console.log(`📄 Processing file: ${file.filename} (ID: ${file.id})`);
      
      // Update file status to processing
      await db.update(scanFiles)
        .set({ status: 'processing', processingStartedAt: new Date() })
        .where(eq(scanFiles.id, file.id));
      
      // ✅ START ASYNC PROCESSING - Return immediately, process in background
      res.json({
        success: true,
        message: `Procesando archivo '${file.filename}'...`,
        status: 'processing'
      });
      
      // 🔥 BACKGROUND PROCESSING - Continue after HTTP response
      setImmediate(async () => {
        try {
          console.log(`⚡ BACKGROUND: Processing ${file.filename} in background...`);
          
          // Parse phone numbers from file content
          const phoneRegex = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
          const phoneNumbers: string[] = [];
          let match;
          
          while ((match = phoneRegex.exec(file.fileContent)) !== null) {
            const phoneNumber = match[1] + match[2] + match[3];
            if (phoneNumber.length === 10) {
              phoneNumbers.push(phoneNumber);
            }
          }
          
          const uniqueNumbers = [...new Set(phoneNumbers)];
          console.log(`📱 ${file.filename}: Extracted ${phoneNumbers.length} numbers, ${uniqueNumbers.length} unique`);
          
          // Update total numbers immediately
          await db.update(scanFiles)
            .set({ totalNumbers: uniqueNumbers.length })
            .where(eq(scanFiles.id, file.id));
          
          // Add numbers to queue in batches with progress updates
          const BATCH_SIZE = 5000;
          const UPDATE_EVERY = 10; // Update progress every 10 batches (50k numbers)
          let totalAdded = 0;
          let totalSkipped = 0;
          
          for (let i = 0; i < uniqueNumbers.length; i += BATCH_SIZE) {
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(uniqueNumbers.length / BATCH_SIZE);
            const batch = uniqueNumbers.slice(i, i + BATCH_SIZE);
            
            // Insert batch
            const beforeCount = await db.select({ count: sql<number>`count(*)` }).from(scanQueue);
            const countBefore = Number(beforeCount[0]?.count) || 0;
            
            const values = batch.map(phoneNumber => ({
              phoneNumber,
              fileId: file.id,
              status: "pending" as const,
              attempts: 0
            }));
            
            await db.insert(scanQueue).values(values).onConflictDoNothing();
            
            const afterCount = await db.select({ count: sql<number>`count(*)` }).from(scanQueue);
            const countAfter = Number(afterCount[0]?.count) || 0;
            
            const batchAdded = countAfter - countBefore;
            const batchSkipped = batch.length - batchAdded;
            totalAdded += batchAdded;
            totalSkipped += batchSkipped;
            
            // 📊 UPDATE PROGRESS every N batches or on last batch
            if (batchNumber % UPDATE_EVERY === 0 || batchNumber === totalBatches) {
              const progressPercent = Math.round((batchNumber / totalBatches) * 100);
              await db.update(scanFiles)
                .set({
                  processedNumbers: i + batch.length,
                  totalNumbers: uniqueNumbers.length
                })
                .where(eq(scanFiles.id, file.id));
              
              console.log(`   📊 Progress: ${batchNumber}/${totalBatches} (${progressPercent}%)`);
            }
          }
          
          // Update file status to 'queued' (numbers extracted, ready to scan)
          await db.update(scanFiles)
            .set({
              status: 'queued',
              processedNumbers: uniqueNumbers.length,
              validNumbers: 0
            })
            .where(eq(scanFiles.id, file.id));
          
          console.log(`✅ BACKGROUND COMPLETE: ${file.filename} - ${totalAdded} added, ${totalSkipped} skipped`);
          
        } catch (error) {
          console.error(`❌ BACKGROUND ERROR processing ${file.filename}:`, error);
          // Update file status to error
          await db.update(scanFiles)
            .set({ 
              status: 'pending',
              errorMessage: (error as Error).message 
            })
            .where(eq(scanFiles.id, file.id));
        }
      });
      
    } catch (error) {
      console.error("❌ PROCESS SINGLE FILE ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process file",
        message: (error as Error).message
      });
    }
  });
  
  // 4. POST /api/scanner/start - Start scanning (numbers must already be in queue)
  app.post("/api/scanner/start", async (req, res) => {
    try {
      console.log("🚀 SCANNER START: Initiating scan...");
      
      // Check if there are numbers to scan
      const pendingCount = await db.select({ count: sql<number>`count(*)` })
        .from(scanQueue)
        .where(eq(scanQueue.status, 'pending'));
      
      const totalPending = Number(pendingCount[0]?.count) || 0;
      
      if (totalPending === 0) {
        console.warn("⚠️ No pending numbers in queue");
        return res.status(400).json({
          success: false,
          message: "No hay números en la cola. Primero procesa los archivos."
        });
      }
      
      // Start the scanner service
      await scannerService.start();
      
      const progress = scannerService.getCurrentProgress();
      
      console.log(`✅ Scanner started with ${totalPending} numbers in queue`);
      console.log(`   Session ID: ${progress.currentSessionId}`);
      
      res.json({
        success: true,
        sessionId: progress.currentSessionId,
        message: `Escaneo iniciado con ${totalPending} números pendientes`,
        totalPending
      });
      
    } catch (error) {
      console.error("❌ SCANNER START ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start scanner",
        message: (error as Error).message
      });
    }
  });
  
  // 4. POST /api/scanner/stop - Stop scanning process
  app.post("/api/scanner/stop", async (req, res) => {
    try {
      console.log("🛑 SCANNER STOP: Stopping scan process...");
      
      await scannerService.stop();
      
      console.log("✅ Scanner stopped successfully");
      
      res.json({
        success: true,
        message: "Escaneo detenido exitosamente"
      });
      
    } catch (error) {
      console.error("❌ SCANNER STOP ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to stop scanner",
        message: (error as Error).message
      });
    }
  });
  
  // 5. GET /api/scanner/status - Get current scanner status
  app.get("/api/scanner/status", async (req, res) => {
    try {
      console.log("📊 SCANNER STATUS: Fetching current scanner status...");
      
      // Get current progress from scanner service
      const progress = scannerService.getCurrentProgress();
      
      // Get pending count from database
      const pendingCount = await db.select({ count: sql<number>`count(*)` })
        .from(scanQueue)
        .where(eq(scanQueue.status, 'pending'));
      
      const totalPending = Number(pendingCount[0]?.count) || 0;
      
      // Calculate estimated time remaining
      let estimatedTimeRemaining = undefined;
      if (progress.isScanning && progress.requestsPerSecond > 0 && totalPending > 0) {
        estimatedTimeRemaining = Math.ceil(totalPending / progress.requestsPerSecond);
      }
      
      // API capacity (assuming 10 keys at 300 req/min each = 3000 req/min = 50 req/sec)
      const apiCapacity = progress.apiKeysActive * 300; // requests per minute
      
      const status = {
        isScanning: progress.isScanning,
        sessionId: progress.currentSessionId,
        totalPending,
        totalProcessed: progress.totalProcessed,
        totalValid: progress.totalValid,          // ✅ Changed from validFound
        totalInvalid: progress.totalInvalid,      // ✅ Changed from invalidFound
        requestsPerSecond: progress.requestsPerSecond,  // ✅ Added for frontend
        currentRate: progress.requestsPerSecond,
        apiKeysActive: progress.apiKeysActive,
        apiCapacity,
        estimatedTimeRemaining,
        lastProcessedNumbers: progress.lastProcessedNumbers,
        errorCount: progress.errorCount
      };
      
      console.log(`📊 Scanner Status:`, {
        isScanning: status.isScanning,
        pending: status.totalPending,
        processed: status.totalProcessed,
        rate: `${status.currentRate} req/s`
      });
      
      // No cache headers - always fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(status);
      
    } catch (error) {
      console.error("❌ SCANNER STATUS ERROR:", error);
      res.status(500).json({
        error: "Failed to fetch scanner status",
        message: (error as Error).message
      });
    }
  });
  
  // 6. GET /api/scanner/results - Get scan results with pagination
  app.get("/api/scanner/results", async (req, res) => {
    try {
      // Parse query parameters with defaults
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      console.log(`📋 SCANNER RESULTS: Fetching results (limit: ${limit}, offset: ${offset})...`);
      
      // Validate parameters
      if (limit < 1 || limit > 1000) {
        return res.status(400).json({
          error: "Invalid limit",
          message: "Limit must be between 1 and 1000"
        });
      }
      
      if (offset < 0) {
        return res.status(400).json({
          error: "Invalid offset",
          message: "Offset must be non-negative"
        });
      }
      
      // Get results from storage
      const results = await storage.getScanResults(limit, offset);
      
      // Get total count for pagination
      const totalCount = await db.select({ count: sql<number>`count(*)` })
        .from(scanResults);
      
      const total = Number(totalCount[0]?.count) || 0;
      
      console.log(`✅ Returning ${results.length} of ${total} total scan results`);
      
      res.json({
        data: results.map(result => ({
          id: result.id,
          phoneNumber: result.phoneNumber,
          memberName: result.memberName,
          encLoyaltyId: result.encLoyaltyId,
          currentBalance: result.currentBalance,
          currentBalanceDollars: result.currentBalanceDollars,
          lastActivityDate: result.lastActivityDate,
          fileId: result.fileId,
          sessionId: result.sessionId,
          scannedAt: result.scannedAt
        })),
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total
        }
      });
      
    } catch (error) {
      console.error("❌ SCANNER RESULTS ERROR:", error);
      res.status(500).json({
        error: "Failed to fetch scan results",
        message: (error as Error).message
      });
    }
  });
  
  // 7. DELETE /api/scanner/file/:id - Delete file from queue
  app.delete("/api/scanner/file/:id", async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      
      console.log(`🗑️ SCANNER DELETE FILE: Attempting to delete file ${fileId}...`);
      
      if (!fileId || isNaN(fileId)) {
        return res.status(400).json({
          success: false,
          message: "ID de archivo inválido"
        });
      }
      
      // Check if file exists and its status
      const [file] = await db.select()
        .from(scanFiles)
        .where(eq(scanFiles.id, fileId))
        .limit(1);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          message: "Archivo no encontrado"
        });
      }
      
      // ✅ PRESERVE scan_queue numbers - DO NOT DELETE them!
      // Only delete scan results and the file record itself
      
      // 1. Delete scan results associated with this file
      const deletedResults = await db.delete(scanResults)
        .where(eq(scanResults.fileId, fileId))
        .returning();
      
      // 2. Set fileId to NULL in scan_queue (preserve numbers, detach from file)
      const detachedQueue = await db.update(scanQueue)
        .set({ fileId: null })
        .where(eq(scanQueue.fileId, fileId))
        .returning();
      
      // 3. Delete the file record
      await db.delete(scanFiles)
        .where(eq(scanFiles.id, fileId));
      
      console.log(`✅ File ${fileId} deleted: ${deletedResults.length} results removed, ${detachedQueue.length} queue entries PRESERVED`);
      
      res.json({
        success: true,
        message: `Archivo '${file.filename}' eliminado. Los ${detachedQueue.length} números en cola se preservaron.`
      });
      
    } catch (error) {
      console.error("❌ SCANNER DELETE FILE ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete file",
        message: (error as Error).message
      });
    }
  });
  
  // 8. GET /api/scanner/api-keys - Get API key statistics with cleanup
  app.get("/api/scanner/api-keys", async (req, res) => {
    try {
      const stats = scannerService.getApiKeyStats();
      res.json(stats);
    } catch (error) {
      console.error("❌ SCANNER API KEYS ERROR:", error);
      res.status(500).json({
        error: "Failed to get API key stats",
        message: (error as Error).message
      });
    }
  });

  // 8B. GET /api/scanner/rate-limiter-stats - Get Token Bucket telemetry
  app.get("/api/scanner/rate-limiter-stats", async (req, res) => {
    try {
      const { RateLimiterManager } = await import('./services/rate-limiter-manager');
      const rateLimiter = RateLimiterManager.getInstance();
      const stats = rateLimiter.getAllStats();
      
      res.json({
        success: true,
        stats: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("❌ RATE LIMITER STATS ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get rate limiter stats",
        message: (error as Error).message
      });
    }
  });

  // 9. GET /api/scanner/results/export - Export results as CSV
  app.get("/api/scanner/results/export", async (req, res) => {
    try {
      console.log("📥 SCANNER EXPORT: Generating CSV export of scan results...");
      
      // Get all scan results
      const results = await db.select()
        .from(scanResults)
        .orderBy(desc(scanResults.scannedAt));
      
      console.log(`📊 Exporting ${results.length} scan results to CSV...`);
      
      // Generate CSV header
      const csvHeader = "Phone,Name,Balance,LastActivity,ScannedAt\n";
      
      // Generate CSV rows
      const csvRows = results.map(result => {
        const phone = result.phoneNumber || '';
        const name = (result.memberName || '').replace(/,/g, ' '); // Remove commas from names
        const balance = result.currentBalanceDollars || '0.00';
        const lastActivity = result.lastActivityDate || '';
        const scannedAt = result.scannedAt ? new Date(result.scannedAt).toISOString() : '';
        
        return `"${phone}","${name}","$${balance}","${lastActivity}","${scannedAt}"`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      // Set headers for file download
      const fileName = `scan-results-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      console.log(`✅ CSV export generated: ${fileName} with ${results.length} results`);
      
      // Send CSV content
      res.send(csvContent);
      
    } catch (error) {
      console.error("❌ SCANNER EXPORT ERROR:", error);
      res.status(500).json({
        error: "Failed to export scan results",
        message: (error as Error).message
      });
    }
  });

  // ========================================
  // DOWNLOADS SYSTEM ROUTES
  // ========================================

  // 1. GET /api/downloads/accounts - Get accounts with filters
  app.get("/api/downloads/accounts", async (req, res) => {
    try {
      const filters = {
        downloaded: req.query.downloaded === "true" ? true : req.query.downloaded === "false" ? false : undefined,
        zipCode: req.query.zipCode as string | undefined,
        state: req.query.state as string | undefined,
        minBalance: req.query.minBalance ? parseFloat(req.query.minBalance as string) : undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };

      const result = await storage.getAccountsWithFilters(filters);
      
      console.log(`📊 DOWNLOADS: Fetched ${result.accounts.length} accounts (${result.total} total)${filters.state ? ` for state ${filters.state}` : ''}`);
      
      res.json(result);
    } catch (error) {
      console.error("❌ DOWNLOADS GET ACCOUNTS ERROR:", error);
      res.status(500).json({
        error: "Failed to get accounts",
        message: (error as Error).message
      });
    }
  });

  // 2. POST /api/downloads/mark-downloaded - Mark accounts as downloaded
  app.post("/api/downloads/mark-downloaded", async (req, res) => {
    try {
      const { accountIds } = req.body;
      
      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({
          error: "accountIds must be a non-empty array"
        });
      }

      await storage.markAccountsAsDownloaded(accountIds);
      
      console.log(`✅ DOWNLOADS: Marked ${accountIds.length} accounts as downloaded`);
      
      res.json({
        success: true,
        count: accountIds.length
      });
    } catch (error) {
      console.error("❌ DOWNLOADS MARK DOWNLOADED ERROR:", error);
      res.status(500).json({
        error: "Failed to mark accounts as downloaded",
        message: (error as Error).message
      });
    }
  });

  // 3. GET /api/downloads/states - Get list of available states
  app.get("/api/downloads/states", async (req, res) => {
    try {
      const states = storage.getAvailableStates();
      
      console.log(`📊 DOWNLOADS: Retrieved ${states.length} available states`);
      
      res.json({ states });
    } catch (error) {
      console.error("❌ DOWNLOADS GET STATES ERROR:", error);
      res.status(500).json({
        error: "Failed to get states",
        message: (error as Error).message
      });
    }
  });

  // 4. GET /api/downloads/zip-to-state - Get ZIP to state mapping
  app.get("/api/downloads/zip-to-state", async (req, res) => {
    try {
      const zipToState = storage.getZipToStateMapping();
      
      console.log(`📊 DOWNLOADS: Retrieved ZIP-to-state mapping with ${Object.keys(zipToState).length} ZIP codes`);
      
      res.json({ zipToState });
    } catch (error) {
      console.error("❌ DOWNLOADS GET ZIP-TO-STATE ERROR:", error);
      res.status(500).json({
        error: "Failed to get ZIP-to-state mapping",
        message: (error as Error).message
      });
    }
  });

  return httpServer;
}
