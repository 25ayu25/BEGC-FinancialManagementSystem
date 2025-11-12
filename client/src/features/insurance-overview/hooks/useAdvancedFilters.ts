/**
 * Custom hook for managing advanced filters with URL sync
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export type FilterStatus = "submitted" | "partially_paid" | "paid" | "rejected" | "written_off";

export interface AdvancedFilters {
  providers: string[];
  startDate: string;
  endDate: string;
  minAmount?: number;
  maxAmount?: number;
  statuses: FilterStatus[];
  searchText: string;
  overdueOnly: boolean;
  highValueOnly: boolean;
  recentOnly: boolean;
}

const DEFAULT_FILTERS: AdvancedFilters = {
  providers: [],
  startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], // Start of year
  endDate: new Date().toISOString().split("T")[0], // Today
  minAmount: undefined,
  maxAmount: undefined,
  statuses: [],
  searchText: "",
  overdueOnly: false,
  highValueOnly: false,
  recentOnly: false,
};

export function useAdvancedFilters() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);

  // Read filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const urlFilters: AdvancedFilters = {
      providers: params.get("providers")?.split(",").filter(Boolean) || [],
      startDate: params.get("startDate") || DEFAULT_FILTERS.startDate,
      endDate: params.get("endDate") || DEFAULT_FILTERS.endDate,
      minAmount: params.get("minAmount") ? Number(params.get("minAmount")) : undefined,
      maxAmount: params.get("maxAmount") ? Number(params.get("maxAmount")) : undefined,
      statuses: (params.get("statuses")?.split(",") as FilterStatus[]) || [],
      searchText: params.get("search") || "",
      overdueOnly: params.get("overdueOnly") === "true",
      highValueOnly: params.get("highValueOnly") === "true",
      recentOnly: params.get("recentOnly") === "true",
    };
    
    setFilters(urlFilters);
  }, []);

  // Update URL when filters change
  const updateURL = useCallback((newFilters: AdvancedFilters) => {
    const params = new URLSearchParams();
    
    if (newFilters.providers.length > 0) {
      params.set("providers", newFilters.providers.join(","));
    }
    if (newFilters.startDate) params.set("startDate", newFilters.startDate);
    if (newFilters.endDate) params.set("endDate", newFilters.endDate);
    if (newFilters.minAmount) params.set("minAmount", String(newFilters.minAmount));
    if (newFilters.maxAmount) params.set("maxAmount", String(newFilters.maxAmount));
    if (newFilters.statuses.length > 0) {
      params.set("statuses", newFilters.statuses.join(","));
    }
    if (newFilters.searchText) params.set("search", newFilters.searchText);
    if (newFilters.overdueOnly) params.set("overdueOnly", "true");
    if (newFilters.highValueOnly) params.set("highValueOnly", "true");
    if (newFilters.recentOnly) params.set("recentOnly", "true");
    
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    window.history.pushState({}, "", newUrl);
  }, []);

  // Update a single filter
  const updateFilter = useCallback((key: keyof AdvancedFilters, value: any) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
  }, []);

  // Apply filters (update URL)
  const applyFilters = useCallback(() => {
    updateURL(filters);
  }, [filters, updateURL]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    updateURL(DEFAULT_FILTERS);
  }, [updateURL]);

  // Set date range preset
  const setDatePreset = useCallback((preset: string) => {
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString().split("T")[0];

    switch (preset) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0];
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
        endDate = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
        break;
      default:
        return;
    }

    setFilters(prev => ({ ...prev, startDate, endDate }));
  }, []);

  return {
    filters,
    updateFilter,
    clearFilters,
    applyFilters,
    setDatePreset,
  };
}
