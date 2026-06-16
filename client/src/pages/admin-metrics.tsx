import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Database, Gauge, ServerCog } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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
  rangeHours: number;
  generatedAt: string;
}

// Stacked by NetSuite request kind.
const KIND_SERIES: Array<{ key: keyof MetricsResponse["series"][number]; label: string; color: string }> = [
  { key: "reqSuiteql", label: "SuiteQL", color: "#2563eb" },
  { key: "reqRecord", label: "Record", color: "#16a34a" },
  { key: "reqToken", label: "Token", color: "#d97706" },
  { key: "reqRestlet", label: "RESTlet", color: "#9333ea" },
  { key: "reqOidc", label: "OIDC", color: "#dc2626" },
  { key: "reqOther", label: "Other", color: "#6b7280" },
];

const RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
];

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
  const [hours, setHours] = useState(24);

  const { data, isLoading, error } = useQuery<MetricsResponse>({
    queryKey: [`/api/admin/metrics?hours=${hours}`],
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
      time: new Date(row.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      total,
      ...row,
    };
  });
  const totalInRange = chartData.reduce((a, r) => a + r.total, 0);

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
            {RANGES.map((r) => (
              <Button
                key={r.label}
                size="sm"
                variant={hours === r.hours ? "default" : "outline"}
                onClick={() => setHours(r.hours)}
              >
                {r.label}
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
            label={`Requests (last ${data?.rangeHours ?? hours}h)`}
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
            <CardTitle className="text-base">NetSuite requests per minute</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-400 text-sm py-12 text-center">Loading…</p>
            ) : chartData.length === 0 ? (
              <p className="text-gray-400 text-sm py-12 text-center">No requests recorded in this window.</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={32} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {KIND_SERIES.map((s) => (
                      <Area
                        key={s.key as string}
                        type="monotone"
                        dataKey={s.key as string}
                        name={s.label}
                        stackId="1"
                        stroke={s.color}
                        fill={s.color}
                        fillOpacity={0.55}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400">
          Live cards reflect this server instance; the chart is the persisted per-minute rollup
          (aggregated across instances). Auto-refreshes every 15s.
        </p>
      </div>
    </MobileLayout>
  );
}
