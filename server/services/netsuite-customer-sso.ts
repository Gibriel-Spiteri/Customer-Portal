import jwt from 'jsonwebtoken';
import { storage } from '../storage';

interface CustomerSSOTokenPayload {
  id?: number;
  customerId?: string;
  entityId?: string;
  name: string;
  email?: string;
  companyName?: string;
  isCustomer: boolean;
  customerType?: string;
  aud?: string;
  iss?: string;
  iat?: number;
  exp?: number;
}

export class NetSuiteCustomerSSO {
  private ssoSecret: string;

  constructor() {
    this.ssoSecret = process.env.NETSUITE_SSO_SECRET || '';
    if (!this.ssoSecret) {
      throw new Error('NETSUITE_SSO_SECRET environment variable is required');
    }
  }

  /**
   * Verify and decode JWT token from NetSuite Customer Center Suitelet
   */
  async verifyCustomerToken(token: string): Promise<{ valid: boolean; payload?: CustomerSSOTokenPayload; error?: string }> {
    try {
      let decoded: CustomerSSOTokenPayload | null = null;
      
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
          }) as CustomerSSOTokenPayload;
          
          console.log('Customer SSO: JWT verification successful with secret format:', typeof secret === 'string' ? 'plaintext' : 'buffer');
          break;
        } catch (error) {
          verificationError = error;
          continue;
        }
      }
      
      if (!decoded) {
        console.error('Customer SSO: All secret formats failed:', verificationError?.message);
        return {
          valid: false,
          error: verificationError instanceof Error ? verificationError.message : 'Invalid token signature'
        };
      }

      // Validate required fields for customer
      if (!decoded.name && !decoded.companyName) {
        return {
          valid: false,
          error: 'Token missing required name or company name field'
        };
      }

      // Validate it's a customer token (not employee)
      if (!decoded.isCustomer && !decoded.customerId) {
        return {
          valid: false,
          error: 'Token is not valid for customer authentication'
        };
      }

      // Check token expiration
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
      console.error('Customer SSO JWT verification failed:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      };
    }
  }

  /**
   * Get or create customer user from SSO token payload
   */
  async processCustomerSSO(payload: CustomerSSOTokenPayload) {
    try {
      // Try to find existing customer by NetSuite customer ID or email
      let user = null;
      
      // Use the customer ID from NetSuite token
      const netsuiteCustomerId = payload.customerId || payload.id?.toString();
      
      if (netsuiteCustomerId) {
        try {
          user = await storage.getUserByNetsuiteId(netsuiteCustomerId);
        } catch (error) {
          // User not found, continue searching by email
        }
      }
      
      if (!user && payload.email) {
        try {
          user = await storage.getUserByUsername(payload.email);
        } catch (error) {
          // User not found, will create new customer user
        }
      }

      // Create new customer user if not found
      if (!user) {
        const username = payload.email || 
                        `${(payload.companyName || payload.name).toLowerCase().replace(/\s+/g, '_')}_customer`;
        
        const newCustomerUser = {
          username,
          email: payload.email || `${username}@customer.local`,
          password: '', // No password needed for SSO customers
          firstName: payload.name ? payload.name.split(' ')[0] : (payload.companyName || 'Customer'),
          lastName: payload.name ? payload.name.split(' ').slice(1).join(' ') : '',
          companyName: payload.companyName || payload.name || null,
          netsuiteCustomerId,
          netsuiteEntityId: payload.entityId || null,
          netsuiteAccessToken: null,
          netsuiteRefreshToken: null,
          netsuiteTokenExpiry: null,
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        user = await storage.createUser(newCustomerUser);
        console.log('Customer SSO: Created new customer user:', user.id, 'for NetSuite Customer ID:', netsuiteCustomerId);
        
        // Create customer account if it doesn't exist
        try {
          await storage.createAccount({
            userId: user.id,
            netsuiteId: netsuiteCustomerId || `customer_${user.id}`,
            balance: "0.00",
            creditLimit: null,
            currency: "USD",
            isActive: true,
            dataFreshness: "cached"
          });
          console.log('Customer SSO: Created account for customer:', user.id);
        } catch (error) {
          console.log('Customer SSO: Account creation failed (may already exist):', error);
        }
        
      } else {
        // Update existing customer user
        const updateData: any = {
          lastLoginAt: new Date(),
          updatedAt: new Date()
        };
        
        // Update NetSuite customer ID if we have it and user doesn't
        if (netsuiteCustomerId && !user.netsuiteCustomerId) {
          updateData.netsuiteCustomerId = netsuiteCustomerId;
        }
        
        // Update company name if available
        if (payload.companyName && payload.companyName !== user.companyName) {
          updateData.companyName = payload.companyName;
        }
        
        await storage.updateUser(user.id, updateData);
        console.log('Customer SSO: Updated existing customer user:', user.id, 'NetSuite Customer ID:', netsuiteCustomerId);
      }

      return user;
    } catch (error) {
      console.error('Customer SSO processing error:', error);
      throw error;
    }
  }

  /**
   * Generate redirect URL to NetSuite Customer Center Suitelet
   */
  generateCustomerCenterURL(): string {
    const accountId = process.env.NETSUITE_ACCOUNT_ID || '1212804';
    const customerScriptId = process.env.NETSUITE_CUSTOMER_SSO_SCRIPT_ID || '4390'; // Different script for customers
    const customerDeployId = process.env.NETSUITE_CUSTOMER_SSO_DEPLOY_ID || '1';
    
    // Get the proper Replit domain from environment 
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    
    console.log('Customer SSO: Environment values:', { accountId, customerScriptId, customerDeployId, replitDomain });
    
    if (!replitDomain) {
      console.warn('Customer SSO: REPLIT_DEV_DOMAIN not found, using basic URL');
      return `https://${accountId}.app.netsuite.com/app/site/hosting/scriptlet.nl?script=${customerScriptId}&deploy=${customerDeployId}`;
    }
    
    // Construct the callback URL that NetSuite should redirect to
    const callbackUrl = `https://${replitDomain}/api/auth/netsuite/customer/sso`;
    
    console.log('Customer SSO: Generated NetSuite Customer Center URL with callback:', callbackUrl);
    
    // Add the callback URL as a parameter so NetSuite Customer Center Suitelet knows where to redirect
    const finalUrl = `https://${accountId}.app.netsuite.com/app/site/hosting/scriptlet.nl?script=${customerScriptId}&deploy=${customerDeployId}&callback=${encodeURIComponent(callbackUrl)}&customer_portal=true`;
    
    console.log('Customer SSO: Final Customer Center URL:', finalUrl);
    return finalUrl;
  }
}