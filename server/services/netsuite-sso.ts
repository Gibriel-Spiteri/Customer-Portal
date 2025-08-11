import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storage } from '../storage';

interface SSOTokenPayload {
  name: string;
  email?: string;
  customerId?: string;
  entityId?: string;
  iat?: number;
  exp?: number;
}

export class NetSuiteSSO {
  private ssoSecret: string;

  constructor() {
    this.ssoSecret = process.env.NETSUITE_SSO_SECRET || '';
    if (!this.ssoSecret) {
      throw new Error('NETSUITE_SSO_SECRET environment variable is required');
    }
  }

  /**
   * Verify and decode JWT token from NetSuite Suitelet
   */
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: SSOTokenPayload; error?: string }> {
    try {
      // Decode the JWT token using the shared secret
      const decoded = jwt.verify(token, Buffer.from(this.ssoSecret, 'base64'), {
        algorithms: ['HS256']
      }) as SSOTokenPayload;

      // Validate required fields
      if (!decoded.name) {
        return {
          valid: false,
          error: 'Token missing required name field'
        };
      }

      // Check token expiration (if present)
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return {
          valid: false,
          error: 'Token has expired'
        };
      }

      return {
        valid: true,
        payload: decoded
      };
    } catch (error) {
      console.error('JWT verification failed:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      };
    }
  }

  /**
   * Get or create user from SSO token payload
   */
  async processSSO(payload: SSOTokenPayload) {
    try {
      // Try to find existing user by NetSuite customer ID or email
      let user = null;
      
      if (payload.customerId) {
        try {
          user = await storage.getUserByNetsuiteId(payload.customerId);
        } catch (error) {
          // User not found, continue searching by email
        }
      }
      
      if (!user && payload.email) {
        try {
          user = await storage.getUserByUsername(payload.email);
        } catch (error) {
          // User not found, will create new user
        }
      }

      // Create new user if not found
      if (!user) {
        const newUser = {
          username: payload.email || payload.name.toLowerCase().replace(/\s+/g, '_'),
          email: payload.email || `${payload.name.toLowerCase().replace(/\s+/g, '_')}@netsuite-sso.local`,
          password: '', // No password needed for SSO users
          firstName: payload.name.split(' ')[0] || payload.name,
          lastName: payload.name.split(' ').slice(1).join(' ') || '',
          companyName: null,
          netsuiteCustomerId: payload.customerId || null,
          netsuiteEntityId: payload.entityId || null,
          netsuiteAccessToken: null,
          netsuiteRefreshToken: null,
          netsuiteTokenExpiry: null,
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        user = await storage.createUser(newUser);
        console.log('SSO: Created new user from NetSuite SSO:', user.id);
      } else {
        // Update last login time
        await storage.updateUser(user.id, {
          lastLoginAt: new Date(),
          updatedAt: new Date()
        });
        console.log('SSO: Updated existing user login:', user.id);
      }

      return user;
    } catch (error) {
      console.error('SSO processing error:', error);
      throw error;
    }
  }

  /**
   * Generate redirect URL to NetSuite Suitelet
   */
  generateSuiteLetURL(): string {
    const accountId = process.env.NETSUITE_ACCOUNT_ID || '1212804';
    const scriptId = process.env.NETSUITE_SSO_SCRIPT_ID || '4354';
    const deployId = process.env.NETSUITE_SSO_DEPLOY_ID || '1';
    
    return `https://${accountId}.app.netsuite.com/app/site/hosting/scriptlet.nl?script=${scriptId}&deploy=${deployId}`;
  }
}