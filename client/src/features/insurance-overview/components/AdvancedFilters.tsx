/**
 * Advanced Filters Component for Insurance Overview
 */

import React, { useState } from "react";
import { Search, X, Calendar, DollarSign, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdvancedFilters as FilterType, FilterStatus } from "../hooks/useAdvancedFilters";

interface Provider {
  id: string;
  code: string;
  name: string;
}

interface AdvancedFiltersProps {
  filters: FilterType;
  providers: Provider[];
  onFilterChange: (key: keyof FilterType, value: any) => void;
  onClear: () => void;
  onApply: () => void;
  onDatePreset: (preset: string) => void;
}

const PROVIDER_OPTIONS = [
  "CIC",
  "UAP",
  "CIGNA",
  "New Sudan",
  "Amanah",
  "ALIMA",
  "Nile International",
  "Other",
];

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "written_off", label: "Written Off" },
];

const DATE_PRESETS = [
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "90days", label: "Last 90 Days" },
  { value: "ytd", label: "Year to Date" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

export function AdvancedFilters({
  filters,
  providers,
  onFilterChange,
  onClear,
  onApply,
  onDatePreset,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleProviderToggle = (providerCode: string) => {
    const current = filters.providers || [];
    const provider = providers.find(p => p.code === providerCode);
    if (!provider) return;

    const updated = current.includes(provider.id)
      ? current.filter(id => id !== provider.id)
      : [...current, provider.id];
    
    onFilterChange("providers", updated);
  };

  const handleStatusToggle = (status: FilterStatus) => {
    const current = filters.statuses || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    
    onFilterChange("statuses", updated);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant={filters.overdueOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("overdueOnly", !filters.overdueOnly)}
        >
          Overdue Only
        </Button>
        <Button
          variant={filters.highValueOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("highValueOnly", !filters.highValueOnly)}
        >
          High Value (&gt;$10,000)
        </Button>
        <Button
          variant={filters.recentOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("recentOnly", !filters.recentOnly)}
        >
          Recent (Last 7 Days)
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search claims, payments, notes, references..."
            value={filters.searchText}
            onChange={(e) => onFilterChange("searchText", e.target.value)}
            className="pl-10 pr-10"
          />
          {filters.searchText && (
            <button
              onClick={() => onFilterChange("searchText", "")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Date Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Date Range</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DATE_PRESETS.map(preset => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  onClick={() => onDatePreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600">Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => onFilterChange("startDate", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => onFilterChange("endDate", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Providers */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Insurance Providers</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {providers.map(provider => (
                <div key={provider.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`provider-${provider.id}`}
                    checked={filters.providers.includes(provider.id)}
                    onCheckedChange={() => handleProviderToggle(provider.code)}
                  />
                  <label
                    htmlFor={`provider-${provider.id}`}
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    {provider.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Amount Range (USD)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600">Min Amount</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minAmount || ""}
                  onChange={(e) =>
                    onFilterChange("minAmount", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Amount</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={filters.maxAmount || ""}
                  onChange={(e) =>
                    onFilterChange("maxAmount", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>
            </div>
          </div>

          {/* Status Filters */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Status</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(status => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={() => handleStatusToggle(status.value)}
                  />
                  <label
                    htmlFor={`status-${status.value}`}
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClear}>
          Clear All
        </Button>
        <Button onClick={onApply}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
