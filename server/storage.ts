import { users, passwordResetTokens, type User, type InsertUser, type PasswordResetToken, type InsertPasswordResetToken } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, sql } from "drizzle-orm";
import bcrypt from 'bcrypt';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByNetSuiteCustomerId(customerId: string): Promise<User | undefined>;
  getUsersByNetSuiteCustomerId(customerId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<User | undefined>;
  updatePassword(userId: number, newPassword: string): Promise<boolean>;
  createPasswordResetToken(userId: number): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-insensitive email lookup
    const [user] = await db.select().from(users).where(
      sql`LOWER(${users.email}) = LOWER(${email})`
    );
    return user || undefined;
  }

  async getUserByNetSuiteCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.netsuiteCustomerId, customerId));
    return user || undefined;
  }

  async getUsersByNetSuiteCustomerId(customerId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.netsuiteCustomerId, customerId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async verifyPassword(email: string, password: string): Promise<User | undefined> {
    // Use case-insensitive getUserByEmail method
    const user = await this.getUserByEmail(email);
    if (!user || !user.isActive) {
      return undefined;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return undefined;
    }

    return user;
  }

  async updatePassword(userId: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const [updated] = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return !!updated;
  }

  async createPasswordResetToken(userId: number): Promise<PasswordResetToken> {
    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const [token] = await db
      .insert(passwordResetTokens)
      .values({
        userId,
        expiresAt,
        used: false,
      })
      .returning();
    
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gte(passwordResetTokens.expiresAt, new Date())
        )
      );
    
    return resetToken || undefined;
  }

  async markTokenAsUsed(tokenId: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }
}

export const storage = new DatabaseStorage();