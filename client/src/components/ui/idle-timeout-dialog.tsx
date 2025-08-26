import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, Shield } from "lucide-react";

interface IdleTimeoutDialogProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
  formatTime: (seconds: number) => string;
}

export function IdleTimeoutDialog({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout,
  formatTime
}: IdleTimeoutDialogProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center space-x-2">
            <div className="bg-amber-100 p-2 rounded-full">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-left">Session Timeout Warning</AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="text-left">
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Shield className="h-4 w-4" />
                <span>For security, your session will expire due to inactivity</span>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-2xl font-mono font-bold text-amber-800">
                    {formatTime(remainingSeconds)}
                  </div>
                  <div className="text-sm text-amber-700 mt-1">
                    Time remaining
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600">
                Click "Stay Logged In" to continue your session, or you'll be automatically logged out for security.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onLogout}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800"
            data-testid="button-logout-now"
          >
            Logout Now
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onExtend}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            data-testid="button-stay-logged-in"
          >
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}