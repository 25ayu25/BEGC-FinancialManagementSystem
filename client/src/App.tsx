import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import AdvancedDashboard from "@/pages/advanced-dashboard";
import Transactions from "@/pages/transactions";
import TransactionsSupabase from "@/pages/transactions-supabase";
import Reports from "@/pages/reports";
import Receipts from "@/pages/receipts";
import Settings from "@/pages/settings";
import Security from "@/pages/security";
import Login from "@/pages/login";
import { TempAuthBypass } from "@/components/TempAuthBypass";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

function Router() {
  const { isAuthenticated, isLoading, user, profile } = useSupabaseAuth();

  console.log('Supabase Auth state:', { isAuthenticated, isLoading, user: !!user, profile: !!profile });

  // Seed data if authenticated and not loading
  if (isAuthenticated && !isLoading && user) {
    import('@/lib/seedData').then(({ seedSupabaseData }) => {
      seedSupabaseData();
    });
  }

  // Force show bypass screen for now since auth is stuck
  return <TempAuthBypass />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={AdvancedDashboard} />
          <Route path="/advanced" component={AdvancedDashboard} />
          <Route path="/simple" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/transactions" component={TransactionsSupabase} />
          <Route path="/add-transaction" component={TransactionsSupabase} />
          <Route path="/reports" component={Reports} />
          <Route path="/receipts" component={Receipts} />
          <Route path="/settings" component={Settings} />
          <Route path="/security" component={Security} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
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
