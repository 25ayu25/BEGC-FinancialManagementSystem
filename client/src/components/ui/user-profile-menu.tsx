import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, Shield } from "lucide-react";

interface UserProfileMenuProps {
  userName?: string;
  userRole?: string;
}

export function UserProfileMenu({ userName, userRole }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();

  // Fetch current user info
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/auth/user');
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          // Redirect to login if not authenticated
          localStorage.removeItem('user_session_backup');
          window.location.href = '/login';
          throw new Error('Authentication required');
        }
        throw error;
      }
    },
    staleTime: 0, // Always refetch
    gcTime: 0  // Don't cache (updated property name for TanStack Query v5)
  });

  // Use provided props or fetched data
  const displayName = userName || currentUser?.fullName || currentUser?.username || "User";
  const displayRole = userRole || (currentUser?.role === 'admin' ? 'USA Admin' : 
    currentUser?.location === 'usa' ? `${currentUser?.role?.charAt(0).toUpperCase() + currentUser?.role?.slice(1)} - USA` : 
    currentUser?.location === 'south_sudan' ? `${currentUser?.role?.charAt(0).toUpperCase() + currentUser?.role?.slice(1)} - South Sudan` : 
    currentUser?.role) || "User";

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout');
      // Clear any cached user data and redirect to login page
      localStorage.removeItem('user_session_backup');
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
    }
    setIsOpen(false);
  };

  const handleSecurityClick = () => {
    navigate('/security');
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-3 w-full p-2">
        <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse"></div>
        <div className="text-left">
          <div className="w-20 h-4 bg-slate-200 rounded animate-pulse mb-1"></div>
          <div className="w-16 h-3 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="p-0 h-auto w-full justify-start hover:bg-gray-100"
          data-testid="button-user-profile"
        >
          <div className="flex items-center space-x-3 w-full">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
              <User className="text-white text-sm" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900" data-testid="text-user-name">
                {displayName}
              </p>
              <p className="text-xs text-gray-500" data-testid="text-user-role">
                {displayRole}
              </p>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center w-full cursor-pointer" data-testid="link-settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSecurityClick} className="cursor-pointer" data-testid="button-security">
          <Shield className="mr-2 h-4 w-4" />
          <span>Security</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer" data-testid="button-sign-out">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}