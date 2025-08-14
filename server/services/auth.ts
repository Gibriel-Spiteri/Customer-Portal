import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storage } from '../storage';
import { InsertUser, User } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const SALT_ROUNDS = 10;

export class AuthService {
  // Password hashing
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Token generation
  generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  generateAccessToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        netsuiteCustomerId: user.netsuiteCustomerId,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Rate limiting
  async checkRateLimit(email: string, ipAddress: string): Promise<boolean> {
    const attempts = await storage.getRecentLoginAttempts(email, ipAddress, 15);
    return attempts.length < 5;
  }

  // User authentication
  async authenticateUser(email: string, password: string, ipAddress: string): Promise<{ user: User; accessToken: string; refreshToken: string } | null> {
    // Check rate limit
    const canAttempt = await this.checkRateLimit(email, ipAddress);
    if (!canAttempt) {
      await storage.createLoginAttempt(email, ipAddress, false);
      throw new Error('Too many login attempts. Please try again in 15 minutes.');
    }

    // Get user
    const user = await storage.getUserByEmail(email);
    if (!user) {
      await storage.createLoginAttempt(email, ipAddress, false);
      return null;
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      await storage.createLoginAttempt(email, ipAddress, false);
      return null;
    }

    // Success - update last login
    await storage.createLoginAttempt(email, ipAddress, true);
    await storage.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await storage.createRefreshToken(user.id, refreshToken, expiresAt);

    return { user, accessToken, refreshToken };
  }

  // Register new user
  async registerUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone?: string;
    netsuiteCustomerId: string;
    invitationToken: string;
  }): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Validate invitation
    const invitation = await storage.getInvitationByToken(userData.invitationToken);
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.used) {
      throw new Error('Invitation has already been used');
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      throw new Error('Invitation has expired');
    }

    if (invitation.netsuiteCustomerId !== userData.netsuiteCustomerId) {
      throw new Error('Invitation does not match customer ID');
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user
    const user = await storage.createUser({
      email: userData.email,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      companyName: userData.companyName,
      phone: userData.phone,
      netsuiteCustomerId: userData.netsuiteCustomerId,
      emailVerified: true, // Auto-verify since they have invitation
    });

    // Mark invitation as used
    await storage.markInvitationUsed(userData.invitationToken, user.id);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await storage.createRefreshToken(user.id, refreshToken, expiresAt);

    return { user, accessToken, refreshToken };
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; user: User }> {
    const tokenRecord = await storage.getRefreshToken(refreshToken);
    if (!tokenRecord) {
      throw new Error('Invalid refresh token');
    }

    const user = await storage.getUserById(tokenRecord.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = this.generateAccessToken(user);
    return { accessToken, user };
  }

  // Logout
  async logout(refreshToken: string): Promise<void> {
    await storage.deleteRefreshToken(refreshToken);
  }

  // Create invitation
  async createInvitation(data: {
    netsuiteCustomerId: string;
    email: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    createdBy?: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await storage.createInvitation({
      token,
      netsuiteCustomerId: data.netsuiteCustomerId,
      email: data.email,
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      used: false,
      usedAt: null,
      usedByUserId: null,
      expiresAt,
      createdBy: data.createdBy || null,
    });

    return { token, expiresAt };
  }

  // Validate invitation
  async validateInvitation(token: string): Promise<{
    valid: boolean;
    invitation?: any;
    error?: string;
  }> {
    const invitation = await storage.getInvitationByToken(token);
    
    if (!invitation) {
      return { valid: false, error: 'Invalid invitation token' };
    }

    if (invitation.used) {
      return { valid: false, error: 'Invitation has already been used' };
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      return { valid: false, error: 'Invitation has expired' };
    }

    return { 
      valid: true, 
      invitation: {
        email: invitation.email,
        netsuiteCustomerId: invitation.netsuiteCustomerId,
        companyName: invitation.companyName,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
      }
    };
  }
}

export const authService = new AuthService();