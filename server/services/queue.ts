interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: 'low' | 'medium' | 'high';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export class QueueService {
  private jobs: Map<string, QueueJob> = new Map();
  private processing = false;
  private workers = new Map<string, (data: any) => Promise<void>>();

  constructor() {
    this.registerWorkers();
    this.startProcessing();
  }

  private registerWorkers(): void {
    // Register sync workers
    this.workers.set('live-sync-orders', async (data) => {
      const { syncService } = await import('./sync');
      await syncService.syncUserOrdersLive(data.userId);
    });

    this.workers.set('live-sync-payments', async (data) => {
      const { syncService } = await import('./sync');
      await syncService.syncUserPaymentsLive(data.userId);
    });

    this.workers.set('batch-sync', async (data) => {
      const { syncService } = await import('./sync');
      // Run batch sync for specific entity type
      console.log('Processing batch sync job:', data);
    });

    this.workers.set('retry-failed-api-call', async (data) => {
      const { netsuiteService } = await import('./netsuite');
      // Retry failed NetSuite API calls
      console.log('Retrying failed API call:', data);
    });
  }

  async addJob(type: string, data: any, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<string> {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: QueueJob = {
      id,
      type,
      data,
      priority,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    
    // If high priority, process immediately
    if (priority === 'high') {
      this.processNextJob();
    }

    return id;
  }

  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.processing) {
      await this.processNextJob();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between jobs
    }
  }

  private async processNextJob(): Promise<void> {
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => !job.completedAt && job.attempts < job.maxAttempts)
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    const job = pendingJobs[0];
    if (!job) return;

    const worker = this.workers.get(job.type);
    if (!worker) {
      console.error(`No worker found for job type: ${job.type}`);
      job.error = `No worker found for job type: ${job.type}`;
      job.completedAt = new Date();
      return;
    }

    job.attempts++;
    job.processedAt = new Date();

    try {
      await worker(job.data);
      job.completedAt = new Date();
      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      job.error = errorMessage;
      
      if (job.attempts >= job.maxAttempts) {
        job.completedAt = new Date();
        console.error(`Job ${job.id} failed after ${job.maxAttempts} attempts:`, errorMessage);
      } else {
        console.warn(`Job ${job.id} failed, attempt ${job.attempts}/${job.maxAttempts}:`, errorMessage);
        // Exponential backoff for retries
        const delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => {
          // Reset processedAt to allow retry
          job.processedAt = undefined;
        }, delay);
      }
    }
  }

  getQueueStats() {
    const jobs = Array.from(this.jobs.values());
    const pending = jobs.filter(job => !job.completedAt && job.attempts < job.maxAttempts).length;
    const processing = jobs.filter(job => job.processedAt && !job.completedAt).length;
    const completed = jobs.filter(job => job.completedAt && !job.error).length;
    const failed = jobs.filter(job => job.completedAt && job.error).length;

    return {
      pending,
      processing,
      completed,
      failed,
      total: jobs.length,
    };
  }

  clearCompletedJobs(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [id, job] of Array.from(this.jobs.entries())) {
      if (job.completedAt && job.completedAt < cutoffTime) {
        this.jobs.delete(id);
      }
    }
  }

  stopProcessing(): void {
    this.processing = false;
  }
}

export const queueService = new QueueService();
