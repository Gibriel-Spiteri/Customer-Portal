import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Database, Gauge, ServerCog } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface MetricsResponse {
  live: {
    snapshot: {
      sinceIso: string;
      uptimeMs: number;
      netsuite: {
        totalRequests: number;
        byKind: Record<string, number>;
        peakConcurrency: number;
      };
      cache: {
        hit: number; miss: number; stale: number; error: number;
        lookups: number; hitRate: number;
      };
    };
    concurrency: { max: number; activeCount: number; pendingCount: number };
  };
  series: Array<{
    bucket: string;
    reqToken: number; reqSuiteql: number; reqRecord: number;
    reqRestlet: number; reqOidc: number; reqOther: number;
    cacheHit: number; cacheMiss: number; cacheStale: number;
    peakConcurrency: number;
  }>;
  granularity: Granularity;
  generatedAt: string;
}

type Granularity = "minute" | "hour" | "day" | "week" | "month";

// Stacked by NetSuite request kind.
const KIND_SERIES: Array<{ key: keyof MetricsResponse["series"][number]; label: string; color: string }> = [
  { key: "reqSuiteql", label: "SuiteQL", color: "#2563eb" },
  { key: "reqRecord", label: "Record", color: "#16a34a" },
  { key: "reqToken", label: "Token", color: "#d97706" },
  { key: "reqRestlet", label: "RESTlet", color: "#9333ea" },
  { key: "reqOidc", label: "OIDC", color: "#dc2626" },
  { key: "reqOther", label: "Other", color: "#6b7280" },
];

const GRANULARITIES: Array<{ label: string; value: Granularity }> = [
  { label: "Minute", value: "minute" },
  { label: "Hour", value: "hour" },
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

// How to format the x-axis / tooltip label for each granularity.
function formatBucket(bucket: string, granularity: Granularity): string {
  const d = new Date(bucket);
  switch (granularity) {
    case "minute":
    case "hour":
      return d.toLocaleString([], {
        month: granularity === "hour" ? "short" : undefined,
        day: granularity === "hour" ? "numeric" : undefined,
        hour: "2-digit",
        minute: granularity === "minute" ? "2-digit" : undefined,
      });
    case "day":
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    case "week":
      return `Wk of ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    case "month":
      return d.toLocaleDateString([], { month: "short", year: "numeric" });
  }
}

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
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
  );
}

export default function AdminMetrics() {
  const { user } = useAuth();
  const [granularity, setGranularity] = useState<Granularity>("minute");

  const { data, isLoading, error } = useQuery<MetricsResponse>({
    queryKey: [`/api/admin/metrics?granularity=${granularity}`],
    enabled: !!user?.isAdmin,
    refetchInterval: 15000, // poll our own server (not NetSuite) for a near-live view
  });

  if (!user?.isAdmin) {
    return (
      <MobileLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-700">Admin access required.</p>
          </CardContent>
        </Card>
      </MobileLayout>
    );
  }

  const snap = data?.live.snapshot;
  const conc = data?.live.concurrency;
  const chartData = (data?.series ?? []).map((row) => {
    const total = row.reqToken + row.reqSuiteql + row.reqRecord + row.reqRestlet + row.reqOidc + row.reqOther;
    return {
      time: formatBucket(row.bucket, granularity),
      total,
      ...row,
    };
  });
  const totalInRange = chartData.reduce((a, r) => a + r.total, 0);
  const granularityLabel = GRANULARITIES.find((g) => g.value === granularity)?.label.toLowerCase() ?? granularity;

  return (
    <MobileLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NetSuite Request Metrics</h1>
            <p className="text-sm text-gray-500">
              Outbound NetSuite requests and cache effectiveness. Concurrency cap is {conc?.max ?? "—"}.
            </p>
          </div>
          <div className="flex gap-1">
            {GRANULARITIES.map((g) => (
              <Button
                key={g.value}
                size="sm"
                variant={granularity === g.value ? "default" : "outline"}
                onClick={() => setGranularity(g.value)}
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <Card><CardContent className="pt-6 text-red-600">Failed to load metrics.</CardContent></Card>
        )}

        {/* Live stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Gauge className="h-5 w-5" />}
            label="In-flight now"
            value={conc ? `${conc.activeCount} / ${conc.max}` : "—"}
            sub={conc ? `${conc.pendingCount} queued` : undefined}
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Peak concurrency"
            value={snap ? `${snap.netsuite.peakConcurrency} / ${conc?.max ?? "?"}` : "—"}
            sub="since this instance started"
          />
          <StatCard
            icon={<ServerCog className="h-5 w-5" />}
            label={`Requests (per-${granularityLabel} view)`}
            value={totalInRange.toLocaleString()}
            sub={snap ? `${snap.netsuite.totalRequests.toLocaleString()} since startup` : undefined}
          />
          <StatCard
            icon={<Database className="h-5 w-5" />}
            label="Cache hit rate"
            value={snap ? `${Math.round(snap.cache.hitRate * 100)}%` : "—"}
            sub={snap ? `${snap.cache.lookups.toLocaleString()} lookups` : undefined}
          />
        </div>

        {/* Requests-per-minute, stacked by kind */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">NetSuite requests per {granularityLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-400 text-sm py-12 text-center">Loading…</p>
            ) : chartData.length === 0 ? (
              <p className="text-gray-400 text-sm py-12 text-center">No requests recorded in this window.</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {KIND_SERIES.map((s) => (
                      <Bar
                        key={s.key as string}
                        dataKey={s.key as string}
                        name={s.label}
                        stackId="1"
                        fill={s.color}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400">
          Live cards reflect this server instance; the chart is the persisted rollup
          (aggregated across instances), grouped by {granularityLabel}. Auto-refreshes every 15s.
        </p>
      </div>
    </MobileLayout>
  );
}
