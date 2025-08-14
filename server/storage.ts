import { users, accountInvitations, loginAttempts, refreshTokens, type User, type InsertUser, type AccountInvitation, type LoginAttempt, type RefreshToken } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, lt } from "drizzle-orm";
import type { SessionStore } from "express-session";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User management
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByNetSuiteCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, 'id'>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateLastLogin(id: string): Promise<void>;
  
  // Invitation management
  getInvitationByToken(token: string): Promise<AccountInvitation | undefined>;
  createInvitation(invitation: Omit<AccountInvitation, 'id' | 'createdAt'>): Promise<AccountInvitation>;
  markInvitationUsed(token: string, userId: string): Promise<void>;
  getInvitationsByCustomerId(customerId: string): Promise<AccountInvitation[]>;
  
  // Login attempts (for rate limiting)
  getRecentLoginAttempts(email: string, ipAddress: string, minutes: number): Promise<LoginAttempt[]>;
  createLoginAttempt(email: string, ipAddress: string, successful: boolean): Promise<void>;
  
  // Refresh tokens
  createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  deleteRefreshToken(token: string): Promise<void>;
  deleteUserRefreshTokens(userId: string): Promise<void>;
  
  // Session store
  sessionStore: SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: SessionStore;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // User management
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || undefined;
  }
  
  async getUserByNetSuiteCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.netsuiteCustomerId, customerId));
    return user || undefined;
  }
  
  async createUser(userData: Omit<InsertUser, 'id'>): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      email: userData.email.toLowerCase(),
    }).returning();
    return user;
  }
  
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async updateLastLogin(id: string): Promise<void> {
    await db.update(users)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }
  
  // Invitation management
  async getInvitationByToken(token: string): Promise<AccountInvitation | undefined> {
    const [invitation] = await db.select()
      .from(accountInvitations)
      .where(eq(accountInvitations.token, token));
    return invitation || undefined;
  }
  
  async createInvitation(invitation: Omit<AccountInvitation, 'id' | 'createdAt'>): Promise<AccountInvitation> {
    const [created] = await db.insert(accountInvitations)
      .values(invitation)
      .returning();
    return created;
  }
  
  async markInvitationUsed(token: string, userId: string): Promise<void> {
    await db.update(accountInvitations)
      .set({
        used: true,
        usedAt: new Date(),
        usedByUserId: userId,
      })
      .where(eq(accountInvitations.token, token));
  }
  
  async getInvitationsByCustomerId(customerId: string): Promise<AccountInvitation[]> {
    return await db.select()
      .from(accountInvitations)
      .where(eq(accountInvitations.netsuiteCustomerId, customerId))
      .orderBy(desc(accountInvitations.createdAt));
  }
  
  // Login attempts
  async getRecentLoginAttempts(email: string, ipAddress: string, minutes: number): Promise<LoginAttempt[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return await db.select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.email, email.toLowerCase()),
          eq(loginAttempts.ipAddress, ipAddress),
          gte(loginAttempts.attemptedAt, cutoff),
          eq(loginAttempts.successful, false)
        )
      );
  }
  
  async createLoginAttempt(email: string, ipAddress: string, successful: boolean): Promise<void> {
    await db.insert(loginAttempts).values({
      email: email.toLowerCase(),
      ipAddress,
      successful,
    });
  }
  
  // Refresh tokens
  async createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    const [refreshToken] = await db.insert(refreshTokens)
      .values({
        userId,
        token,
        expiresAt,
      })
      .returning();
    return refreshToken;
  }
  
  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const [refreshToken] = await db.select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, token),
          gte(refreshTokens.expiresAt, new Date())
        )
      );
    return refreshToken || undefined;
  }
  
  async deleteRefreshToken(token: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  }
  
  async deleteUserRefreshTokens(userId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}

export const storage = new DatabaseStorage();