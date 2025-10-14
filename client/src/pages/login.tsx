// client/src/pages/login.tsx
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import clinicLogo from "@/assets/clinic-logo.jpeg";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/queryClient";

export default function LoginPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [timeoutMessage, setTimeoutMessage] = useState("");

  const [credentials, setCredentials] = useState({ username: "", password: "" });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("timeout") === "true") {
      setTimeoutMessage("You were signed out due to inactivity. Please log in again.");
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!credentials.username || !credentials.password) {
      setLoginError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/api/auth/login", credentials);
      const user = response.data;

      // Safari fallback for session
      localStorage.setItem("user_session_backup", JSON.stringify(user));

      toast({ title: "Login Successful", description: `Welcome, ${user.fullName || user.username}!` });
      window.location.href = "/";
    } catch {
      setLoginError("Incorrect username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Full viewport, centered, with safe-area padding and no page scroll
    <main className="fullscreen grid place-items-center safe-pad bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Keep content width reasonable on phones and avoid tall outer spacing */}
      <section className="w-[min(92vw,420px)] mx-auto">
        <div className="flex flex-col items-center gap-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-lg bg-white p-2">
                <img
                  src={clinicLogo}
                  alt="Bahr El Ghazal Clinic Logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Bahr El Ghazal Clinic</h1>
              <p className="text-slate-600 text-sm">Financial Management System</p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-0">
            <CardHeader className="space-y-1 pb-5">
              <CardTitle className="text-lg text-center">Welcome</CardTitle>
              <p className="text-sm text-slate-600 text-center">
                Sign in to access the financial dashboard
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
                    onChange={(e) => setCredentials((p) => ({ ...p, username: e.target.value }))}
                    required
                    autoFocus
                    autoComplete="username"
                    data-testid="input-username"
                    className={`h-11 ${loginError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
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
                      onChange={(e) => setCredentials((p) => ({ ...p, password: e.target.value }))}
                      required
                      autoComplete="current-password"
                      data-testid="input-password"
                      className={`h-11 pr-10 ${loginError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-teal-600 hover:text-teal-700 hover:underline focus:outline-none focus:underline"
                      onClick={() =>
                        toast({
                          title: "Password Reset",
                          description: "Please contact your system administrator to reset your password.",
                        })
                      }
                    >
                      Forgot password? Contact the administrator
                    </button>
                  </div>
                </div>

                {/* Timeout Message */}
                {timeoutMessage && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      <p className="text-sm text-amber-800 font-medium">{timeoutMessage}</p>
                    </div>
                  </div>
                )}

                {/* Login Error */}
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

          {/* Footer (kept small so it never forces page scroll) */}
          <div className="text-center text-[11px] text-slate-500">
            <p>© 2025 Bahr El Ghazal Clinic. All rights reserved.</p>
            <p className="mt-1">Secure financial management for healthcare operations</p>
          </div>
        </div>
      </section>
    </main>
  );
}
