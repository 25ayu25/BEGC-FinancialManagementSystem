import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AdvancedDashboard from "@/pages/advanced-dashboard";
import SimpleDashboard from "@/pages/simple-dashboard";
import TransactionsSupabase from "@/pages/transactions-supabase";
import Reports from "@/pages/reports";
import Receipts from "@/pages/receipts";
import Settings from "@/pages/settings";
import Security from "@/pages/security";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

import Sidebar from "@/components/layout/sidebar";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import Loading from "@/components/Loading";

function Router() {
  const { isAuthenticated, isLoading } = useSupabaseAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Login />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={AdvancedDashboard} />
          <Route path="/advanced" component={AdvancedDashboard} />
          <Route path="/simple" component={SimpleDashboard} />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
