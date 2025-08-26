import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Plus, 
  FileText, 
  Settings, 
  Building2,
  Users,
  Activity,
  X
} from "lucide-react";
import { UserProfileMenu } from "@/components/ui/user-profile-menu";
import { useEffect } from "react";

const navigation = [
  { name: "Executive Dashboard", href: "/", icon: BarChart3 },
  { name: "Overview", href: "/simple", icon: BarChart3 },
  { name: "Add Transaction", href: "/transactions", icon: Plus },
  { name: "Monthly Reports", href: "/reports", icon: FileText },
  { name: "Patient Volume", href: "/patient-volume", icon: Activity },
  { name: "User Management", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location] = useLocation();

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl flex flex-col border-r border-gray-100 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )} data-testid="sidebar-navigation">
        
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      {/* Logo and Clinic Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mx-4 mt-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-50 text-teal-600 border border-teal-100 rounded-lg p-2 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-slate-800 font-semibold text-base leading-tight">Bahr El Ghazal Clinic</h1>
            <p className="text-slate-500 font-normal text-xs leading-tight">Financial Management System</p>
          </div>
        </div>
        <div className="border-b border-slate-200 mt-3"></div>
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
                    ? "text-slate-600 bg-slate-100 border-l-2 border-teal-500" 
                    : "text-slate-600 hover:text-slate-700 hover:bg-slate-50"
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
        <UserProfileMenu />
        

      </div>
      </div>
    </>
  );
}
