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
  X,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { UserProfileMenu } from "@/components/ui/user-profile-menu";
import { useEffect, useCallback } from "react";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  sub?: boolean;
};

const navigation: NavItem[] = [
  { name: "Executive Dashboard", href: "/", icon: BarChart3 },
  { name: "Overview", href: "/simple", icon: BarChart3 },
  { name: "Add Transaction", href: "/transactions", icon: Plus },

  { name: "Insurance Ledger", href: "/insurance", icon: ShieldCheck },
  { name: "Insurance", href: "/insurance-providers", icon: ListChecks, sub: true },

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

  // Close on ESC (mobile)
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", onEsc);
      return () => document.removeEventListener("keydown", onEsc);
    }
  }, [isOpen, onClose]);

  // Close drawer when a link is tapped on mobile
  const handleNavClick = useCallback(() => {
    if (!onClose) return;
    if (window.matchMedia("(max-width: 1023px)").matches) onClose();
  }, [onClose]);

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 shadow-xl",
          "flex flex-col transform transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
        data-testid="sidebar-navigation"
      >
        {/* Close button (mobile) */}
        <div className="lg:hidden absolute top-4 right-4">
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            data-testid="button-close-sidebar"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logo */}
        <div className="p-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="bg-teal-50 text-teal-600 border border-teal-100 rounded-lg p-2 flex items-center justify-center">
                <Building2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-slate-800 font-semibold text-base leading-tight">
                  Bahr El Ghazal Clinic
                </h1>
                <p className="text-slate-500 font-normal text-xs leading-tight">
                  Financial Management System
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable menu */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const subClasses = item.sub ? "pl-10 text-sm" : "";
            return (
              <Link key={item.name} href={item.href} onClick={handleNavClick}>
                <div
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors cursor-pointer min-w-0",
                    subClasses,
                    isActive
                      ? "text-slate-700 bg-slate-100 border-l-2 border-teal-500"
                      : "text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                  )}
                  data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span className="font-medium flex-1 whitespace-normal break-words leading-snug">
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <UserProfileMenu />
        </div>
      </aside>
    </>
  );
}
