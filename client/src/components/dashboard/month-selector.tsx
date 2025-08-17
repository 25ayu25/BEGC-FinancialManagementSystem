import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface MonthSelectorProps {
  onMonthChange?: (year: number, month: number, range?: string) => void;
}

export default function MonthSelector({ onMonthChange }: MonthSelectorProps) {
  const [selectedValue, setSelectedValue] = useState("current");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

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
    if (value === "custom") {
      setShowCustomRange(true);
      return;
    }
    setShowCustomRange(false);
    const option = generateMonthOptions().find(opt => opt.value === value);
    if (option) {
      onMonthChange?.(option.year, option.month, option.range);
    }
  };

  const handleCustomRangeApply = () => {
    if (startDate && endDate) {
      onMonthChange?.(startDate.getFullYear(), startDate.getMonth() + 1, `custom:${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}`);
      setShowCustomRange(false);
    }
  };

  const options = generateMonthOptions();

  if (showCustomRange) {
    return (
      <div className="flex items-center space-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-32 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMM dd") : "Start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        <span className="text-gray-500">to</span>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-32 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMM dd") : "End date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        <Button 
          size="sm" 
          onClick={handleCustomRangeApply}
          disabled={!startDate || !endDate}
          data-testid="button-apply-custom-range"
        >
          Apply
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            setShowCustomRange(false);
            setSelectedValue("current");
            handleSelectionChange("current");
          }}
          data-testid="button-cancel-custom-range"
        >
          Cancel
        </Button>
      </div>
    );
  }

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