import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storage } from '../storage';

interface SSOTokenPayload {
  id?: number;
  name: string;
  email?: string;
  customerId?: string;
  entityId?: string;
  companyName?: string;
  customerCenterAccess?: boolean;
  billingAddress?: string;
  phone?: string;
  aud?: string;
  iss?: string;
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
      let decoded: SSOTokenPayload | null = null;
      
      // Try different secret formats as NetSuite might encode it differently
      const secretVariants = [
        Buffer.from(this.ssoSecret, 'base64'), // Base64 encoded
        this.ssoSecret,                        // Plain text
        Buffer.from(this.ssoSecret, 'hex'),    // Hex encoded
        Buffer.from(this.ssoSecret, 'utf8')    // UTF8 encoded
      ];
      
      let verificationError: any;
      
      for (const secret of secretVariants) {
        try {
          decoded = jwt.verify(token, secret, {
            algorithms: ['HS256']
          }) as SSOTokenPayload;
          
          console.log('SSO: JWT verification successful with secret format:', typeof secret === 'string' ? 'plaintext' : 'buffer');
          break;
        } catch (error) {
          verificationError = error;
          continue;
        }
      }
      
      if (!decoded) {
        console.error('SSO: All secret formats failed:', verificationError?.message);
        return {
          valid: false,
          error: verificationError instanceof Error ? verificationError.message : 'Invalid token signature'
        };
      }

      // Validate required fields for customer center access
      if (!decoded.name) {
        return {
          valid: false,
          error: 'Token missing required name field'
        };
      }

      // Validate customer center access if specified
      if (decoded.customerCenterAccess === false) {
        return {
          valid: false,
          error: 'Customer does not have center access permissions'
        };
      }

      // Validate customer ID for customer center users
      if (!decoded.customerId && !decoded.id) {
        return {
          valid: false,
          error: 'Token missing required customer identification'
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
      
      // Use the `id` field from NetSuite token if available
      const netsuiteId = payload.id?.toString() || payload.customerId;
      
      if (netsuiteId) {
        try {
          user = await storage.getUserByNetsuiteId(netsuiteId);
        } catch (error) {
          // User not found, continue searching by email
        }
      }
      
      if (!user && payload.email) {
        try {
          user = await storage.getUserByEmail(payload.email);
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
          companyName: payload.companyName || null,
          netsuiteCustomerId: netsuiteId,
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
        console.log('SSO: Created new user from NetSuite SSO:', user.id, 'for NetSuite ID:', netsuiteId);
      } else {
        // Update last login time and NetSuite ID if needed
        const updateData: any = {
          lastLoginAt: new Date(),
          updatedAt: new Date()
        };
        
        // Update NetSuite customer ID if we have it and user doesn't
        if (netsuiteId && !user.netsuiteCustomerId) {
          updateData.netsuiteCustomerId = netsuiteId;
        }
        
        // Update company name from NetSuite if available
        if (payload.companyName && payload.companyName !== user.companyName) {
          updateData.companyName = payload.companyName;
        }
        
        await storage.updateUser(user.id, updateData);
        console.log('SSO: Updated existing user login:', user.id, 'NetSuite ID:', netsuiteId);
      }

      return user;
    } catch (error) {
      console.error('SSO processing error:', error);
      throw error;
    }
  }

  /**
   * Generate redirect URL to NetSuite Suitelet with proper callback URL
   */
  generateSuiteLetURL(): string {
    let accountId = process.env.NETSUITE_ACCOUNT_ID || '1212804';
    
    // Extract account ID if full URL is provided
    if (accountId.includes('netsuite.com')) {
      // Extract account ID from URL like "https://1212804.app.netsuite.com/"
      const match = accountId.match(/(?:https?:\/\/)?(\d+)\.app\.netsuite\.com/);
      if (match && match[1]) {
        accountId = match[1];
      }
    }
    
    // Remove any trailing slashes or https:// prefix
    accountId = accountId.replace(/^https?:\/\//, '').replace(/\/$/, '').replace('.app.netsuite.com', '');
    
    const scriptId = process.env.NETSUITE_SSO_SCRIPT_ID || '4354';
    const deployId = process.env.NETSUITE_SSO_DEPLOY_ID || '1';
    
    // Get the proper Replit domain from environment 
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    
    console.log('SSO: Environment values:', { accountId, scriptId, deployId, replitDomain });
    
    if (!replitDomain) {
      console.warn('SSO: REPLIT_DEV_DOMAIN not found, using basic URL');
      return `https://${accountId}.app.netsuite.com/app/site/hosting/scriptlet.nl?script=${scriptId}&deploy=${deployId}`;
    }
    
    // Construct the callback URL that NetSuite should redirect to
    const callbackUrl = `https://${replitDomain}/api/auth/netsuite/sso`;
    
    console.log('SSO: Generated NetSuite URL with callback:', callbackUrl);
    
    // Add the callback URL as a parameter so NetSuite Suitelet knows where to redirect
    const finalUrl = `https://${accountId}.app.netsuite.com/app/site/hosting/scriptlet.nl?script=${scriptId}&deploy=${deployId}&callback=${encodeURIComponent(callbackUrl)}`;
    
    console.log('SSO: Final URL:', finalUrl);
    return finalUrl;
  }
}