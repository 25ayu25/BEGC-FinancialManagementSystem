import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Camera } from "lucide-react";
import AddTransactionModal from "@/components/transactions/add-transaction-modal";

interface QuickActionsProps {
  insuranceData?: Record<string, string>;
  insuranceProviders?: Array<{ id: string; name: string; code: string }>;
}

export default function QuickActions({ insuranceData, insuranceProviders }: QuickActionsProps) {
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  const totalInsurance = Object.values(insuranceData || {})
    .reduce((sum, amount) => sum + parseFloat(amount), 0);

  return (
    <div className="space-y-6">
      {/* Quick Actions Card */}
      <Card className="border border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full bg-primary text-white hover:bg-blue-700 transition-colors"
            onClick={() => setShowAddIncomeModal(true)}
            data-testid="button-add-income"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Income
          </Button>
          <Button 
            variant="destructive"
            className="w-full"
            onClick={() => setShowAddExpenseModal(true)}
            data-testid="button-add-expense"
          >
            <Minus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
          <Button 
            variant="outline"
            className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            data-testid="button-upload-receipt"
          >
            <Camera className="h-4 w-4 mr-2" />
            Upload Receipt
          </Button>
        </CardContent>
      </Card>

      {/* Insurance Providers */}
      <Card className="border border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Insurance Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!insuranceProviders?.length ? (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">No insurance data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insuranceProviders.map((provider) => {
                const amount = parseFloat(insuranceData?.[provider.id] || '0');
                return (
                  <div key={provider.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">
                          {provider.code.substring(0, 3).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">{provider.name}</span>
                    </div>
                    <span 
                      className="text-sm font-medium text-gray-900"
                      data-testid={`insurance-amount-${provider.code}`}
                    >
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Total</span>
                  <span 
                    className="text-sm font-bold text-primary"
                    data-testid="insurance-total"
                  >
                    ${totalInsurance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddTransactionModal 
        open={showAddIncomeModal} 
        onOpenChange={setShowAddIncomeModal}
        defaultType="income"
      />
      <AddTransactionModal 
        open={showAddExpenseModal} 
        onOpenChange={setShowAddExpenseModal}
        defaultType="expense"
      />
    </div>
  );
}
