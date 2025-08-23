import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { 
  Eye, 
  EyeOff
} from "lucide-react";
import clinicLogo from "@/assets/clinic-logo.jpeg";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(""); // Clear previous errors
    
    if (!credentials.username || !credentials.password) {
      setLoginError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    
    try {
      // Call the actual login API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const user = await response.json();
      
      // Safari fallback: store session in localStorage as backup
      localStorage.setItem('user_session_backup', JSON.stringify(user));
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.fullName || user.username}!`
      });
      
      // Redirect to dashboard with full page refresh to ensure proper state
      window.location.href = '/';
    } catch (error: any) {
      setLoginError("Incorrect username or password");
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
            <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-lg bg-white p-2">
              <img 
                src={clinicLogo} 
                alt="Bahr El Ghazal Clinic Logo" 
                className="w-full h-full object-contain rounded-xl"
              />
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
              Sign in
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
                  autoFocus
                  autoComplete="username"
                  data-testid="input-username"
                  className={`h-11 ${loginError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
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
                    autoComplete="current-password"
                    data-testid="input-password"
                    className={`h-11 pr-10 ${loginError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
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
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm text-teal-600 hover:text-teal-700 hover:underline focus:outline-none focus:underline"
                    onClick={() => {
                      toast({
                        title: "Password Reset",
                        description: "Please contact your system administrator to reset your password."
                      });
                    }}
                  >
                    Forgot password? Contact the administrator
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-700">{loginError}</p>
                </div>
              )}

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



        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          <p>© 2025 Bahr El Ghazal Clinic. All rights reserved.</p>
          <p className="mt-1">Secure financial management for healthcare operations</p>
        </div>
      </div>
    </div>
  );
}