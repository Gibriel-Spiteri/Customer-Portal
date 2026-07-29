import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, User, LogOut, Menu } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";

export function Header() {
  const { user, logout } = useAuth();

  const getInitials = (companyName?: string, email?: string) => {
    if (companyName) {
      const words = companyName.trim().split(/\s+/);
      if (words.length >= 2) {
        return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
      }
      return companyName.charAt(0).toUpperCase();
    }
    return email?.charAt(0)?.toUpperCase() || 'U';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          <div className="flex items-center min-w-0">
            {/* Mobile menu button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  className="lg:hidden mr-2 px-0"
                  size="sm"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <MobileNav />
              </SheetContent>
            </Sheet>
            
            <div className="min-w-0 shrink">
              <img 
                src="https://1212804.app.netsuite.com/core/media/media.nl?id=9641134&c=1212804&h=mTEBmvmdDKM4h0mgbLpG789NURbPi4V1b2DrTREho5ho_PnP"
                alt="Company Logo"
                className="h-8 sm:h-10 w-auto max-w-[140px] sm:max-w-none object-contain"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 min-w-0 shrink">
            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 min-w-0 px-2 sm:px-4">
                    <span className="font-medium uppercase truncate max-w-[40vw] sm:max-w-none text-sm sm:text-base">
                      {user.companyName || 'Account'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
