import { pgTable, text, integer, boolean, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - stores customer login credentials
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed
  netsuiteCustomerId: text("netsuite_customer_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  phone: text("phone"),
  emailVerified: boolean("email_verified").notNull().default(false),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  netsuiteCustomerIdIdx: index("netsuite_customer_id_idx").on(table.netsuiteCustomerId),
}));

// Account invitations table - tracks registration links
export const accountInvitations = pgTable("account_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  netsuiteCustomerId: text("netsuite_customer_id").notNull(),
  email: text("email").notNull(),
  companyName: text("company_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  usedByUserId: uuid("used_by_user_id").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"), // Admin user who created the invitation
}, (table) => ({
  tokenIdx: index("token_idx").on(table.token),
  netsuiteCustomerIdIdx: index("invitation_netsuite_customer_id_idx").on(table.netsuiteCustomerId),
}));

// Login attempts table - for rate limiting
export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  ipAddress: text("ip_address").notNull(),
  successful: boolean("successful").notNull().default(false),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("login_attempts_email_idx").on(table.email),
  ipAddressIdx: index("login_attempts_ip_idx").on(table.ipAddress),
}));

// Refresh tokens table - for JWT refresh
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("refresh_token_idx").on(table.token),
  userIdIdx: index("refresh_token_user_id_idx").on(table.userId),
}));

// Create insert schemas with validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  companyName: z.string().min(1, "Company name is required").optional(),
  phone: z.string().optional(),
  netsuiteCustomerId: z.string().min(1, "NetSuite Customer ID is required"),
});

export const insertInvitationSchema = createInsertSchema(accountInvitations, {
  email: z.string().email("Invalid email address"),
  netsuiteCustomerId: z.string().min(1, "NetSuite Customer ID is required"),
  companyName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AccountInvitation = typeof accountInvitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// Registration form schema (for frontend validation)
export const registrationSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  phone: z.string().optional(),
  token: z.string().min(1, "Invitation token is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Login form schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});