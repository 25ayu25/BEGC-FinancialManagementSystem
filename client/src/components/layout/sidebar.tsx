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
import { UserProfileMenu } from "@/components/ui/user-profile-menu";

const navigation = [
  { name: "Executive Dashboard", href: "/", icon: BarChart3 },
  { name: "Simple Dashboard", href: "/simple", icon: BarChart3 },
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
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mx-4 mt-4">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-50 text-teal-600 border border-teal-100 rounded-lg p-2 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-gray-800 font-semibold text-base leading-tight">Bahr El Ghazal Clinic</h1>
            <p className="text-gray-400 font-normal text-xs leading-tight">Financial Management System</p>
          </div>
        </div>
        <div className="border-b border-gray-100 mt-2.5"></div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div 
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                  isActive 
                    ? "text-teal-700 bg-teal-50 border-r-2 border-teal-500 font-semibold" 
                    : "text-gray-600 hover:text-teal-700 hover:bg-teal-50/50"
                )}
                data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Status */}
      <div className="p-4 border-t border-gray-200">
        <UserProfileMenu userName="Admin User" userRole="USA Admin" />
        
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
