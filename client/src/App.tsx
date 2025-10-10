import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import AdvancedDashboard from "@/pages/advanced-dashboard";
import Transactions from "@/pages/transactions";
import Reports from "@/pages/reports";
import PatientVolume from "@/pages/patient-volume";
import Settings from "@/pages/settings";
import Security from "@/pages/security";
import UserManagement from "@/pages/user-management";
import InsuranceProviders from "@/pages/insurance-providers";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import { useEffect, useState } from "react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleTimeoutDialog } from "@/components/ui/idle-timeout-dialog";

// Global date filter provider
import { DateFilterProvider } from "@/context/date-filter-context";

// Insurance page
import Insurance from "@/pages/insurance";

// 🔒 Auth gate + 401 safety net
import { AuthProvider, useAuth } from "@/context/auth";
import { useRequireAuth } from "@/hooks/use-require-auth";

function Router() {
  return (
    <Switch>
      {/* Public route */}
      <Route path="/login" component={Login} />

      {/* Protected area (everything else) */}
      <Route>
        {() => {
          const [sidebarOpen, setSidebarOpen] = useState(false);
          const [location, setLocation] = useLocation();
          const { status } = useAuth(); // "loading" | "guest" | "authed"

          // If guest, redirect to /login before rendering any shell
          useEffect(() => {
            if (status === "guest") {
              const next = encodeURIComponent(`${location}${window.location.search}`);
              setLocation(`/login?next=${next}`, { replace: true });
            }
          }, [status, location, setLocation]);

          // Attach 401 safety net after login
          useRequireAuth();

          // Don’t render the shell until authenticated (removes flash)
          if (status !== "authed") return null;

          // Auto-logout dialog (kept as-is)
          const isOnLoginPage = location === "/login";
          const { isWarning, remainingSeconds, extendSession, logoutNow, formatTime } =
            useIdleTimeout({
              timeoutMinutes: 15,
              warningMinutes: 3,
              enabled: !isOnLoginPage,
              onTimeout: () => {
                window.location.href = "/login?timeout=true";
              },
              onWarning: (seconds) => {
                console.log(`Session timeout warning: ${seconds} seconds remaining`);
              },
            });

          return (
            <div className="flex h-screen bg-gray-50">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <div className="flex-1 flex flex-col overflow-auto">
                {/* Mobile header */}
                <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    data-testid="button-mobile-menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <h1 className="text-lg font-semibold text-gray-900">Bahr El Ghazal Clinic</h1>
                  <div className="w-10"></div>
                </div>

                <Switch>
                  <Route path="/" component={AdvancedDashboard} />
                  <Route path="/advanced" component={AdvancedDashboard} />
                  <Route path="/simple" component={Dashboard} />
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/transactions" component={Transactions} />
                  <Route path="/reports" component={Reports} />
                  <Route path="/patient-volume" component={PatientVolume} />
                  <Route path="/insurance-providers" component={InsuranceProviders} />
                  <Route path="/insurance" component={Insurance} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/security" component={Security} />
                  <Route path="/users" component={UserManagement} />
                  <Route component={NotFound} />
                </Switch>
              </div>

              {/* Auto-logout warning dialog */}
              <IdleTimeoutDialog
                isOpen={isWarning}
                remainingSeconds={remainingSeconds}
                onExtend={extendSession}
                onLogout={logoutNow}
                formatTime={formatTime}
              />
            </div>
          );
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Global period provider (unchanged) */}
        <DateFilterProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </DateFilterProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
