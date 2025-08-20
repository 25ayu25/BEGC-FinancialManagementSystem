import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  EyeOff, 
  Building2,
  Shield,
  Globe,
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      toast({
        variant: "destructive",
        title: "Missing Credentials",
        description: "Please enter both username and password."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // For demo purposes, accept any credentials and redirect
      // In real implementation, this would call the authentication API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: "Login Successful",
        description: "Welcome back to Bahr El Ghazal Financial System."
      });
      
      // Redirect to dashboard
      navigate('/');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Please check your credentials and try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bahr El Ghazal Clinic</h1>
            <p className="text-slate-600">Financial Management System</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl text-center">Welcome Back</CardTitle>
            <p className="text-sm text-slate-600 text-center">
              Sign in to access your financial dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  required
                  data-testid="input-username"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    required
                    data-testid="input-password"
                    className="h-11 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Access Demo Accounts */}
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Demo Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">USA Admin</p>
                  <p className="text-xs text-slate-500">admin / password123</p>
                </div>
              </div>
              <Badge variant="default" className="text-xs">
                USA
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" />
                <div>
                  <p className="font-medium text-sm">South Sudan Staff</p>
                  <p className="text-xs text-slate-500">staff / password123</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                South Sudan
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          <p>© 2025 Bahr El Ghazal Clinic. All rights reserved.</p>
          <p className="mt-1">Secure financial management for healthcare operations</p>
        </div>
      </div>
    </div>
  );
}