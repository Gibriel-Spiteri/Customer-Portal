import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { syncService } from "./services/sync";
import { queueService } from "./services/queue";
import { 
  loginSchema, 
  registrationSchema, 
  requestPasswordResetSchema, 
  resetPasswordSchema
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { netsuiteClient } from "./services/netsuite-simple";
import { invalidateCustomer } from "./services/ns-cache";
import { getMetricsSnapshot } from "./services/ns-metrics";
import { nsLimitStatus } from "./services/ns-limit";
import { startMetricsFlusher, getMetricsRollup } from "./services/ns-metrics-store";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import multer from "multer";
import crypto from "crypto";
import { quickQuoteRequests, quickQuoteFiles, conciergeRequests, conciergeFiles } from "@shared/schema";
import {
  getSalespeopleByStore,
  findSalesRep,
  getCustomerInternalId,
  createQuickQuoteTask,
  getStoreManager,
  INFO_MAILBOX_EMPLOYEE_ID,
} from "./services/quick-quote";

// Fail fast if the signing secret is missing — a hardcoded fallback would let
// anyone who reads the source forge session tokens (including admin sessions).
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Handle both old format (userId) and new format (id)
    const userId = decoded.id || decoded.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is no longer active' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      netsuiteCustomerId: decoded.netsuiteCustomerId,
      isNetSuiteUser: decoded.isNetSuiteUser,
      ssoUser: decoded.ssoUser || false,
      isAdmin: user.isAdmin,
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Middleware to require admin access (use after authenticateToken).
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Short-TTL cache of customer account/status, keyed by NetSuite customer ID.
// validateCustomerAccess runs on EVERY protected request and previously fetched
// the customer account (2 SuiteQL + an OAuth token POST) every single time. This
// caches the account for CUSTOMER_STATUS_TTL_MS so repeat and parallel requests
// reuse one fetch, and the account is stashed on req so the dashboard can reuse
// it instead of fetching it again. Trade-off: hold-status changes
// (GLOBAL_HOLD/DISCONTINUED/CONTACT_HOLD) and account balance can be up to the
// TTL stale — acceptable for a self-service portal; lower the TTL to tighten.
const CUSTOMER_STATUS_TTL_MS = 60 * 1000;
const customerAccountCache = new Map<string, { account: any; fetchedAt: number }>();

async function getCachedCustomerAccount(customerId: string): Promise<any> {
  const cached = customerAccountCache.get(customerId);
  if (cached && Date.now() - cached.fetchedAt < CUSTOMER_STATUS_TTL_MS) {
    return cached.account;
  }
  const { NetSuiteM2M } = await import('./services/netsuite-m2m');
  const m2m = new NetSuiteM2M();
  const account = await m2m.getCustomerAccount(customerId);
  customerAccountCache.set(customerId, { account, fetchedAt: Date.now() });
  return account;
}

// Middleware to validate customer center access and customer status
const validateCustomerAccess = async (req: any, res: any, next: any) => {
  const user = req.user;
  
  // For NetSuite customer center users, validate they have customer access
  if (user.isNetSuiteUser && user.ssoUser) {
    if (!user.netsuiteCustomerId) {
      return res.status(403).json({ 
        message: 'Customer center access required',
        error: 'Missing NetSuite customer identification'
      });
    }
    
    // Add customer filter for data isolation
    req.customerFilter = {
      customerId: user.netsuiteCustomerId
    };
    
    console.log('Customer center access validated for NetSuite customer:', user.netsuiteCustomerId);
  }
  
  // Check customer status for all NetSuite users
  if (user.netsuiteCustomerId) {
    try {
      // Replaced the per-request fetch with a 60s cached lookup (getCachedCustomerAccount).
      // Legacy inline fetch preserved per house rule — it ran one getCustomerAccount
      // (2 SuiteQL + a token POST) on EVERY protected request:
      //   const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      //   const m2m = new NetSuiteM2M();
      //   const customerData = await m2m.getCustomerAccount(user.netsuiteCustomerId);
      const customerData = await getCachedCustomerAccount(user.netsuiteCustomerId);
      // Stash so downstream handlers (e.g. /api/dashboard) reuse it without re-fetching.
      req.nsCustomerAccount = customerData;

      const customerStatus = customerData.customerstatus;
      
      if (customerStatus === '2' || customerStatus === 2) {
        return res.status(403).json({ 
          message: 'Your Account is on Hold. Speak to a Store Manager for more information.',
          statusCode: 'GLOBAL_HOLD'
        });
      }
      
      if (customerStatus === '3' || customerStatus === 3) {
        return res.status(403).json({ 
          message: 'Your Account has been discontinued.',
          statusCode: 'DISCONTINUED'
        });
      }
      
      if (customerStatus === '7' || customerStatus === 7) {
        return res.status(403).json({ 
          message: 'Your Account is on Contact Hold. Please contact support for assistance.',
          statusCode: 'CONTACT_HOLD'
        });
      }
    } catch (error) {
      console.error('Error checking customer status in middleware:', error);
      // Allow access if we can't check status - don't block due to API errors
    }
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Begin persisting NetSuite request metrics to per-minute buckets (admin dashboard).
  startMetricsFlusher();

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Start live sync for this connection
    syncService.startLiveSync(ws);

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe' && data.userId) {
          // Subscribe to user-specific updates
          (ws as any).userId = data.userId;
          console.log(`Client subscribed to updates for user ${data.userId}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // NetSuite Test Endpoint - Simple connection test
  app.get('/api/netsuite/test', async (req, res) => {
    try {
      // Check if NetSuite is configured
      const configStatus = netsuiteClient.getConfigStatus();
      
      if (!configStatus.configured) {
        return res.json({
          success: false,
          message: 'NetSuite not configured',
          missing: configStatus.missing
        });
      }

      // Test the connection
      const result = await netsuiteClient.testConnection();
      
      res.json(result);
    } catch (error) {
      console.error('NetSuite test error:', error);
      res.status(500).json({
        success: false,
        message: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // NetSuite Debug Endpoint - Get configuration and debug info
  // Test NetSuite M2M connection (debug endpoint)
  app.get('/api/debug/netsuite-m2m', async (req, res) => {
    try {
      console.log('Testing NetSuite M2M connection...');
      console.log('Environment check:', {
        hasConsumerKey: !!process.env.NETSUITE_CONSUMER_KEY,
        hasConsumerSecret: !!process.env.NETSUITE_CONSUMER_SECRET,
        accountId: process.env.NETSUITE_ACCOUNT_ID
      });
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const result = await m2m.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Error testing NetSuite M2M:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test NetSuite M2M connection',
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
  
  // Test endpoint to fetch estimates from NetSuite using M2M
  // Debug endpoint to check specific customer estimates
  app.get('/api/debug/customer-estimates/:customerId', async (req, res) => {
    try {
      const customerId = req.params.customerId;
      console.log(`Checking estimates for customer ID: ${customerId}`);
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const estimates = await m2m.getCustomerEstimates(customerId, 50);
      
      res.json({
        success: true,
        customerId: customerId,
        count: estimates.length,
        hasEstimates: estimates.length > 0,
        estimates: estimates
      });
    } catch (error) {
      console.error('Error fetching customer estimates:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch customer estimates',
        error: error instanceof Error ? error.message : error
      });
    }
  });
  
  app.get('/api/debug/netsuite-estimates', async (req, res) => {
    try {
      console.log('Fetching estimates from NetSuite using M2M...');
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Get estimates list
      const estimates = await m2m.getAllEstimates(10, 0);
      
      console.log(`Found ${estimates.items.length} estimates`);
      
      res.json({
        success: true,
        count: estimates.items.length,
        hasMore: estimates.hasMore,
        estimates: estimates.items
      });
    } catch (error) {
      console.error('Error fetching estimates:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch estimates from NetSuite',
        error: error instanceof Error ? error.message : error
      });
    }
  });
  
  app.get('/api/netsuite/debug', async (req, res) => {
    try {
      const configStatus = netsuiteClient.getConfigStatus();
      const debugInfo = netsuiteClient.getDebugInfo();
      
      res.json({
        configuration: configStatus,
        debug: debugInfo,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasAccountId: !!process.env.NETSUITE_ACCOUNT_ID,
          hasConsumerKey: !!process.env.NETSUITE_CONSUMER_KEY,
          hasConsumerSecret: !!process.env.NETSUITE_CONSUMER_SECRET,
          hasTokenId: !!process.env.NETSUITE_TOKEN_ID,
          hasTokenSecret: !!process.env.NETSUITE_TOKEN_SECRET
        }
      });
    } catch (error) {
      console.error('NetSuite debug error:', error);
      res.status(500).json({
        success: false,
        message: 'Debug failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Authentication routes
  // NetSuite OIDC login initiation
  app.get('/api/auth/netsuite/oidc/login', async (req, res) => {
    try {
      const { netsuiteOIDCService } = await import('./services/netsuite-oidc');
      
      const status = netsuiteOIDCService.getStatus();
      if (!status.configured) {
        return res.status(400).json({
          success: false,
          message: 'NetSuite OIDC is not configured. Please set NETSUITE_OIDC_CLIENT_ID and NETSUITE_OIDC_CLIENT_SECRET environment variables.'
        });
      }

      const authUrl = await netsuiteOIDCService.getAuthorizationUrl(req);
      res.json({ success: true, authUrl });
    } catch (error) {
      console.error('NetSuite OIDC login error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate NetSuite OIDC login',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // NetSuite OIDC callback
  app.get('/auth/netsuite/oidc/callback', async (req, res) => {
    try {
      const { netsuiteOIDCService } = await import('./services/netsuite-oidc');
      
      // Handle the OIDC callback
      const result = await netsuiteOIDCService.handleCallback(req);
      const userinfo = result.userinfo;
      const tokenSet = result.tokens;
      
      console.log('NetSuite OIDC callback - userinfo:', userinfo);
      
      // Extract customer information from userinfo
      const email = userinfo.email;
      const customerId = userinfo.sub; // Subject is typically the user/customer ID
      
      // Check if user exists in our database
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Create new user from OIDC data
        const newUser = {
          email: email,
          username: email,
          password: '', // No password for OIDC users
          firstName: userinfo.given_name || '',
          lastName: userinfo.family_name || '',
          companyName: userinfo.company || '',
          netsuiteCustomerId: customerId,
          isNetSuiteUser: true,
          customerCenterAccess: true
        };
        
        user = await storage.createUser(newUser);
        console.log('Created new user from NetSuite OIDC:', user.id);
      } else {
        // Update existing user with OIDC data
        await storage.updateUser(user.id, {
          netsuiteCustomerId: customerId,
          isNetSuiteUser: true,
          customerCenterAccess: true
        });
        console.log('Updated existing user with OIDC data:', user.id);
      }
      
      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          netsuiteCustomerId: customerId,
          isNetSuiteUser: true,
          customerCenterAccess: true
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Set session
      req.session.userId = user.id;
      req.session.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        companyName: user.companyName || '',
        netsuiteCustomerId: customerId,
        isNetSuiteUser: true,
        customerCenterAccess: true
      };
      
      // Store tokens in session for API calls
      req.session.oidcTokens = {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        idToken: tokenSet.id_token,
        expiresAt: tokenSet.expires_at
      };
      
      // Redirect to dashboard with token
      res.redirect(`/?token=${token}`);
    } catch (error) {
      console.error('NetSuite OIDC callback error:', error);
      res.redirect('/login?error=oidc_callback_failed');
    }
  });

  // NetSuite OIDC status endpoint
  app.get('/api/auth/netsuite/oidc/status', async (req, res) => {
    try {
      const { netsuiteOIDCService } = await import('./services/netsuite-oidc');
      const status = netsuiteOIDCService.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get OIDC status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Verify customer number endpoint
  app.post('/api/auth/verify-customer', async (req, res) => {
    try {
      const { customerNumber } = req.body;
      
      if (!customerNumber) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer number is required' 
        });
      }
      
      console.log(`Verifying customer number: ${customerNumber}`);
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const customer = await m2m.searchCustomerByEntityId(customerNumber);
      
      if (!customer) {
        return res.json({ 
          success: false, 
          message: 'Customer number not found' 
        });
      }
      
      // Check if customer is inactive
      if (customer.isinactive === 'T') {
        return res.json({ 
          success: false, 
          message: 'Customer account is inactive' 
        });
      }
      
      res.json({ 
        success: true, 
        customer: {
          customerNumber: customer.customernumber,
          companyName: customer.companyname,
          email: customer.email,
          firstName: customer.firstname,
          lastName: customer.lastname
        }
      });
    } catch (error) {
      console.error('Customer verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to verify customer number' 
      });
    }
  });
  
  // Custom login endpoint for direct NetSuite authentication
  app.post('/api/auth/custom-login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      console.log('Custom login attempt for email:', email);
      
      let user = await storage.getUserByEmail(email);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ 
          message: 'Invalid email or password. Please use your NetSuite Customer Center credentials.' 
        });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password || '');
      if (!isValidPassword) {
        return res.status(401).json({ 
          message: 'Invalid email or password' 
        });
      }
      
      // Get customer details from user record
      const customerId = user.netsuiteCustomerId;
      if (!customerId) {
        return res.status(401).json({ 
          message: 'Account not linked to NetSuite Customer Center' 
        });
      }
      
      // Fetch latest companyName from NetSuite and sync
      try {
        if (process.env.NETSUITE_CONSUMER_KEY && process.env.NETSUITE_CONSUMER_SECRET) {
          const { NetSuiteM2M } = await import('./services/netsuite-m2m');
          const m2m = new NetSuiteM2M();
          const customerData = await m2m.getCustomerAccount(customerId);
          if (customerData.companyname && customerData.companyname !== user.companyName) {
            await storage.updateUser(user.id, { companyName: customerData.companyname });
            user = { ...user, companyName: customerData.companyname };
            console.log(`Updated companyName for user ${user.id} to: ${customerData.companyname}`);
          }
        }
      } catch (err: any) {
        console.error('Could not sync companyName from NetSuite:', err.message);
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          netsuiteCustomerId: customerId,
          isNetSuiteUser: true
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      console.log('Custom login successful for:', email);
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          netsuiteCustomerId: customerId,
          isNetSuiteUser: true,
          customerCenterAccess: true
        }
      });
    } catch (error) {
      console.error('Custom login error:', error);
      res.status(500).json({ 
        message: 'Login failed. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Demo mode backdoor login for multiple customers
  app.post('/api/auth/demo', async (req, res) => {
    try {
      // Get customer ID from request body or default to 441667
      const customerId = req.body?.customerId || '441667';
      
      // Define demo customer configurations
      const demoCustomers: Record<string, { email: string; firstName: string; lastName: string; companyName: string }> = {
        '441667': {
          email: 'demo@baloga.com',
          firstName: 'Demo',
          lastName: 'User',
          companyName: '104453 Baloga'
        },
        '154783': {
          email: 'demo@crd154783.com',
          firstName: 'CRD',
          lastName: 'Demo',
          companyName: 'CRD Company'
        }
      };
      
      const customerConfig = demoCustomers[customerId];
      if (!customerConfig) {
        return res.status(400).json({ message: 'Invalid demo customer ID' });
      }
      
      console.log(`Demo mode login - backdoor access for customer ${customerId}`);
      
      let netsuiteCompanyName = customerConfig.companyName;
      try {
        if (process.env.NETSUITE_CONSUMER_KEY && process.env.NETSUITE_CONSUMER_SECRET) {
          const { NetSuiteM2M } = await import('./services/netsuite-m2m');
          const m2m = new NetSuiteM2M();
          const accountData = await m2m.getCustomerAccount(customerId);
          if (accountData && accountData.companyname) {
            netsuiteCompanyName = accountData.companyname;
            console.log(`Fetched company name from NetSuite: ${netsuiteCompanyName}`);
          }
        }
      } catch (err: any) {
        console.log('Could not fetch company name from NetSuite:', err.message);
      }

      // Try to get demo user first
      let user = await storage.getUserByEmail(`demo_${customerId}`);
      
      if (!user) {
        // Check if another user already has this customer ID
        const existingUserWithCustomer = await storage.getUserByNetSuiteCustomerId(customerId);
        
        if (existingUserWithCustomer) {
          // Use the existing user with this customer ID
          user = existingUserWithCustomer;
          console.log(`Using existing user with customer ID ${customerId}:`, user.username);
        } else {
          // Create new demo user
          const hashedPassword = await bcrypt.hash(`demo_password_${customerId}`, 10);
          user = await storage.createUser({
            username: `demo_${customerId}`,
            email: customerConfig.email,
            password: hashedPassword,
            firstName: customerConfig.firstName,
            lastName: customerConfig.lastName,
            companyName: netsuiteCompanyName,
            netsuiteCustomerId: customerId,
          });
          console.log(`Created new demo user with customer ID ${customerId}`);
        }
      } else {
        console.log('Using existing demo user:', user.username);
        await storage.updateUser(user.id, {
          lastLoginAt: new Date(),
          companyName: netsuiteCompanyName,
        });
      }

      const sessionData = {
        userId: user.id,
        username: user.username,
        netsuiteCustomerId: customerId,
        isNetSuiteUser: true,
        customerCenterAccess: true,
        companyName: netsuiteCompanyName
      };

      const token = jwt.sign(
        sessionData,
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: customerConfig.firstName,
          lastName: `${customerConfig.lastName} (Customer ${customerId})`,
          companyName: netsuiteCompanyName,
          netsuiteCustomerId: customerId,
        },
      });
    } catch (error) {
      console.error('Demo login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const identifier = email.trim();
      const isNumericId = /^\d+$/.test(identifier);
      const safeIdentifier = identifier.replace(/'/g, "''");

      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();

      const whereClause = isNumericId
        ? `customer.entityid = '${safeIdentifier}' OR customer.id = '${safeIdentifier}'`
        : `LOWER(customer.email) = LOWER('${safeIdentifier}')`;

      const customerQuery = `
        SELECT 
          customer.id,
          customer.email,
          customer.entityid AS customerNumber,
          customer.companyname,
          customer.firstname,
          customer.lastname,
          customer.custentity_legpw AS legpw,
          customer.custentity_customerstatus AS customerStatus
        FROM 
          customer
        WHERE 
          ${whereClause}
      `.trim();

      let customerResult;
      try {
        customerResult = await m2m.executeSuiteQL(customerQuery, 10, 0);
      } catch (nsError) {
        console.error('NetSuite authentication query failed:', nsError);
        return res.status(500).json({ message: 'Authentication service temporarily unavailable. Please try again later.' });
      }

      if (!customerResult.items || customerResult.items.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      console.log(`NetSuite login: Found ${customerResult.items.length} customers for email ${email}`);
      customerResult.items.forEach((c: any, i: number) => {
        console.log(`  Customer[${i}]: id=${c.id}, entityid=${c.customernumber}, legpw=${c.legpw ? '***set***' : '(empty)'}`);
      });

      const customer = customerResult.items.find((c: any) => c.legpw && c.legpw === password);
      if (!customer) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const customerId = String(customer.id);
      const customerStatus = customer.customerstatus;
      console.log(`NetSuite login: Customer ${customerId} (${email}), status: ${customerStatus}`);

      if (customerStatus === '2' || customerStatus === 2) {
        return res.status(403).json({ 
          message: 'Your Account is on Hold. Speak to a Store Manager for more information.',
          statusCode: 'GLOBAL_HOLD'
        });
      }
      
      if (customerStatus === '3' || customerStatus === 3) {
        return res.status(403).json({ 
          message: 'Your Account has been discontinued.',
          statusCode: 'DISCONTINUED'
        });
      }
      
      if (customerStatus === '7' || customerStatus === 7) {
        return res.status(403).json({ 
          message: 'Your Account is on Contact Hold. Please contact support for assistance.',
          statusCode: 'CONTACT_HOLD'
        });
      }

      const customerEmail = (customer.email || '').toString().toLowerCase();

      // Auto-grant admin to emails listed in ADMIN_EMAILS (comma-separated,
      // case-insensitive). Promote-only: removing an email from the list does
      // NOT demote an existing admin, and admins flagged directly in the DB
      // are unaffected. This survives republishes since production user rows
      // are separate from development.
      const adminEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      // Anchor the grant to the email of the NetSuite record the user actually
      // proved credentials for — never the typed identifier.
      const shouldBeAdmin = adminEmails.includes(customerEmail);

      let user = await storage.getUserByNetSuiteCustomerId(customerId);

      if (!user && customerEmail) {
        user = await storage.getUserByEmail(customerEmail);
      }

      if (user) {
        const updates: Partial<any> = { updatedAt: new Date() };
        if (customer.companyname && customer.companyname !== user.companyName) {
          updates.companyName = customer.companyname;
        }
        if (customer.firstname && customer.firstname !== user.firstName) {
          updates.firstName = customer.firstname;
        }
        if (customer.lastname && customer.lastname !== user.lastName) {
          updates.lastName = customer.lastname;
        }
        if (user.netsuiteCustomerId !== customerId) {
          updates.netsuiteCustomerId = customerId;
        }
        if (shouldBeAdmin && !user.isAdmin) {
          updates.isAdmin = true;
          console.log(`Granting admin access to ${user.email} (listed in ADMIN_EMAILS)`);
        }
        user = (await storage.updateUser(user.id, updates)) || user;
      } else {
        user = await storage.createUser({
          email: customerEmail || identifier.toLowerCase(),
          password: password,
          netsuiteCustomerId: customerId,
          firstName: customer.firstname || null,
          lastName: customer.lastname || null,
          companyName: customer.companyname || null,
          isActive: true,
          isAdmin: shouldBeAdmin,
        });
        console.log(`Created local user ${user.id} for NetSuite customer ${customerId}${shouldBeAdmin ? ' (admin via ADMIN_EMAILS)' : ''}`);
      }

      // Record the sign-in atomically so concurrent logins can't undercount.
      await db.execute(sql`
        UPDATE users SET last_login_at = NOW(), login_count = login_count + 1
        WHERE id = ${user.id}
      `);

      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          netsuiteCustomerId: customerId
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          netsuiteCustomerId: customerId,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user profile endpoint
  app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Refresh companyName from NetSuite in real time
      if (user.netsuiteCustomerId) {
        try {
          if (process.env.NETSUITE_CONSUMER_KEY && process.env.NETSUITE_CONSUMER_SECRET) {
            const { NetSuiteM2M } = await import('./services/netsuite-m2m');
            const m2m = new NetSuiteM2M();
            const customerData = await m2m.getCustomerAccount(user.netsuiteCustomerId);
            if (customerData.companyname && customerData.companyname !== user.companyName) {
              await storage.updateUser(user.id, { companyName: customerData.companyname });
              user = { ...user, companyName: customerData.companyname };
              console.log(`Profile: Updated companyName for user ${user.id} to: ${customerData.companyname}`);
            }
          }
        } catch (err: any) {
          console.error('Profile: Could not sync companyName from NetSuite:', err.message);
        }
      }

      res.json({
        id: user.id.toString(),
        username: user.email,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        companyName: user.companyName || '',
        netsuiteCustomerId: user.netsuiteCustomerId,
        isNetSuiteUser: !!user.netsuiteCustomerId,
        isAdmin: user.isAdmin,
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


  // Request password reset endpoint
  app.post('/api/auth/request-password-reset', async (req, res) => {
    try {
      const { email } = requestPasswordResetSchema.parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: 'If an account exists with this email, a password reset link has been sent' });
      }
      
      // Create reset token
      const resetToken = await storage.createPasswordResetToken(user.id);
      
      // Generate reset URL - use the Replit app URL in production
      const baseUrl = process.env.APP_URL || 
                      (process.env.REPL_SLUG && process.env.REPL_OWNER 
                        ? `https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app`
                        : 'http://localhost:5000');
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken.token}`;
      
      console.log('Password reset URL:', resetUrl);
      
      // Send email via NetSuite RESTlet
      const { netsuiteEmailService } = await import('./services/netsuite-email');
      const emailSent = await netsuiteEmailService.sendPasswordResetEmail(
        email, 
        resetUrl, 
        user.netsuiteCustomerId || undefined
      );
      
      if (emailSent) {
        console.log(`Password reset email sent to ${email} via NetSuite`);
      } else {
        console.log(`Failed to send password reset email to ${email} - NetSuite email service may not be configured`);
      }
      
      // In development, return the URL for testing
      if (process.env.NODE_ENV === 'development') {
        return res.json({ 
          message: emailSent 
            ? 'Password reset email sent successfully' 
            : 'Password reset link generated (email not sent - SendGrid not configured)',
          resetUrl, // Only in development
          emailSent
        });
      }
      
      res.json({ message: 'If an account exists with this email, a password reset link has been sent' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Request password reset error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Reset password endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      
      // Get valid reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      
      // Update password
      const updated = await storage.updatePassword(resetToken.userId, newPassword);
      if (!updated) {
        return res.status(500).json({ message: 'Failed to reset password' });
      }
      
      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);
      
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // NetSuite SSO Routes (Suitelet-based authentication)
  app.get('/api/auth/netsuite', async (req, res) => {
    try {
      const { NetSuiteSSO } = await import('./services/netsuite-sso');
      const sso = new NetSuiteSSO();
      
      // Check if SSO is configured
      if (!process.env.NETSUITE_SSO_SECRET) {
        return res.status(400).json({
          error: 'NetSuite SSO not configured',
          message: 'Please configure NETSUITE_SSO_SECRET environment variable'
        });
      }
      
      // Generate SuiteScript URL for SSO
      const suiteLetURL = sso.generateSuiteLetURL();
      
      res.json({ authUrl: suiteLetURL });
    } catch (error) {
      console.error('SSO initiation error:', error);
      res.status(500).json({ error: 'Failed to initiate SSO flow' });
    }
  });
  
  // SSO callback handler (receives JWT token from NetSuite Suitelet)
  app.get('/api/auth/netsuite/sso', async (req, res) => {
    try {
      const { sso_token } = req.query;
      
      console.log('SSO: Received callback with token:', sso_token ? 'Token present' : 'No token');
      console.log('SSO: Token length:', sso_token ? (sso_token as string).length : 0);
      
      if (!sso_token) {
        return res.redirect('/login?error=missing_token');
      }
      
      const { NetSuiteSSO } = await import('./services/netsuite-sso');
      const sso = new NetSuiteSSO();
      
      // Log token structure for debugging
      const tokenParts = (sso_token as string).split('.');
      console.log('SSO: Token structure - parts:', tokenParts.length);
      if (tokenParts.length !== 3) {
        console.error('SSO: Invalid JWT structure. Expected 3 parts, got', tokenParts.length);
        console.log('SSO: Token sample:', (sso_token as string).substring(0, 50) + '...');
      }
      
      // Verify the JWT token from NetSuite
      const verificationResult = await sso.verifyToken(sso_token as string);
      
      if (!verificationResult.valid || !verificationResult.payload) {
        console.error('SSO token verification failed:', verificationResult.error);
        console.error('SSO: Secret configured:', process.env.NETSUITE_SSO_SECRET ? 'Yes' : 'No');
        return res.redirect(`/login?error=${encodeURIComponent(verificationResult.error || 'Invalid token')}`);
      }
      
      // Process SSO and create/update user
      const user = await sso.processSSO(verificationResult.payload);
      
      // Create JWT for our application with customer center access
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          netsuiteCustomerId: user.netsuiteCustomerId,
          isNetSuiteUser: true,
          ssoUser: true,
          customerCenterAccess: true
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Redirect to frontend with token
      res.redirect(`/auth/netsuite/callback?token=${token}`);
      
    } catch (error) {
      console.error('SSO callback error:', error);
      res.redirect(`/login?error=${encodeURIComponent('Authentication failed')}`);
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = registrationSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      
      // Search for customer in NetSuite using entityid (customer number)
      console.log(`Searching for customer with entityid: ${userData.netsuiteCustomerId}`);
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const customer = await m2m.searchCustomerByEntityId(userData.netsuiteCustomerId);
      
      if (!customer) {
        return res.status(400).json({ 
          message: 'Customer number not found in NetSuite. Please verify your customer number and try again.' 
        });
      }
      
      // Check if customer is inactive
      if (customer.isinactive === 'T') {
        return res.status(400).json({ 
          message: 'This customer account is inactive. Please contact support for assistance.' 
        });
      }
      
      // Check customer status (custentity_customerstatus)
      // 1 = Active, 2 = Global Hold, 3 = Discontinued, 5 = Pre-Registration, 7 = Contact Hold
      const customerStatus = customer.customerstatus;
      console.log(`Customer status for ${customer.customernumber}: ${customerStatus}`);
      
      if (customerStatus === '2' || customerStatus === 2) {
        return res.status(403).json({ 
          message: 'Your Account is on Hold. Speak to a Store Manager for more information.',
          statusCode: 'GLOBAL_HOLD'
        });
      }
      
      if (customerStatus === '3' || customerStatus === 3) {
        return res.status(403).json({ 
          message: 'Your Account has been discontinued.',
          statusCode: 'DISCONTINUED'
        });
      }
      
      if (customerStatus === '7' || customerStatus === 7) {
        return res.status(403).json({ 
          message: 'Your Account is on Contact Hold. Please contact support for assistance.',
          statusCode: 'CONTACT_HOLD'
        });
      }
      
      const internalId = customer.internalid;
      console.log(`Found customer: ${customer.customernumber} (Internal ID: ${internalId})`);
      
      // Check if NetSuite internal ID is already in use
      const existingCustomer = await storage.getUserByNetSuiteCustomerId(internalId);
      if (existingCustomer) {
        return res.status(400).json({ message: 'This customer is already registered' });
      }
      
      // Create user with internal ID (password will be hashed in storage layer)
      // Pull firstName, lastName, and companyName from NetSuite customer data
      const user = await storage.createUser({
        email: userData.email,
        password: userData.password,
        netsuiteCustomerId: internalId, // Store internal ID, not entityid
        firstName: customer.firstname || null,
        lastName: customer.lastname || null,
        companyName: customer.companyname || null,
        isActive: true
      });

      // Welcome email sending is disabled
      // const { netsuiteEmailService } = await import('./services/netsuite-email');
      // const emailSent = await netsuiteEmailService.sendWelcomeEmail(
      //   userData.email, 
      //   internalId // Use internal ID for email service
      // );
      
      // if (emailSent) {
      //   console.log(`Welcome email sent to ${userData.email} via NetSuite`);
      // } else {
      //   console.log(`Failed to send welcome email to ${userData.email} - NetSuite email service may not be configured`);
      // }
      const emailSent = false; // Welcome emails are disabled

      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          netsuiteCustomerId: internalId
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          netsuiteCustomerId: internalId
        },
        emailSent // Include email status in development
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Dashboard data - Aggregate from NetSuite
  app.get('/api/dashboard', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning database dashboard');
        const dashboardData = await storage.getUserDashboardData(req.user.id);
        return res.json(dashboardData);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // De-duplicated fetch. Previously this fired 9 parallel NetSuite calls,
      // including DUPLICATE limit-5 AND limit-100 fetches of orders/estimates/cases
      // (the limit-100 sets existed only to COUNT in JS — capped at 100, so inexact).
      // Now: fetch each display list ONCE (limit 5) and get EXACT counts from SuiteQL
      // aggregates via getDashboardCounts (2 calls). The account is reused from
      // validateCustomerAccess's 60s cache (req.nsCustomerAccount) instead of refetched.
      //
      // Legacy 9-call fan-out preserved per house rule:
      //   const [account, orders, invoices, payments, estimates, cases, allOrders, allEstimates, allCases] = await Promise.all([
      //     m2m.getCustomerAccount(...),       m2m.getCustomerOrders(...,5),  m2m.getCustomerInvoices(...,5),
      //     m2m.getCustomerPayments(...,5),     m2m.getCustomerEstimates(...,5), m2m.getCustomerCases(...,5),
      //     m2m.getCustomerOrders(...,100),     m2m.getCustomerEstimates(...,100), m2m.getCustomerCases(...,100) ]);
      //   // counts were allOrders/allEstimates/allCases .filter(...).length — capped at 100
      const customerId = req.user.netsuiteCustomerId;
      const [orders, invoices, payments, estimates, cases, counts] = await Promise.all([
        m2m.getCustomerOrders(customerId, 5).catch(err => {
          console.error('Failed to fetch orders:', err);
          return [];
        }),
        m2m.getCustomerInvoices(customerId, 5).catch(err => {
          console.error('Failed to fetch invoices:', err);
          return [];
        }),
        m2m.getCustomerPayments(customerId, 5).catch(err => {
          console.error('Failed to fetch payments:', err);
          return [];
        }),
        m2m.getCustomerEstimates(customerId, 5).catch(err => {
          console.error('Failed to fetch estimates:', err);
          return [];
        }),
        // limit is the 3rd arg of getCustomerCases (2nd is an unused email param);
        // 30 matches the previous effective behavior, then we slice(0,5) for display.
        m2m.getCustomerCases(customerId, undefined, 30).catch(err => {
          console.error('Failed to fetch cases:', err);
          return [];
        }),
        m2m.getDashboardCounts(customerId).catch(err => {
          console.error('Failed to fetch dashboard counts:', err);
          return null;
        }),
      ]);

      // Reuse the account fetched (and cached) by validateCustomerAccess to avoid a
      // duplicate getCustomerAccount (2 SuiteQL). Fall back to a fetch if absent.
      let account = req.nsCustomerAccount ?? null;
      if (!account) {
        account = await m2m.getCustomerAccount(customerId).catch(err => {
          console.error('Failed to fetch account:', err);
          return null;
        });
      }
      
      // Map NetSuite status codes to friendly names (same logic as /api/orders)
      const mapOrderStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
          'A': 'pending approval',
          'B': 'pending fulfillment',
          'C': 'cancelled',
          'D': 'partially fulfilled',
          'E': 'partially fulfilled',
          'F': 'pending billing',
          'G': 'fully billed',
          'H': 'closed',
        };
        return statusMap[status] || status.toLowerCase();
      };
      
      // Exact counts from SuiteQL aggregates (getDashboardCounts). Degrade to
      // display-list approximations only if the count query is unavailable.
      // Legacy approach (counted limit-100 lists in JS — capped at 100, inexact):
      //   const activeOrdersCount   = allOrders.filter(o => active(o)).length;
      //   const activeEstimatesCount= allEstimates.filter(...).length;
      //   const openCasesCount      = allCases.filter(c => c.status != 5).length;
      //   const pendingOrdersCount  = allOrders.filter(o => pending(o)).length;
      let activeOrdersCount: number;
      let pendingOrdersCount: number;
      let activeEstimatesCount: number;
      let openCasesCount: number;
      if (counts) {
        activeOrdersCount = counts.activeOrders;
        pendingOrdersCount = counts.pendingOrders;
        activeEstimatesCount = counts.activeEstimates;
        openCasesCount = counts.openCases;
      } else {
        console.warn('Dashboard counts unavailable from SuiteQL; using display-list counts (may undercount beyond the 5 fetched).');
        activeOrdersCount = orders.filter((order: any) => {
          const mapped = mapOrderStatus(order.status);
          return mapped !== 'closed' && mapped !== 'fully billed' && mapped !== 'cancelled';
        }).length;
        pendingOrdersCount = orders.filter((order: any) => {
          const mapped = mapOrderStatus(order.status);
          return mapped === 'pending' || mapped === 'pending approval' || mapped === 'pending fulfillment';
        }).length;
        activeEstimatesCount = estimates.filter((estimate: any) =>
          estimate.status && !['Closed', 'Voided', 'Rejected'].includes(estimate.status)
        ).length;
        openCasesCount = cases.filter((supportCase: any) =>
          supportCase.status !== '5' && supportCase.status !== 5
        ).length;
      }
      
      // activeEstimatesCount / openCasesCount / pendingOrdersCount are now computed
      // exactly in the counts block above (from getDashboardCounts), so the legacy
      // limit-100 JS-filter versions that lived here were removed (preserved as
      // comments in that block).

      const outstandingInvoices = invoices.filter((invoice: any) =>
        parseFloat(invoice.balancedue || invoice.amountremaining || '0') > 0
      );
      
      // Calculate monthly total (sum of payments in current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyPayments = payments.filter((payment: any) => {
        const paymentDate = new Date(payment.paymentdate || payment.trandate);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      });
      const monthlyTotal = monthlyPayments.reduce((sum: number, payment: any) => 
        sum + parseFloat(payment.amount || payment.total || '0'), 0
      ).toFixed(2);
      
      // Transform data for dashboard
      const dashboardData = {
        account: account ? {
          balance: account.balance || '0.00',
          creditLimit: account.creditlimit || '0.00',
          crdRebateBalance: account.crdrebatebalance || '0.00',
          dataFreshness: 'live' as const
        } : null,
        recentOrders: orders.slice(0, 5).map((order: any) => ({
          id: order.id,
          orderNumber: order.ordernumber || order.tranid,
          status: mapOrderStatus(order.status),
          totalAmount: order.total || '0.00',
          currency: 'USD',
          orderDate: order.orderdate || order.trandate,
          tagFor: order.tagfor || '',
          memo: order.memo || ''
        })),
        recentPayments: payments.slice(0, 5).map((payment: any) => ({
          id: payment.id,
          paymentNumber: payment.paymentnumber || payment.tranid,
          amount: payment.amount || payment.total || '0.00',
          paymentDate: payment.paymentdate || payment.trandate
        })),
        outstandingInvoices: outstandingInvoices.slice(0, 5).map((invoice: any) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoicenumber || invoice.tranid,
          amount: invoice.total || '0.00',
          balanceDue: invoice.balancedue || invoice.amountremaining || '0.00',
          dueDate: invoice.duedate
        })),
        recentEstimates: estimates.slice(0, 5).map((estimate: any) => ({
          id: estimate.id,
          estimateNumber: estimate.documentnumber || estimate.tranid,
          status: estimate.status,
          amount: estimate.total || '0.00',
          estimateDate: estimate.date || estimate.trandate,
          expiryDate: estimate.expirationdate || estimate.duedate,
          customerName: estimate.customername
        })),
        recentCases: cases.slice(0, 5).map((supportCase: any) => ({
          id: supportCase.id,
          caseNumber: supportCase.casenumber,
          subject: supportCase.title || supportCase.subject,
          status: supportCase.status,
          priority: supportCase.priority,
          createdDate: supportCase.createddate,
          lastModified: supportCase.lastmodifieddate
        })),
        pendingOrdersCount,
        monthlyTotal,
        // Add accurate counts for dashboard tiles
        totalCounts: {
          activeOrders: activeOrdersCount,
          activeEstimates: activeEstimatesCount, 
          openCases: openCasesCount
        },
        metrics: {
          dataFreshness: 'live' as const,
          lastSyncAt: new Date().toISOString()
        }
      };
      
      res.json(dashboardData);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
  });

  // Orders - Fetch from NetSuite using SuiteQL
  app.get('/api/orders', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning database orders');
        const orders = await storage.getUserOrders(req.user.id, limit);
        return res.json(orders);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Map NetSuite status codes to friendly names
      const mapStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
          'A': 'pending approval',
          'B': 'pending fulfillment',
          'C': 'cancelled',
          'D': 'partially fulfilled',
          'E': 'partially fulfilled',
          'F': 'pending billing',
          'G': 'fully billed',
          'H': 'closed',
        };
        return statusMap[status] || status.toLowerCase();
      };
      
      // Transform NetSuite data to match frontend format
      const transformOrder = (item: any) => ({
        id: item.id,
        orderNumber: item.ordernumber || item.tranid,
        status: mapStatus(item.status),
        totalAmount: item.total || '0.00',
        currency: 'USD',
        orderDate: item.orderdate || item.trandate,
        targetReceiptDate: item.custbody_target_receipt_date || null,
        shipDate: item.shipdate,
        shipMethod: item.shipmethod,
        deliveryDate: null,
        trackingNumber: null,
        shippingAddress: null,
        memo: item.memo || '',
        tagFor: item.tagfor || '',
        customerName: item.customername,
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      });
      
      const orders = await m2m.getCustomerOrders(req.user.netsuiteCustomerId, limit);

      const transformed = orders.map(transformOrder);
      res.json(transformed);
    } catch (error: any) {
      console.error('Error fetching orders from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch orders from NetSuite' });
    }
  });

  app.get('/api/orders/:id', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        const order = await storage.getOrder(req.params.id);
        if (!order || order.userId !== req.user.id) {
          return res.status(404).json({ message: 'Order not found' });
        }
        return res.json(order);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Map NetSuite status codes to friendly names
      const mapStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
          'A': 'pending approval',
          'B': 'pending fulfillment',
          'C': 'cancelled',
          'D': 'partially fulfilled',
          'E': 'partially fulfilled',
          'F': 'pending billing',
          'G': 'fully billed',
          'H': 'closed',
        };
        return statusMap[status] || status.toLowerCase();
      };
      
      // Fetch order details with line items from NetSuite
      const [orderDetails, recordFields] = await Promise.all([
        m2m.getOrderDetails(req.params.id),
        m2m.getRecordField('salesOrder', req.params.id, ['custbody_balance_due'])
      ]);
      
      // Log the raw data to understand what NetSuite is returning
      console.log('Raw NetSuite order data:', JSON.stringify(orderDetails, null, 2));
      
      // Transform the response to match frontend expectations
      const transformed = {
        id: orderDetails.id,
        orderNumber: orderDetails.ordernumber || orderDetails.tranid,
        status: mapStatus(orderDetails.status),
        orderDate: orderDetails.orderdate || orderDetails.trandate,
        targetReceiptDate: orderDetails.custbody_target_receipt_date || null,
        shipDate: orderDetails.shipdate,
        deliveryDate: null,
        totalAmount: orderDetails.total || '0.00',
        balanceDue: recordFields?.custbody_balance_due ?? '0.00',
        subtotal: orderDetails.subtotal || '0.00',
        tax: orderDetails.tax || '0.00',
        discountTotal: orderDetails.discounttotal || '0',
        shipping: orderDetails.shipping || '0.00',
        currency: 'USD',
        shippingAddress: orderDetails.shippingaddress,
        billingAddress: orderDetails.billingaddress,
        trackingNumber: null,
        memo: orderDetails.memo,
        tagFor: orderDetails.tagfor || '',
        customerName: orderDetails.customername,
        salesRepPreferredName: orderDetails.salesreppreferredname || '',
        items: orderDetails.lineItems ? orderDetails.lineItems.map((item: any) => ({
          id: item.lineid,
          lineNumber: item.linenumber,
          itemName: item.itemname,
          itemId: item.itemid,
          quantity: item.quantity || 0,
          rate: item.rate || '0.00',
          amount: item.amount || '0.00',
          description: item.description || '',
          discountPercent: item.discountpercent,
          itemType: item.itemtype,
          itemDisplayName: item.itemdisplayname,
          itemDescription: item.itemdescription,
          cabBuildId: item.cabbuildid,
          cntrBuildId: item.cntrbuildid
        })) : [],
        praDetails: orderDetails.praDetails ? orderDetails.praDetails.map((pra: any) => ({
          praId: pra.praid,
          praNumber: pra.pranumber,
          praCode: pra.pracode,
          praCodeName: pra.pracodename,
          discountRate: pra.discountrate,
          postedAmount: pra.postedamount,
          praType: pra.pratype,
          praDescription: pra.pradescription
        })) : [],
        files: orderDetails.files ? orderDetails.files.map((file: any) => ({
          fileId: file.fileid,
          fileName: file.filename,
          fileDescription: file.filedescription,
          fileType: file.filetype,
          fileSize: file.filesize,
          fileUrl: file.fileurl,
          createdDate: file.createddate,
          lastModifiedDate: file.lastmodifieddate,
          messageSubject: file.messagesubject,
          messageDate: file.messagedate
        })) : [],
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      };
      
      res.json(transformed);
    } catch (error: any) {
      console.error('Order detail error:', error);
      res.status(500).json({ message: 'Failed to fetch order details' });
    }
  });

  // Payments - Fetch from NetSuite using SuiteQL
  app.get('/api/payments', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning empty payments');
        return res.json([]);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Transform NetSuite data to match frontend format
      const transformPayment = (item: any) => {
        // Parse the amount - NetSuite may return it as a string
        const amount = parseFloat(item.amount || item.total || '0').toFixed(2);
        
        // Determine payment method based on common patterns
        let paymentMethod = 'bank_transfer';
        if (item.memo && item.memo.toLowerCase().includes('check')) {
          paymentMethod = 'check';
        } else if (item.memo && item.memo.toLowerCase().includes('card')) {
          paymentMethod = 'credit_card';
        } else if (item.memo && item.memo.toLowerCase().includes('cash')) {
          paymentMethod = 'cash';
        }
        
        return {
          id: item.id,
          paymentNumber: item.paymentNumber || item.tranid || `PMT-${item.id}`,
          amount: amount,
          paymentDate: item.paymentDate || item.trandate || item.createddate,
          paymentMethod: paymentMethod,
          referenceNumber: item.tranid || null,
          status: 'processed', // All payments in NetSuite are processed
          currency: 'USD',
          memo: item.memo || '',
          customerName: item.customerName || item.customername,
          dataFreshness: 'live' as const,
          lastSyncAt: new Date().toISOString()
        };
      };
      
      console.log('Fetching payments for customer:', req.user.netsuiteCustomerId);
      const payments = await m2m.getCustomerPayments(req.user.netsuiteCustomerId, limit);
      console.log(`Found ${payments.length} payments from NetSuite`);
      
      const transformed = payments.map(transformPayment);
      res.json(transformed);
    } catch (error: any) {
      console.error('Error fetching payments from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch payments from NetSuite' });
    }
  });

  // Invoices - Fetch from NetSuite using SuiteQL
  app.get('/api/invoices', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning database invoices');
        const invoices = await storage.getUserInvoices(req.user.id, limit);
        return res.json(invoices);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Map NetSuite status codes to friendly names
      const mapStatus = (status: string, balanceDue: string): string => {
        if (parseFloat(balanceDue || '0') > 0) {
          return 'open';
        }
        return 'paid';
      };
      
      // Transform NetSuite data to match frontend format
      const transformInvoice = (item: any) => ({
        id: item.id,
        invoiceNumber: item.invoicenumber || item.invoiceNumber || item.tranid,
        status: mapStatus(item.status, item.balancedue || item.balanceDue || item.amountremaining),
        amount: item.total || '0.00',
        balanceDue: item.balancedue || item.balanceDue || item.amountremaining || '0.00',
        invoiceDate: item.invoicedate || item.invoiceDate || item.trandate,
        dueDate: item.duedate || item.dueDate,
        memo: item.memo || '',
        customerName: item.customername || item.customerName,
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      });
      
      const invoices = await m2m.getCustomerInvoices(req.user.netsuiteCustomerId, limit);
      const transformed = invoices.map(transformInvoice);
      res.json(transformed);
    } catch (error: any) {
      console.error('Error fetching invoices from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch invoices from NetSuite' });
    }
  });

  // Account - Fetch from NetSuite using SuiteQL
  app.get('/api/account', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning database account');
        const account = await storage.getUserAccount(req.user.id);
        if (!account) {
          return res.status(404).json({ message: 'Account not found' });
        }
        return res.json(account);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const accountData = await m2m.getCustomerAccount(req.user.netsuiteCustomerId);
      
      // Transform NetSuite data to match frontend format
      const transformedAccount = {
        id: accountData.id,
        customerNumber: accountData.customernumber || accountData.customerNumber || accountData.entityid,
        companyName: accountData.companyname || accountData.companyName,
        balance: accountData.balance || '0.00',
        creditLimit: accountData.creditlimit || accountData.creditLimit || '0.00',
        creditHold: accountData.credithold || accountData.creditHold || false,
        daysOverdue: accountData.daysoverdue || accountData.daysOverdue || 0,
        email: accountData.email,
        phone: accountData.phone,
        altPhone: accountData.altphone,
        mobilePhone: accountData.phone,
        defaultAddress: accountData.defaultaddress || accountData.defaultAddress,
        unbilledOrders: accountData.unbilledorders || accountData.unbilledOrders || '0.00',
        depositBalance: accountData.depositbalance || accountData.depositBalance || '0.00',
        paymentTerms: accountData.paymentterms || accountData.paymentTerms || 'Net 30',
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      };
      
      res.json(transformedAccount);
    } catch (error: any) {
      console.error('Error fetching account from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch account from NetSuite' });
    }
  });

  // ---- Account contact-info updates (phone validation + NetSuite write-back) ----
  app.post('/api/account/update', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      if (!req.user.netsuiteCustomerId) {
        return res.status(400).json({ message: 'No NetSuite customer linked to this account' });
      }

      const schema = z.object({
        email: z.string().email('Please enter a valid email address').optional(),
        mobilePhone: z.string().optional(),
        altPhone: z.string().optional(),
        address: z.object({
          addr1: z.string().min(1, 'Street address is required'),
          addr2: z.string().optional(),
          city: z.string().min(1, 'City is required'),
          state: z.string().min(2, 'State is required'),
          zip: z.string().min(5, 'ZIP code is required'),
        }).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Invalid request' });
      }
      const { email, mobilePhone, altPhone, address } = parsed.data;

      if (email === undefined && mobilePhone === undefined && altPhone === undefined && !address) {
        return res.status(400).json({ message: 'Nothing to update' });
      }

      // --- Phones: validate line type via Twilio Lookup ---
      const { lookupPhone } = await import('./services/twilio-lookup');
      let mobileFormatted: string | undefined;
      let altFormatted: string | undefined;

      if (mobilePhone !== undefined && mobilePhone.trim() !== '') {
        const result = await lookupPhone(mobilePhone);
        if (!result.valid || !result.e164) {
          return res.status(400).json({ message: 'The mobile phone number is not a valid US phone number' });
        }
        if (result.lineType !== 'mobile') {
          return res.status(400).json({ message: `The mobile phone number appears to be a ${result.lineType === 'landline' ? 'landline' : result.lineType || 'non-mobile'} number. Please enter a mobile number.` });
        }
        mobileFormatted = result.nationalFormat || result.e164;
      }

      if (altPhone !== undefined && altPhone.trim() !== '') {
        const result = await lookupPhone(altPhone);
        if (!result.valid || !result.e164) {
          return res.status(400).json({ message: 'The alternate phone number is not a valid US phone number' });
        }
        if (result.lineType !== 'landline') {
          return res.status(400).json({ message: `The alternate phone number appears to be a ${result.lineType === 'mobile' ? 'mobile' : result.lineType || 'non-landline'} number. Please enter a landline number.` });
        }
        altFormatted = result.nationalFormat || result.e164;
      }

      // --- Write back to NetSuite ---
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();

      await m2m.updateCustomerContactInfo(req.user.netsuiteCustomerId, {
        ...(email !== undefined ? { email: email.trim() } : {}),
        ...(mobileFormatted !== undefined ? { mobilePhone: mobileFormatted } : {}),
        ...(altFormatted !== undefined ? { altphone: altFormatted } : {}),
      });

      if (address) {
        // Validate that the ZIP exists and matches the city/state
        const { lookupZip } = await import('./services/zip-validate');
        const zipInfo = await lookupZip(address.zip);
        if (zipInfo && !zipInfo.exists) {
          return res.status(400).json({ message: `${address.zip.trim().slice(0, 5)} is not a valid US ZIP code` });
        }
        if (zipInfo && zipInfo.exists) {
          if (zipInfo.state && zipInfo.state.toUpperCase() !== address.state.trim().toUpperCase()) {
            return res.status(400).json({ message: `ZIP code ${address.zip.trim().slice(0, 5)} is in ${zipInfo.state}, not ${address.state.trim().toUpperCase()}. Please check the ZIP or state.` });
          }
          const cityGiven = address.city.trim().toLowerCase();
          const cityOk = (zipInfo.placeNames || []).some((p) => p.toLowerCase() === cityGiven);
          if (!cityOk) {
            return res.status(400).json({ message: `ZIP code ${address.zip.trim().slice(0, 5)} belongs to ${zipInfo.city}, ${zipInfo.state} — not ${address.city.trim()}. Please check the ZIP or city.` });
          }
        }
        // zipInfo === null means the validation service was unreachable — allow the save rather than blocking the user
        await m2m.updateDefaultAddress(req.user.netsuiteCustomerId, address);
      }

      // Keep the local user record's email in sync
      if (email !== undefined) {
        await storage.updateUser(req.user.id, { email: email.trim() } as any).catch((e) =>
          console.error('Local email sync failed:', e));
      }

      // Invalidate cached NetSuite data for this customer so the UI refreshes
      await invalidateCustomer(req.user.netsuiteCustomerId).catch(() => {});

      res.json({ message: 'Contact information updated' });
    } catch (error: any) {
      console.error('Account update error:', error);
      res.status(500).json({ message: error?.message || 'Failed to update contact information' });
    }
  });

  // Cabinet Build Details - Fetch from NetSuite using SuiteQL
  app.get('/api/cabinet-build/:buildId', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const { buildId } = req.params;
      
      // Check if NetSuite M2M is configured
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.status(400).json({ message: 'NetSuite M2M not configured' });
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Determine if this is a build ID (numeric) or order number (starts with SO)
      const isOrderNumber = buildId.startsWith('SO');
      
      // Query for cabinet build details with specific fields
      const query = isOrderNumber ? `
        SELECT 
          cb.id,
          cb.name AS cabBuildId,
          BUILTIN.DF(cb.custrecord_cabbuild_prodline) AS prodLine,
          BUILTIN.DF(cb.custrecord_cabbuild_material) AS material,
          BUILTIN.DF(cb.custrecord_cabbuild_updoorstyle) AS upperDoorStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_lowdoorstyle) AS lowerDoorStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_cabconstr) AS cabinetConstruction,
          BUILTIN.DF(cb.custrecord_cabbuild_cabstyle) AS cabinetStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_hinge) AS hingeType,
          BUILTIN.DF(cb.custrecord_cabbuild_drawerconstr) AS drawerConstruction,
          BUILTIN.DF(cb.custrecord_cabbuild_drawerstyle) AS drawerStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_extfinish) AS exteriorFinish,
          BUILTIN.DF(cb.custrecord_cabbuild_treatment) AS treatment,
          cb.custrecord_cabbuild_memo AS memo
        FROM customrecord_cabbuild cb
        WHERE cb.custrecord_cabbuild_salesorder IN (
          SELECT id FROM transaction WHERE tranid = '${buildId}'
        )
        FETCH FIRST 1 ROWS ONLY
      ` : `
        SELECT 
          cb.id,
          cb.name AS cabBuildId,
          BUILTIN.DF(cb.custrecord_cabbuild_prodline) AS prodLine,
          BUILTIN.DF(cb.custrecord_cabbuild_material) AS material,
          BUILTIN.DF(cb.custrecord_cabbuild_updoorstyle) AS upperDoorStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_lowdoorstyle) AS lowerDoorStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_cabconstr) AS cabinetConstruction,
          BUILTIN.DF(cb.custrecord_cabbuild_cabstyle) AS cabinetStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_hinge) AS hingeType,
          BUILTIN.DF(cb.custrecord_cabbuild_drawerconstr) AS drawerConstruction,
          BUILTIN.DF(cb.custrecord_cabbuild_drawerstyle) AS drawerStyle,
          BUILTIN.DF(cb.custrecord_cabbuild_extfinish) AS exteriorFinish,
          BUILTIN.DF(cb.custrecord_cabbuild_treatment) AS treatment,
          cb.custrecord_cabbuild_memo AS memo
        FROM customrecord_cabbuild cb
        WHERE cb.id = ${buildId}
      `;
      
      const result = await m2m.executeSuiteQL(query, 1, 0);
      
      if (!result || !result.items || result.items.length === 0) {
        return res.status(404).json({ message: 'Cabinet build details not found' });
      }
      
      res.json(result.items[0]);
    } catch (error: any) {
      console.error('Error fetching cabinet build details from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch cabinet build details' });
    }
  });
  
  // Counter Build Details - Fetch from NetSuite using SuiteQL
  app.get('/api/counter-build/:buildId', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const { buildId } = req.params;
      
      // Check if NetSuite M2M is configured
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.status(400).json({ message: 'NetSuite M2M not configured' });
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Determine if this is a build ID (numeric) or order number (starts with SO)
      const isOrderNumber = buildId.startsWith('SO');
      
      // Query for counter build details by ID or order number
      const query = isOrderNumber ? `
        SELECT 
          cb.id,
          cb.name AS cntrBuildId,
          BUILTIN.DF(cb.custrecord_cntrbuild_customer) AS customer,
          BUILTIN.DF(cb.custrecord_cntrbuild_salesorder) AS salesOrder,
          BUILTIN.DF(cb.custrecord_cntrbuild_material) AS material,
          BUILTIN.DF(cb.custrecord_cntrbuild_edge) AS edge,
          BUILTIN.DF(cb.custrecord_cntrbuild_backsplash) AS backsplash,
          BUILTIN.DF(cb.custrecord_cntrbuild_thickness) AS thickness
        FROM customrecord_cntrbuild cb
        WHERE cb.custrecord_cntrbuild_salesorder IN (
          SELECT id FROM transaction WHERE tranid = '${buildId}'
        )
        FETCH FIRST 1 ROWS ONLY
      ` : `
        SELECT 
          cb.id,
          cb.name AS cntrBuildId,
          BUILTIN.DF(cb.custrecord_cntrbuild_customer) AS customer,
          BUILTIN.DF(cb.custrecord_cntrbuild_salesorder) AS salesOrder,
          BUILTIN.DF(cb.custrecord_cntrbuild_material) AS material,
          BUILTIN.DF(cb.custrecord_cntrbuild_edge) AS edge,
          BUILTIN.DF(cb.custrecord_cntrbuild_backsplash) AS backsplash,
          BUILTIN.DF(cb.custrecord_cntrbuild_thickness) AS thickness
        FROM customrecord_cntrbuild cb
        WHERE cb.id = ${buildId}
      `;
      
      const result = await m2m.executeSuiteQL(query, 1, 0);
      
      if (!result || !result.items || result.items.length === 0) {
        return res.status(404).json({ message: 'Counter build details not found' });
      }
      
      res.json(result.items[0]);
    } catch (error: any) {
      console.error('Error fetching counter build details from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch counter build details' });
    }
  });

  // Customer Contacts - Fetch from NetSuite using SuiteQL
  app.get('/api/customer-contacts', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning empty contacts');
        return res.json([]);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const contacts = await m2m.getCustomerContacts(req.user.netsuiteCustomerId);
      
      // Transform contacts to match frontend format
      const transformedContacts = contacts.map((contact: any) => {
        // Use displayname if available, otherwise try to build from first/last name or entityid
        let fullName = contact.displayname || 
                       `${contact.firstname || ''} ${contact.lastname || ''}`.trim() ||
                       contact.entityid || 
                       `Contact ${contact.id}`;
        
        // Check if contact is primary (role -10); -20 is NetSuite's built-in Alternate Contact
        const roleCode = String(contact.contactrole ?? '');
        const isPrimary = roleCode === '-10';
        const roleDisplay = isPrimary
          ? 'Primary Contact'
          : roleCode === '-20'
            ? 'Alternate Contact'
            : (contact.role && !/^-?\d+$/.test(String(contact.role)) ? contact.role : '');
        
        // Address is not available for contact records in NetSuite
        const address = '';
        
        return {
          id: contact.id,
          firstName: contact.firstname || '',
          lastName: contact.lastname || '',
          fullName: fullName,
          email: contact.email || '',
          phone: contact.phone || '',
          mobilePhone: contact.mobilephone || '',
          bestPhone: contact.custentity_best_phone || '',
          title: contact.title || '',
          role: roleDisplay,
          address: address,
          isPrimary: isPrimary,
          dataFreshness: 'live' as const,
          lastSyncAt: new Date().toISOString()
        };
      });
      
      res.json(transformedContacts);
    } catch (error: any) {
      console.error('Error fetching contacts from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch contacts from NetSuite' });
    }
  });

  // Add an alternate contact: creates a NetSuite contact (role: Alternate Contact) + a portal login
  app.post('/api/customer-contacts', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      if (!req.user.netsuiteCustomerId) {
        return res.status(400).json({ message: 'No NetSuite customer linked to this account' });
      }

      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        phone: z.string().min(7, 'Phone is required'),
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(4, 'Password must be at least 4 characters'),
        verifyPassword: z.string(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Invalid request' });
      }
      const { name, phone, email, password, verifyPassword } = parsed.data;

      if (password !== verifyPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }

      // Password must differ from every existing portal login on this account
      // (including the primary contact's), regardless of who is making the request.
      const accountUsers = await storage.getUsersByNetSuiteCustomerId(req.user.netsuiteCustomerId);
      for (const u of accountUsers) {
        if (u.isActive && u.password && await bcrypt.compare(password, u.password)) {
          return res.status(400).json({ message: 'Password cannot be the same as another contact\'s password on this account' });
        }
      }
      const primaryUser = accountUsers.find(u => u.id === req.user.id) || await storage.getUser(req.user.id);

      // Email must not already have a portal login
      const existing = await storage.getUserByEmail(email.trim());
      if (existing) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }

      // Must also differ from the account's Dealer Website Password in NetSuite
      // (covers the primary's password even when it was set directly in NetSuite)
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      try {
        const dealerQ = await m2m.executeSuiteQL(
          `SELECT custentity_legpw FROM customer WHERE id = ${req.user.netsuiteCustomerId}`, 1, 0
        );
        const dealerPw = dealerQ.items?.[0]?.custentity_legpw;
        if (dealerPw && password === String(dealerPw)) {
          return res.status(400).json({ message: 'Password cannot be the same as another contact\'s password on this account' });
        }
      } catch (e) {
        console.error('Could not check Dealer Website Password:', e);
      }

      // Validate phone format only (10-digit US number) — no carrier lookup needed here
      const phoneDigits = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
      if (phoneDigits.length !== 10) {
        return res.status(400).json({ message: 'Please enter a 10-digit US phone number' });
      }
      const formattedPhone = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;

      const trimmed = name.trim().replace(/\s+/g, ' ');
      const lastSpace = trimmed.lastIndexOf(' ');
      const firstName = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
      const lastName = lastSpace > 0 ? trimmed.slice(lastSpace + 1) : '';

      // Create the NetSuite contact
      const newContactId = await m2m.createRecord('contact', {
        firstName,
        ...(lastName ? { lastName } : {}),
        company: { id: req.user.netsuiteCustomerId },
        email: email.trim(),
        phone: formattedPhone,
      });

      // Create the portal login for the new contact (createUser hashes the password).
      // If this fails, delete the NetSuite contact so we don't leave an orphan.
      try {
        await storage.createUser({
          email: email.trim(),
          password,
          netsuiteCustomerId: req.user.netsuiteCustomerId,
          firstName,
          lastName: lastName || null,
          companyName: primaryUser?.companyName || null,
        } as any);
      } catch (userErr) {
        console.error('Portal user creation failed, rolling back NetSuite contact:', userErr);
        if (newContactId) {
          await m2m.deleteRecord('contact', newContactId).catch(e =>
            console.error('Rollback of NetSuite contact failed:', e));
        }
        throw new Error('Could not create the portal login for this contact. Please try again.');
      }

      await invalidateCustomer(req.user.netsuiteCustomerId).catch(() => {});
      res.json({ message: 'Contact added' });
    } catch (error: any) {
      console.error('Add contact error:', error);
      res.status(500).json({ message: error?.message || 'Failed to add contact' });
    }
  });

  // Remove an alternate contact (NetSuite contact + portal login). Primary contacts cannot be removed.
  app.delete('/api/customer-contacts/:id', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      if (!req.user.netsuiteCustomerId) {
        return res.status(400).json({ message: 'No NetSuite customer linked to this account' });
      }
      const contactId = String(req.params.id || '').trim();
      if (!/^\d+$/.test(contactId)) {
        return res.status(400).json({ message: 'Invalid contact id' });
      }

      // Verify the contact belongs to this customer and is an alternate contact
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      const check = await m2m.executeSuiteQL(
        `SELECT contact.id, contact.email, contact.contactrole FROM contact WHERE contact.id = ${contactId} AND contact.company = ${req.user.netsuiteCustomerId}`,
        1, 0
      );
      const found = check.items?.[0];
      if (!found) {
        return res.status(404).json({ message: 'Contact not found on this account' });
      }
      if (String(found.contactrole) === '-10') {
        return res.status(400).json({ message: 'The primary contact cannot be removed' });
      }

      await m2m.deleteRecord('contact', contactId);

      // Deactivate the matching portal login, if any
      if (found.email) {
        const portalUser = await storage.getUserByEmail(found.email);
        if (portalUser && portalUser.netsuiteCustomerId === req.user.netsuiteCustomerId && portalUser.id !== req.user.id) {
          await storage.updateUser(portalUser.id, { isActive: false } as any).catch((e) =>
            console.error('Could not deactivate portal login:', e));
        }
      }

      await invalidateCustomer(req.user.netsuiteCustomerId).catch(() => {});
      res.json({ message: 'Contact removed' });
    } catch (error: any) {
      console.error('Remove contact error:', error);
      res.status(500).json({ message: error?.message || 'Failed to remove contact' });
    }
  });

  // Change the primary contact's password: updates the NetSuite customer's
  // Password/Verify Password (Customer Center access) fields, the Dealer Website
  // Password field on the customer record, and the portal login password.
  app.post('/api/account/change-password', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      if (!req.user.netsuiteCustomerId) {
        return res.status(400).json({ message: 'No NetSuite customer linked to this account' });
      }

      const schema = z.object({
        password: z.string().min(4, 'Password must be at least 4 characters'),
        verifyPassword: z.string(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Invalid request' });
      }
      const { password, verifyPassword } = parsed.data;

      if (password !== verifyPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }

      // Must differ from every OTHER contact's password on this account
      const accountUsers = await storage.getUsersByNetSuiteCustomerId(req.user.netsuiteCustomerId);
      for (const u of accountUsers) {
        if (u.id !== req.user.id && u.isActive && u.password && await bcrypt.compare(password, u.password)) {
          return res.status(400).json({ message: 'Password cannot be the same as another contact\'s password on this account' });
        }
      }

      // Update NetSuite: access password/verify + Dealer Website Password (System Information tab)
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      await m2m.patchRecord('customer', req.user.netsuiteCustomerId, {
        password,
        password2: password,
        custentity_legpw: password,
      });

      // Also update the Password / Verify Password fields on the PRIMARY CONTACT record
      // (these are what NetSuite checks during estimate entry)
      const primaryQ = await m2m.executeSuiteQL(
        `SELECT contact.id FROM contact WHERE contact.company = ${req.user.netsuiteCustomerId} AND contact.contactrole = '-10'`,
        1, 0
      );
      const primaryContactId = primaryQ.items?.[0]?.id;
      if (primaryContactId) {
        await m2m.patchRecord('contact', String(primaryContactId), {
          custentity_crd_pin: password,
          custentity_crd_pin_confirm: password,
        });
      } else {
        console.warn('Change password: no primary contact (-10) found for customer', req.user.netsuiteCustomerId);
      }

      // Update the portal login password
      await storage.updatePassword(req.user.id, password);

      await invalidateCustomer(req.user.netsuiteCustomerId).catch(() => {});
      res.json({ message: 'Password updated' });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(500).json({ message: error?.message || 'Failed to change password' });
    }
  });

  // Support tickets
  // Estimates - Fetch from NetSuite using SuiteQL
  app.get('/api/estimates', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Check if NetSuite M2M is configured
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        console.log('NetSuite M2M not configured, returning database estimates');
        const estimates = await storage.getUserEstimates(req.user.id, limit);
        return res.json({ items: estimates, hasMore: false, totalResults: estimates.length });
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Map NetSuite status codes to friendly names
      const mapStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
          'A': 'open',      // NetSuite displays 'A' as "OPEN"
          'B': 'sent',
          'C': 'closed',
          'E': 'expired',
          'O': 'open',
          'P': 'pending',
          'R': 'rejected',
          'X': 'cancelled'
        };
        return statusMap[status] || status.toLowerCase();
      };
      
      // Transform NetSuite data to match frontend format
      const transformEstimate = (item: any) => ({
        id: item.id,
        estimateNumber: item.documentnumber || item.tranid,
        status: mapStatus(item.status),
        amount: item.total || '0.00', // NetSuite returns lowercase 'total'
        currency: item.currency || 'USD',
        estimateDate: item.date || item.trandate || item.createddate,
        expiryDate: item.expirationdate || item.duedate,
        description: item.memo || '',
        memo: item.memo || '',
        tagFor: item.tagfor || '',
        customerName: item.customername,
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      });
      
      // If user has NetSuite customer ID, fetch their estimates
      if (req.user.netsuiteCustomerId) {
        const estimates = await m2m.getCustomerEstimates(req.user.netsuiteCustomerId, limit);
        

        
        const transformed = estimates.map(transformEstimate);
        res.json(transformed);
      } else {
        // For testing/demo, fetch all estimates
        const result = await m2m.getAllEstimates(limit, offset);
        

        
        const transformed = result.items.map(transformEstimate);
        res.json(transformed);
      }
    } catch (error: any) {
      console.error('Error fetching estimates from NetSuite:', error);
      res.status(500).json({ message: 'Failed to fetch estimates from NetSuite' });
    }
  });
  
  // Get specific estimate details
  app.get('/api/estimates/:id', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const estimateId = req.params.id;
      
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.status(400).json({ message: 'NetSuite M2M not configured' });
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      const estimate = await m2m.getEstimateDetails(estimateId);
      
      // Verify customer has access to this estimate
      const estimateCustomerId = String(estimate.customerid || estimate.customerId || '');
      const userCustomerId = String(req.user.netsuiteCustomerId || '');
      if (userCustomerId && estimateCustomerId && estimateCustomerId !== userCustomerId) {
        return res.status(403).json({ message: 'Access denied to this estimate' });
      }
      
      // Transform the data to match frontend expectations
      const transformedEstimate = {
        id: estimate.id,
        estimateNumber: estimate.documentnumber || estimate.tranid,
        status: estimate.status === 'A' ? 'open' : estimate.status?.toLowerCase(),
        amount: estimate.total || '0',
        totalAmount: estimate.total || '0',
        subtotal: estimate.total || '0', // Use total as subtotal since subtotal not available
        tax: estimate.tax || '0',
        discountTotal: estimate.discounttotal || '0',
        shipping: '0', // Shipping not available in SuiteQL
        currency: estimate.currency || 'USD',
        estimateDate: estimate.date || estimate.trandate,
        expiryDate: estimate.expirationdate || estimate.duedate,
        memo: estimate.memo || '',
        tagFor: estimate.tagfor || '',
        customerName: estimate.customername,
        salesRepPreferredName: estimate.salesreppreferredname || '',
        location: estimate.location,
        shippingAddress: '', // Not available in SuiteQL
        billingAddress: '', // Not available in SuiteQL
        items: estimate.items ? estimate.items.map((item: any) => ({
          id: item.lineid,
          lineNumber: item.linenumber,
          name: item.itemname,
          itemName: item.itemname,
          quantity: item.quantity || 0,
          rate: item.rate || '0.00',
          amount: item.amount || '0.00',
          description: item.description || ''
        })) : [],
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      };
      
      res.json(transformedEstimate);
    } catch (error: any) {
      console.error('Error fetching estimate details:', error);
      res.status(500).json({ message: 'Failed to fetch estimate details' });
    }
  });

  app.get('/api/support/tickets/:caseId/messages', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      
      // Check if NetSuite M2M is configured
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.json([]);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Fetch messages for the specific case
      const messages = await m2m.getCaseMessages(caseId);
      
      // Transform messages to frontend format
      const transformedMessages = messages.map((msg: any) => ({
        id: msg.id,
        subject: msg.subject || 'No subject',
        content: msg.message || '',
        author: (msg.firstname && msg.lastname ? `${msg.firstname} ${msg.lastname}` : msg.authorname) || 'System',
        date: msg.messagedate || new Date().toISOString(),
        type: msg.author === '-5' ? 'system' : 'user'
      }));
      
      res.json(transformedMessages);
    } catch (error) {
      console.error('Case messages error:', error);
      res.status(500).json({ message: 'Failed to fetch case messages' });
    }
  });

  app.get('/api/support/tickets', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning empty tickets');
        return res.json([]);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Keep NetSuite status codes as-is for proper filtering
      const mapStatus = (status: string, statusText: string): string => {
        // NetSuite status codes: 1=Not Started, 2=In Progress, 3=Escalated, 4=Re-Opened, 5=Closed, 6=On Hold
        // Return the numeric status code as a string
        return status;
      };
      
      // Transform NetSuite case data to match frontend format
      const transformCase = (caseItem: any) => {
        // Use company name if available, fallback to email
        let createdBy = caseItem.companyname || caseItem.email || 'Support case';
        
        // If it's just a number like "1340", prepend "Customer"
        if (createdBy && /^\d+$/.test(createdBy)) {
          createdBy = `Customer ${createdBy}`;
        } else if (createdBy && createdBy !== 'Support case') {
          // Clean up company name by removing any leading numbers and formatting
          createdBy = createdBy.replace(/^[\d\s\-\.]+/, '').trim();
        }
        
        return {
          id: caseItem.id,
          subject: caseItem.title || `Case #${caseItem.casenumber}`,
          description: createdBy ? `Created by: ${createdBy}` : 'Support case',
          detail: caseItem.custevent_xprdetail || '',
          status: mapStatus(caseItem.status, caseItem.statustext),
          assignedTo: caseItem.assignedname || caseItem.assigned || null,
          createdAt: caseItem.createddate || new Date().toISOString(),
          updatedAt: caseItem.lastmodifieddate || caseItem.createddate || new Date().toISOString(),
          caseNumber: caseItem.casenumber,
          category: caseItem.category,
          followUpDate: caseItem.followupdate || null,
          relatedSalesOrder: caseItem.relatedsalesordernumber || caseItem.relatedsalesorder || null,
          endUser: caseItem.caseenduser || null,
          jobId: caseItem.casejobid || null,
          messages: [] // Will be populated if we can fetch messages separately
        };
      };
      
      // Only fetch cases linked to the customer record directly
      console.log('Fetching support cases for customer ID:', req.user.netsuiteCustomerId);
      const cases = await m2m.getCustomerCases(req.user.netsuiteCustomerId, null, 30);
      console.log(`Found ${cases.length} support cases from NetSuite`);
      if (cases.length > 0) {
        console.log('Sample case keys:', Object.keys(cases[0]));
        console.log('Sample case data:', JSON.stringify(cases[0], null, 2));
      }
      
      // Debug: Log unique statuses
      const uniqueStatuses = [...new Set(cases.map((c: any) => c.status))];
      console.log('Unique case statuses from NetSuite:', uniqueStatuses);
      
      const transformed = cases.map(transformCase);
      res.json(transformed);
    } catch (error) {
      console.error('Support tickets error:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  app.post('/api/support/tickets', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const parsed = z.object({
        salesOrderId: z.string().regex(/^\d+$/).optional().or(z.literal('')),
        subject: z.string().trim().min(5).max(255),
        description: z.string().trim().min(20).max(10000),
      }).safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || 'Invalid support ticket',
        });
      }
      if (!req.user.netsuiteCustomerId) {
        return res.status(400).json({ message: 'No NetSuite customer linked to this account' });
      }

      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      const customerId = String(req.user.netsuiteCustomerId);
      const { subject, description, salesOrderId } = parsed.data;

      let relatedOrder: any = null;
      if (salesOrderId) {
        // Never trust a browser-supplied transaction id: verify that the
        // selected sales order belongs to the authenticated customer.
        const orderResult = await m2m.executeSuiteQL(`
          SELECT
            transaction.id,
            transaction.tranid,
            transaction.custbody_tagfor AS enduser,
            transaction.memo
          FROM transaction
          WHERE transaction.id = ${salesOrderId}
            AND transaction.entity = ${customerId}
            AND transaction.type = 'SalesOrd'
        `.trim(), 1, 0);
        relatedOrder = orderResult.items?.[0];
        if (!relatedOrder) {
          return res.status(400).json({ message: 'The selected sales order was not found on this account' });
        }
      }

      const caseBody: any = {
        title: subject,
        email: req.user.email,
        incomingMessage: description,
        custevent_xprdetail: description,
        custevent_svcsjpr_customer: { id: customerId },
        custevent_jprtype: { id: '1' },
      };

      if (relatedOrder) {
        caseBody.custevent_related_salesorder = { id: String(relatedOrder.id) };
        caseBody.custevent_svrcjpr_tag_for = relatedOrder.enduser || '';
        caseBody.custevent_svrcjpr_memo = relatedOrder.memo || '';
      }

      // Intentionally omit `assigned`: NetSuite's default Customer Service
      // routing determines the appropriate owner.
      const caseId = await m2m.createRecord('supportCase', caseBody);
      await invalidateCustomer(customerId).catch(() => {});

      res.status(201).json({
        id: caseId,
        message: 'Your support ticket was created successfully.',
      });
    } catch (error: any) {
      console.error('Create support ticket error:', error);
      res.status(500).json({ message: error?.message || 'Failed to create support ticket in NetSuite' });
    }
  });

  // ---------------------------------------------------------------------------
  // Quick Quote: customer picks a store + salesperson, fills in project info,
  // uploads measurements/photos. Files persist in Postgres; delivery is a
  // NetSuite task assigned to the rep (sendEmail=true) logged on the customer.
  // ---------------------------------------------------------------------------

  const quickQuoteUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10MB/file, 10 files max
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
        'application/pdf',
      ];
      if (allowed.includes(file.mimetype)) return cb(null, true);
      cb(new Error(`File type not allowed: ${file.mimetype}. Use photos (JPG/PNG/HEIC) or PDF.`));
    },
  });

  // Store + salesperson list (cached 10 min server-side)
  // Task messages are rendered as HTML in NetSuite's notification email, so
  // escape user-supplied text to prevent HTML/markup injection.
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Content sniffing: the download endpoint is unauthenticated (tokenized),
  // so never trust the client-provided MIME type — verify magic numbers.
  const sniffOk = (buf: Buffer): boolean => {
    if (buf.length < 12) return false;
    if (buf.slice(0, 4).toString('latin1') === '%PDF') return true;            // PDF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;    // JPEG
    if (buf[0] === 0x89 && buf.slice(1, 4).toString('latin1') === 'PNG') return true; // PNG
    if (buf.slice(0, 3).toString('latin1') === 'GIF') return true;             // GIF
    if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return true; // WEBP
    if (buf.slice(4, 8).toString('latin1') === 'ftyp') return true;            // HEIC/HEIF (ISO BMFF)
    return false;
  };

  // Copy a form submission to the store manager of the selected location and
  // the shared info@ mailbox (each gets its own sendEmail task — NetSuite
  // tasks only email the assignee). Copies are best-effort: a failure is
  // logged but never fails the submission, since the salesperson was notified.
  const sendCopyTasks = async (params: {
    storeName: string;
    salesRepId: string;
    customerInternalId: string;
    title: string;
    message: string;
  }) => {
    const copyIds = new Set<string>([INFO_MAILBOX_EMPLOYEE_ID]);
    try {
      const manager = await getStoreManager(params.storeName);
      if (manager) copyIds.add(manager.id);
    } catch (err) {
      console.error('Store manager lookup failed:', err);
    }
    copyIds.delete(params.salesRepId); // don't double-email the assignee
    for (const id of Array.from(copyIds)) {
      try {
        await createQuickQuoteTask({
          salesRepId: id,
          customerInternalId: params.customerInternalId,
          title: params.title,
          message: params.message,
        });
      } catch (err) {
        console.error(`Copy task to employee ${id} failed:`, err);
      }
    }
  };

  app.get('/api/quick-quote/salespeople', authenticateToken, async (_req: any, res) => {
    try {
      const stores = await getSalespeopleByStore();
      res.json({ stores });
    } catch (error) {
      console.error('Quick quote salespeople error:', error);
      res.status(500).json({ message: 'Failed to load salespeople' });
    }
  });

  app.post(
    '/api/quick-quote',
    authenticateToken,
    (req: any, res, next) => {
      quickQuoteUpload.fields([
        { name: 'measurements', maxCount: 5 },
        { name: 'photos', maxCount: 5 },
      ])(req, res, (err: any) => {
        if (err) return res.status(400).json({ message: err.message || 'File upload failed' });
        next();
      });
    },
    async (req: any, res) => {
      try {
        const schema = z.object({
          storeName: z.string().min(1),
          salesRepId: z.string().min(1),
          projectType: z.enum(['Kitchen', 'Bath', 'Other']),
          budget: z.string().max(100).optional().default(''),
          timeFrame: z.enum(['0-3 months', '4-6 months', '7+ months']).optional(),
          brandPreference: z.string().max(255).optional().default(''),
          comments: z.string().max(5000).optional().default(''),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid form data', errors: parsed.error.flatten().fieldErrors });
        }
        const data = parsed.data;

        // Validate the rep actually belongs to the selected store (server-side truth)
        const rep = await findSalesRep(data.storeName, data.salesRepId);
        if (!rep) {
          return res.status(400).json({ message: 'Selected salesperson not found for that store' });
        }

        const user = await storage.getUser(req.user.id);
        if (!user) return res.status(401).json({ message: 'User not found' });

        // Validate file signatures BEFORE saving anything, so a rejected
        // submission leaves no orphaned request row behind.
        const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
        for (const kind of ['measurements', 'photos'] as const) {
          for (const f of files?.[kind] || []) {
            if (!sniffOk(f.buffer)) {
              return res.status(400).json({ message: `"${f.originalname}" does not look like a valid PDF or image file.` });
            }
          }
        }

        // Save the request + files first so nothing is lost if NetSuite errors
        const [request] = await db.insert(quickQuoteRequests).values({
          userId: user.id,
          storeName: data.storeName,
          salesRepId: rep.id,
          salesRepName: rep.name,
          salesRepEmail: rep.email,
          projectType: data.projectType,
          budget: data.budget || null,
          timeFrame: data.timeFrame || null,
          brandPreference: data.brandPreference || null,
          comments: data.comments || null,
        }).returning();

        const savedFiles: { kind: string; fileName: string; token: string; size: number }[] = [];
        for (const kind of ['measurements', 'photos'] as const) {
          for (const f of files?.[kind] || []) {
            const token = crypto.randomBytes(24).toString('hex');
            await db.insert(quickQuoteFiles).values({
              requestId: request.id,
              kind,
              fileName: f.originalname,
              mimeType: f.mimetype,
              fileSize: f.size,
              downloadToken: token,
              data: f.buffer,
            });
            savedFiles.push({ kind, fileName: f.originalname, token, size: f.size });
          }
        }

        // Build the NetSuite task
        const baseUrl = process.env.APP_URL
          || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
        const customerName = user.companyName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
        // NetSuite's task-notification email collapses plain newlines but
        // renders HTML — use <br> line breaks and <b> labels (verified live).
        const lines = [
          `<b>QUICK QUOTE request from the customer portal</b>`,
          ``,
          `<b>Customer Name:</b> ${esc(customerName)}`,
          `<b>Customer #:</b> ${user.netsuiteCustomerId}`,
          ``,
          `<b>Project Type:</b> ${data.projectType || '—'}`,
          `<b>Budget:</b> ${data.budget || '—'}`,
          `<b>Time Frame:</b> ${data.timeFrame || '—'}`,
          `<b>Brand Preference:</b> ${data.brandPreference || '—'}`,
        ];
        if (data.comments) {
          lines.push(``, `<b>Comments:</b> ${esc(data.comments)}`);
        }
        if (savedFiles.length > 0) {
          lines.push('', '<b>Attached files:</b>');
          for (const sf of savedFiles) {
            lines.push(`[${sf.kind === 'measurements' ? 'Measurements' : 'Photo'}] ${esc(sf.fileName)} (${(sf.size / 1024 / 1024).toFixed(1)} MB): ${baseUrl}/api/quick-quote/files/${sf.token}`);
          }
        }

        let netsuiteTaskId: string | null = null;
        let netsuiteError: string | null = null;
        try {
          const customerInternalId = await getCustomerInternalId(String(user.netsuiteCustomerId));
          if (!customerInternalId) {
            // The task must be logged on the customer record; without it,
            // fail delivery explicitly (request stays saved for follow-up).
            throw new Error(`Could not resolve NetSuite customer for ${user.netsuiteCustomerId}`);
          }
          const title = `Quick Quote - ${data.projectType} - ${customerName}`;
          netsuiteTaskId = await createQuickQuoteTask({
            salesRepId: rep.id,
            customerInternalId,
            title,
            message: lines.join('<br>'),
          });
          await db.update(quickQuoteRequests)
            .set({ netsuiteTaskId })
            .where(eq(quickQuoteRequests.id, request.id));
          // Fire-and-forget: copies are best-effort and must not delay the response
          void sendCopyTasks({
            storeName: data.storeName,
            salesRepId: rep.id,
            customerInternalId,
            title,
            message: lines.join('<br>'),
          });
        } catch (err: any) {
          // Request + files are saved; surface the delivery failure explicitly
          console.error('Quick quote NetSuite task error:', err);
          netsuiteError = err?.message || 'NetSuite task creation failed';
        }

        if (netsuiteError) {
          return res.status(502).json({
            message: 'Your request was saved, but we could not notify the salesperson automatically. Please call the store to follow up.',
            requestId: request.id,
          });
        }

        res.status(201).json({
          message: `Your request was sent to ${rep.name} at ${data.storeName}.`,
          requestId: request.id,
        });
      } catch (error) {
        console.error('Quick quote submit error:', error);
        res.status(500).json({ message: 'Failed to submit quick quote request' });
      }
    }
  );

  // Client Concierge: showroom appointment request for a trade customer's client.
  // Delivered as a NetSuite task assigned to the selected salesperson.
  app.post(
    '/api/client-concierge',
    authenticateToken,
    (req: any, res, next) => {
      quickQuoteUpload.fields([
        { name: 'measurements', maxCount: 5 },
        { name: 'photos', maxCount: 5 },
      ])(req, res, (err: any) => {
        if (err) return res.status(400).json({ message: err.message || 'File upload failed' });
        next();
      });
    },
    async (req: any, res) => {
    try {
      const schema = z.object({
        storeName: z.string().min(1),
        salesRepId: z.string().min(1),
        clientName: z.string().min(1).max(200),
        clientEmail: z.string().email().max(255).optional().or(z.literal('')),
        clientPhone: z.string().min(1).max(50),
        projectType: z.enum(['Kitchen', 'Bath', 'Other']).optional(),
        budget: z.string().max(100).optional().default(''),
        timeFrame: z.enum(['0-3 months', '4-6 months', '7+ months']).optional(),
        brandPreference: z.string().max(255).optional().default(''),
        preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').refine((d) => {
          const date = new Date(`${d}T00:00:00`);
          if (isNaN(date.getTime())) return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date > today; // appointments must be tomorrow or later
        }, 'Preferred date must be in the future'),
        preferredTime: z.enum(['Morning', 'Afternoon']).optional(),
        projectDetails: z.string().max(5000).optional().default(''),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid form data', errors: parsed.error.flatten().fieldErrors });
      }
      const data = parsed.data;

      const rep = await findSalesRep(data.storeName, data.salesRepId);
      if (!rep) {
        return res.status(400).json({ message: 'Selected salesperson not found for that store' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(401).json({ message: 'User not found' });

      // Validate file signatures BEFORE saving anything, so a rejected
      // submission leaves no orphaned request row behind.
      const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
      for (const kind of ['measurements', 'photos'] as const) {
        for (const f of files?.[kind] || []) {
          if (!sniffOk(f.buffer)) {
            return res.status(400).json({ message: `"${f.originalname}" does not look like a valid PDF or image file.` });
          }
        }
      }

      // Save first so nothing is lost if NetSuite errors
      const [request] = await db.insert(conciergeRequests).values({
        userId: user.id,
        storeName: data.storeName,
        salesRepId: rep.id,
        salesRepName: rep.name,
        salesRepEmail: rep.email,
        clientName: data.clientName,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone || null,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime || null,
        projectType: data.projectType || null,
        budget: data.budget || null,
        timeFrame: data.timeFrame || null,
        brandPreference: data.brandPreference || null,
        projectDetails: data.projectDetails || null,
      }).returning();

      // Save uploaded files (same pattern as quick quote)
      const savedFiles: { kind: string; fileName: string; token: string; size: number }[] = [];
      for (const kind of ['measurements', 'photos'] as const) {
        for (const f of files?.[kind] || []) {
          const token = crypto.randomBytes(24).toString('hex');
          await db.insert(conciergeFiles).values({
            requestId: request.id,
            kind,
            fileName: f.originalname,
            mimeType: f.mimetype,
            fileSize: f.size,
            downloadToken: token,
            data: f.buffer,
          });
          savedFiles.push({ kind, fileName: f.originalname, token, size: f.size });
        }
      }

      const customerName = user.companyName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
      // NetSuite's task-notification email collapses plain newlines but
      // renders HTML — use <br> line breaks and <b> labels (verified live).
      // Preferred date as MM/DD/YYYY
      const fmtDate = (d: string) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '').trim());
        return m ? `${m[2]}/${m[3]}/${m[1]}` : (d || '—');
      };
      const lines = [
        `<b>CLIENT CONCIERGE appointment request from the customer portal</b>`,
        ``,
        `<b>Customer Name:</b> ${esc(customerName)}`,
        `<b>Customer #:</b> ${user.netsuiteCustomerId}`,
        ``,
        `<b>Client Name:</b> ${esc(data.clientName)}`,
        `<b>Client Email:</b> ${esc(data.clientEmail) || '—'}`,
        `<b>Client Phone:</b> ${esc(data.clientPhone) || '—'}`,
        `<b>Preferred Date:</b> ${fmtDate(data.preferredDate)}`,
        `<b>Preferred Time:</b> ${data.preferredTime || '—'}`,
        ``,
        `<b>Project Type:</b> ${data.projectType || '—'}`,
        `<b>Budget:</b> ${data.budget || '—'}`,
        `<b>Time Frame:</b> ${data.timeFrame || '—'}`,
        `<b>Brand Preference:</b> ${data.brandPreference || '—'}`,
        ``,
        `<b>IMPORTANT: Show the client retail pricing only. Send branded estimates to the PRO customer (${user.email}), not their client.</b>`,
      ];
      if (data.projectDetails) {
        lines.push(``, `<b>Project Details:</b> ${esc(data.projectDetails)}`);
      }
      if (savedFiles.length > 0) {
        const baseUrl = process.env.APP_URL
          || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
        lines.push('', '<b>Attached files:</b>');
        for (const sf of savedFiles) {
          lines.push(`[${sf.kind === 'measurements' ? 'Measurements' : 'Photo'}] ${esc(sf.fileName)} (${(sf.size / 1024 / 1024).toFixed(1)} MB): ${baseUrl}/api/quick-quote/files/${sf.token}`);
        }
      }

      let netsuiteError: string | null = null;
      try {
        const customerInternalId = await getCustomerInternalId(String(user.netsuiteCustomerId));
        if (!customerInternalId) {
          throw new Error(`Could not resolve NetSuite customer for ${user.netsuiteCustomerId}`);
        }
        const title = `Client Concierge - Showroom Appointment - ${customerName}`;
        const netsuiteTaskId = await createQuickQuoteTask({
          salesRepId: rep.id,
          customerInternalId,
          title,
          message: lines.join('<br>'),
        });
        await db.update(conciergeRequests)
          .set({ netsuiteTaskId })
          .where(eq(conciergeRequests.id, request.id));
        // Fire-and-forget: copies are best-effort and must not delay the response
        void sendCopyTasks({
          storeName: data.storeName,
          salesRepId: rep.id,
          customerInternalId,
          title,
          message: lines.join('<br>'),
        });
      } catch (err: any) {
        console.error('Client concierge NetSuite task error:', err);
        netsuiteError = err?.message || 'NetSuite task creation failed';
      }

      if (netsuiteError) {
        return res.status(502).json({
          message: 'Your request was saved, but we could not notify the salesperson automatically. Please call the store to follow up.',
          requestId: request.id,
        });
      }

      res.status(201).json({
        message: `Your appointment request was sent to ${rep.name} at ${data.storeName}.`,
        requestId: request.id,
      });
    } catch (error) {
      console.error('Client concierge submit error:', error);
      res.status(500).json({ message: 'Failed to submit appointment request' });
    }
  });

  // Tokenized file download (no portal login required — the salesperson opens
  // this from the NetSuite task email; tokens are 48-hex-char unguessable).
  app.get('/api/quick-quote/files/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '');
      if (!/^[a-f0-9]{48}$/.test(token)) return res.status(404).json({ message: 'File not found' });
      let [file]: Array<{ mimeType: string; fileName: string; data: Buffer }> =
        await db.select().from(quickQuoteFiles).where(eq(quickQuoteFiles.downloadToken, token));
      if (!file) {
        [file] = await db.select().from(conciergeFiles).where(eq(conciergeFiles.downloadToken, token));
      }
      if (!file) return res.status(404).json({ message: 'File not found' });
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/[^\w.\- ]/g, '_')}"`);
      res.send(file.data);
    } catch (error) {
      console.error('Quick quote file download error:', error);
      res.status(500).json({ message: 'Failed to download file' });
    }
  });

  // Sync operations
  app.post('/api/sync/live/:entityType', authenticateToken, async (req: any, res) => {
    try {
      const { entityType } = req.params;
      
      if (!['orders', 'payments'].includes(entityType)) {
        return res.status(400).json({ message: 'Invalid entity type for live sync' });
      }

      // Queue live sync job
      await syncService.queueLiveSync(req.user.id, entityType as 'orders' | 'payments');
      
      res.json({ message: 'Live sync queued successfully' });
    } catch (error) {
      console.error('Live sync error:', error);
      res.status(500).json({ message: 'Failed to queue live sync' });
    }
  });

  app.get('/api/sync/status', authenticateToken, async (req: any, res) => {
    try {
      const syncStatus = syncService.getSyncStatus();
      const queueStats = queueService.getQueueStats();
      
      res.json({
        sync: syncStatus,
        queue: queueStats,
      });
    } catch (error) {
      console.error('Sync status error:', error);
      res.status(500).json({ message: 'Failed to fetch sync status' });
    }
  });

  // User profile
  app.get('/api/profile', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        createdAt: user.createdAt,
        // Include NetSuite information from JWT token
        isNetSuiteUser: req.user.isNetSuiteUser || false,
        netsuiteCustomerId: req.user.netsuiteCustomerId || null,
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // Deprecated: Direct authentication endpoint removed
  // NetSuite SSO is now the only authentication method for NetSuite accounts
  app.post('/api/auth/netsuite-direct', async (req, res) => {
    res.status(410).json({ 
      message: 'Direct authentication has been replaced with NetSuite SSO. Please use the "Sign in with NetSuite SSO" button on the login page.',
      error: 'method_deprecated'
    });
  });

  // Loyalty endpoints
  app.get('/api/loyalty/account', authenticateToken, async (req: any, res) => {
    try {
      const loyaltyAccount = await storage.getLoyaltyAccount(req.user.id);
      if (!loyaltyAccount) {
        return res.status(404).json({ message: 'Loyalty account not found' });
      }
      res.json(loyaltyAccount);
    } catch (error) {
      console.error('Loyalty account error:', error);
      res.status(500).json({ message: 'Failed to fetch loyalty account' });
    }
  });

  app.get('/api/loyalty/transactions', authenticateToken, async (req: any, res) => {
    try {
      const transactions = await storage.getLoyaltyTransactions(req.user.id);
      res.json(transactions);
    } catch (error) {
      console.error('Loyalty transactions error:', error);
      res.status(500).json({ message: 'Failed to fetch loyalty transactions' });
    }
  });

  app.get('/api/loyalty/rewards', authenticateToken, async (req: any, res) => {
    try {
      const rewards = await storage.getLoyaltyRewards();
      res.json(rewards);
    } catch (error) {
      console.error('Loyalty rewards error:', error);
      res.status(500).json({ message: 'Failed to fetch loyalty rewards' });
    }
  });

  // CRD Rebates CSV download endpoint
  app.get('/api/crd-rebates/download', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const customerId = req.user.netsuiteCustomerId;
      
      if (!customerId) {
        return res.status(400).json({ message: 'No NetSuite customer ID found' });
      }

      console.log(`Downloading CRD rebates CSV for customer ${customerId}`);
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const netsuiteM2M = new NetSuiteM2M();
      
      // SuiteQL query to fetch all CRD rebate records with transaction IDs
      const query = `
        SELECT 
          customrecord_crdrebate.id,
          customrecord_crdrebate.custrecord_crdrebate_date AS rebateDate,
          customrecord_crdrebate.custrecord_crdrebate_amount AS amount,
          customrecord_crdrebate.custrecord_crdrebate_type AS typeId,
          customrecord_crdrebate.custrecord_crdrebate_reversed AS reversed,
          customrecord_crdrebate.custrecord_crdrebate_salesorder AS salesOrderId,
          salesorder.tranid AS salesOrderTranId,
          customrecord_crdrebate.custrecord_crdrebate_expiration_date AS expirationDate,
          customrecord_crdrebate.custrecord_crdrebate_applyingtxn AS applyingTxnId,
          applyingtxn.tranid AS applyingTxnTranId,
          customrecord_crdrebate.custrecord_crdrebate_category AS categoryId,
          customrecord_crdrebate.custrecord_crdrebate_earnedpercent AS earnedPercent,
          customrecord_crdrebate.custrecord_crdrebate_sorebaterate AS salesOrderRebateRate
        FROM 
          customrecord_crdrebate
        LEFT JOIN 
          transaction salesorder ON customrecord_crdrebate.custrecord_crdrebate_salesorder = salesorder.id
        LEFT JOIN 
          transaction applyingtxn ON customrecord_crdrebate.custrecord_crdrebate_applyingtxn = applyingtxn.id
        WHERE 
          customrecord_crdrebate.custrecord_crdrebate_customer = ${customerId}
        ORDER BY 
          customrecord_crdrebate.custrecord_crdrebate_date DESC
      `;
      
      const rebatesResponse = await netsuiteM2M.executeSuiteQL(query, 1000);
      const allRebates = rebatesResponse.items || [];
      
      // Filter out reversed transactions for accurate balance
      const rebates = allRebates.filter((r: any) => r.reversed !== 'T');
      
      // Create CSV content with a note about reversed transactions
      const csvHeaders = [
        'ID',
        'Date',
        'Amount',
        'Status',
        'Sales Order',
        'Expiration Date',
        'Applying Transaction',
        'Category',
        'Earned Percent',
        'Sales Order Rebate Rate'
      ];
      
      const csvRows = rebates.map((rebate: any) => {
        const status = rebate.typeid === 1 || rebate.typeid === '1' ? 'Earned' :
                      rebate.typeid === 2 || rebate.typeid === '2' ? 'Redeemed' :
                      rebate.typeid === 3 || rebate.typeid === '3' ? 'Expired' :
                      rebate.typeid === 4 || rebate.typeid === '4' ? 'Return' :
                      rebate.typeid === 5 || rebate.typeid === '5' ? 'Accommodation' :
                      'Unknown';
        
        return [
          rebate.id || '',
          rebate.rebatedate || '',
          rebate.amount || '0',
          status,
          rebate.salesordertranid || rebate.salesorderid || '',
          rebate.expirationdate || '',
          rebate.applyingtxntranid || rebate.applyingtxnid || '',
          rebate.categoryid || '',
          rebate.earnedpercent ? (parseFloat(rebate.earnedpercent) * 100).toFixed(1) + '%' : '',
          rebate.salesorderrebaterate ? (parseFloat(rebate.salesorderrebaterate) * 100).toFixed(1) + '%' : ''
        ];
      });
      
      // Calculate totals for the CSV (same logic as main endpoint)
      const totalEarned = rebates
        .filter((r: any) => r.typeid === 1 || r.typeid === '1')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalRedeemed = rebates
        .filter((r: any) => r.typeid === 2 || r.typeid === '2')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalExpired = rebates
        .filter((r: any) => r.typeid === 3 || r.typeid === '3')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalReturns = rebates
        .filter((r: any) => r.typeid === 4 || r.typeid === '4')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalAccommodations = rebates
        .filter((r: any) => r.typeid === 5 || r.typeid === '5')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalAvailable = totalEarned + totalRedeemed + totalExpired + totalReturns + totalAccommodations;
      
      // Add summary rows at the end
      const summaryRows = [
        ['', '', '', '', '', '', '', '', '', ''],
        ['SUMMARY', '', '', '', '', '', '', '', '', ''],
        ['Total Earned', '', totalEarned.toFixed(2), '', '', '', '', '', '', ''],
        ['Total Redeemed', '', totalRedeemed.toFixed(2), '', '', '', '', '', '', ''],
        ['Total Expired', '', totalExpired.toFixed(2), '', '', '', '', '', '', ''],
        ['Total Returns', '', totalReturns.toFixed(2), '', '', '', '', '', '', ''],
        ['Total Accommodations', '', totalAccommodations.toFixed(2), '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        ['AVAILABLE BALANCE', '', totalAvailable.toFixed(2), '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        [`Note: ${allRebates.length - rebates.length} reversed transactions excluded from this export`, '', '', '', '', '', '', '', '', '']
      ];
      
      // Convert to CSV format
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma or quotes
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')),
        ...summaryRows.map(row => row.map(cell => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');
      
      // Set headers for CSV download
      const fileName = `consumers_cash_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csvContent);
      
    } catch (error) {
      console.error('Error downloading CRD rebates CSV:', error);
      res.status(500).json({ error: 'Failed to download CRD rebates CSV' });
    }
  });

  // Customer Growth Analysis endpoint
  app.get('/api/analytics/customer-growth', authenticateToken, async (req: any, res) => {
    try {
      console.log('Fetching customer growth data from NetSuite...');
      
      // Check if NetSuite M2M is configured
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.status(503).json({ 
          message: 'NetSuite integration not configured',
          details: 'M2M authentication credentials are missing'
        });
      }

      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();

      // SuiteQL query to get customer creation dates grouped by month
      const query = `
        SELECT 
          TO_CHAR(customer.datecreated, 'YYYY-MM') AS month,
          COUNT(customer.id) AS new_customers,
          MIN(customer.datecreated) AS earliest_date,
          MAX(customer.datecreated) AS latest_date
        FROM 
          customer
        WHERE 
          customer.datecreated IS NOT NULL
          AND customer.datecreated >= ADD_MONTHS(CURRENT_DATE, -24)
        GROUP BY 
          TO_CHAR(customer.datecreated, 'YYYY-MM')
        ORDER BY 
          TO_CHAR(customer.datecreated, 'YYYY-MM') DESC
      `.trim();

      const result = await m2m.executeSuiteQL(query, 100, 0);

      // Calculate growth metrics
      const monthlyData = result.items || [];
      
      // Calculate month-over-month growth
      const growthData = monthlyData.map((month, index) => {
        const previousMonth = monthlyData[index + 1];
        let growthRate = null;
        let growthAmount = null;
        
        if (previousMonth && previousMonth.new_customers > 0) {
          growthAmount = month.new_customers - previousMonth.new_customers;
          growthRate = ((month.new_customers - previousMonth.new_customers) / previousMonth.new_customers * 100).toFixed(2);
        }
        
        return {
          ...month,
          growth_rate: growthRate ? `${growthRate}%` : null,
          growth_amount: growthAmount
        };
      });

      // Calculate statistics
      const totalCustomers = monthlyData.reduce((sum, month) => sum + month.new_customers, 0);
      const avgPerMonth = monthlyData.length > 0 ? (totalCustomers / monthlyData.length).toFixed(1) : 0;
      const lastMonth = monthlyData[0]?.new_customers || 0;
      const lastThreeMonths = monthlyData.slice(0, 3).reduce((sum, month) => sum + month.new_customers, 0);
      const lastSixMonths = monthlyData.slice(0, 6).reduce((sum, month) => sum + month.new_customers, 0);
      const lastYear = monthlyData.slice(0, 12).reduce((sum, month) => sum + month.new_customers, 0);

      res.json({
        success: true,
        summary: {
          total_in_period: totalCustomers,
          average_per_month: parseFloat(avgPerMonth),
          last_month: lastMonth,
          last_3_months: lastThreeMonths,
          last_6_months: lastSixMonths,
          last_12_months: lastYear,
          period: 'Last 24 months',
          data_points: monthlyData.length
        },
        monthly_breakdown: growthData,
        query_info: {
          executed_at: new Date().toISOString(),
          records_returned: result.items.length,
          has_more: result.hasMore
        }
      });

    } catch (error) {
      console.error('Customer growth analysis error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch customer growth data',
        error: error.message,
        details: 'Check NetSuite M2M configuration and permissions'
      });
    }
  });

  // CRD Rebate (Consumers Cash) endpoint
  app.get('/api/crd-rebates', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const customerId = req.user.netsuiteCustomerId;
      
      if (!customerId) {
        return res.status(400).json({ message: 'No NetSuite customer ID found' });
      }

      console.log(`Fetching CRD rebates for customer ${customerId}`);
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const netsuiteM2M = new NetSuiteM2M();
      
      // First, fetch the customer's rebate rate
      const customerQuery = `
        SELECT 
          custentity_crd_purchase_rebate_rate AS rebateRate
        FROM 
          customer
        WHERE 
          id = ${customerId}
      `;
      
      const customerResponse = await netsuiteM2M.executeSuiteQL(customerQuery, 1);
      const customerData = customerResponse.items?.[0];
      const customerRebateRate = customerData?.rebaterate ? 
        (parseFloat(customerData.rebaterate) * 100).toFixed(1) : '10';
      
      // Fetch previous 12 months qualifying sales for rebate level
      const today = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(today.getFullYear() - 1);
      
      // Format dates as MM/DD/YYYY
      const startDate = `${(twelveMonthsAgo.getMonth() + 1).toString().padStart(2, '0')}/${twelveMonthsAgo.getDate().toString().padStart(2, '0')}/${twelveMonthsAgo.getFullYear()}`;
      const endDate = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      console.log('Date range for qualifying sales:', { startDate, endDate });
      
      const salesQuery = `
        SELECT 
          SUM(transaction.total - NVL(transaction.taxtotal, 0)) AS totalSales
        FROM 
          transaction
        WHERE 
          transaction.entity = ${customerId}
          AND transaction.type IN ('CustInvc', 'CustCred')
          AND transaction.trandate >= '${startDate}'
          AND transaction.trandate <= '${endDate}'
      `;
      
      console.log('Qualifying sales query:', salesQuery);
      const salesResponse = await netsuiteM2M.executeSuiteQL(salesQuery, 1);
      console.log('Qualifying sales response:', salesResponse);
      const salesData = salesResponse.items?.[0];
      const qualifyingSales = salesData?.totalsales || salesData?.TOTALSALES || '0';
      console.log('Qualifying sales amount:', qualifyingSales);
      
      // SuiteQL query to fetch all CRD rebate records with transaction IDs
      const query = `
        SELECT 
          customrecord_crdrebate.id,
          customrecord_crdrebate.custrecord_crdrebate_date AS rebateDate,
          customrecord_crdrebate.custrecord_crdrebate_amount AS amount,
          customrecord_crdrebate.custrecord_crdrebate_type AS typeId,
          customrecord_crdrebate.custrecord_crdrebate_reversed AS reversed,
          customrecord_crdrebate.custrecord_crdrebate_salesorder AS salesOrderId,
          salesorder.tranid AS salesOrderTranId,
          customrecord_crdrebate.custrecord_crdrebate_expiration_date AS expirationDate,
          customrecord_crdrebate.custrecord_crdrebate_applyingtxn AS applyingTxnId,
          applyingtxn.tranid AS applyingTxnTranId,
          customrecord_crdrebate.custrecord_crdrebate_category AS categoryId,
          customrecord_crdrebate.custrecord_crdrebate_earnedpercent AS earnedPercent,
          customrecord_crdrebate.custrecord_crdrebate_sorebaterate AS salesOrderRebateRate
        FROM 
          customrecord_crdrebate
        LEFT JOIN 
          transaction salesorder ON customrecord_crdrebate.custrecord_crdrebate_salesorder = salesorder.id
        LEFT JOIN 
          transaction applyingtxn ON customrecord_crdrebate.custrecord_crdrebate_applyingtxn = applyingtxn.id
        WHERE 
          customrecord_crdrebate.custrecord_crdrebate_customer = ${customerId}
        ORDER BY 
          customrecord_crdrebate.custrecord_crdrebate_date DESC
      `;
      
      const rebatesResponse = await netsuiteM2M.executeSuiteQL(query, 1000);
      const rebates = rebatesResponse.items || [];
      
      // Log sample data to understand the structure
      if (rebates.length > 0) {
        console.log('Sample rebate data - All fields:', rebates[0]);
        console.log('Sample rebate data:', {
          typeid: rebates[0].typeid,
          typeidType: typeof rebates[0].typeid,
          reversed: rebates[0].reversed,
          amount: rebates[0].amount,
          sampleTypes: rebates.slice(0, 5).map((r: any) => ({ 
            typeid: r.typeid, 
            amount: r.amount,
            allFields: Object.keys(r) 
          }))
        });
      }
      
      // Calculate summary statistics based on type field
      // Type values: 1=EARNED, 2=REDEEMED, 3=EXPIRED, 4=RETURN, 5=ACCOMMODATION
      
      // Calculate total earned (type 1)
      const totalEarned = rebates
        .filter((r: any) => r.typeid === 1 || r.typeid === '1')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      // Calculate total redeemed (type 2)
      const totalRedeemed = rebates
        .filter((r: any) => r.typeid === 2 || r.typeid === '2')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      // Calculate total expired (type 3)
      const totalExpired = rebates
        .filter((r: any) => r.typeid === 3 || r.typeid === '3')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      // Calculate returns (type 4)
      const totalReturns = rebates
        .filter((r: any) => r.typeid === 4 || r.typeid === '4')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      // Calculate accommodations (type 5)
      const totalAccommodations = rebates
        .filter((r: any) => r.typeid === 5 || r.typeid === '5')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      // Log the totals for debugging
      console.log('Rebate totals:', {
        totalEarned,
        totalRedeemed,
        totalExpired,
        totalReturns,
        totalAccommodations,
        totalAvailable: totalEarned + totalRedeemed + totalExpired + totalReturns + totalAccommodations,
        counts: {
          earned: rebates.filter((r: any) => r.typeid === 1 || r.typeid === '1').length,
          redeemed: rebates.filter((r: any) => r.typeid === 2 || r.typeid === '2').length,
          expired: rebates.filter((r: any) => r.typeid === 3 || r.typeid === '3').length,
          returns: rebates.filter((r: any) => r.typeid === 4 || r.typeid === '4').length,
          accommodations: rebates.filter((r: any) => r.typeid === 5 || r.typeid === '5').length
        }
      });
      
      // Available balance = Sum of all non-reversed transactions
      // Redeemed and Expired are already negative in the database
      const totalAvailable = totalEarned + totalRedeemed + totalExpired + totalReturns + totalAccommodations;
      
      res.json({
        rebates: rebates.map((rebate: any) => ({
          id: rebate.id,
          date: rebate.rebatedate,
          amount: rebate.amount,
          type: rebate.typeid,
          reversed: rebate.reversed === 'T',
          salesOrder: rebate.salesordertranid || rebate.salesorderid,
          expirationDate: rebate.expirationdate,
          applyingTransaction: rebate.applyingtxntranid || rebate.applyingtxnid,
          category: rebate.categoryid,
          earnedPercent: rebate.earnedpercent ? (parseFloat(rebate.earnedpercent) * 100).toFixed(1) : null,
          salesOrderRebateRate: rebate.salesorderrebaterate ? (parseFloat(rebate.salesorderrebaterate) * 100).toFixed(1) : null,
          status: rebate.typeid === 1 || rebate.typeid === '1' ? 'Earned' :
                  rebate.typeid === 2 || rebate.typeid === '2' ? 'Redeemed' :
                  rebate.typeid === 3 || rebate.typeid === '3' ? 'Expired' :
                  rebate.typeid === 4 || rebate.typeid === '4' ? 'Return' :
                  rebate.typeid === 5 || rebate.typeid === '5' ? 'Accommodation' :
                  'Unknown'
        })),
        summary: {
          totalAvailable: Math.max(0, totalAvailable).toFixed(2),
          totalExpired: Math.abs(totalExpired).toFixed(2),  // Convert negative to positive for display
          totalRedeemed: Math.abs(totalRedeemed).toFixed(2), // Convert negative to positive for display
          totalRebates: rebates.length,
          customerRebateRate: customerRebateRate,
          qualifyingSales: qualifyingSales
        }
      });
    } catch (error) {
      console.error('CRD rebates error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch CRD rebates', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test endpoint to send welcome email (for development/testing)
  app.post('/api/test/send-welcome-email', async (req, res) => {
    try {
      const { email, customerId } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      console.log(`Sending test welcome email to ${email}`);
      
      // Send email via NetSuite RESTlet
      const { netsuiteEmailService } = await import('./services/netsuite-email');
      const emailSent = await netsuiteEmailService.sendWelcomeEmail(
        email, 
        customerId || 'GUEST'
      );
      
      if (emailSent) {
        console.log(`Welcome email sent to ${email} via NetSuite template 432`);
        res.json({ 
          success: true, 
          message: `Welcome email sent successfully to ${email} using NetSuite template 432` 
        });
      } else {
        console.log(`Failed to send welcome email to ${email}`);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send welcome email - NetSuite email service may not be configured' 
        });
      }
    } catch (error) {
      console.error('Test welcome email error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.get('/api/express-bath/discover-field', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.status(503).json({ success: false, message: 'NetSuite M2M is not configured' });
      }
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      const result = await m2m.discoverExpressBathField();
      console.log('Express Bath field discovery result:', JSON.stringify(result.items, null, 2));
      res.json({ success: true, fields: result.items });
    } catch (error) {
      console.error('Express Bath field discovery error:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/express-bath/items', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
        return res.status(503).json({
          success: false,
          message: 'NetSuite M2M is not configured'
        });
      }

      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();

      const result = await m2m.getExpressBathItems('custitem_expressbath', limit, offset);

      for (const item of result.items) {
        const i = item as any;
        const levels = [
          i.sitecategorygreatgrandparent,
          i.sitecategorygrandparent,
          i.sitecategoryparent,
          i.sitecategory
        ].filter(Boolean);
        
        if (levels.length >= 2) {
          i.sitecategory = levels[1];
        } else if (levels.length === 1) {
          i.sitecategory = levels[0];
        }
        delete i.sitecategoryparent;
        delete i.sitecategorygrandparent;
        delete i.sitecategorygreatgrandparent;
      }

      const seen = new Map<string, any>();
      for (const item of result.items) {
        const id = (item as any).internalid || (item as any).internalId;
        if (!seen.has(id)) {
          seen.set(id, item);
        }
      }
      const dedupedItems = Array.from(seen.values());

      const allTypes = [...new Set(dedupedItems.map((i: any) => i.itemtype))];
      console.log('Express Bath: All item types found:', JSON.stringify(allTypes));

      for (const item of dedupedItems) {
        const i = item as any;
        console.log(`Express Bath item: ${i.itemnumber || i.itemid} | type: ${i.itemtype} | qtyAvailable: ${i.quantityavailable} | qtyOnHand: ${i.quantityonhand}`);
      }

      const kitItems = dedupedItems.filter((i: any) => {
        const type = (i.itemtype || '').toLowerCase();
        return type === 'kit' || type === 'kititem' || type === 'kit/package';
      });

      console.log(`Express Bath: Found ${kitItems.length} kit items out of ${dedupedItems.length} total`);
      if (kitItems.length > 0) {
        for (const k of kitItems) {
          console.log(`Express Bath KIT: ${(k as any).itemnumber} (id: ${(k as any).internalid}) - original qtyAvailable: ${(k as any).quantityavailable}`);
        }
        const kitIds = kitItems.map((i: any) => parseInt(i.internalid));
        try {
          const kitAvailability = await m2m.getKitComponentAvailability(kitIds);
          console.log(`Express Bath: Kit component availability results:`, JSON.stringify(Object.fromEntries(kitAvailability)));
          for (const item of dedupedItems) {
            const i = item as any;
            const id = parseInt(i.internalid);
            if (kitAvailability.has(id)) {
              const oldQty = i.quantityavailable;
              i.quantityavailable = String(kitAvailability.get(id));
              console.log(`Express Bath KIT ${i.itemnumber}: updated qtyAvailable from ${oldQty} to ${i.quantityavailable}`);
            }
          }
          console.log(`Express Bath: Resolved kit availability for ${kitIds.length} kit items`);
        } catch (kitError) {
          console.error('Express Bath: Failed to resolve kit component availability:', kitError);
        }
      }

      if (dedupedItems.length > 0) {
        const sample = dedupedItems.slice(0, 5).map((i: any) => ({ id: i.internalid, sitecategory: i.sitecategory }));
        console.log('Express Bath sample sitecategory values:', JSON.stringify(sample, null, 2));
      }

      res.json({
        success: true,
        items: dedupedItems,
        count: dedupedItems.length,
        hasMore: result.hasMore,
        totalResults: result.totalResults
      });
    } catch (error) {
      console.error('Express Bath items fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Express Bath items',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/pay-balance', authenticateToken, async (req: any, res: any) => {
    try {
      const { salesOrderId } = req.body;

      if (!salesOrderId) {
        return res.status(400).json({ success: false, message: 'Sales order ID is required' });
      }

      const suiteletUrl = `https://1212804.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=3543&deploy=2&compid=1212804&ns-at=AAEJ7tMQKcksB0knkDChjv954UdVt2fCHwUVHvBPyQ8kJFDimWM&soid=${salesOrderId}`;

      console.log(`Pay balance: Generated payment URL for SO internal ID ${salesOrderId}`);

      res.json({ success: true, paymentUrl: suiteletUrl });
    } catch (error) {
      console.error('Pay balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Manual cache refresh — drops this customer's cached NetSuite data so the next
  // load repopulates live. This is the escape hatch from the TTL window (no
  // NetSuite-side push invalidation). Optional body { entityTypes: string[] } to
  // scope it (e.g. ['account','orders']); omitted clears everything for the customer.
  // Frontends should call this, then refetch their react-query keys.
  app.post('/api/cache/refresh', authenticateToken, async (req: any, res) => {
    try {
      const customerId = req.user?.netsuiteCustomerId;
      if (!customerId) {
        return res.status(400).json({ success: false, message: 'No NetSuite customer for this user' });
      }
      const entityTypes = Array.isArray(req.body?.entityTypes) ? req.body.entityTypes : undefined;
      await invalidateCustomer(customerId, entityTypes);
      // Also drop the in-memory status/account cache (validateCustomerAccess) for this customer.
      customerAccountCache.delete(customerId);
      res.json({ success: true });
    } catch (error) {
      console.error('Cache refresh error:', error);
      res.status(500).json({ success: false, message: 'Failed to refresh cache' });
    }
  });

  // Admin: NetSuite request-volume metrics — live snapshot (this instance) plus the
  // persisted per-minute time-series (aggregated across instances). Admin-gated.
  app.get('/api/admin/metrics', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const allowed = ['minute', 'hour', 'day', 'week', 'month'] as const;
      const granularity = (allowed as readonly string[]).includes(req.query.granularity as string)
        ? (req.query.granularity as typeof allowed[number])
        : 'minute';
      const series = await getMetricsRollup(granularity);
      res.json({
        live: {
          snapshot: getMetricsSnapshot(),
          concurrency: nsLimitStatus(),
        },
        series,
        granularity,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Admin metrics error:', error);
      res.status(500).json({ message: 'Failed to load metrics' });
    }
  });

  // Admin: portal user metrics — totals, signups per day, and recent sign-ins.
  app.get('/api/admin/user-metrics', authenticateToken, requireAdmin, async (_req: any, res) => {
    try {
      const totalsResult = await db.execute(sql`
        SELECT
          COUNT(*)::int                                                            AS "totalUsers",
          COUNT(*) FILTER (WHERE is_active)::int                                   AS "activeUsers",
          COUNT(*) FILTER (WHERE is_admin)::int                                    AS "adminUsers",
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '24 hours')::int AS "signedIn24h",
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int   AS "signedIn7d",
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int     AS "newUsers30d"
        FROM users
      `);

      const signupsResult = await db.execute(sql`
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS signups
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
      `);

      const recentResult = await db.execute(sql`
        SELECT email, company_name AS "companyName", last_login_at AS "lastLoginAt",
               login_count AS "loginCount", is_admin AS "isAdmin"
        FROM users
        WHERE last_login_at IS NOT NULL
        ORDER BY last_login_at DESC
        LIMIT 10
      `);

      res.json({
        totals: totalsResult.rows[0],
        signupsByDay: signupsResult.rows,
        recentSignIns: recentResult.rows,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Admin user metrics error:', error);
      res.status(500).json({ message: 'Failed to load user metrics' });
    }
  });

  return httpServer;
}
