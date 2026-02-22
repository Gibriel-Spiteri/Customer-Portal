import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  CalculatorIcon,
  HeadphonesIcon,
  DollarSign,
  User
} from "lucide-react";

const bottomNavItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    label: 'Dashboard'
  },
  {
    name: 'Sales Orders',
    href: '/orders',
    icon: ShoppingCart,
    label: 'Orders'
  },
  {
    name: 'Estimates',
    href: '/estimates',
    icon: CalculatorIcon,
    label: 'Estimates'
  },
  {
    name: 'Support',
    href: '/support',
    icon: HeadphonesIcon,
    label: 'Support'
  },
  {
    name: 'Consumers Cash',
    href: '/consumers-cash',
    icon: DollarSign,
    label: 'Cash'
  },
  {
    name: 'Account',
    href: '/account',
    icon: User,
    label: 'Account'
  },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-50 md:hidden">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {bottomNavItems.map((item) => {
          const isActive = location === item.href || 
            (item.href !== '/' && location.startsWith(item.href));
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center px-3 py-2 min-w-0 transition-colors touch-manipulation",
                  isActive
                    ? "text-blue-600"
                    : "text-gray-500 active:text-blue-600"
                )}
              >
                <item.icon
                  className={cn(
                    "h-6 w-6 mb-1",
                    isActive ? "text-blue-600" : "text-gray-500"
                  )}
                  aria-hidden="true"
                />
                <span className={cn(
                  "text-xs font-medium truncate w-full text-center",
                  isActive ? "text-blue-600" : "text-gray-500"
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}