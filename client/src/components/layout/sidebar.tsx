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
  ShieldCheck,   // main insurance ledger
  ListChecks,    // providers sub-link
  PieChart,      // insurance overview
  ChevronDown,
  FlaskConical,  // <--- NEW ICON for Lab Finance
} from "lucide-react";
import { UserProfileMenu } from "@/components/ui/user-profile-menu";
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
};

// Separate navigation items
const navigationBefore: NavItem[] = [
  { name: "Executive Dashboard", href: "/", icon: BarChart3 },
  { name: "Overview", href: "/simple", icon: BarChart3 },
  { name: "Add Transaction", href: "/transactions", icon: Plus },
];

const insuranceItems: NavItem[] = [
  { name: "Overview", href: "/insurance-overview", icon: PieChart },
  { name: "Match Payments", href: "/claim-reconciliation", icon: ListChecks },
  // --- NEW ITEM ADDED HERE ---
  { name: "Lab Finance", href: "/insurance/lab", icon: FlaskConical },
  { name: "Insurance Balance", href: "/insurance", icon: ShieldCheck },
];

const navigationAfter: NavItem[] = [
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
  
  // Check if any insurance route is active to auto-expand the group
  const isInsuranceActive = insuranceItems.some(item => location === item.href);
  
  // State to control collapsible open/close for user interaction
  const [isInsuranceOpen, setIsInsuranceOpen] = useState(isInsuranceActive);
  
  // Auto-expand when navigating to an insurance route
  useEffect(() => {
    if (isInsuranceActive) {
      setIsInsuranceOpen(true);
    }
  }, [isInsuranceActive]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 h-screen bg-slate-900 text-white shadow-xl flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar-navigation"
      >
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-4 right-4">
          <button
            onClick={onClose}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logo - Fixed at top, never scrolls */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base leading-tight">
                Bahr El Ghazal Clinic
              </h1>
              <p className="text-slate-400 font-normal text-xs leading-tight">
                Financial Management System
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable menu area */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-1">
          {/* Navigation items before Insurance group */}
          {navigationBefore.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer min-w-0",
                    isActive
                      ? "bg-slate-800/50 text-white border-l-[3px] border-teal-400"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                  data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-teal-400" : "text-slate-400")} aria-hidden="true" />
                  <span className="font-medium flex-1 whitespace-normal break-words leading-snug">
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Insurance collapsible group */}
          <Collapsible open={isInsuranceOpen} onOpenChange={setIsInsuranceOpen}>
            <CollapsibleTrigger className="w-full [&[data-state=open]>div>svg:last-child]:rotate-180">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-w-0",
                  isInsuranceActive
                    ? "text-white bg-slate-800/50"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                )}
                data-testid="group-insurance"
              >
                <ShieldCheck className={cn("w-5 h-5 shrink-0", isInsuranceActive ? "text-teal-400" : "text-slate-400")} aria-hidden="true" />
                <span className="font-medium flex-1 whitespace-normal break-words leading-snug text-left">
                  Insurance
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200" aria-hidden="true" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {insuranceItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer min-w-0 pl-10 text-sm",
                        isActive
                          ? "bg-slate-800/50 text-white border-l-[3px] border-teal-400"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      )}
                      data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-teal-400" : "")} aria-hidden="true" />
                      <span className="font-medium flex-1 whitespace-normal break-words leading-snug">
                        {item.name}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Navigation items after Insurance group */}
          {navigationAfter.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer min-w-0",
                    isActive
                      ? "bg-slate-800/50 text-white border-l-[3px] border-teal-400"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                  data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-teal-400" : "text-slate-400")} aria-hidden="true" />
                  <span className="font-medium flex-1 whitespace-normal break-words leading-snug">
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Status - Fixed at bottom, never scrolls */}
        <div 
          className="flex-shrink-0 mt-auto p-4 border-t border-slate-700 bg-slate-900"
          style={{ 
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 24px))' 
          }}
        >
          <UserProfileMenu />
        </div>
      </aside>
    </>
  );
}
