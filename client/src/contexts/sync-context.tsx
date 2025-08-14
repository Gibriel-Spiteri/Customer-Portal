import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuth } from "./auth-context";

interface SyncData {
  liveSyncActive: boolean;
  connectedClients: number;
  batchSyncEnabled: boolean;
  lastUpdate: Date | null;
  netSuiteConcurrency: {
    current: number;
    max: number;
    available: number;
  };
}

interface SyncContextType {
  syncData: SyncData;
  isConnected: boolean;
  triggerLiveSync: (entityType: 'orders' | 'payments') => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [syncData, setSyncData] = useState<SyncData>({
    liveSyncActive: false,
    connectedClients: 0,
    batchSyncEnabled: false,
    lastUpdate: null,
    netSuiteConcurrency: {
      current: 0,
      max: 15,
      available: 15,
    },
  });

  const { isConnected, sendMessage } = useWebSocket({
    url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
    onMessage: (data) => {
      if (data.type === 'sync_status_update') {
        setSyncData(prev => ({
          ...prev,
          ...data.data,
          lastUpdate: new Date(),
        }));
      } else if (data.type === 'orders_updated' || data.type === 'payments_updated') {
        setSyncData(prev => ({
          ...prev,
          lastUpdate: new Date(),
        }));
      }
    },
    enabled: !!user && !!accessToken,
  });

  useEffect(() => {
    if (isConnected && user) {
      // Subscribe to updates for this user
      sendMessage({
        type: 'subscribe',
        userId: user.id,
      });
    }
  }, [isConnected, user, sendMessage]);

  useEffect(() => {
    if (user && accessToken) {
      refreshSyncStatus();
      // Refresh sync status every 30 seconds
      const interval = setInterval(refreshSyncStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [user, accessToken]);

  const refreshSyncStatus = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('/api/sync/status', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const statusData = await response.json();
        setSyncData(prev => ({
          ...prev,
          ...statusData.sync,
          lastUpdate: new Date(),
        }));
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const triggerLiveSync = async (entityType: 'orders' | 'payments') => {
    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetch(`/api/sync/live/${entityType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to trigger live sync');
    }
  };

  return (
    <SyncContext.Provider value={{
      syncData,
      isConnected,
      triggerLiveSync,
      refreshSyncStatus,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
