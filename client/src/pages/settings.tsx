import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Lock, User, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PageHeader from "@/components/layout/PageHeader";

// User type interface
interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  location: string;
  defaultCurrency: string;
  emailNotifications: boolean;
  reportAlerts: boolean;
}

// Settings schema for validation
const settingsSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  emailNotifications: z.boolean(),
  reportAlerts: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  
  // Fetch current user data
  const { data: user, isLoading: isUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Form setup with validation
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      firstName: "",
      lastName: "", 
      email: "",
      emailNotifications: true,
      reportAlerts: true,
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      const nameParts = (user.fullName || "").trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      
      const formData = {
        firstName,
        lastName,
        email: user.email || "",
        emailNotifications: user.emailNotifications ?? true,
        reportAlerts: user.reportAlerts ?? true,
      };
      
      form.reset(formData);
      setHasChanges(false);
    }
  }, [user, form]);

  // Watch for form changes
  const watchedValues = form.watch();
  useEffect(() => {
    if (user) {
      const currentValues = form.getValues();
      const nameParts = (user.fullName || "").trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      
      const hasFormChanges = 
        currentValues.firstName !== firstName ||
        currentValues.lastName !== lastName ||
        currentValues.email !== (user.email || "") ||
        currentValues.emailNotifications !== (user.emailNotifications ?? true) ||
        currentValues.reportAlerts !== (user.reportAlerts ?? true);
      
      setHasChanges(hasFormChanges);
    }
  }, [watchedValues, user, form]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const updateData = {
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        emailNotifications: data.emailNotifications,
        reportAlerts: data.reportAlerts,
      };
      
      const response = await apiRequest(
        "PATCH",
        `/api/users/${user.id}`,
        updateData
      );
      
      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully."
      });
      setHasChanges(false);
      // Invalidate user cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Save",
        description: error.message || "Could not save your settings. Please try again."
      });
    }
  });

  const onSubmit = (data: SettingsFormData) => {
    saveSettingsMutation.mutate(data);
  };

  const handleCancel = () => {
    if (user) {
      const nameParts = (user.fullName || "").trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      
      form.reset({
        firstName,
        lastName,
        email: user.email || "",
        emailNotifications: user.emailNotifications ?? true,
        reportAlerts: user.reportAlerts ?? true,
      });
      setHasChanges(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <Header 
          title="Settings" 
          subtitle="Manage your system preferences and configurations"
          actions={<div></div>}
        />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-slate-500">Loading settings...</div>
        </main>
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col h-full">
      <PageHeader
        variant="settings"
        title="Settings"
        subtitle="Manage your system preferences and configurations"
      >
        {hasChanges && (
          <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            Unsaved changes
          </div>
        )}
      </PageHeader>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* User Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input 
                    id="firstName" 
                    {...form.register("firstName")}
                    data-testid="input-firstname"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    {...form.register("lastName")}
                    data-testid="input-lastname"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  {...form.register("email")}
                  data-testid="input-email"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={user?.role} disabled>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-500 mt-1">
                  Contact your administrator to change your role
                </p>
              </div>
            </CardContent>
          </Card>



          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive email alerts for important events</p>
                </div>
                <Switch 
                  checked={form.watch("emailNotifications")}
                  onCheckedChange={(checked) => form.setValue("emailNotifications", checked, { shouldDirty: true })}
                  data-testid="switch-email-notifications"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Monthly Report Alerts</p>
                  <p className="text-sm text-gray-500">Get notified when reports are generated</p>
                </div>
                <Switch 
                  checked={form.watch("reportAlerts")}
                  onCheckedChange={(checked) => form.setValue("reportAlerts", checked, { shouldDirty: true })}
                  data-testid="switch-report-alerts"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings - Link to dedicated page */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Manage your password and security settings on the dedicated security page.
              </p>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => window.location.href = '/security'}
                data-testid="button-security"
              >
                Go to Security Settings
              </Button>
            </CardContent>
          </Card>

          {/* Save Changes */}
          {hasChanges && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-sm text-slate-700">You have unsaved changes</span>
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={saveSettingsMutation.isPending}
                    data-testid="button-cancel"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={saveSettingsMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </main>
      </form>
    </div>
  );
}