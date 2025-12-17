import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Filter, Download, Search, X, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface TransactionFiltersProps {
  onFilterChange?: (filters: {
    type?: string;
    departmentId?: string;
    insuranceProviderId?: string;
    startDate?: string;
    endDate?: string;
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
    startDate: "",
    endDate: "",
  });
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

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
    
    // Convert empty strings and "all" to undefined for the API, but keep date values
    const apiFilters = Object.fromEntries(
      Object.entries(newFilters).map(([k, v]) => {
        if (k === 'startDate' || k === 'endDate') {
          return [k, v === "" ? undefined : v];
        }
        return [k, (v === "" || v === "all") ? undefined : v];
      })
    );
    
    onFilterChange?.(apiFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      type: "all",
      departmentId: "all", 
      insuranceProviderId: "all",
      searchQuery: "",
      startDate: "",
      endDate: "",
    };
    setFilters(clearedFilters);
    setActiveQuickFilter(null);
    onFilterChange?.({});
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    if (key === 'type') {
      newFilters.type = 'all';
    } else if (key === 'departmentId') {
      newFilters.departmentId = 'all';
    } else if (key === 'insuranceProviderId') {
      newFilters.insuranceProviderId = 'all';
    } else if (key === 'searchQuery') {
      newFilters.searchQuery = '';
    } else if (key === 'startDate') {
      newFilters.startDate = '';
      setActiveQuickFilter(null);
    } else if (key === 'endDate') {
      newFilters.endDate = '';
      setActiveQuickFilter(null);
    }
    setFilters(newFilters);
    
    const apiFilters = Object.fromEntries(
      Object.entries(newFilters).map(([k, v]) => {
        if (k === 'startDate' || k === 'endDate') {
          return [k, v === "" ? undefined : v];
        }
        return [k, (v === "" || v === "all") ? undefined : v];
      })
    );
    
    onFilterChange?.(apiFilters);
  };

  const applyQuickFilter = (label: string, startDate: string, endDate: string) => {
    const newFilters = { ...filters, startDate, endDate };
    setFilters(newFilters);
    setActiveQuickFilter(label);
    
    const apiFilters = Object.fromEntries(
      Object.entries(newFilters).map(([k, v]) => {
        if (k === 'startDate' || k === 'endDate') {
          return [k, v === "" ? undefined : v];
        }
        return [k, (v === "" || v === "all") ? undefined : v];
      })
    );
    
    onFilterChange?.(apiFilters);
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== "" && value !== "all");

  const handleExport = () => {
    // Create CSV headers
    let csvContent = "Type,Department,Insurance,Amount,Currency,Description,Date\n";
    
    // Initialize totals for each currency
    const totals = {
      SSP: { income: 0, expense: 0, net: 0 },
      USD: { income: 0, expense: 0, net: 0 }
    };
    
    // Add transaction data and calculate totals
    transactions.forEach((transaction: any) => {
      const departmentName = (departments as any[])?.find((d: any) => d.id === transaction.departmentId)?.name || 'Unknown';
      const insuranceName = (insuranceProviders as any[])?.find((p: any) => p.id === transaction.insuranceProviderId)?.name || 'None';
      const amount = parseFloat(transaction.amount) || 0;
      const currency = transaction.currency || 'SSP';
      const description = (transaction.description || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
      const date = new Date(transaction.date).toLocaleDateString();
      
      // Add to totals
      if (!totals[currency]) {
        totals[currency] = { income: 0, expense: 0, net: 0 };
      }
      
      if (transaction.type === 'income') {
        totals[currency].income += amount;
      } else {
        totals[currency].expense += amount;
      }
      totals[currency].net = totals[currency].income - totals[currency].expense;
      
      csvContent += `${transaction.type},${departmentName},${insuranceName},${amount.toFixed(2)},${currency},"${description}",${date}\n`;
    });
    
    // Add totals summary at the bottom
    csvContent += "\n"; // Empty line separator
    csvContent += "SUMMARY TOTALS\n";
    csvContent += "Currency,Total Income,Total Expenses,Net Amount\n";
    
    Object.entries(totals).forEach(([currency, amounts]) => {
      if (amounts.income > 0 || amounts.expense > 0) {
        csvContent += `${currency},${amounts.income.toFixed(2)},${amounts.expense.toFixed(2)},${amounts.net.toFixed(2)}\n`;
      }
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

        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              data-testid="button-reset-filters"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Filters</span>
            </Button>
          )}
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

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(new Date(filters.startDate + 'T12:00:00'), "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border shadow-lg z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate ? new Date(filters.startDate + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                        handleFilterChange("startDate", localDate.toISOString().split('T')[0]);
                      } else {
                        handleFilterChange("startDate", "");
                      }
                    }}
                    initialFocus
                    className="bg-white"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(new Date(filters.endDate + 'T12:00:00'), "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border shadow-lg z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate ? new Date(filters.endDate + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                        handleFilterChange("endDate", localDate.toISOString().split('T')[0]);
                      } else {
                        handleFilterChange("endDate", "");
                      }
                    }}
                    initialFocus
                    className="bg-white"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick Date Filters */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={activeQuickFilter === 'Today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;
                applyQuickFilter('Today', todayStr, todayStr);
              }}
            >
              Today
            </Button>
            <Button
              variant={activeQuickFilter === 'This Week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as start of week
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - diff);
                
                const startYyyy = weekStart.getFullYear();
                const startMm = String(weekStart.getMonth() + 1).padStart(2, '0');
                const startDd = String(weekStart.getDate()).padStart(2, '0');
                const startStr = `${startYyyy}-${startMm}-${startDd}`;
                
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;
                
                applyQuickFilter('This Week', startStr, todayStr);
              }}
            >
              This Week
            </Button>
            <Button
              variant={activeQuickFilter === 'This Month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const monthStart = `${yyyy}-${mm}-01`;
                
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;
                
                applyQuickFilter('This Month', monthStart, todayStr);
              }}
            >
              This Month
            </Button>
          </div>


        </div>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.type !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Type: {filters.type}
              <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('type')} />
            </Badge>
          )}
          {filters.departmentId !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Department: {((departments as any[]) || []).find((d: any) => d.id === filters.departmentId)?.name || 'Unknown'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('departmentId')} />
            </Badge>
          )}
          {filters.insuranceProviderId !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Insurance: {((insuranceProviders as any[]) || []).find((p: any) => p.id === filters.insuranceProviderId)?.name || 'Unknown'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('insuranceProviderId')} />
            </Badge>
          )}
          {filters.searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{filters.searchQuery}"
              <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('searchQuery')} />
            </Badge>
          )}
          {filters.startDate && (
            <Badge variant="secondary" className="flex items-center gap-1">
              From: {format(new Date(filters.startDate + 'T12:00:00'), "MMM d, yyyy")}
              <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('startDate')} />
            </Badge>
          )}
          {filters.endDate && (
            <Badge variant="secondary" className="flex items-center gap-1">
              To: {format(new Date(filters.endDate + 'T12:00:00'), "MMM d, yyyy")}
              <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('endDate')} />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}