import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  companyName: text("company_name"),
  netsuiteCustomerId: text("netsuite_customer_id").unique(),
  netsuiteEntityId: text("netsuite_entity_id"),
  netsuiteAccessToken: text("netsuite_access_token"),
  netsuiteRefreshToken: text("netsuite_refresh_token"),
  netsuiteTokenExpiry: timestamp("netsuite_token_expiry"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  netsuiteId: text("netsuite_id").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  currency: text("currency").default("USD"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("cached"), // 'live' or 'cached'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  netsuiteId: text("netsuite_id").notNull().unique(),
  orderNumber: text("order_number").notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  orderDate: timestamp("order_date").notNull(),
  shipDate: timestamp("ship_date"),
  deliveryDate: timestamp("delivery_date"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  trackingNumber: text("tracking_number"),
  items: jsonb("items"), // Store order items as JSON array
  notes: text("notes"),
  customerPO: text("customer_po"),
  shippingMethod: text("shipping_method"),
  paymentMethod: text("payment_method"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }),
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("cached"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  netsuiteId: text("netsuite_id").notNull().unique(),
  invoiceNumber: text("invoice_number").notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  status: text("status").notNull(), // 'open', 'paid', 'overdue', 'cancelled'
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0.00"),
  balanceAmount: decimal("balance_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  pdfUrl: text("pdf_url"),
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("cached"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  netsuiteId: text("netsuite_id").notNull().unique(),
  paymentNumber: text("payment_number").notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'check', 'credit_card', 'bank_transfer', 'cash'
  referenceNumber: text("reference_number"),
  status: text("status").notNull(), // 'pending', 'processed', 'failed', 'refunded'
  currency: text("currency").default("USD"),
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("live"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const syncJobs = pgTable("sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(), // 'live_sync', 'batch_sync', 'manual_sync'
  entityType: text("entity_type").notNull(), // 'orders', 'payments', 'invoices', 'accounts'
  status: text("status").notNull(), // 'pending', 'running', 'completed', 'failed'
  userId: varchar("user_id").references(() => users.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  recordsProcessed: integer("records_processed").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").default("open"), // 'open', 'in_progress', 'resolved', 'closed'
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  netsuiteId: text("netsuite_id"),
  estimateNumber: text("estimate_number").notNull(),
  status: text("status").default("draft"), // 'draft', 'sent', 'viewed', 'accepted', 'expired', 'rejected'
  customerName: text("customer_name").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  estimateDate: timestamp("estimate_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  dataFreshness: text("data_freshness").default("cached"), // 'live', 'cached'
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loyaltyAccounts = pgTable("loyalty_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  netsuiteId: text("netsuite_id").notNull().unique(),
  programName: text("program_name").notNull().default("Consumers Cash"),
  memberNumber: text("member_number").notNull(),
  memberSince: timestamp("member_since").notNull(),
  tier: text("tier").notNull().default("bronze"), // 'bronze', 'silver', 'gold', 'platinum', 'diamond'
  totalPoints: integer("total_points").default(0),
  availablePoints: integer("available_points").default(0),
  cashValue: decimal("cash_value", { precision: 12, scale: 2 }).default("0.00"),
  lifetimeEarnings: decimal("lifetime_earnings", { precision: 12, scale: 2 }).default("0.00"),
  nextTierPoints: integer("next_tier_points"),
  nextTierName: text("next_tier_name"),
  expiringPoints: jsonb("expiring_points"), // {amount: number, expirationDate: string}
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("cached"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  loyaltyAccountId: varchar("loyalty_account_id").notNull().references(() => loyaltyAccounts.id),
  netsuiteId: text("netsuite_id").notNull().unique(),
  type: text("type").notNull(), // 'earned', 'redeemed', 'expired'
  points: integer("points").notNull(),
  description: text("description").notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  redemptionDetails: jsonb("redemption_details"),
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("cached"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loyaltyRewards = pgTable("loyalty_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pointsRequired: integer("points_required").notNull(),
  category: text("category").notNull(),
  available: boolean("available").default(true),
  imageUrl: text("image_url"),
  terms: text("terms"),
  lastSyncAt: timestamp("last_sync_at"),
  dataFreshness: text("data_freshness").default("cached"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  account: one(accounts),
  orders: many(orders),
  invoices: many(invoices),
  payments: many(payments),
  supportTickets: many(supportTickets),
  estimates: many(estimates),
  loyaltyAccount: one(loyaltyAccounts),
  loyaltyTransactions: many(loyaltyTransactions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));

export const estimatesRelations = relations(estimates, ({ one }) => ({
  user: one(users, {
    fields: [estimates.userId],
    references: [users.id],
  }),
}));

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [loyaltyAccounts.userId],
    references: [users.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  user: one(users, {
    fields: [loyaltyTransactions.userId],
    references: [users.id],
  }),
  loyaltyAccount: one(loyaltyAccounts, {
    fields: [loyaltyTransactions.loyaltyAccountId],
    references: [loyaltyAccounts.id],
  }),
  order: one(orders, {
    fields: [loyaltyTransactions.orderId],
    references: [orders.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

export const insertSyncJobSchema = createInsertSchema(syncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstimateSchema = createInsertSchema(estimates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type SyncJob = typeof syncJobs.$inferSelect;
export type InsertSyncJob = z.infer<typeof insertSyncJobSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
