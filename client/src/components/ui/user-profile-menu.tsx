import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserProfileMenuProps {
  userName?: string;
  userRole?: string;
}

export function UserProfileMenu({ userName, userRole }: UserProfileMenuProps) {
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

  // Get first letter of name for avatar
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout');
      // Clear any cached user data and redirect to login page
      localStorage.removeItem('user_session_backup');
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-full animate-pulse"></div>
          <div className="flex-1 min-w-0">
            <div className="w-20 h-4 bg-slate-700 rounded animate-pulse mb-1"></div>
            <div className="w-16 h-3 bg-slate-700 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="user-profile-section">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            data-testid="button-user-menu"
            aria-label="Open user menu"
          >
            <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium shadow-md shrink-0">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-white truncate" data-testid="text-user-name">
                {displayName}
              </div>
              <div className="text-xs text-slate-400 truncate" data-testid="text-user-role">
                {displayRole}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          side="top"
          sideOffset={8}
          className="w-56 bg-slate-800 border-slate-700 text-white"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="text-xs text-slate-400">{displayRole}</p>
          </div>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem 
            onClick={handleSignOut}
            className="text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer focus:bg-slate-700 focus:text-white"
            data-testid="button-sign-out"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}