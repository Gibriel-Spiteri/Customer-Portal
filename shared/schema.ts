import { pgTable, serial, text, varchar, timestamp, boolean, integer, uuid, jsonb, index, customType } from 'drizzle-orm/pg-core';

// Postgres bytea for storing uploaded file contents (drizzle has no built-in bytea type)
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return 'bytea';
  },
});
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Users table for authentication
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  netsuiteCustomerId: varchar('netsuite_customer_id', { length: 100 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  companyName: varchar('company_name', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(), // gates the /admin metrics dashboard
  lastLoginAt: timestamp('last_login_at'), // set on each successful login (admin user metrics)
  loginCount: integer('login_count').default(0).notNull(), // lifetime successful logins
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: uuid('token').defaultRandom().notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Read-through cache of NetSuite responses (see server/services/ns-cache.ts).
// One row per logical query result, keyed by a stable cache key. Stale-while-
// revalidate uses two horizons: serve+revalidate after softExpiresAt, force a
// blocking refetch after hardExpiresAt. Persisted (not in-memory) so it is shared
// across Replit autoscale instances and survives scale-to-zero cold starts.
export const nsCache = pgTable('ns_cache', {
  cacheKey: text('cache_key').primaryKey(),
  customerId: varchar('customer_id', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  softExpiresAt: timestamp('soft_expires_at', { withTimezone: true }).notNull(),
  hardExpiresAt: timestamp('hard_expires_at', { withTimezone: true }).notNull(),
}, (t) => ({
  customerIdx: index('ns_cache_customer_idx').on(t.customerId),       // invalidate-by-customer
  hardExpiryIdx: index('ns_cache_hard_expiry_idx').on(t.hardExpiresAt), // cleanup sweep
}));

export type NsCacheRow = typeof nsCache.$inferSelect;

// Per-minute rollup of NetSuite request volume + cache effectiveness, for the
// admin metrics dashboard. Written by a 60s flusher (server/services/ns-metrics-store.ts)
// that drains the in-process counters and upsert-increments the current bucket — so
// counts aggregate across Replit autoscale instances (each flushes its own delta).
export const nsMetrics = pgTable('ns_metrics', {
  bucket: timestamp('bucket', { withTimezone: true }).primaryKey(), // truncated to the minute
  reqToken: integer('req_token').default(0).notNull(),
  reqSuiteql: integer('req_suiteql').default(0).notNull(),
  reqRecord: integer('req_record').default(0).notNull(),
  reqRestlet: integer('req_restlet').default(0).notNull(),
  reqOidc: integer('req_oidc').default(0).notNull(),
  reqOther: integer('req_other').default(0).notNull(),
  cacheHit: integer('cache_hit').default(0).notNull(),
  cacheMiss: integer('cache_miss').default(0).notNull(),
  cacheStale: integer('cache_stale').default(0).notNull(),
  peakConcurrency: integer('peak_concurrency').default(0).notNull(),
});

export type NsMetricsRow = typeof nsMetrics.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  netsuiteCustomerId: z.string().min(1, 'NetSuite Customer ID is required'),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  token: true,
  createdAt: true,
});

// Quick Quote requests: a portal customer picks a store + salesperson, fills in
// project info, and uploads files. The request is logged here and a NetSuite
// task (assigned to the salesperson, sendEmail=true) is created for delivery.
export const quickQuoteRequests = pgTable('quick_quote_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storeName: varchar('store_name', { length: 100 }).notNull(),
  salesRepId: varchar('sales_rep_id', { length: 50 }).notNull(), // NetSuite employee internal id
  salesRepName: varchar('sales_rep_name', { length: 200 }).notNull(),
  salesRepEmail: varchar('sales_rep_email', { length: 255 }),
  projectType: varchar('project_type', { length: 50 }).notNull(), // Kitchen | Bath | Other
  budget: varchar('budget', { length: 100 }),
  timeFrame: varchar('time_frame', { length: 50 }), // 0-3 months | 4-6 months | 7+ months
  brandPreference: varchar('brand_preference', { length: 255 }),
  comments: text('comments'),
  netsuiteTaskId: varchar('netsuite_task_id', { length: 50 }), // set once the NetSuite task is created
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Uploaded measurement/photo files for a quick quote request. Stored in Postgres
// (persists across autoscale instances/deploys). Downloaded via an unguessable
// per-file token link included in the NetSuite task, so the salesperson doesn't
// need a portal login.
export const quickQuoteFiles = pgTable('quick_quote_files', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => quickQuoteRequests.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 20 }).notNull(), // 'measurements' | 'photos'
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  downloadToken: varchar('download_token', { length: 64 }).notNull().unique(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  requestIdx: index('quick_quote_files_request_idx').on(t.requestId),
}));

export type QuickQuoteRequest = typeof quickQuoteRequests.$inferSelect;
export type QuickQuoteFile = typeof quickQuoteFiles.$inferSelect;

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

// Login schema for validation
export const loginSchema = z.object({
  email: z.string().min(1, 'Email or customer ID is required'),
  password: z.string().min(1, 'Password is required'),
});

// Registration schema
export const registrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  netsuiteCustomerId: z.string().min(1, 'Customer Number is required'),
});


// Request password reset schema
export const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().uuid('Invalid token'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});