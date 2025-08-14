import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { syncService } from "./services/sync";
import { queueService } from "./services/queue";
import { authService } from "./services/auth";
import { registrationSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { netsuiteClient } from "./services/netsuite-simple";

const JWT_SECRET = process.env.JWT_SECRET || "customer-portal-secret-key-2025";

interface AuthenticatedRequest extends Request {
  user?: { 
    id: string; 
    email: string;
    netsuiteCustomerId: string;
  };
}

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = authService.verifyAccessToken(token);
    const user = await storage.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = { 
      id: user.id, 
      email: user.email,
      netsuiteCustomerId: user.netsuiteCustomerId
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to validate customer access
const validateCustomerAccess = async (req: any, res: any, next: any) => {
  const user = req.user;
  
  // Ensure user has NetSuite customer ID
  if (!user.netsuiteCustomerId) {
    return res.status(403).json({ 
      message: 'Customer access required',
      error: 'Missing NetSuite customer identification'
    });
  }
  
  // Add customer filter for data isolation
  req.customerFilter = {
    customerId: user.netsuiteCustomerId
  };
  
  console.log('Customer access validated for customer:', user.netsuiteCustomerId);
  next();
};

// Helper to get client IP address
const getClientIp = (req: any): string => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

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

  // ==========================================
  // Authentication Endpoints
  // ==========================================

  // Validate invitation token
  app.post('/api/auth/validate-invitation', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const result = await authService.validateInvitation(token);
      
      if (!result.valid) {
        return res.status(400).json({ 
          valid: false, 
          message: result.error 
        });
      }

      res.json({ 
        valid: true, 
        data: result.invitation 
      });
    } catch (error) {
      console.error('Invitation validation error:', error);
      res.status(500).json({ message: 'Failed to validate invitation' });
    }
  });

  // Register new user with invitation
  app.post('/api/auth/register', async (req, res) => {
    try {
      // Validate request body
      const validatedData = registrationSchema.parse(req.body);
      
      const result = await authService.registerUser({
        email: validatedData.email,
        password: validatedData.password,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        companyName: validatedData.companyName,
        phone: validatedData.phone,
        netsuiteCustomerId: req.body.netsuiteCustomerId, // From invitation
        invitationToken: validatedData.token,
      });

      res.json({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          companyName: result.user.companyName,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Registration failed' 
      });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const ipAddress = getClientIp(req);
      
      const result = await authService.authenticateUser(
        validatedData.email,
        validatedData.password,
        ipAddress
      );

      if (!result) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      res.json({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          companyName: result.user.companyName,
          netsuiteCustomerId: result.user.netsuiteCustomerId,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Login failed' 
      });
    }
  });

  // Refresh token
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token required' });
      }

      const result = await authService.refreshAccessToken(refreshToken);
      
      res.json({
        success: true,
        accessToken: result.accessToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          companyName: result.user.companyName,
        },
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ 
        message: error instanceof Error ? error.message : 'Failed to refresh token' 
      });
    }
  });

  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.json({ success: true, message: 'Logged out' });
    }
  });

  // Get current user
  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        netsuiteCustomerId: user.netsuiteCustomerId,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to get user data' });
    }
  });

  // Create invitation (admin endpoint - you may want to add admin authentication)
  app.post('/api/admin/invitations', async (req, res) => {
    try {
      // TODO: Add admin authentication middleware
      const { netsuiteCustomerId, email, companyName, firstName, lastName } = req.body;
      
      if (!netsuiteCustomerId || !email) {
        return res.status(400).json({ 
          message: 'NetSuite Customer ID and email are required' 
        });
      }

      const result = await authService.createInvitation({
        netsuiteCustomerId,
        email,
        companyName,
        firstName,
        lastName,
        createdBy: 'admin', // TODO: Get from authenticated admin user
      });

      const invitationUrl = `${process.env.APP_URL || 'http://localhost:5000'}/register?token=${result.token}`;

      res.json({
        success: true,
        token: result.token,
        invitationUrl,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      console.error('Create invitation error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create invitation' 
      });
    }
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
      let user = await storage.getUserByUsername(email);
      
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
  
  // Custom login endpoint for direct NetSuite authentication
  app.post('/api/auth/custom-login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      console.log('Custom login attempt for email:', email);
      
      // In production, this would integrate with NetSuite's customer authentication API
      // For now, authenticate against our database
      let user = await storage.getUserByUsername(email);
      
      if (!user) {
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
      
      // Try to get demo user first
      let user = await storage.getUserByUsername(`demo_${customerId}`);
      
      if (!user) {
        // Check if another user already has this customer ID
        const existingUserWithCustomer = await storage.getUserByNetsuiteId(customerId);
        
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
            companyName: customerConfig.companyName,
            netsuiteCustomerId: customerId,
          });
          console.log(`Created new demo user with customer ID ${customerId}`);
        }
      } else {
        console.log('Using existing demo user:', user.username);
        // Update last login
        await storage.updateUser(user.id, {
          lastLoginAt: new Date(),
        });
      }

      // Create session with NetSuite customer info
      const sessionData = {
        userId: user.id,
        username: user.username,
        netsuiteCustomerId: customerId,
        isNetSuiteUser: true,
        customerCenterAccess: true,
        companyName: customerConfig.companyName
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
          companyName: customerConfig.companyName,
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
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Update last login
      await storage.updateUser(user.id, {
        lastLoginAt: new Date(),
      });

      // NetSuite integration disabled - demo mode only
      const sessionData = {
        userId: user.id,
        username: user.username
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
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
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
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
        },
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
      
      // Fetch all data in parallel for efficiency
      const [account, orders, invoices, payments] = await Promise.all([
        m2m.getCustomerAccount(req.user.netsuiteCustomerId).catch(err => {
          console.error('Failed to fetch account:', err);
          return null;
        }),
        m2m.getCustomerOrders(req.user.netsuiteCustomerId, 5).catch(err => {
          console.error('Failed to fetch orders:', err);
          return [];
        }),
        m2m.getCustomerInvoices(req.user.netsuiteCustomerId, 5).catch(err => {
          console.error('Failed to fetch invoices:', err);
          return [];
        }),
        m2m.getCustomerPayments(req.user.netsuiteCustomerId, 5).catch(err => {
          console.error('Failed to fetch payments:', err);
          return [];
        })
      ]);
      
      // Calculate metrics
      const pendingOrdersCount = orders.filter((order: any) => 
        ['A', 'B', 'F'].includes(order.status) // Pending, Pending Approval, Pending Fulfillment
      ).length;
      
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
          dataFreshness: 'live' as const
        } : null,
        recentOrders: orders.slice(0, 5).map((order: any) => ({
          id: order.id,
          orderNumber: order.ordernumber || order.tranid,
          status: order.status,
          total: order.total || '0.00',
          orderDate: order.orderdate || order.trandate
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
        pendingOrdersCount,
        monthlyTotal,
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
      const limit = parseInt(req.query.limit as string) || 20;
      
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
          'A': 'pending',
          'B': 'pending approval',
          'C': 'cancelled',
          'D': 'partially fulfilled',
          'E': 'pending billing',
          'F': 'pending fulfillment',
          'G': 'fully billed',
          'H': 'closed',
        };
        return statusMap[status] || status.toLowerCase();
      };
      
      // Transform NetSuite data to match frontend format
      const transformOrder = (item: any) => ({
        id: item.id,
        orderNumber: item.ordernumber || item.orderNumber || item.tranid,
        status: mapStatus(item.status),
        total: item.total || '0.00',
        orderDate: item.orderdate || item.orderDate || item.trandate,
        shipDate: item.shipdate || item.shipDate,
        shipMethod: item.shipmethod || item.shipMethod,
        memo: item.memo || '',
        customerName: item.customername || item.customerName,
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
      const order = await storage.getOrder(req.params.id);
      if (!order || order.userId !== req.user.id) {
        return res.status(404).json({ message: 'Order not found' });
      }
      res.json(order);
    } catch (error) {
      console.error('Order detail error:', error);
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });

  // Payments - Fetch from NetSuite using SuiteQL
  app.get('/api/payments', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Check if NetSuite M2M is configured and user has customer ID
      if (!process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET || !req.user.netsuiteCustomerId) {
        console.log('NetSuite M2M not configured or no customer ID, returning database payments');
        const payments = await storage.getUserPayments(req.user.id, limit);
        return res.json(payments);
      }
      
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Transform NetSuite data to match frontend format
      const transformPayment = (item: any) => ({
        id: item.id,
        paymentNumber: item.paymentnumber || item.paymentNumber || item.tranid,
        amount: item.amount || item.total || '0.00',
        paymentDate: item.paymentdate || item.paymentDate || item.trandate,
        status: 'processed',
        method: item.paymentmethod || 'Credit Card',
        memo: item.memo || '',
        customerName: item.customername || item.customerName,
        dataFreshness: 'live' as const,
        lastSyncAt: new Date().toISOString()
      });
      
      const payments = await m2m.getCustomerPayments(req.user.netsuiteCustomerId, limit);
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
      const limit = parseInt(req.query.limit as string) || 20;
      
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

  // Support tickets
  // Estimates - Fetch from NetSuite using SuiteQL
  app.get('/api/estimates', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
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
          'A': 'accepted',
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
        estimateNumber: item.documentnumber || item.documentNumber || item.tranid,
        status: mapStatus(item.status),
        amount: item.total || item.amount || '0.00',
        currency: item.currency || 'USD',
        estimateDate: item.date || item.trandate || item.createddate,
        expiryDate: item.expirationdate || item.expirationDate || item.duedate,
        description: item.memo || '',
        customerName: item.customername || item.customerName,
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
      if (req.user.netsuiteCustomerId && estimate.customerId !== req.user.netsuiteCustomerId) {
        return res.status(403).json({ message: 'Access denied to this estimate' });
      }
      
      res.json(estimate);
    } catch (error: any) {
      console.error('Error fetching estimate details:', error);
      res.status(500).json({ message: 'Failed to fetch estimate details' });
    }
  });

  app.get('/api/support/tickets', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const tickets = await storage.getUserSupportTickets(req.user.id);
      res.json(tickets);
    } catch (error) {
      console.error('Support tickets error:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  app.post('/api/support/tickets', authenticateToken, validateCustomerAccess, async (req: any, res) => {
    try {
      const ticketData = insertSupportTicketSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const ticket = await storage.createSupportTicket(ticketData);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Create support ticket error:', error);
      res.status(500).json({ message: 'Failed to create support ticket' });
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
      
      // SuiteQL query to fetch CRD rebate records
      const query = `
        SELECT 
          customrecord_crdrebate.id,
          customrecord_crdrebate.custrecord_crdrebate_date AS rebateDate,
          customrecord_crdrebate.custrecord_crdrebate_amount AS amount,
          customrecord_crdrebate.custrecord_crdrebate_type AS typeId,
          customrecord_crdrebate.custrecord_crdrebate_reversed AS reversed,
          customrecord_crdrebate.custrecord_crdrebate_salesorder AS salesOrderId,
          customrecord_crdrebate.custrecord_crdrebate_expiration_date AS expirationDate,
          customrecord_crdrebate.custrecord_crdrebate_applyingtxn AS applyingTxnId,
          customrecord_crdrebate.custrecord_crdrebate_category AS categoryId,
          customrecord_crdrebate.custrecord_crdrebate_earnedpercent AS earnedPercent,
          customrecord_crdrebate.custrecord_crdrebate_sorebaterate AS salesOrderRebateRate
        FROM 
          customrecord_crdrebate
        WHERE 
          customrecord_crdrebate.custrecord_crdrebate_customer = '${customerId}'
        ORDER BY 
          customrecord_crdrebate.custrecord_crdrebate_date DESC
      `;
      
      const rebatesResponse = await netsuiteM2M.executeSuiteQL(query);
      const rebates = rebatesResponse.items || [];
      
      // Calculate summary statistics
      const totalAvailable = rebates
        .filter((r: any) => !r.reversed && (!r.expirationDate || new Date(r.expirationDate) > new Date()))
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalExpired = rebates
        .filter((r: any) => !r.reversed && r.expirationDate && new Date(r.expirationDate) <= new Date())
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      const totalRedeemed = rebates
        .filter((r: any) => r.applyingTxnId)
        .reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      res.json({
        rebates: rebates.map((rebate: any) => ({
          id: rebate.id,
          date: rebate.rebateDate,
          amount: rebate.amount,
          type: rebate.typeId,
          reversed: rebate.reversed === 'T',
          salesOrder: rebate.salesOrderId,
          expirationDate: rebate.expirationDate,
          applyingTransaction: rebate.applyingTxnId,
          category: rebate.categoryId,
          earnedPercent: rebate.earnedPercent,
          salesOrderRebateRate: rebate.salesOrderRebateRate,
          status: rebate.reversed === 'T' ? 'Reversed' : 
                  rebate.applyingTxnId ? 'Redeemed' :
                  (rebate.expirationDate && new Date(rebate.expirationDate) <= new Date()) ? 'Expired' : 
                  'Available'
        })),
        summary: {
          totalAvailable: totalAvailable.toFixed(2),
          totalExpired: totalExpired.toFixed(2),
          totalRedeemed: totalRedeemed.toFixed(2),
          totalRebates: rebates.length
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

  return httpServer;
}
