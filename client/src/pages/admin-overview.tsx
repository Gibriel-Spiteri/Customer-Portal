import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity, Database, Gauge, ServerCog,
  Users, UserCheck, LogIn, UserPlus, ChevronRight,
} from "lucide-react";
import { AdminOnly } from "@/pages/admin-netsuite-metrics";
import type { ReactNode } from "react";

interface OverviewMetricsResponse {
  live: {
    snapshot: {
      netsuite: { totalRequests: number; peakConcurrency: number };
      cache: { lookups: number; hitRate: number };
    };
    concurrency: { max: number; activeCount: number; pendingCount: number };
  };
  series: Array<Record<string, number | string>>;
}

interface UserMetricsResponse {
  totals: {
    totalUsers: number;
    adminUsers: number;
    signedIn24h: number;
    signedIn7d: number;
    newUsers30d: number;
  };
}

// A stat tile that navigates to a details page when clicked.
function LinkedStatCard({ href, icon, label, value, sub }: {
  href: string; icon: ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-blue-300">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">{icon}</div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              {sub && <p className="text-xs text-gray-400">{sub}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-1 cursor-pointer group w-fit">
        <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">{title}</h2>
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-700" />
      </div>
    </Link>
  );
}

export default function AdminOverview() {
  const { user } = useAuth();

  const { data: nsData } = useQuery<OverviewMetricsResponse>({
    queryKey: ["/api/admin/metrics?granularity=minute"],
    enabled: !!user?.isAdmin,
    refetchInterval: 15000,
  });

  const { data: userMetrics } = useQuery<UserMetricsResponse>({
    queryKey: ["/api/admin/user-metrics"],
    enabled: !!user?.isAdmin,
    refetchInterval: 60000,
  });

  if (!user?.isAdmin) {
    return <AdminOnly />;
  }

  const snap = nsData?.live.snapshot;
  const conc = nsData?.live.concurrency;
  const totals = userMetrics?.totals;

  return (
    <MobileLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Metrics</h1>
          <p className="text-sm text-gray-500">At-a-glance overview. Click any tile for details.</p>
        </div>

        <div className="space-y-3">
          <SectionHeader title="NetSuite Requests" href="/admin/netsuite" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LinkedStatCard
              href="/admin/netsuite"
              icon={<Gauge className="h-5 w-5" />}
              label="In-flight now"
              value={conc ? `${conc.activeCount} / ${conc.max}` : "—"}
              sub={conc ? `${conc.pendingCount} queued` : undefined}
            />
            <LinkedStatCard
              href="/admin/netsuite"
              icon={<Activity className="h-5 w-5" />}
              label="Peak concurrency"
              value={snap ? `${snap.netsuite.peakConcurrency} / ${conc?.max ?? "?"}` : "—"}
              sub="since this instance started"
            />
            <LinkedStatCard
              href="/admin/netsuite"
              icon={<ServerCog className="h-5 w-5" />}
              label="Requests since startup"
              value={snap ? snap.netsuite.totalRequests.toLocaleString() : "—"}
            />
            <LinkedStatCard
              href="/admin/netsuite"
              icon={<Database className="h-5 w-5" />}
              label="Cache hit rate"
              value={snap ? `${Math.round(snap.cache.hitRate * 100)}%` : "—"}
              sub={snap ? `${snap.cache.lookups.toLocaleString()} lookups` : undefined}
            />
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader title="User Metrics" href="/admin/users" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LinkedStatCard
              href="/admin/users"
              icon={<Users className="h-5 w-5" />}
              label="Total users"
              value={totals ? totals.totalUsers.toLocaleString() : "—"}
              sub={totals ? `${totals.adminUsers} admin${totals.adminUsers === 1 ? "" : "s"}` : undefined}
            />
            <LinkedStatCard
              href="/admin/users"
              icon={<LogIn className="h-5 w-5" />}
              label="Signed in (24h)"
              value={totals ? totals.signedIn24h.toLocaleString() : "—"}
            />
            <LinkedStatCard
              href="/admin/users"
              icon={<UserCheck className="h-5 w-5" />}
              label="Signed in (7 days)"
              value={totals ? totals.signedIn7d.toLocaleString() : "—"}
            />
            <LinkedStatCard
              href="/admin/users"
              icon={<UserPlus className="h-5 w-5" />}
              label="New users (30 days)"
              value={totals ? totals.newUsers30d.toLocaleString() : "—"}
            />
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
