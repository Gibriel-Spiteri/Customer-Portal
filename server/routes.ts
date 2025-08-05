import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { syncService } from "./services/sync";
import { queueService } from "./services/queue";
import { insertUserSchema, insertSupportTicketSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { netsuiteAuth } from "./services/netsuite-auth";
import { netsuiteDirectAuth } from "./services/netsuite-direct-auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = { id: user.id, username: user.username };
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
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

  // Authentication routes
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

      const token = jwt.sign(
        { userId: user.id, username: user.username },
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

  // NetSuite direct authentication (credentials in form)
  app.post('/api/auth/netsuite-direct', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Authenticate with NetSuite using provided credentials
      const authResult = await netsuiteDirectAuth.authenticateUser({
        email,
        password,
        accountId: process.env.NETSUITE_ACCOUNT_ID || ''
      });

      if (!authResult.success) {
        return res.status(401).json({ message: authResult.error || 'Authentication failed' });
      }

      const customerData = authResult.user;

      // Create or update user in our database
      let user = await storage.getUserByUsername(customerData.email);
      
      if (!user) {
        // Create new user from NetSuite customer data
        user = await storage.createUser({
          username: customerData.email,
          email: customerData.email,
          password: '', // No password needed for NetSuite users
          firstName: customerData.firstname || '',
          lastName: customerData.lastname || '',
          companyName: customerData.companyname || ''
        });
      } else {
        // Update user data from NetSuite
        await storage.updateUser(user.id, {
          firstName: customerData.firstname || user.firstName,
          lastName: customerData.lastname || user.lastName,
          companyName: customerData.companyname || user.companyName,
          lastLoginAt: new Date()
        });
      }

      // Create JWT token for our application
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username, 
          authProvider: 'netsuite-direct',
          netsuiteCustomerId: customerData.id
        },
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
        netsuiteData: {
          accountNumber: customerData.accountNumber,
          customerType: customerData.customerType,
          status: customerData.status
        }
      });

    } catch (error) {
      console.error('NetSuite direct authentication error:', error);
      res.status(500).json({ message: 'Authentication failed. Please try again.' });
    }
  });

  // NetSuite OAuth authentication routes
  app.get('/api/auth/netsuite', (req, res) => {
    try {
      const { url, state, codeVerifier } = netsuiteAuth.generateAuthorizationUrl();
      
      // Store state and code verifier in session/cookie for security
      res.cookie('oauth_state', state, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      res.cookie('oauth_code_verifier', codeVerifier, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      
      res.json({ authUrl: url });
    } catch (error) {
      console.error('NetSuite auth initiation error:', error);
      res.status(500).json({ message: 'Failed to initiate NetSuite authentication' });
    }
  });

  app.get('/auth/netsuite/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        return res.redirect(`/login?error=${encodeURIComponent(error as string)}`);
      }
      
      if (!code || !state) {
        return res.redirect('/login?error=missing_parameters');
      }
      
      // Verify state parameter
      const storedState = req.cookies?.oauth_state;
      const codeVerifier = req.cookies?.oauth_code_verifier;
      
      if (!storedState || storedState !== state || !codeVerifier) {
        return res.redirect('/login?error=invalid_state');
      }
      
      // Exchange authorization code for tokens
      const tokenResponse = await netsuiteAuth.exchangeCodeForToken(code as string, codeVerifier);
      
      // Get customer information from NetSuite
      const customerInfo = await netsuiteAuth.getCustomerInfo(tokenResponse.access_token);
      
      // Create or update user in our database
      let user = await storage.getUserByUsername(customerInfo.email || customerInfo.entityid);
      
      if (!user) {
        // Create new user from NetSuite customer data
        user = await storage.createUser({
          username: customerInfo.email || customerInfo.entityid,
          email: customerInfo.email,
          password: '', // No password needed for OAuth users
          firstName: customerInfo.firstname || '',
          lastName: customerInfo.lastname || '',
          companyName: customerInfo.companyname || ''
        });
      }
      
      // Create JWT token for our application
      const appToken = jwt.sign(
        { userId: user.id, username: user.username, authProvider: 'netsuite' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Clear OAuth cookies
      res.clearCookie('oauth_state');
      res.clearCookie('oauth_code_verifier');
      
      // Redirect to dashboard with token
      res.redirect(`/?token=${appToken}`);
      
    } catch (error) {
      console.error('NetSuite callback error:', error);
      res.redirect('/login?error=authentication_failed');
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

  // Dashboard data
  app.get('/api/dashboard', authenticateToken, async (req: any, res) => {
    try {
      const dashboardData = await storage.getUserDashboardData(req.user.id);
      res.json(dashboardData);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
  });

  // Orders
  app.get('/api/orders', authenticateToken, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const orders = await storage.getUserOrders(req.user.id, limit);
      res.json(orders);
    } catch (error) {
      console.error('Orders error:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders/:id', authenticateToken, async (req: any, res) => {
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

  // Payments
  app.get('/api/payments', authenticateToken, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const payments = await storage.getUserPayments(req.user.id, limit);
      res.json(payments);
    } catch (error) {
      console.error('Payments error:', error);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  // Invoices
  app.get('/api/invoices', authenticateToken, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const invoices = await storage.getUserInvoices(req.user.id, limit);
      res.json(invoices);
    } catch (error) {
      console.error('Invoices error:', error);
      res.status(500).json({ message: 'Failed to fetch invoices' });
    }
  });

  // Account
  app.get('/api/account', authenticateToken, async (req: any, res) => {
    try {
      const account = await storage.getUserAccount(req.user.id);
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }
      res.json(account);
    } catch (error) {
      console.error('Account error:', error);
      res.status(500).json({ message: 'Failed to fetch account' });
    }
  });

  // Support tickets
  app.get('/api/support/tickets', authenticateToken, async (req: any, res) => {
    try {
      const tickets = await storage.getUserSupportTickets(req.user.id);
      res.json(tickets);
    } catch (error) {
      console.error('Support tickets error:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  app.post('/api/support/tickets', authenticateToken, async (req: any, res) => {
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
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
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

  return httpServer;
}
