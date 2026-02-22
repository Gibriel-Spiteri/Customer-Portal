import { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MobileLayout({ children, className }: MobileLayoutProps) {
  const { user } = useAuth();
  
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header for all devices */}
      <Header />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main className={cn(
          "flex-1 overflow-y-auto pb-20 md:pb-4", // Add bottom padding for mobile nav
          className
        )}>
          <div className="px-4 pt-0 pb-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
            {children}
            
            {/* Quick Actions - Available on all pages */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="flex items-center justify-center py-3 touch-manipulation"
                    size="lg"
                  >
                    <Phone className="mr-2 h-4 w-4 text-warning" />
                    Contact Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}