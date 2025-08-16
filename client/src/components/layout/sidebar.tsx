import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  FileText, 
  CreditCard, 
  Star, 
  Settings, 
  HelpCircle,
  Calculator,
  Bug
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
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Estimates',
    href: '/estimates',
    icon: Calculator,
  },
  {
    name: 'Sales Orders',
    href: '/orders',
    icon: ShoppingCart,
  },
  {
    name: 'Consumers Cash',
    href: '/loyalty',
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
  {
    name: 'Debug Info',
    href: '/debug',
    icon: Bug,
  },
];

export function Sidebar() {
  const [location] = useLocation();

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
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
