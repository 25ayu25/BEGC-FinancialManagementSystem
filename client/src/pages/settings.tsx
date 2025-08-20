import { useState } from "react";
import Loading from "@/components/Loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/lib/supabase";

export default function Settings() {
  const { user, profile, isLoading } = useSupabaseAuth();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading) return <Loading />;

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please sign in to manage your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast({
        title: "Password too short",
        description: "Please use at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      toast({ title: "Password updated" });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Could not update password",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // The auth hook will push you to /login automatically
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Sign out failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Email</Label>
              <Input value={user.email ?? ""} disabled />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={profile?.role ?? "staff"} disabled />
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 pt-2">
            <Label htmlFor="password">Change password</Label>
            <div className="flex flex-col md:flex-row gap-3">
              <Input
                id="password"
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="md:w-80"
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update password"}
              </Button>
            </div>
          </form>

          <div className="pt-4">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
