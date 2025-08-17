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
    <div className="w-64 bg-white shadow-xl flex flex-col border-r border-gray-100" data-testid="sidebar-navigation">
      {/* Logo and Clinic Info */}
      <div className="p-6 border-b border-teal-100 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-600">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
            <Building2 className="text-white text-xl" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Bahr El Ghazal Clinic</h1>
            <p className="text-sm text-teal-100">Financial Management System</p>
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
                    ? "text-teal-700 bg-gradient-to-r from-teal-50 to-emerald-50 border-r-2 border-teal-500 font-semibold" 
                    : "text-gray-600 hover:text-teal-700 hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-emerald-50/50"
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
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
              <User className="text-white text-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900" data-testid="text-user-name">
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
