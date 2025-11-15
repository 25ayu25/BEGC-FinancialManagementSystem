// client/src/App.tsx
import { Switch, Route } from "wouter";
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
import { useState } from "react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleTimeoutDialog } from "@/components/ui/idle-timeout-dialog";
import { useLocation } from "wouter";

// Global date filter provider
import { DateFilterProvider } from "@/context/date-filter-context";

// Insurance page
import Insurance from "@/pages/insurance";

// Claim Reconciliation page
import ClaimReconciliation from "@/pages/claim-reconciliation";

// Insurance Overview page
import InsuranceOverview from "@/pages/insurance-overview";

function Router() {
  return (
    <Switch>
      {/* Public route without app chrome */}
      <Route path="/login" component={Login} />

      {/* Authenticated routes with sidebar */}
      <Route>
        {() => {
          const [sidebarOpen, setSidebarOpen] = useState(false);
          const [location] = useLocation();

          // Auto-logout (disabled on login page)
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
            // 👇 Use fullscreen + content-safe-b to be safe across iOS/Android UI bars
            <main
              role="main"
              className="fullscreen content-safe-b flex bg-gray-50"
            >
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              {/* Content column: single scroll container */}
              <div className="flex-1 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden scroll-touch">
                {/* Mobile header (sticky + safe notch padding) */}
                <div className="lg:hidden safe-pad sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    data-testid="button-mobile-menu"
                    aria-label="Open navigation"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <h1 className="text-lg font-semibold text-gray-900 truncate">
                    Bahr El Ghazal Clinic
                  </h1>
                  <div aria-hidden className="w-10" />
                </div>

                {/* Page routes */}
                <div className="px-4 sm:px-6 lg:px-8 py-4">
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
                    <Route path="/insurance-overview" component={InsuranceOverview} />
                    <Route path="/claim-reconciliation" component={ClaimReconciliation} />
                    <Route path="/settings" component={Settings} />
                    <Route path="/security" component={Security} />
                    <Route path="/users" component={UserManagement} />
                    <Route component={NotFound} />
                  </Switch>
                </div>
              </div>

              {/* Auto-logout warning dialog */}
              <IdleTimeoutDialog
                isOpen={isWarning}
                remainingSeconds={remainingSeconds}
                onExtend={extendSession}
                onLogout={logoutNow}
                formatTime={formatTime}
              />
            </main>
          );
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DateFilterProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </DateFilterProvider>
    </QueryClientProvider>
  );
}

export default App;
