import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { syncService } from "./services/sync";
import { queueService } from "./services/queue";
import { 
  loginSchema, 
  registrationSchema, 
  changePasswordSchema, 
  requestPasswordResetSchema, 
  resetPasswordSchema
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { netsuiteClient } from "./services/netsuite-simple";

const JWT_SECRET = process.env.JWT_SECRET || "customer-portal-secret-key-2025";

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

    req.user = { 
      id: user.id, 
      username: user.username,
      netsuiteCustomerId: decoded.netsuiteCustomerId,
      isNetSuiteUser: decoded.isNetSuiteUser,
      ssoUser: decoded.ssoUser || false
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

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
      const { NetSuiteM2M } = await import('./services/netsuite-m2m');
      const m2m = new NetSuiteM2M();
      const customerData = await m2m.getCustomerAccount(user.netsuiteCustomerId);
      
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
      
      // In production, this would integrate with NetSuite's customer authentication API
      // For now, authenticate against our database
      let user = await storage.getUserByEmail(email);
      
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
      const { email, password } = loginSchema.parse(req.body);
      
      // Verify credentials
      const user = await storage.verifyPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Update last login
      await storage.updateUser(user.id, {
        updatedAt: new Date(),
      });

      // Check customer status if user has NetSuite customer ID
      if (user.netsuiteCustomerId) {
        try {
          const { NetSuiteM2M } = await import('./services/netsuite-m2m');
          const m2m = new NetSuiteM2M();
          const customerData = await m2m.getCustomerAccount(user.netsuiteCustomerId);
          
          const customerStatus = customerData.customerstatus;
          console.log(`Customer status for NetSuite ID ${user.netsuiteCustomerId}: ${customerStatus}`);
          
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
          console.error('Error checking customer status:', error);
          // Continue login if status check fails - don't block access due to API errors
        }
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          netsuiteCustomerId: user.netsuiteCustomerId
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
          netsuiteCustomerId: user.netsuiteCustomerId
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
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id.toString(),
        username: user.email, // Using email as username for backward compatibility
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        companyName: user.companyName || '',
        netsuiteCustomerId: user.netsuiteCustomerId,
        isNetSuiteUser: !!user.netsuiteCustomerId, // Flag if user has NetSuite ID
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Change password endpoint
  app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const userId = req.user.id;
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Update password
      const updated = await storage.updatePassword(userId, newPassword);
      if (!updated) {
        return res.status(500).json({ message: 'Failed to update password' });
      }
      
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Change password error:', error);
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
      
      // Fetch all data in parallel for efficiency
      const [account, orders, invoices, payments, estimates, cases, allOrders, allEstimates, allCases] = await Promise.all([
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
        }),
        m2m.getCustomerEstimates(req.user.netsuiteCustomerId, 5).catch(err => {
          console.error('Failed to fetch estimates:', err);
          return [];
        }),
        m2m.getCustomerCases(req.user.netsuiteCustomerId, 5).catch(err => {
          console.error('Failed to fetch cases:', err);
          return [];
        }),
        // Fetch all orders to get accurate count
        m2m.getCustomerOrders(req.user.netsuiteCustomerId, 100).catch(err => {
          console.error('Failed to fetch all orders:', err);
          return [];
        }),
        // Fetch all estimates to get accurate count
        m2m.getCustomerEstimates(req.user.netsuiteCustomerId, 100).catch(err => {
          console.error('Failed to fetch all estimates:', err);
          return [];
        }),
        // Fetch all cases to get accurate count
        m2m.getCustomerCases(req.user.netsuiteCustomerId, 100).catch(err => {
          console.error('Failed to fetch all cases:', err);
          return [];
        })
      ]);
      
      // Calculate metrics using all records for accurate counts
      const activeOrdersCount = allOrders.filter((order: any) => 
        ['A', 'B', 'D', 'E', 'F'].includes(order.status) // All non-closed, non-cancelled statuses
      ).length;
      
      const activeEstimatesCount = allEstimates.filter((estimate: any) => 
        estimate.status && !['Closed', 'Voided', 'Rejected'].includes(estimate.status)
      ).length;
      
      // In NetSuite, status 5 = Closed, so exclude those
      const openCasesCount = allCases.filter((supportCase: any) => 
        supportCase.status !== '5' && supportCase.status !== 5
      ).length;
      
      const pendingOrdersCount = allOrders.filter((order: any) => 
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
          crdRebateBalance: account.crdrebatebalance || '0.00',
          dataFreshness: 'live' as const
        } : null,
        recentOrders: orders.slice(0, 5).map((order: any) => ({
          id: order.id,
          orderNumber: order.ordernumber || order.tranid,
          status: order.status,
          totalAmount: order.total || '0.00', // Frontend expects totalAmount, not total
          currency: 'USD',
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
        orderNumber: item.ordernumber || item.tranid,
        status: mapStatus(item.status),
        totalAmount: item.total || '0.00', // NetSuite returns lowercase 'total'
        currency: 'USD',
        orderDate: item.orderdate || item.trandate,
        shipDate: item.shipdate,
        shipMethod: item.shipmethod,
        deliveryDate: null,
        trackingNumber: null,
        shippingAddress: null,
        memo: item.memo || '',
        customerName: item.customername,
        jobId: item.jobid || '',
        crdEndUser: item.crdenduser || '',
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
      
      // Fetch order details with line items from NetSuite
      const orderDetails = await m2m.getOrderDetails(req.params.id);
      
      // Log the raw data to understand what NetSuite is returning
      console.log('Raw NetSuite order data:', JSON.stringify(orderDetails, null, 2));
      
      // Transform the response to match frontend expectations
      const transformed = {
        id: orderDetails.id,
        orderNumber: orderDetails.ordernumber || orderDetails.tranid,
        status: mapStatus(orderDetails.status),
        orderDate: orderDetails.orderdate || orderDetails.trandate,
        shipDate: orderDetails.shipdate,
        deliveryDate: null,
        totalAmount: orderDetails.total || '0.00',
        subtotal: orderDetails.subtotal || '0.00',
        tax: orderDetails.tax || '0.00',
        shipping: orderDetails.shipping || '0.00',
        currency: 'USD',
        shippingAddress: orderDetails.shippingaddress,
        billingAddress: orderDetails.billingaddress,
        trackingNumber: null,
        memo: orderDetails.memo,
        customerName: orderDetails.customername,
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
          praType: pra.pratype,
          praDescription: pra.pradescription
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
      const limit = parseInt(req.query.limit as string) || 20;
      
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
        altPhone: accountData.altphone,
        mobilePhone: accountData.mobilephone || accountData.mobilePhone,
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
        
        // Check if contact is primary (role -10)
        const isPrimary = contact.contactrole === -10 || contact.contactrole === '-10';
        const roleDisplay = isPrimary ? 'Primary Contact' : (contact.role || '');
        
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
      if (req.user.netsuiteCustomerId && estimate.customerId !== req.user.netsuiteCustomerId) {
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
        shipping: '0', // Shipping not available in SuiteQL
        currency: estimate.currency || 'USD',
        estimateDate: estimate.date || estimate.trandate,
        expiryDate: estimate.expirationdate || estimate.duedate,
        memo: estimate.memo || '',
        tagFor: estimate.tagfor || '',
        customerName: estimate.customername,
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
        author: msg.authorname || 'System',
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
          messages: [] // Will be populated if we can fetch messages separately
        };
      };
      
      // Only fetch cases linked to the customer record directly
      console.log('Fetching support cases for customer ID:', req.user.netsuiteCustomerId);
      const cases = await m2m.getCustomerCases(req.user.netsuiteCustomerId, null, 30);
      console.log(`Found ${cases.length} support cases from NetSuite`);
      
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
      // For now, we'll return a message that ticket creation should be done in NetSuite
      // In a real implementation, this would create a case in NetSuite via API
      res.status(201).json({ 
        message: 'Please contact our support team directly to create a new support case.',
        email: 'support@consumersmail.com',
        phone: '1-800-SUPPORT'
      });
    } catch (error) {
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
          SUM(
            CASE
              WHEN transaction.type IN ('CustInvc', 'CashSale') THEN transaction.total
              WHEN transaction.type = 'CustCred' THEN -1 * transaction.total
              ELSE 0
            END
          ) AS qualifyingSales
        FROM 
          transaction
        WHERE 
          transaction.entity = ${customerId}
          AND transaction.type IN ('CustInvc', 'CashSale', 'CustCred')
          AND transaction.trandate >= '${startDate}'
          AND transaction.trandate <= '${endDate}'
      `;
      
      console.log('Qualifying sales query:', salesQuery);
      const salesResponse = await netsuiteM2M.executeSuiteQL(salesQuery, 1);
      console.log('Qualifying sales response:', salesResponse);
      const salesData = salesResponse.items?.[0];
      // NetSuite returns field names in lowercase
      const qualifyingSales = salesData?.qualifyingsales || salesData?.QUALIFYINGSALES || '0';
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

  return httpServer;
}
