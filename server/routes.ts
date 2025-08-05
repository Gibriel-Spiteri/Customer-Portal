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
import { netsuiteService } from "./services/netsuite";

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
      isNetSuiteUser: decoded.isNetSuiteUser
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
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

  // NetSuite authentication disabled - using demo mode only

  // NetSuite OAuth routes disabled - demo mode only

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
      
      // If user is NetSuite user, fetch live data when possible
      if (req.user.isNetSuiteUser && req.user.netsuiteCustomerId) {
        try {
          const { NetSuiteService } = await import('./services/netsuite');
          const netsuiteService = new NetSuiteService();
          
          console.log('Fetching live NetSuite data for customer:', req.user.netsuiteCustomerId);
          
          // Try to get live account balance
          const accountBalance = await netsuiteService.getCustomerBalance(req.user.netsuiteCustomerId);
          if (accountBalance.success && accountBalance.data) {
            dashboardData.account.balance = accountBalance.data.balance.toString();
            dashboardData.account.dataFreshness = 'live';
            console.log('Updated account balance with live NetSuite data:', accountBalance.data.balance);
          }
          
          // Get live order count (recent orders)
          const recentOrders = await netsuiteService.getCustomerOrders(req.user.netsuiteCustomerId, 5);
          if (recentOrders.success && recentOrders.data) {
            // Update the pending orders count based on NetSuite data
            const pendingCount = recentOrders.data.filter(order => 
              ['pending', 'processing'].includes(order.status.toLowerCase())
            ).length;
            
            // Add metrics if they don't exist
            if (!(dashboardData as any).metrics) {
              (dashboardData as any).metrics = { pendingOrders: 0 };
            }
            (dashboardData as any).metrics.pendingOrders = pendingCount;
            (dashboardData as any).metrics.dataFreshness = 'live';
            console.log('Updated pending orders count with live NetSuite data:', pendingCount);
          }
          
        } catch (error) {
          console.log('Failed to fetch live NetSuite data, using cached data:', error);
          // Continue with cached data on error
        }
      }
      
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
  // Estimates
  app.get('/api/estimates', authenticateToken, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      // For NetSuite users, fetch live data
      if (req.user.isNetSuiteUser && req.user.netsuiteCustomerId) {
        console.log('Fetching live estimates for NetSuite customer:', req.user.netsuiteCustomerId);
        const netsuiteEstimates = await netsuiteService.getCustomerEstimates(req.user.netsuiteCustomerId, limit);
        
        if (netsuiteEstimates.success) {
          // Transform NetSuite data to our format
          const transformedEstimates = netsuiteEstimates.data.map(estimate => ({
            id: estimate.id,
            userId: req.user.id,
            netsuiteId: estimate.id,
            estimateNumber: estimate.tranid,
            status: estimate.status,
            amount: estimate.total.toString(),
            currency: estimate.currency,
            estimateDate: estimate.trandate,
            expiryDate: estimate.duedate,
            description: estimate.memo || '',
            items: estimate.item,
            dataFreshness: 'live' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
          
          console.log(`Returning ${transformedEstimates.length} live estimates`);
          return res.json(transformedEstimates);
        }
      }
      
      // Fall back to database data for demo users
      const estimates = await storage.getUserEstimates(req.user.id, limit);
      res.json(estimates);
    } catch (error: any) {
      console.error('Estimates error:', error);
      res.status(500).json({ message: 'Failed to fetch estimates' });
    }
  });

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

  // NetSuite Direct Authentication endpoint
  app.post('/api/auth/netsuite-direct', async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('NetSuite direct auth attempt for:', email);

      // Import the NetSuite direct auth service
      const { netsuiteDirectAuth } = await import('./services/netsuite-direct-auth');
      
      const result = await netsuiteDirectAuth.authenticateUser({
        email,
        password,
        accountId: process.env.NETSUITE_ACCOUNT_ID || ''
      });

      if (!result.success) {
        return res.status(401).json({ 
          message: result.error || 'NetSuite authentication failed' 
        });
      }

      // Create or update user in our database
      let user;
      const existingUser = await storage.getUserByUsername(email);
      
      if (existingUser) {
        // Update existing user with NetSuite data
        user = existingUser;
        console.log('Updating existing user:', user.id);
      } else {
        // Create new user from NetSuite data
        const newUser = {
          username: email,
          email: result.user.email,
          password: '', // NetSuite users don't need local passwords
          firstName: result.user.firstname,
          lastName: result.user.lastname,
          companyName: result.user.companyname,
          netsuiteCustomerId: result.user.customerId,
          netsuiteEntityId: result.user.entityid
        };
        
        user = await storage.createUser(newUser);
        console.log('Created new NetSuite user:', user.id);
      }

      // Create JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          netsuiteCustomerId: result.user.customerId,
          isNetSuiteUser: true
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'NetSuite authentication successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          netsuiteCustomerId: result.user.customerId,
          isNetSuiteUser: true
        }
      });

    } catch (error) {
      console.error('NetSuite direct auth error:', error);
      res.status(500).json({ message: 'NetSuite authentication failed' });
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
