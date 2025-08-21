import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import AdvancedDashboard from "@/pages/advanced-dashboard";
import Transactions from "@/pages/transactions";
import Reports from "@/pages/reports";

import Settings from "@/pages/settings";
import Security from "@/pages/security";
import UserManagement from "@/pages/user-management";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <Switch>
      {/* Public routes without sidebar */}
      <Route path="/login" component={Login} />
      
      {/* Authenticated routes with sidebar */}
      <Route>
        {(params) => (
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-auto">
              <Switch>
                <Route path="/" component={AdvancedDashboard} />
                <Route path="/advanced" component={AdvancedDashboard} />
                <Route path="/simple" component={Dashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/transactions" component={Transactions} />
                <Route path="/reports" component={Reports} />

                <Route path="/settings" component={Settings} />
                <Route path="/security" component={Security} />
                <Route path="/users" component={UserManagement} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </div>
        )}
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
