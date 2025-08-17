import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthSelectorProps {
  onMonthChange?: (year: number, month: number, range?: string) => void;
}

export default function MonthSelector({ onMonthChange }: MonthSelectorProps) {
  const [selectedValue, setSelectedValue] = useState("current");

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    // Current Month
    options.push({
      value: "current",
      label: "Current Month",
      year: now.getFullYear(),
      month: now.getMonth() + 1
    });

    // Last Month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    options.push({
      value: "last",
      label: "Last Month",
      year: lastMonth.getFullYear(),
      month: lastMonth.getMonth() + 1
    });

    // Last 3 Months
    options.push({
      value: "last3",
      label: "Last 3 Months",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      range: "3months"
    });

    // Last 6 Months
    options.push({
      value: "last6",
      label: "Last 6 Months",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      range: "6months"
    });

    // Last Year
    options.push({
      value: "lastyear",
      label: "Last Year",
      year: now.getFullYear() - 1,
      month: now.getMonth() + 1,
      range: "year"
    });

    // Custom Range
    options.push({
      value: "custom",
      label: "Custom Range",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      range: "custom"
    });

    return options;
  };

  const handleSelectionChange = (value: string) => {
    setSelectedValue(value);
    const option = generateMonthOptions().find(opt => opt.value === value);
    if (option) {
      onMonthChange?.(option.year, option.month, option.range);
    }
  };

  const options = generateMonthOptions();

  return (
    <div className="w-64">
      <Select value={selectedValue} onValueChange={handleSelectionChange}>
        <SelectTrigger data-testid="select-month-filter">
          <SelectValue placeholder="Select time period" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}