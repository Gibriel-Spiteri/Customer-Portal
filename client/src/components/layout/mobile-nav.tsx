import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  FileText, 
  CreditCard, 
  Settings, 
  HelpCircle 
} from "lucide-react";

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Sales Orders',
    href: '/orders',
    icon: ShoppingCart,
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: FileText,
  },
  {
    name: 'Payments',
    href: '/payments',
    icon: CreditCard,
  },
  {
    name: 'Loyalty Program',
    href: '/loyalty',
    icon: Settings,
  },
  {
    name: 'Account Settings',
    href: '/account',
    icon: Settings,
  },
  {
    name: 'Support',
    href: '/support',
    icon: HelpCircle,
  },
];

export function MobileNav() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href || 
            (item.href !== '/' && location.startsWith(item.href));
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
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
      </nav>
    </div>
  );
}