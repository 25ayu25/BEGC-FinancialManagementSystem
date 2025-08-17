import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileImage, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Receipts() {
  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/receipts/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (result: any) => {
    console.log("Upload complete:", result);
    // TODO: Create receipt record in database
  };

  const transactionsWithReceipts = (transactions as any)?.filter((t: any) => t.receiptPath) || [];
  const transactionsWithoutReceipts = (transactions as any)?.filter((t: any) => !t.receiptPath) || [];

  return (
    <div className="flex-1 overflow-auto">
      <Header 
        title="Receipts & Vouchers" 
        subtitle="Manage receipt photos and documentation for transactions"
        actions={
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search receipts..." 
                className="pl-10 w-64"
                data-testid="input-search-receipts"
              />
            </div>
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={5242880} // 5MB
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="bg-primary text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Receipt
            </ObjectUploader>
          </div>
        }
      />

      <main className="p-6 space-y-6">
        {/* Transactions needing receipts */}
        {transactionsWithoutReceipts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">Transactions Missing Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactionsWithoutReceipts.slice(0, 5).map((transaction: any) => (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                    data-testid={`card-missing-receipt-${transaction.id}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{transaction.description}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(transaction.date).toLocaleDateString()} • ${transaction.amount}
                      </p>
                    </div>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="bg-orange-600 text-white hover:bg-orange-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Receipt
                    </ObjectUploader>
                  </div>
                ))}
                {transactionsWithoutReceipts.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    And {transactionsWithoutReceipts.length - 5} more transactions without receipts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Receipts gallery */}
        <Card>
          <CardHeader>
            <CardTitle>Receipt Gallery</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsWithReceipts.length === 0 ? (
              <div className="text-center py-8">
                <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No receipts uploaded yet.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Upload receipt photos to maintain proper documentation for your transactions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transactionsWithReceipts.map((transaction: any) => (
                  <div 
                    key={transaction.id} 
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    data-testid={`card-receipt-${transaction.id}`}
                  >
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <FileImage className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(transaction.date).toLocaleDateString()} • ${transaction.amount}
                      </p>
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        View Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
