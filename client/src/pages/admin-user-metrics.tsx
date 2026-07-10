import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, LogIn, UserPlus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { StatCard, AdminOnly } from "@/pages/admin-netsuite-metrics";

interface UserMetricsResponse {
  totals: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    signedIn24h: number;
    signedIn7d: number;
    newUsers30d: number;
  };
  signupsByDay: Array<{ day: string; signups: number }>;
  recentSignIns: Array<{
    email: string;
    companyName: string | null;
    lastLoginAt: string;
    loginCount: number;
    isAdmin: boolean;
  }>;
  generatedAt: string;
}

export default function AdminUserMetrics() {
  const { user } = useAuth();

  const { data: userMetrics, isLoading, error } = useQuery<UserMetricsResponse>({
    queryKey: ["/api/admin/user-metrics"],
    enabled: !!user?.isAdmin,
    refetchInterval: 60000, // user activity changes slowly; refresh once a minute
  });

  if (!user?.isAdmin) {
    return <AdminOnly />;
  }

  return (
    <MobileLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Metrics</h1>
          <p className="text-sm text-gray-500">Portal accounts and sign-in activity.</p>
        </div>

        {error && (
          <Card><CardContent className="pt-6 text-red-600">Failed to load user metrics.</CardContent></Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total users"
            value={userMetrics ? userMetrics.totals.totalUsers.toLocaleString() : "—"}
            sub={userMetrics ? `${userMetrics.totals.adminUsers} admin${userMetrics.totals.adminUsers === 1 ? "" : "s"}` : undefined}
          />
          <StatCard
            icon={<LogIn className="h-5 w-5" />}
            label="Signed in (24h)"
            value={userMetrics ? userMetrics.totals.signedIn24h.toLocaleString() : "—"}
          />
          <StatCard
            icon={<UserCheck className="h-5 w-5" />}
            label="Signed in (7 days)"
            value={userMetrics ? userMetrics.totals.signedIn7d.toLocaleString() : "—"}
          />
          <StatCard
            icon={<UserPlus className="h-5 w-5" />}
            label="New users (30 days)"
            value={userMetrics ? userMetrics.totals.newUsers30d.toLocaleString() : "—"}
          />
        </div>

        {/* New accounts per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New accounts per day (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-400 text-sm py-12 text-center">Loading…</p>
            ) : (userMetrics?.signupsByDay ?? []).length === 0 ? (
              <p className="text-gray-400 text-sm py-12 text-center">No new accounts in the last 30 days.</p>
            ) : (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={(userMetrics?.signupsByDay ?? []).map((r) => ({
                      day: new Date(r.day).toLocaleDateString([], { month: "short", day: "numeric" }),
                      signups: r.signups,
                    }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="signups" name="New accounts" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sign-ins */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent sign-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
            ) : (userMetrics?.recentSignIns ?? []).length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">
                No sign-ins recorded yet. Sign-in tracking starts from today.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">User</th>
                      <th className="py-2 pr-4 font-medium">Company</th>
                      <th className="py-2 pr-4 font-medium">Last sign-in</th>
                      <th className="py-2 font-medium text-right">Total sign-ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(userMetrics?.recentSignIns ?? []).map((u) => (
                      <tr key={u.email} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <span className="text-gray-900">{u.email}</span>
                          {u.isAdmin && (
                            <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">admin</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{u.companyName || "—"}</td>
                        <td className="py-2 pr-4 text-gray-600">
                          {new Date(u.lastLoginAt).toLocaleString([], {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 text-right text-gray-600">{u.loginCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
