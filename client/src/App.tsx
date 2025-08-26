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

function Router() {
  return (
    <Switch>
      {/* Public routes without sidebar */}
      <Route path="/login" component={Login} />
      
      {/* Authenticated routes with sidebar */}
      <Route>
        {(params) => {
          const [sidebarOpen, setSidebarOpen] = useState(false);
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
                <Route path="/settings" component={Settings} />
                <Route path="/security" component={Security} />
                <Route path="/users" component={UserManagement} />
                <Route component={NotFound} />
              </Switch>
            </div>
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
