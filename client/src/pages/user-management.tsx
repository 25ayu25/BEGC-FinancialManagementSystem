import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import PageHeader from "@/components/layout/PageHeader";
import HeaderAction from "@/components/layout/HeaderAction";

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  permissions: string[];
}

export default function UserManagementPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    fullName: "",
    role: "",
    password: "",
    permissions: [] as string[]
  });

  const [editUser, setEditUser] = useState({
    username: "",
    email: "",
    fullName: "",
    role: "",
    status: "",
    permissions: [] as string[]
  });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data;
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await api.post('/api/users', userData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddDialogOpen(false);
      setNewUser({
        username: "",
        email: "",
        fullName: "",
        role: "",
        password: "",
        permissions: []
      });
      toast({
        title: "User Created",
        description: "New user has been created successfully."
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Create User",
        description: error.response?.data?.error || error.message || "Failed to create user. Please try again."
      });
    }
  });

  // Update user mutation
  const editUserMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await api.patch(`/api/users/${selectedUser?.id}`, updates);
      return res.data;
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
        title: "Failed to Update User",
        description: error.response?.data?.error || error.message || "Failed to update user."
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been removed successfully."
      });
    }
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const res = await api.patch(`/api/users/${id}`, { status: newStatus });
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: `User ${variables.newStatus === 'active' ? 'Activated' : 'Deactivated'}`,
        description: `User has been ${variables.newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Update Status",
        description: error.response?.data?.error || error.message || "Failed to update user status."
      });
    }
  });

  const roles = [
    { value: "admin", label: "Administrator", permissions: ["all"] },
    { value: "staff", label: "Staff", permissions: ["view", "create", "edit"] }
  ];

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.username || !newUser.email || !newUser.fullName || !newUser.role) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields."
      });
      return;
    }

    const selectedRole = roles.find(r => r.value === newUser.role);
    const userData = {
      ...newUser,
      location: "clinic", // Default location since not required from user
      permissions: selectedRole?.permissions || []
    };
    
    createUserMutation.mutate(userData);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser.username || !editUser.email || !editUser.fullName || !editUser.role) {
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
      location: "clinic", // Default location
      permissions: selectedRole?.permissions || []
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <PageHeader
        variant="userManagement"
        title="User Management"
        subtitle="Manage clinic staff accounts"
      >
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <HeaderAction
              variant="light"
              icon={<UserPlus className="w-4 h-4" />}
              data-testid="button-add-user"
            >
              Add User
            </HeaderAction>
          </DialogTrigger>
              <DialogContent className="sm:max-w-lg bg-white">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
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
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="John Doe"
                      required
                      data-testid="input-fullname"
                    />
                  </div>

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
          </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Users ({users?.length || 0})</CardTitle>
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
                  {users?.map((user: User) => (
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
                            <Badge className={user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                              {user.role}
                            </Badge>
                            <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                              {user.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{user.email}</span>
                            <span>Clinic Staff</span>
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
                              status: user.status,
                              permissions: user.permissions || []
                            });
                            setIsEditDialogOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          
                          {user.status === 'active' ? (
                            <DropdownMenuItem 
                              className="text-orange-600"
                              onClick={() => {
                                toggleUserStatusMutation.mutate({ 
                                  id: user.id, 
                                  newStatus: 'inactive' 
                                });
                              }}
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Deactivate User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="text-green-600"
                              onClick={() => {
                                toggleUserStatusMutation.mutate({ 
                                  id: user.id, 
                                  newStatus: 'active' 
                                });
                              }}
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Activate User
                            </DropdownMenuItem>
                          )}
                          
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
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
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
              <Label htmlFor="edit-fullName">Full Name *</Label>
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
                <Label htmlFor="edit-status">Status *</Label>
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
  );
}