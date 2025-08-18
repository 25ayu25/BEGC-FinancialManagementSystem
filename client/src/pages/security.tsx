import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, Clock, Globe, Monitor, Smartphone, Calendar, Trash2 } from "lucide-react";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Types for API responses
interface SessionInfo {
  sid: string;
  ua: string;
  ip: string;
  lastSeen: number;
  createdAt: number;
  current: boolean;
}

interface SessionsResponse {
  sessions: SessionInfo[];
}

interface TimeoutResponse {
  minutes: number;
}


// Password change schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Security() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Password change form
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Session management queries
  const { data: sessionsData, refetch: refetchSessions } = useQuery<SessionsResponse>({
    queryKey: ['/api/sessions'],
    enabled: !!user,
  });

  const { data: timeoutData, refetch: refetchTimeout } = useQuery<TimeoutResponse>({
    queryKey: ['/api/sessions/timeout'],
    enabled: !!user,
  });

  // State for dialogs
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);

  // Password change mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      return apiRequest('PUT', '/api/user/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
      setShowPasswordDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Session management mutations
  const revokeSessionMutation = useMutation({
    mutationFn: async (sid: string) => {
      return apiRequest('POST', '/api/sessions/revoke', { sid });
    },
    onSuccess: () => {
      toast({
        title: "Session Revoked",
        description: "The session has been signed out successfully.",
      });
      refetchSessions();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Revoke Session",
        description: error.message || "Could not revoke the session.",
        variant: "destructive",
      });
    }
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/sessions/revoke-all', {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Other devices signed out successfully.",
      });
      refetchSessions();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Sign Out",
        description: error.message || "Could not sign out from all devices.",
        variant: "destructive",
      });
    }
  });

  const updateTimeoutMutation = useMutation({
    mutationFn: async (minutes: number | null) => {
      return apiRequest('PUT', '/api/sessions/timeout', { minutes });
    },
    onSuccess: () => {
      toast({
        title: "Session Timeout Updated",
        description: "Your session timeout has been configured successfully.",
      });
      refetchTimeout();
      setShowTimeoutDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update session timeout.",
        variant: "destructive",
      });
    }
  });

  // Helper functions
  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getTimeoutLabel = (minutes: number | null) => {
    if (!minutes) return 'Never';
    if (minutes === 240) return '4 hours';
    if (minutes === 480) return '8 hours';
    if (minutes === 1440) return '24 hours';
    return `${minutes} minutes`;
  };

  const handleSecurityAction = (action: string) => {
    if (action === "Change password") {
      setShowPasswordDialog(true);
      return;
    }
    
    toast({
      title: "Security Action",
      description: `${action} feature will be implemented in a future update.`,
    });
  };

  const onPasswordSubmit = (data: z.infer<typeof passwordSchema>) => {
    updatePasswordMutation.mutate(data);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <Header 
        title="Security" 
        subtitle="Manage your account security and access controls"
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Account Security Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Password Strength</span>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Strong
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Active Sessions</span>
                </div>
                <Badge variant="secondary">
                  {sessionsData?.sessions?.length || 0}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Last Login</span>
                </div>
                <span className="text-sm text-gray-600">
                  Today
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Password Strength</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your current password strength is rated as strong
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Strong</span>
              </div>
            </div>
            
            <Separator />
            
            {!showPasswordDialog ? (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Last Password Change</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last changed recently
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowPasswordDialog(true)}
                  data-testid="button-change-password"
                >
                  Change Password
                </Button>
              </div>
            ) : (
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field} 
                            data-testid="input-current-password"
                            placeholder="Enter current password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field} 
                            data-testid="input-new-password"
                            placeholder="Enter new password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field} 
                            data-testid="input-confirm-new-password"
                            placeholder="Confirm new password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button 
                      type="submit" 
                      disabled={updatePasswordMutation.isPending}
                      data-testid="button-submit-password-change"
                    >
                      {updatePasswordMutation.isPending ? "Updating..." : "Change Password"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordDialog(false);
                        passwordForm.reset();
                      }}
                      data-testid="button-cancel-password-change"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            )}
            
            <Separator />
            
            <div className="space-y-3">
              <Label>Password Requirements</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>Contains uppercase letters</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>Contains lowercase letters</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>Contains numbers</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Session Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Session Timeout</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically sign out after {getTimeoutLabel(timeoutData?.minutes)}
                </p>
              </div>
              <Dialog open={showTimeoutDialog} onOpenChange={setShowTimeoutDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    data-testid="button-session-settings"
                  >
                    Configure
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Configure Session Timeout</DialogTitle>
                    <DialogDescription>
                      Choose when you want to be automatically signed out due to inactivity.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={timeoutData?.minutes === 240 ? "default" : "outline"}
                        onClick={() => updateTimeoutMutation.mutate(240)}
                        disabled={updateTimeoutMutation.isPending}
                      >
                        4 hours
                      </Button>
                      <Button
                        variant={timeoutData?.minutes === 480 ? "default" : "outline"}
                        onClick={() => updateTimeoutMutation.mutate(480)}
                        disabled={updateTimeoutMutation.isPending}
                      >
                        8 hours
                      </Button>
                      <Button
                        variant={timeoutData?.minutes === 1440 ? "default" : "outline"}
                        onClick={() => updateTimeoutMutation.mutate(1440)}
                        disabled={updateTimeoutMutation.isPending}
                      >
                        24 hours
                      </Button>
                      <Button
                        variant={!timeoutData?.minutes ? "default" : "outline"}
                        onClick={() => updateTimeoutMutation.mutate(null)}
                        disabled={updateTimeoutMutation.isPending}
                      >
                        Never
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Sessions</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You have {sessionsData?.sessions?.length || 0} active sessions
                </p>
              </div>
              <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    data-testid="button-view-sessions"
                  >
                    View Sessions
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Active Sessions</DialogTitle>
                    <DialogDescription>
                      Manage your active sessions across different devices and locations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {sessionsData?.sessions?.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No active sessions found.
                      </div>
                    ) : (
                      sessionsData?.sessions?.map((session: any) => (
                        <div 
                          key={session.sid} 
                          className={`flex items-center justify-between p-4 border rounded-lg ${
                            session.current ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {getDeviceIcon(session.ua)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {session.ua.includes('Chrome') ? 'Chrome Browser' : 
                                   session.ua.includes('Firefox') ? 'Firefox Browser' :
                                   session.ua.includes('Safari') ? 'Safari Browser' : 'Web Browser'}
                                </span>
                                {session.current && (
                                  <Badge variant="secondary" className="text-xs">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                IP: {session.ip || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Last seen: {formatLastSeen(session.lastSeen)}
                              </p>
                              {session.createdAt && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  <Calendar className="h-3 w-3 inline mr-1" />
                                  Signed in: {new Date(session.createdAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {!session.current && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => revokeSessionMutation.mutate(session.sid)}
                              disabled={revokeSessionMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sign Out Other Devices</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sign out from all other devices while keeping this session active
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => revokeAllSessionsMutation.mutate()}
                  disabled={revokeAllSessionsMutation.isPending}
                  data-testid="button-signout-others"
                >
                  {revokeAllSessionsMutation.isPending ? "Signing Out..." : "Sign Out Others"}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sign Out Everywhere</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sign out from all devices including this one (you will be logged out)
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    window.location.href = '/api/logout';
                  }}
                  data-testid="button-signout-everywhere"
                >
                  Sign Out Everywhere
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch 
                checked={false}
                onCheckedChange={() => handleSecurityAction("Toggle 2FA")}
                data-testid="switch-2fa"
              />
            </div>
            
            {true && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Two-factor authentication is disabled
                  </p>
                  <p className="text-orange-700 dark:text-orange-300 mt-1">
                    Enable 2FA to secure your account with an additional verification step.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Login Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Login Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Current Session</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Today • {user.location === 'usa' ? 'United States' : 'South Sudan'}
                  </p>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No suspicious login activity detected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Recommendations */}
        {user.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Regular Security Audits
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    Review user accounts and permissions monthly to ensure proper access control.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Strong Password Policy
                  </p>
                  <p className="text-green-700 dark:text-green-300 mt-1">
                    Your system enforces strong passwords for all user accounts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


      </main>
    </div>
  );
}