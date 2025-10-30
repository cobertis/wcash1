import { pgTable, text, serial, timestamp, boolean, integer, json, varchar, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  assignedStoreNumber: text("assigned_store_number"),
  assignedStoreName: text("assigned_store_name"),
  assignedStoreAddress: json("assigned_store_address"),
  assignedStorePhone: text("assigned_store_phone"),
  storeAssignedAt: timestamp("store_assigned_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  offerId: text("offer_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  discount: text("discount"),
  category: text("category"),
  imageUrl: text("image_url"),
  expiryDate: text("expiry_date"),
  status: text("status").default("active"),
  offerData: json("offer_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clippedOffers = pgTable("clipped_offers", {
  id: serial("id").primaryKey(),
  encLoyaltyId: text("enc_loyalty_id").notNull(),
  offerId: text("offer_id").notNull(),
  channel: text("channel").default("web"),
  status: text("status").default("active"),
  clippedAt: timestamp("clipped_at").defaultNow(),
});

export const redeemedOffers = pgTable("redeemed_offers", {
  id: serial("id").primaryKey(),
  encLoyaltyId: text("enc_loyalty_id").notNull(),
  offerId: text("offer_id").notNull(),
  redeemedDate: text("redeemed_date").notNull(),
  storeLocation: text("store_location"),
  savings: text("savings"),
  redemptionData: json("redemption_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberHistory = pgTable("member_history", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  encLoyaltyId: text("enc_loyalty_id").notNull(),
  memberName: text("member_name"),
  cardNumber: text("card_number"),
  currentBalance: integer("current_balance"),
  currentBalanceDollars: text("current_balance_dollars"),
  lastActivityDate: text("last_activity_date"),
  emailAddress: text("email_address"),
  memberData: json("member_data"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  markedAsUsed: boolean("marked_as_used").default(false),
  markedAsUsedAt: timestamp("marked_as_used_at"),
});

// Bulk verification jobs for background processing
export const bulkVerificationJobs = pgTable("bulk_verification_jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  phoneNumbers: json("phone_numbers").notNull(), // Array of phone numbers
  status: text("status").default("pending"), // pending, processing, completed, failed
  totalNumbers: integer("total_numbers").notNull(),
  processedNumbers: integer("processed_numbers").default(0),
  validNumbers: integer("valid_numbers").default(0),
  results: json("results").default([]), // Array of verification results
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Job execution history - Real executed jobs with results
export const jobExecutionHistory = pgTable("job_execution_history", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  jobName: text("job_name").notNull(),
  description: text("description"),
  totalPhoneNumbers: integer("total_phone_numbers").notNull(),
  validAccounts: integer("valid_accounts").default(0),
  invalidAccounts: integer("invalid_accounts").default(0),
  accountsWithBalance: integer("accounts_with_balance").default(0),
  totalBalance: integer("total_balance").default(0), // in cents
  totalBalanceDollars: text("total_balance_dollars").default("0.00"),
  executionTime: integer("execution_time_seconds"), // execution time in seconds
  apiCallsUsed: integer("api_calls_used").default(0),
  status: text("status").default("completed"), // completed, failed, partial
  executedAt: timestamp("executed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  environment: text("environment").default("deployed"), // deployed, development
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Job results detail - Individual account results for each job
export const jobResultsDetail = pgTable("job_results_detail", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  memberName: text("member_name"),
  cardNumber: text("card_number"),
  currentBalance: integer("current_balance").default(0),
  currentBalanceDollars: text("current_balance_dollars").default("0.00"),
  lastActivityDate: text("last_activity_date"),
  emailAddress: text("email_address"),
  status: text("status").notNull(), // valid, invalid, error
  errorMessage: text("error_message"),
  apiResponseTime: integer("api_response_time_ms"),
  processedAt: timestamp("processed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// API Keys pool table for persistence
export const apiKeyPool = pgTable("api_key_pool", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  apiKey: text("api_key").notNull(),
  affId: text("aff_id").notNull(),
  requestCount: integer("request_count").default(0),
  isActive: boolean("is_active").default(true),
  lastResetTime: timestamp("last_reset_time").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Removed couponAnalyses table (AI functionality removed)

export const insertMemberSchema = createInsertSchema(members);
export const insertOfferSchema = createInsertSchema(offers);
export const insertClippedOfferSchema = createInsertSchema(clippedOffers);
export const insertRedeemedOfferSchema = createInsertSchema(redeemedOffers);
export const insertMemberHistorySchema = createInsertSchema(memberHistory);
export const insertBulkVerificationJobSchema = createInsertSchema(bulkVerificationJobs);
export const insertJobExecutionHistorySchema = createInsertSchema(jobExecutionHistory);
export const insertJobResultsDetailSchema = createInsertSchema(jobResultsDetail);
export const insertApiKeyPoolSchema = createInsertSchema(apiKeyPool);

// Removed couponAnalyses schema (AI functionality removed)

export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type MemberHistory = typeof memberHistory.$inferSelect;
export type InsertMemberHistory = z.infer<typeof insertMemberHistorySchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type ClippedOffer = typeof clippedOffers.$inferSelect;
export type InsertClippedOffer = z.infer<typeof insertClippedOfferSchema>;
export type RedeemedOffer = typeof redeemedOffers.$inferSelect;
export type InsertRedeemedOffer = z.infer<typeof insertRedeemedOfferSchema>;
export type BulkVerificationJob = typeof bulkVerificationJobs.$inferSelect;
export type InsertBulkVerificationJob = z.infer<typeof insertBulkVerificationJobSchema>;
export type JobExecutionHistory = typeof jobExecutionHistory.$inferSelect;
export type InsertJobExecutionHistory = z.infer<typeof insertJobExecutionHistorySchema>;
export type JobResultsDetail = typeof jobResultsDetail.$inferSelect;
export type InsertJobResultsDetail = z.infer<typeof insertJobResultsDetailSchema>;
export type ApiKeyPool = typeof apiKeyPool.$inferSelect;
export type InsertApiKeyPool = z.infer<typeof insertApiKeyPoolSchema>;
// Removed CouponAnalysis types (AI functionality removed)

// API Request/Response types
export const lookupMemberSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});

export const clipOfferSchema = z.object({
  encId: z.string().min(1, "Encrypted loyalty ID is required"),
  offerId: z.string().min(1, "Offer ID is required"),
  channel: z.string().default("web"),
});

export const searchOffersSchema = z.object({
  encId: z.string().min(1, "Encrypted loyalty ID is required"),
  q: z.string().optional(),
  type: z.string().optional(),
  page: z.number().default(1),
  size: z.number().default(20),
});

export const fetchOffersSchema = z.object({
  encId: z.string().min(1, "Encrypted loyalty ID is required"),
  page: z.number().default(1),
  size: z.number().default(20),
  category: z.string().optional(),
});

export const redeemedOffersSchema = z.object({
  encId: z.string().min(1, "Encrypted loyalty ID is required"),
  start: z.string().optional(),
  end: z.string().optional(),
  page: z.number().default(1),
  size: z.number().default(20),
});

export const assignStoreSchema = z.object({
  encLoyaltyId: z.string(),
  storeNumber: z.string(),
  storeName: z.string(),
  storeAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }),
  storePhone: z.string(),
});

export type LookupMemberRequest = z.infer<typeof lookupMemberSchema>;
export type ClipOfferRequest = z.infer<typeof clipOfferSchema>;
export type SearchOffersRequest = z.infer<typeof searchOffersSchema>;
export type FetchOffersRequest = z.infer<typeof fetchOffersSchema>;
export type RedeemedOffersRequest = z.infer<typeof redeemedOffersSchema>;
export type AssignStoreRequest = z.infer<typeof assignStoreSchema>;

// Balance Rewards Activity Schema
export const balanceRewardsActivities = pgTable("balance_rewards_activities", {
  id: serial("id").primaryKey(),
  memberPhone: varchar("member_phone", { length: 15 }).notNull(),
  encLoyaltyId: varchar("enc_loyalty_id", { length: 255 }),
  activityType: varchar("activity_type", { length: 50 }).notNull(), // walking, running, weight_management, etc.
  activityData: jsonb("activity_data").notNull(), // JSON with activity details
  pointsAwarded: integer("points_awarded").default(0),
  status: varchar("status", { length: 20 }).default("pending"), // pending, submitted, rewarded, failed
  submittedAt: timestamp("submitted_at").defaultNow(),
  responseData: jsonb("response_data"), // API response from Walgreens
  createdAt: timestamp("created_at").defaultNow(),
});

export type BalanceRewardsActivity = typeof balanceRewardsActivities.$inferSelect;
export type InsertBalanceRewardsActivity = typeof balanceRewardsActivities.$inferInsert;

// OAuth tokens for Balance Rewards API
export const balanceRewardsTokens = pgTable("balance_rewards_tokens", {
  id: serial("id").primaryKey(),
  memberPhone: varchar("member_phone", { length: 15 }).notNull(),
  encLoyaltyId: varchar("enc_loyalty_id", { length: 255 }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: varchar("token_type", { length: 50 }).default("bearer"),
  expiresAt: timestamp("expires_at"),
  scope: varchar("scope", { length: 255 }),
  state: varchar("state", { length: 255 }),
  transactionId: varchar("transaction_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BalanceRewardsToken = typeof balanceRewardsTokens.$inferSelect;
export type InsertBalanceRewardsToken = typeof balanceRewardsTokens.$inferInsert;

// Balance Rewards Activity Request Schema
export const submitActivitySchema = z.object({
  memberPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  encLoyaltyId: z.string().optional(),
  activityType: z.enum(["walking", "running", "weight_management", "exercise", "medication", "health_check"]),
  activityData: z.object({
    // For walking/running
    steps: z.number().optional(),
    distance: z.number().optional(),
    calories: z.number().optional(),
    duration: z.number().optional(),
    date: z.string().optional(),
    // For weight management
    weight: z.number().optional(),
    weightUnit: z.enum(["lbs", "kg"]).optional(),
    // For exercise
    exerciseType: z.string().optional(),
    // For medication
    medicationName: z.string().optional(),
    dosage: z.string().optional(),
    // For health check
    checkupType: z.string().optional(),
    result: z.string().optional(),
  }),
});

export type SubmitActivityRequest = z.infer<typeof submitActivitySchema>;

// Scanner System Tables
export const scanFiles = pgTable("scan_files", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileContent: text("file_content").notNull(),
  totalNumbers: integer("total_numbers").notNull(),
  processedNumbers: integer("processed_numbers").default(0),
  validNumbers: integer("valid_numbers").default(0),
  invalidNumbers: integer("invalid_numbers").default(0),
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, completed, error
  errorMessage: text("error_message"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processingStartedAt: timestamp("processing_started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("scan_files_status_idx").on(table.status),
  uploadedAtIdx: index("scan_files_uploaded_at_idx").on(table.uploadedAt),
}));

export const scanSessions = pgTable("scan_sessions", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 20 }).default("active"), // active, paused, completed, cancelled
  totalScanned: integer("total_scanned").default(0),
  validFound: integer("valid_found").default(0),
  invalidFound: integer("invalid_found").default(0),
  apiKeysUsed: integer("api_keys_used").default(0),
  ratePerSecond: integer("rate_per_second"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scanQueue = pgTable("scan_queue", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  fileId: integer("file_id").references(() => scanFiles.id),
  status: varchar("status", { length: 25 }).default("pending"), // pending, processing, completed, invalid, error_retryable, error_permanent
  attempts: integer("attempts").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  processedAt: timestamp("processed_at"),
  lastStatusChangeAt: timestamp("last_status_change_at").defaultNow(),
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  errorIsRetryable: boolean("error_is_retryable"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  phoneNumberIdx: uniqueIndex("scan_queue_phone_number_idx").on(table.phoneNumber),
  statusIdx: index("scan_queue_status_idx").on(table.status),
  fileIdIdx: index("scan_queue_file_id_idx").on(table.fileId),
  pendingStatusIdx: index("scan_queue_pending_idx").on(table.status).where(sql`status = 'pending'`),
  processedStatusIdx: index("scan_queue_processed_idx").on(table.status).where(sql`status IN ('completed', 'invalid', 'error_permanent')`),
}));

export const scanResults = pgTable("scan_results", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  memberName: text("member_name"),
  encLoyaltyId: text("enc_loyalty_id"),
  currentBalance: integer("current_balance").default(0),
  currentBalanceDollars: text("current_balance_dollars").default("0.00"),
  lastActivityDate: text("last_activity_date"),
  fileId: integer("file_id").references(() => scanFiles.id),
  sessionId: integer("session_id").references(() => scanSessions.id),
  scannedAt: timestamp("scanned_at").defaultNow(),
});

// Admin Users table for authentication
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: varchar("email", { length: 255 }),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Scanner System Insert Schemas
export const insertScanFileSchema = createInsertSchema(scanFiles);
export const insertScanSessionSchema = createInsertSchema(scanSessions);
export const insertScanQueueSchema = createInsertSchema(scanQueue);
export const insertScanResultSchema = createInsertSchema(scanResults);

// Scanner System Types
export type ScanFile = typeof scanFiles.$inferSelect;
export type InsertScanFile = z.infer<typeof insertScanFileSchema>;
export type ScanSession = typeof scanSessions.$inferSelect;
export type InsertScanSession = z.infer<typeof insertScanSessionSchema>;
export type ScanQueue = typeof scanQueue.$inferSelect;
export type InsertScanQueue = z.infer<typeof insertScanQueueSchema>;
export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
