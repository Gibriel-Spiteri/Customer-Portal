import { useSync } from "@/contexts/sync-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, RefreshCw, Clock, Activity } from "lucide-react";

export function SyncStatus() {
  const { syncData, isConnected, refreshSyncStatus } = useSync();

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Connection Status */}
      <div className="flex items-center space-x-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-gray-600">
          {isConnected ? 'Live Sync Active' : 'Offline'}
        </span>
        {syncData.lastUpdate && (
          <span className="text-xs text-gray-400">
            Last update: {formatLastUpdate(syncData.lastUpdate)}
          </span>
        )}
      </div>

      {/* Refresh Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshSyncStatus}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh sync status</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SyncStatusDetail() {
  const { syncData, isConnected } = useSync();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Data Synchronization Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-error" />
            )}
            <span className="font-medium">WebSocket Connection</span>
          </div>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        {/* Live Sync Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${syncData.liveSyncActive ? 'bg-success animate-pulse' : 'bg-gray-400'}`} />
            <span className="font-medium">Live Sync</span>
          </div>
          <Badge variant={syncData.liveSyncActive ? "default" : "secondary"}>
            {syncData.liveSyncActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Batch Sync Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Batch Sync</span>
          </div>
          <Badge variant={syncData.batchSyncEnabled ? "default" : "secondary"}>
            {syncData.batchSyncEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {/* NetSuite API Concurrency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">NetSuite API Usage</span>
            <span className="text-sm text-gray-600">
              {syncData.netSuiteConcurrency.current}/{syncData.netSuiteConcurrency.max}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(syncData.netSuiteConcurrency.current / syncData.netSuiteConcurrency.max) * 100}%`
              }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {syncData.netSuiteConcurrency.available} requests available
          </div>
        </div>

        {/* Last Update */}
        {syncData.lastUpdate && (
          <div className="flex items-center justify-between">
            <span className="font-medium">Last Update</span>
            <span className="text-sm text-gray-600">
              {syncData.lastUpdate.toLocaleString()}
            </span>
          </div>
        )}

        {/* Data Freshness Info */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">Data Sync Model</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Real-time:</strong> Orders, Payments, Account Balance</p>
            <p><strong>Cached (10min):</strong> Historical data, Customer details, Invoices</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
