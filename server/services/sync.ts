import { storage } from "../storage";
import { netsuiteService, NetSuiteService } from "./netsuite";
import { netsuiteAuth } from "./netsuite-auth";
import { queueService } from "./queue";
import type { User, InsertOrder, InsertPayment, InsertInvoice, InsertAccount, InsertEstimate } from "@shared/schema";
import { WebSocket } from "ws";

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  duration: number;
}

export class SyncService {
  private isLiveSyncActive = false;
  private batchSyncInterval: NodeJS.Timeout | null = null;
  private liveSyncConnections = new Set<any>();

  constructor() {
    this.startBatchSync();
  }

  // Real-time sync for critical data (orders, payments)
  async startLiveSync(ws?: any): Promise<void> {
    if (ws) {
      this.liveSyncConnections.add(ws);
      ws.on('close', () => {
        this.liveSyncConnections.delete(ws);
      });
    }

    if (this.isLiveSyncActive) return;
    
    this.isLiveSyncActive = true;
    console.log('Live sync activated for critical data');
  }

  async stopLiveSync(): Promise<void> {
    this.isLiveSyncActive = false;
    this.liveSyncConnections.clear();
    console.log('Live sync deactivated');
  }

  // Batch sync for reference data (5-15 minute intervals)
  private startBatchSync(): void {
    // Temporarily disable batch sync until NetSuite is properly configured
    console.log('Batch sync disabled - awaiting NetSuite configuration');
    return;
    
    const intervalMinutes = parseInt(process.env.BATCH_SYNC_INTERVAL || "10");
    
    this.batchSyncInterval = setInterval(async () => {
      console.log('Starting batch sync for cached data...');
      await this.runBatchSync();
    }, intervalMinutes * 60 * 1000);

    // Run initial batch sync
    setTimeout(() => this.runBatchSync(), 5000);
  }

  private async runBatchSync(): Promise<void> {
    try {
      const syncJob = await storage.createSyncJob({
        jobType: 'batch_sync',
        entityType: 'all',
        status: 'pending',
      });

      await storage.updateSyncJob(syncJob.id, {
        status: 'running',
        startedAt: new Date(),
      });

      let totalRecords = 0;
      const errors: string[] = [];

      // Sync customer accounts
      const accountResult = await this.syncCustomerAccounts();
      totalRecords += accountResult.recordsProcessed;
      errors.push(...accountResult.errors);

      // Sync historical orders
      const ordersResult = await this.syncHistoricalOrders();
      totalRecords += ordersResult.recordsProcessed;
      errors.push(...ordersResult.errors);

      // Sync invoices
      const invoicesResult = await this.syncInvoices();
      totalRecords += invoicesResult.recordsProcessed;
      errors.push(...invoicesResult.errors);

      await storage.updateSyncJob(syncJob.id, {
        status: errors.length > 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        recordsProcessed: totalRecords,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
      });

      // Notify connected clients about batch sync completion
      this.broadcastSyncUpdate('batch_sync_completed', {
        recordsProcessed: totalRecords,
        errors: errors.length,
      });

    } catch (error) {
      console.error('Batch sync failed:', error);
    }
  }

  async syncUserOrdersLive(userId: string): Promise<SyncResult> {
    const startTime = Date.now();
    
    console.log('NetSuite integration disabled - orders sync will not run');
    
    return {
      success: true,
      recordsProcessed: 0,
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  async syncUserPaymentsLive(userId: string): Promise<SyncResult> {
    const startTime = Date.now();
    
    console.log('NetSuite integration disabled - payments sync will not run');
    
    return {
      success: true,
      recordsProcessed: 0,
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  private async syncCustomerAccounts(): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    const errors: string[] = [];

    // This would sync all customer accounts in batch
    // Implementation depends on how you want to handle multiple customers
    
    return {
      success: true,
      recordsProcessed,
      errors,
      duration: Date.now() - startTime,
    };
  }

  private async syncHistoricalOrders(): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    const errors: string[] = [];

    // Sync historical orders for all users
    // This would be more comprehensive than live sync
    
    return {
      success: true,
      recordsProcessed,
      errors,
      duration: Date.now() - startTime,
    };
  }

  private async syncInvoices(): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    const errors: string[] = [];

    // Sync invoice data
    
    return {
      success: true,
      recordsProcessed,
      errors,
      duration: Date.now() - startTime,
    };
  }

  private mapOrderStatus(nsStatus: string): string {
    const statusMap: Record<string, string> = {
      'Pending Fulfillment': 'pending',
      'Pending Billing': 'processing',
      'Partially Fulfilled': 'processing',
      'Fulfilled': 'shipped',
      'Shipped': 'shipped',
      'Delivered': 'delivered',
      'Cancelled': 'cancelled',
    };
    return statusMap[nsStatus] || 'pending';
  }

  private mapPaymentMethod(nsMethod: string): string {
    const methodMap: Record<string, string> = {
      'Check': 'check',
      'Credit Card': 'credit_card',
      'Bank Transfer': 'bank_transfer',
      'Cash': 'cash',
    };
    return methodMap[nsMethod] || 'check';
  }

  private mapPaymentStatus(nsStatus: string): string {
    const statusMap: Record<string, string> = {
      'Deposited': 'processed',
      'Not Deposited': 'pending',
      'Voided': 'failed',
    };
    return statusMap[nsStatus] || 'pending';
  }

  private broadcastSyncUpdate(type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    
    this.liveSyncConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  getSyncStatus() {
    return {
      liveSyncActive: this.isLiveSyncActive,
      connectedClients: this.liveSyncConnections.size,
      batchSyncEnabled: this.batchSyncInterval !== null,
      netSuiteConcurrency: netsuiteService.getConcurrencyStatus(),
    };
  }

  async queueLiveSync(userId: string, entityType: 'orders' | 'payments' | 'estimates'): Promise<void> {
    await queueService.addJob(`live-sync-${entityType}`, {
      userId,
      entityType,
      priority: 'high',
    });
  }



  async syncUserEstimatesLive(userId: string): Promise<SyncResult> {
    const startTime = Date.now();
    
    console.log('NetSuite integration disabled - estimates sync will not run');
    
    return {
      success: true,
      recordsProcessed: 0,
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  private mapEstimateStatus(nsStatus: string): string {
    const statusMap: Record<string, string> = {
      'Open': 'sent',
      'Closed': 'accepted',
      'Voided': 'rejected',
      'Expired': 'expired',
      'In Discussion': 'draft',
    };
    return statusMap[nsStatus] || 'draft';
  }
}

export const syncService = new SyncService();
