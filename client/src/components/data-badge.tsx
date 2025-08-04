import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Clock } from "lucide-react";

interface DataBadgeProps {
  freshness: 'live' | 'cached';
  lastSync?: Date | string | null;
  size?: 'sm' | 'default';
}

export function DataBadge({ freshness, lastSync, size = 'sm' }: DataBadgeProps) {
  const isLive = freshness === 'live';
  
  const formatLastSync = (date: Date | string | null) => {
    if (!date) return null;
    const syncDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - syncDate.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "just updated";
    if (minutes < 60) return `updated ${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `updated ${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `updated ${days}d ago`;
  };

  const lastSyncText = formatLastSync(lastSync);

  const badge = (
    <Badge
      variant={isLive ? "default" : "secondary"}
      className={`
        inline-flex items-center gap-1
        ${isLive ? 'bg-success text-white hover:bg-success/90' : 'bg-gray-400 text-white hover:bg-gray-500'}
        ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'}
      `}
    >
      {isLive ? (
        <Zap className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isLive ? 'LIVE' : 'CACHED'}
    </Badge>
  );

  if (!lastSyncText) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent>
        <p className="capitalize">{lastSyncText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
