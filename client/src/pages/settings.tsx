import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Database, Globe, Lock, User, Download, Save, Shield, Clock, MapPin } from "lucide-react";
import { useState } from "react";

export default function Settings() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  
  const handleSaveChanges = () => {
    // Simulate saving changes
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully."
    });
    setHasChanges(false);
  };

  const handleInputChange = () => {
    setHasChanges(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <Header 
        title="Settings" 
        subtitle="Manage your system preferences and configurations"
        actions={
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                Unsaved Changes
              </Badge>
            )}
            <Button 
              onClick={handleSaveChanges}
              disabled={!hasChanges}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
        {/* User Profile Settings */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <span className="text-slate-900">User Profile</span>
                <p className="text-sm font-normal text-slate-600 mt-1">Update your personal information and preferences</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-slate-700 font-medium">First Name</Label>
                <Input 
                  id="firstName" 
                  defaultValue="Admin" 
                  onChange={handleInputChange}
                  className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-slate-700 font-medium">Last Name</Label>
                <Input 
                  id="lastName" 
                  defaultValue="User" 
                  onChange={handleInputChange}
                  className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                defaultValue="admin@bahrelghazal.clinic" 
                onChange={handleInputChange}
                className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              />
              <p className="text-xs text-slate-500">This email will be used for notifications and account recovery</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-slate-700 font-medium">Role</Label>
              <Select defaultValue="admin" onValueChange={handleInputChange}>
                <SelectTrigger className="border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-600" />
                      Administrator
                    </div>
                  </SelectItem>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      Staff Member
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Globe className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <span className="text-slate-900">System Configuration</span>
                <p className="text-sm font-normal text-slate-600 mt-1">Configure regional and operational settings</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="location" className="text-slate-700 font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Primary Location
              </Label>
              <Select defaultValue="usa" onValueChange={handleInputChange}>
                <SelectTrigger className="border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usa">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      United States of America
                    </div>
                  </SelectItem>
                  <SelectItem value="south-sudan">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      South Sudan
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">This affects default currency, timezone, and data sync preferences</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-slate-700 font-medium">Default Currency</Label>
              <Select defaultValue="SSP" onValueChange={handleInputChange}>
                <SelectTrigger className="border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSP">
                    <div className="flex items-center justify-between w-full">
                      <span>South Sudanese Pound</span>
                      <Badge variant="secondary">SSP</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="USD">
                    <div className="flex items-center justify-between w-full">
                      <span>US Dollar</span>
                      <Badge variant="secondary">USD</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-slate-700 font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timezone
              </Label>
              <Select defaultValue="america/new_york" onValueChange={handleInputChange}>
                <SelectTrigger className="border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="america/new_york">
                    <div className="flex items-center justify-between w-full">
                      <span>Eastern Time (New York)</span>
                      <span className="text-xs text-slate-500">UTC-5</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="africa/juba">
                    <div className="flex items-center justify-between w-full">
                      <span>Central Africa Time (Juba)</span>
                      <span className="text-xs text-slate-500">UTC+3</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Bell className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <span className="text-slate-900">Notifications</span>
                <p className="text-sm font-normal text-slate-600 mt-1">Manage your alert preferences and communication settings</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <Bell className="h-3 w-3 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Email Notifications</p>
                  <p className="text-sm text-slate-600">Receive email alerts for important events and system updates</p>
                </div>
              </div>
              <Switch defaultChecked onCheckedChange={handleInputChange} />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <Database className="h-3 w-3 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Monthly Report Alerts</p>
                  <p className="text-sm text-slate-600">Get notified when monthly financial reports are generated</p>
                </div>
              </div>
              <Switch defaultChecked onCheckedChange={handleInputChange} />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                  <Globe className="h-3 w-3 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Low Balance Warnings</p>
                  <p className="text-sm text-slate-600">Alert when department budgets or account balances are running low</p>
                </div>
              </div>
              <Switch onCheckedChange={handleInputChange} />
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Database className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <span className="text-slate-900">Data Management</span>
                <p className="text-sm font-normal text-slate-600 mt-1">Control backup, sync, and export settings</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <Database className="h-3 w-3 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Automatic Backups</p>
                  <p className="text-sm text-slate-600">Automatically backup financial data every 24 hours</p>
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">Last backup: 2 hours ago</Badge>
                </div>
              </div>
              <Switch defaultChecked onCheckedChange={handleInputChange} />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <Globe className="h-3 w-3 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Data Sync</p>
                  <p className="text-sm text-slate-600">Sync financial data between USA and South Sudan locations</p>
                  <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-700">Last sync: 5 minutes ago</Badge>
                </div>
              </div>
              <Switch defaultChecked onCheckedChange={handleInputChange} />
            </div>
            
            <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                  <Download className="h-3 w-3 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Export Data</p>
                  <p className="text-sm text-slate-600">Download your financial data for backup, migration, or compliance</p>
                </div>
              </div>
              <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-100">
                <Download className="h-4 w-4 mr-2" />
                Export All Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <Lock className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <span className="text-slate-900">Security</span>
                <p className="text-sm font-normal text-slate-600 mt-1">Update your password and security preferences</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-slate-700 font-medium">Current Password</Label>
              <Input 
                id="currentPassword" 
                type="password" 
                onChange={handleInputChange}
                className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Enter your current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-700 font-medium">New Password</Label>
              <Input 
                id="newPassword" 
                type="password" 
                onChange={handleInputChange}
                className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Choose a strong password"
              />
              <p className="text-xs text-slate-500">Password must be at least 8 characters with numbers and symbols</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                onChange={handleInputChange}
                className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Confirm your new password"
              />
            </div>
            <Button className="w-full bg-red-600 hover:bg-red-700">
              <Lock className="h-4 w-4 mr-2" />
              Update Password
            </Button>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
}