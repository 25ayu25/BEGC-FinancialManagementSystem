import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Plus, 
  FileText, 
  Receipt, 
  Settings, 
  Building2,
  User,
  Wifi,
  WifiOff
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Add Transaction", href: "/transactions", icon: Plus },
  { name: "Monthly Reports", href: "/reports", icon: FileText },
  { name: "Receipts & Vouchers", href: "/receipts", icon: Receipt },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col" data-testid="sidebar-navigation">
      {/* Logo and Clinic Info */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Building2 className="text-white text-lg" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Bahr El Ghazal</h1>
            <p className="text-sm text-gray-500">Financial System</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href === '/dashboard' && location === '/');
          return (
            <Link key={item.name} href={item.href}>
              <a 
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                  isActive 
                    ? "text-primary bg-blue-50" 
                    : "text-gray-600 hover:text-primary hover:bg-gray-50"
                )}
                data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Status */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="text-white text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900" data-testid="text-user-name">
                Admin User
              </p>
              <p className="text-xs text-gray-500" data-testid="text-user-role">
                USA Admin
              </p>
            </div>
          </div>
        </div>
        
        {/* Sync Status */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1">
            <Wifi className="w-3 h-3 text-green-600" />
            <span className="text-gray-600">Online</span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600">Last sync: 2 min ago</span>
          <Badge variant="secondary" className="ml-auto">
            Synced
          </Badge>
        </div>
      </div>
    </div>
  );
}
