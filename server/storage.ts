import { 
  users, accounts, orders, invoices, payments, syncJobs, supportTickets, estimates,
  loyaltyAccounts, loyaltyTransactions, loyaltyRewards,
  type User, type InsertUser, type Account, type InsertAccount,
  type Order, type InsertOrder, type Invoice, type InsertInvoice,
  type Payment, type InsertPayment, type SyncJob, type InsertSyncJob,
  type SupportTicket, type InsertSupportTicket,
  type Estimate, type InsertEstimate
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;

  // Account operations
  getUserAccount(userId: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, account: Partial<Account>): Promise<Account | undefined>;

  // Order operations
  getUserOrders(userId: string, limit?: number): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined>;
  getOrderByNetsuiteId(netsuiteId: string): Promise<Order | undefined>;

  // Invoice operations
  getUserInvoices(userId: string, limit?: number): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice | undefined>;
  getInvoiceByNetsuiteId(netsuiteId: string): Promise<Invoice | undefined>;

  // Payment operations
  getUserPayments(userId: string, limit?: number): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<Payment>): Promise<Payment | undefined>;
  getPaymentByNetsuiteId(netsuiteId: string): Promise<Payment | undefined>;

  // Sync job operations
  createSyncJob(job: InsertSyncJob): Promise<SyncJob>;
  updateSyncJob(id: string, job: Partial<SyncJob>): Promise<SyncJob | undefined>;
  getPendingSyncJobs(): Promise<SyncJob[]>;
  getActiveSyncJobs(): Promise<SyncJob[]>;

  // Support ticket operations
  getUserSupportTickets(userId: string): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: string, ticket: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  
  // Estimate operations
  getUserEstimates(userId: string, limit?: number): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  createEstimate(estimate: InsertEstimate): Promise<Estimate>;
  updateEstimate(id: string, estimate: Partial<Estimate>): Promise<Estimate | undefined>;

  // Loyalty operations
  getLoyaltyAccount(userId: string): Promise<any>;
  getLoyaltyTransactions(userId: string): Promise<any[]>;
  getLoyaltyRewards(): Promise<any[]>;

  // Dashboard analytics
  getUserDashboardData(userId: string): Promise<{
    account: Account | null;
    recentOrders: Order[];
    recentPayments: Payment[];
    outstandingInvoices: Invoice[];
    pendingOrdersCount: number;
    monthlyTotal: string;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      updatedAt: new Date(),
    }).returning();
    return user;
  }

  async updateUser(id: string, user: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async getUserAccount(userId: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    return account || undefined;
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const [account] = await db.insert(accounts).values({
      ...insertAccount,
      updatedAt: new Date(),
    }).returning();
    return account;
  }

  async updateAccount(id: string, account: Partial<Account>): Promise<Account | undefined> {
    const [updatedAccount] = await db.update(accounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return updatedAccount || undefined;
  }

  async getUserOrders(userId: string, limit = 10): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.orderDate))
      .limit(limit);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values({
      ...insertOrder,
      updatedAt: new Date(),
    }).returning();
    return order;
  }

  async updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder || undefined;
  }

  async getOrderByNetsuiteId(netsuiteId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.netsuiteId, netsuiteId));
    return order || undefined;
  }

  async getUserInvoices(userId: string, limit = 10): Promise<Invoice[]> {
    return await db.select().from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.invoiceDate))
      .limit(limit);
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values({
      ...insertInvoice,
      updatedAt: new Date(),
    }).returning();
    return invoice;
  }

  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db.update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice || undefined;
  }

  async getInvoiceByNetsuiteId(netsuiteId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.netsuiteId, netsuiteId));
    return invoice || undefined;
  }

  async getUserPayments(userId: string, limit = 10): Promise<Payment[]> {
    return await db.select().from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.paymentDate))
      .limit(limit);
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values({
      ...insertPayment,
      updatedAt: new Date(),
    }).returning();
    return payment;
  }

  async updatePayment(id: string, payment: Partial<Payment>): Promise<Payment | undefined> {
    const [updatedPayment] = await db.update(payments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updatedPayment || undefined;
  }

  async getPaymentByNetsuiteId(netsuiteId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.netsuiteId, netsuiteId));
    return payment || undefined;
  }

  async createSyncJob(insertJob: InsertSyncJob): Promise<SyncJob> {
    const [job] = await db.insert(syncJobs).values(insertJob).returning();
    return job;
  }

  async updateSyncJob(id: string, job: Partial<SyncJob>): Promise<SyncJob | undefined> {
    const [updatedJob] = await db.update(syncJobs)
      .set(job)
      .where(eq(syncJobs.id, id))
      .returning();
    return updatedJob || undefined;
  }

  async getPendingSyncJobs(): Promise<SyncJob[]> {
    return await db.select().from(syncJobs)
      .where(eq(syncJobs.status, 'pending'))
      .orderBy(syncJobs.createdAt);
  }

  async getActiveSyncJobs(): Promise<SyncJob[]> {
    return await db.select().from(syncJobs)
      .where(eq(syncJobs.status, 'running'))
      .orderBy(syncJobs.startedAt);
  }

  async getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async createSupportTicket(insertTicket: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values({
      ...insertTicket,
      updatedAt: new Date(),
    }).returning();
    return ticket;
  }

  async updateSupportTicket(id: string, ticket: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const [updatedTicket] = await db.update(supportTickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updatedTicket || undefined;
  }

  async getUserEstimates(userId: string, limit = 20): Promise<Estimate[]> {
    return await db.select().from(estimates)
      .where(eq(estimates.userId, userId))
      .orderBy(desc(estimates.estimateDate))
      .limit(limit);
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    return estimate || undefined;
  }

  async createEstimate(insertEstimate: InsertEstimate): Promise<Estimate> {
    const [estimate] = await db.insert(estimates).values({
      ...insertEstimate,
      updatedAt: new Date(),
    }).returning();
    return estimate;
  }

  async updateEstimate(id: string, estimate: Partial<Estimate>): Promise<Estimate | undefined> {
    const [updatedEstimate] = await db.update(estimates)
      .set({ ...estimate, updatedAt: new Date() })
      .where(eq(estimates.id, id))
      .returning();
    return updatedEstimate || undefined;
  }

  async getUserDashboardData(userId: string) {
    const [account] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    
    const recentOrders = await db.select().from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.orderDate))
      .limit(5);

    const recentPayments = await db.select().from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.paymentDate))
      .limit(5);

    const outstandingInvoices = await db.select().from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        eq(invoices.status, 'open')
      ))
      .orderBy(desc(invoices.dueDate));

    const [pendingOrdersResult] = await db.select({ 
      count: sql<number>`count(*)::int` 
    }).from(orders)
      .where(and(
        eq(orders.userId, userId),
        eq(orders.status, 'pending')
      ));

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const [monthlyTotalResult] = await db.select({
      total: sql<string>`COALESCE(SUM(total_amount), 0)::text`
    }).from(orders)
      .where(and(
        eq(orders.userId, userId),
        gte(orders.orderDate, currentMonth)
      ));

    return {
      account: account || null,
      recentOrders,
      recentPayments,
      outstandingInvoices,
      pendingOrdersCount: pendingOrdersResult.count,
      monthlyTotal: monthlyTotalResult.total || "0",
    };
  }

  async getLoyaltyAccount(userId: string): Promise<any> {
    const [loyaltyAccount] = await db.select().from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.userId, userId));
    return loyaltyAccount || undefined;
  }

  async getLoyaltyTransactions(userId: string): Promise<any[]> {
    const transactions = await db.select().from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.userId, userId))
      .orderBy(desc(loyaltyTransactions.transactionDate))
      .limit(50);
    return transactions;
  }

  async getLoyaltyRewards(): Promise<any[]> {
    const rewards = await db.select().from(loyaltyRewards)
      .where(eq(loyaltyRewards.available, true))
      .orderBy(loyaltyRewards.pointsRequired);
    return rewards;
  }
}

export const storage = new DatabaseStorage();
