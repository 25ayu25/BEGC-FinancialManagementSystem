import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  UserPlus, 
  Shield, 
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  Globe,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  location: string;
  status: string;
  lastLogin: string;
  createdAt: string;
  permissions: string[];
}

export default function UserManagementPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState({
    username: "",
    email: "",
    fullName: "",
    role: "",
    location: "",
    status: "",
    permissions: [] as string[]
  });
  
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    fullName: "",
    role: "",
    location: "",
    password: "",
    permissions: [] as string[]
  });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddDialogOpen(false);
      setNewUser({
        username: "",
        email: "",
        fullName: "",
        role: "",
        location: "",
        password: "",
        permissions: []
      });
      toast({
        title: "User Created",
        description: "New user has been added successfully."
      });
    },
    onError: (error: any) => {
      console.error('Create user error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create user. Please try again."
      });
    }
  });

  // Update user status
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Updated",
        description: "User has been updated successfully."
      });
    }
  });

  // Delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been removed successfully."
      });
    }
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/users/${selectedUser?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "User Updated",
        description: "User has been updated successfully."
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user. Please try again."
      });
    }
  });

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser.username || !editUser.email || !editUser.role || !editUser.location) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields."
      });
      return;
    }

    const selectedRole = roles.find(r => r.value === editUser.role);
    editUserMutation.mutate({
      ...editUser,
      permissions: selectedRole?.permissions || [],
      fullName: editUser.fullName || null
    });
  };

  const roles = [
    { value: "admin", label: "Administrator", permissions: ["all"] },
    { value: "manager", label: "Manager", permissions: ["view", "create", "edit", "reports"] },
    { value: "staff", label: "Staff", permissions: ["view", "create"] },
    { value: "viewer", label: "Viewer", permissions: ["view"] }
  ];

  const locations = [
    { value: "usa", label: "USA" },
    { value: "south_sudan", label: "South Sudan" }
  ];

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', newUser);
    
    if (!newUser.username || !newUser.email || !newUser.role || !newUser.location) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields."
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address."
      });
      return;
    }

    const selectedRole = roles.find(r => r.value === newUser.role);
    const userData = {
      ...newUser,
      permissions: selectedRole?.permissions || [],
      fullName: newUser.fullName || null
    };
    
    console.log('Sending user data:', userData);
    createUserMutation.mutate(userData);
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    updateUserMutation.mutate({
      id: user.id,
      updates: { status: newStatus }
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getLocationIcon = (location: string) => {
    return location === 'usa' ? <Globe className="w-4 h-4" /> : <MapPin className="w-4 h-4" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
                <p className="text-slate-600">Manage users, roles, and permissions</p>
              </div>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-0">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-xl font-semibold">Add New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={newUser.username}
                        onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="john.doe"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@clinic.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location *</Label>
                      <Select value={newUser.location} onValueChange={(value) => setNewUser(prev => ({ ...prev, location: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.value} value={location.value}>
                              {location.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Initial Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Leave empty for auto-generated"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createUserMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {createUserMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-0">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-xl font-semibold">Edit User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEditUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-username">Username *</Label>
                      <Input
                        id="edit-username"
                        value={editUser.username}
                        onChange={(e) => setEditUser(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="john.doe"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email *</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editUser.email}
                        onChange={(e) => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@clinic.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-fullName">Full Name</Label>
                    <Input
                      id="edit-fullName"
                      value={editUser.fullName}
                      onChange={(e) => setEditUser(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-role">Role *</Label>
                      <Select value={editUser.role} onValueChange={(value) => setEditUser(prev => ({ ...prev, role: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-location">Location *</Label>
                      <Select value={editUser.location} onValueChange={(value) => setEditUser(prev => ({ ...prev, location: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.value} value={location.value}>
                              {location.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select value={editUser.status} onValueChange={(value) => setEditUser(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={editUserMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {editUserMutation.isPending ? "Updating..." : "Update User"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Interactive Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Total Users Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
              onClick={() => {
                setFilterRole("");
                setFilterStatus("");
                setFilterLocation("");
                toast({
                  title: "Filter Reset",
                  description: "Showing all users"
                });
              }}
              data-testid="card-total-users"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {users?.length || 0}
                    </p>
                    <p className="text-sm text-slate-600 mb-1">Total Users</p>
                    <p className="text-xs text-slate-400">Click to show all</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Users Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all duration-200 group"
              onClick={() => {
                setFilterStatus("active");
                setFilterRole("");
                setFilterLocation("");
                toast({
                  title: "Filter Applied",
                  description: "Showing active users only"
                });
              }}
              data-testid="card-active-users"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 group-hover:text-green-600 transition-colors">
                      {users?.filter((u: User) => u.status === 'active').length || 0}
                    </p>
                    <p className="text-sm text-slate-600 mb-1">Active Users</p>
                    <p className="text-xs text-slate-400">Click to filter</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Administrators Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all duration-200 group"
              onClick={() => {
                setFilterRole("admin");
                setFilterStatus("");
                setFilterLocation("");
                toast({
                  title: "Filter Applied",
                  description: "Showing administrators only"
                });
              }}
              data-testid="card-administrators"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {users?.filter((u: User) => u.role === 'admin').length || 0}
                    </p>
                    <p className="text-sm text-slate-600 mb-1">Admins</p>
                    <p className="text-xs text-slate-400">Click to filter</p>
                  </div>
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Shield className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Locations Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all duration-200 group"
              onClick={() => {
                const locations = [...new Set(users?.map(user => user.location))];
                const locationNames = locations.map(loc => loc === 'usa' ? 'USA' : 'South Sudan');
                toast({
                  title: "Active Locations",
                  description: `Users are located in: ${locationNames.join(', ')}`
                });
              }}
              data-testid="card-locations"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                      {new Set(users?.map(user => user.location)).size || 0}
                    </p>
                    <p className="text-sm text-slate-600 mb-1">Locations</p>
                    <p className="text-xs text-slate-400">Click to view details</p>
                  </div>
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Status */}
          {(filterRole || filterStatus || filterLocation) && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm font-medium text-blue-800">
                  Filters applied: 
                  {filterRole && ` Role: ${filterRole}`}
                  {filterStatus && ` Status: ${filterStatus}`}
                  {filterLocation && ` Location: ${filterLocation}`}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setFilterRole("");
                  setFilterStatus("");
                  setFilterLocation("");
                  toast({
                    title: "Filters Cleared",
                    description: "Showing all users"
                  });
                }}
                className="text-blue-600 border-blue-200 hover:bg-blue-100"
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>All Users</span>
                {(filterRole || filterStatus || filterLocation) && (
                  <span className="text-sm font-normal text-slate-500">
                    ({users?.filter((user: User) => {
                      if (filterRole && user.role !== filterRole) return false;
                      if (filterStatus && user.status !== filterStatus) return false;
                      if (filterLocation && user.location !== filterLocation) return false;
                      return true;
                    }).length || 0} filtered)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-slate-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : users?.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No users found</h3>
                  <p className="text-slate-600 mb-4">Get started by adding your first user</p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First User
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {users?.filter((user: User) => {
                    // Apply filters
                    if (filterRole && user.role !== filterRole) return false;
                    if (filterStatus && user.status !== filterStatus) return false;
                    if (filterLocation && user.location !== filterLocation) return false;
                    return true;
                  }).map((user: User) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {user.fullName ? user.fullName.split(' ').map(n => n[0]).join('') : user.username.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-900">{user.fullName || user.username}</h4>
                            <Badge className={getRoleBadgeColor(user.role)}>
                              {user.role}
                            </Badge>
                            <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                              {user.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{user.email}</span>
                            <div className="flex items-center gap-1">
                              {getLocationIcon(user.location)}
                              <span className="capitalize">{user.location.replace('_', ' ')}</span>
                            </div>
                            <span>Last login: {user.lastLogin || 'Never'}</span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setEditUser({
                              username: user.username,
                              email: user.email,
                              fullName: user.fullName || "",
                              role: user.role,
                              location: user.location,
                              status: user.status,
                              permissions: user.permissions || []
                            });
                            setIsEditDialogOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                            {user.status === 'active' ? (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Key className="w-4 h-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <Separator className="my-1" />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this user?')) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}