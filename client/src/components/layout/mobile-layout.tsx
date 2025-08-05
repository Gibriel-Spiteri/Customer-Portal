import { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
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
      
      <div className="flex h-screen pt-16">
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main className={cn(
          "flex-1 overflow-y-auto pb-20 md:pb-4", // Add bottom padding for mobile nav
          className
        )}>
          <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}