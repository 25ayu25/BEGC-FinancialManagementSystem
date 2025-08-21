import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter, Download, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface TransactionFiltersProps {
  onFilterChange?: (filters: {
    type?: string;
    departmentId?: string;
    insuranceProviderId?: string;
    dateRange?: { start: Date; end: Date };
    searchQuery?: string;
  }) => void;
  onExport?: () => void;
  transactions?: any[];
  departments?: any[];
  insuranceProviders?: any[];
}

export default function TransactionFilters({ onFilterChange, onExport, transactions = [], departments: propDepartments, insuranceProviders: propInsuranceProviders }: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    departmentId: "all",
    insuranceProviderId: "all", 
    searchQuery: "",
  });

  const { data: queryDepartments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: queryInsuranceProviders } = useQuery({
    queryKey: ["/api/insurance-providers"],
  });

  const departments = propDepartments || queryDepartments;
  const insuranceProviders = propInsuranceProviders || queryInsuranceProviders;

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Convert empty strings and "all" to undefined for the API
    const apiFilters = Object.fromEntries(
      Object.entries(newFilters).map(([k, v]) => [k, (v === "" || v === "all") ? undefined : v])
    );
    
    onFilterChange?.(apiFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      type: "all",
      departmentId: "all", 
      insuranceProviderId: "all",
      searchQuery: "",
    };
    setFilters(clearedFilters);
    onFilterChange?.({});
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== "" && value !== "all");

  const handleExport = () => {
    // Create CSV headers
    let csvContent = "Type,Department,Insurance,Amount,Currency,Description,Date\n";
    
    // Add transaction data
    transactions.forEach((transaction: any) => {
      const departmentName = (departments as any[])?.find((d: any) => d.id === transaction.departmentId)?.name || 'Unknown';
      const insuranceName = (insuranceProviders as any[])?.find((p: any) => p.id === transaction.insuranceProviderId)?.name || 'None';
      const amount = transaction.amount || '0';
      const currency = transaction.currency || 'SSP';
      const description = (transaction.description || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
      const date = new Date(transaction.date).toLocaleDateString();
      
      csvContent += `${transaction.type},${departmentName},${insuranceName},${amount},${currency},"${description}",${date}\n`;
    });
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onExport?.();
  };

  return (
    <div className="space-y-4">
      {/* Filter Toggle and Export */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-toggle-filters"
          className="flex items-center space-x-2"
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
              {Object.values(filters).filter(v => v !== "").length}
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleExport}
          data-testid="button-export-transactions"
          className="flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Filter Transactions</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search descriptions..."
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                  data-testid="input-search-transactions"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction Type
              </label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange("type", value)}>
                <SelectTrigger data-testid="select-transaction-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <Select value={filters.departmentId} onValueChange={(value) => handleFilterChange("departmentId", value)}>
                <SelectTrigger data-testid="select-department">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {((departments as any[]) || []).map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Insurance Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Provider
              </label>
              <Select value={filters.insuranceProviderId} onValueChange={(value) => handleFilterChange("insuranceProviderId", value)}>
                <SelectTrigger data-testid="select-insurance-provider">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {((insuranceProviders as any[]) || []).map((provider: any) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}