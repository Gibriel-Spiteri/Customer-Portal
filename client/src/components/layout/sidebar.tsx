import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  CreditCard,
  Star,
  Settings,
  HelpCircle,
  Calculator,
  Bath,
  BarChart3,
  ServerCog,
  Users
} from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  badge?: number;
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Estimates',
    href: '/estimates',
    icon: ShoppingCart,
  },
  {
    name: 'Sales Orders',
    href: '/orders',
    icon: Calculator,
  },
  {
    name: 'Express Bath',
    href: '/express-bath',
    icon: Bath,
  },
  {
    name: 'Consumers Cash',
    href: '/consumers-cash',
    icon: Star,
  },
  {
    name: 'Support',
    href: '/support',
    icon: HelpCircle,
  },
  {
    name: 'Account Settings',
    href: '/account',
    icon: Settings,
  },
];

// Sub-menu items shown under "Admin Metrics" for admin users only.
const adminNavigation: NavigationItem[] = [
  {
    name: 'NetSuite Requests',
    href: '/admin/netsuite',
    icon: ServerCog,
  },
  {
    name: 'User Metrics',
    href: '/admin/users',
    icon: Users,
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <nav className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="flex-1 flex flex-col min-h-0 pt-5 pb-4 overflow-y-auto">
          <div className="flex-1 px-3 space-y-1">
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || 
                  (item.href !== '/' && location.startsWith(item.href));
                
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                        isActive
                          ? "bg-blue-100 text-blue-900 border-l-4 border-blue-600 font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon
                        className="mr-3 h-5 w-5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {item.name}
                      {item.badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {user?.isAdmin && (
                <div>
                  <Link href="/admin">
                    <div
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                        location === '/admin'
                          ? "bg-blue-100 text-blue-900 border-l-4 border-blue-600 font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <BarChart3 className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      Admin Metrics
                    </div>
                  </Link>
                  {adminNavigation.map((item) => {
                    const isActive = location.startsWith(item.href);
                    return (
                      <Link key={item.name} href={item.href}>
                        <div
                          className={cn(
                            "group flex items-center pl-11 pr-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                            isActive
                              ? "bg-blue-100 text-blue-900 border-l-4 border-blue-600 font-semibold"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          {item.name}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
