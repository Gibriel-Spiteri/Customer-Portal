import { useAuth } from "@/contexts/auth-context";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Bug, User, Database, Wifi, WifiOff } from "lucide-react";
import { SyncStatus } from "@/components/sync-status";

export default function Debug() {
  const { user, token } = useAuth();

  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['/api/profile'],
    enabled: !!token,
  });

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/dashboard'],
    enabled: !!token,
  });

  return (
    <MobileLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bug className="h-6 w-6" />
              Debug Information
            </h1>
            <p className="mt-1 text-gray-600">
              Customer and record number debugging
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchProfile()}
              disabled={profileLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${profileLoading ? 'animate-spin' : ''}`} />
              Refresh Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchDashboard()}
              disabled={dashboardLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${dashboardLoading ? 'animate-spin' : ''}`} />
              Refresh Dashboard
            </Button>
          </div>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Real-time connection to NetSuite</p>
                <SyncStatus />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auth Context User Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Auth Context User Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <strong>User ID:</strong>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                    {user?.id || 'Not available'}
                  </p>
                </div>
                <div>
                  <strong>Username/Email:</strong>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                    {user?.username || 'Not available'}
                  </p>
                </div>
                <div>
                  <strong>First Name:</strong>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                    {user?.firstName || 'Not available'}
                  </p>
                </div>
                <div>
                  <strong>Last Name:</strong>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                    {user?.lastName || 'Not available'}
                  </p>
                </div>
                <div>
                  <strong>Company Name:</strong>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                    {user?.companyName || 'Not available'}
                  </p>
                </div>
                <div>
                  <strong>Is NetSuite User:</strong>
                  <div className="mt-1">
                    {user?.isNetSuiteUser ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <strong>NetSuite Customer ID:</strong>
                  <p className="font-mono text-sm bg-blue-50 border border-blue-200 p-2 rounded mt-1">
                    {user?.netsuiteCustomerId || 'Not available'}
                  </p>
                </div>
                <div>
                  <strong>NetSuite Record Number:</strong>
                  <p className="font-mono text-sm bg-blue-50 border border-blue-200 p-2 rounded mt-1">
                    {user?.netsuiteCustomerId || 'Not available'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile API Response */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Profile API Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading profile data...
              </div>
            ) : profileData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <strong>API User ID:</strong>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                      {(profileData as any)?.id || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <strong>API Username:</strong>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                      {(profileData as any)?.username || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <strong>API NetSuite User:</strong>
                    <div className="mt-1">
                      {(profileData as any)?.isNetSuiteUser ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>API NetSuite Customer ID:</strong>
                    <p className="font-mono text-sm bg-blue-50 border border-blue-200 p-2 rounded mt-1">
                      {(profileData as any)?.netsuiteCustomerId || 'Not available'}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>Full API Response:</strong>
                  <pre className="text-xs bg-gray-100 p-3 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(profileData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No profile data available</p>
            )}
          </CardContent>
        </Card>

        {/* Token Information */}
        <Card>
          <CardHeader>
            <CardTitle>JWT Token Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <strong>Token Present:</strong>
                <div className="mt-1">
                  {token ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="destructive">No</Badge>
                  )}
                </div>
              </div>
              {token && (
                <div>
                  <strong>Token (First 50 chars):</strong>
                  <p className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                    {token.substring(0, 50)}...
                  </p>
                </div>
              )}
              <div>
                <strong>LocalStorage Token:</strong>
                <p className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                  {localStorage.getItem('auth_token')?.substring(0, 50) || 'Not found'}
                  {localStorage.getItem('auth_token') && '...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Data */}
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Data</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading dashboard data...
              </div>
            ) : dashboardData ? (
              <div>
                <strong>Dashboard Response Available:</strong>
                <Badge variant="default" className="bg-green-100 text-green-800 ml-2">
                  Yes
                </Badge>
                <pre className="text-xs bg-gray-100 p-3 rounded mt-3 overflow-x-auto max-h-60">
                  {JSON.stringify(dashboardData, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500">No dashboard data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}