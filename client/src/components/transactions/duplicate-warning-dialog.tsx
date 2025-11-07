import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  amount: string;
  currency: string;
  type: string;
  description?: string;
  departmentId?: string;
  expenseCategory?: string;
  createdAt: string;
}

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Transaction[];
  onProceed: () => void;
  onCancel: () => void;
}

export default function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onProceed,
  onCancel,
}: DuplicateWarningDialogProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeDifference = (dateStr: string) => {
    const now = new Date();
    const created = new Date(dateStr);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) > 1 ? "s" : ""} ago`;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl">Possible Duplicate Transaction Detected</AlertDialogTitle>
              <AlertDialogDescription className="text-base mt-1">
                We found {duplicates.length} similar transaction{duplicates.length > 1 ? "s" : ""} that {duplicates.length > 1 ? "were" : "was"} recently entered.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="my-4">
          <p className="text-sm text-gray-600 mb-3">
            Please review the following transaction{duplicates.length > 1 ? "s" : ""} to ensure you're not entering a duplicate:
          </p>

          <div className="space-y-3">
            {duplicates.map((dup) => (
              <div key={dup.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        dup.type === "income" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      }`}>
                        {dup.type === "income" ? "Income" : "Expense"}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {dup.currency} {Math.round(Number(dup.amount)).toLocaleString()}
                      </span>
                    </div>
                    {dup.description && (
                      <p className="text-sm text-gray-700 mb-1">{dup.description}</p>
                    )}
                    {dup.expenseCategory && (
                      <p className="text-xs text-gray-600">Category: {dup.expenseCategory}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-gray-500">Entered {getTimeDifference(dup.createdAt)}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(dup.date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">What would you like to do?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Cancel</strong> to review the existing transaction(s)</li>
            <li>• <strong>Proceed Anyway</strong> if this is truly a different transaction</li>
          </ul>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel & Review
          </Button>
          <Button variant="default" onClick={onProceed} className="bg-amber-600 hover:bg-amber-700">
            Proceed Anyway
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
