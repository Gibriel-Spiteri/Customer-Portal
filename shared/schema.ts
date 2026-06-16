import { pgTable, serial, text, varchar, timestamp, boolean, integer, uuid, jsonb, index } from 'drizzle-orm/pg-core';
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