import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  onMonthChange?: (year: number, month: number) => void;
}

export default function MonthSelector({ onMonthChange }: MonthSelectorProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const handleQuickSelect = (type: 'current' | 'last' | 'prev') => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (type === 'last') {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    } else if (type === 'prev') {
      month -= 2;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
    }

    setSelectedYear(year);
    setSelectedMonth(month);
    onMonthChange?.(year, month);
  };

  const handleMonthChange = (newMonth: string) => {
    const month = parseInt(newMonth);
    setSelectedMonth(month);
    onMonthChange?.(selectedYear, month);
  };

  const handleYearChange = (newYear: string) => {
    const year = parseInt(newYear);
    setSelectedYear(year);
    onMonthChange?.(year, selectedMonth);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    let newYear = selectedYear;
    let newMonth = selectedMonth;

    if (direction === 'next') {
      newMonth += 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
    } else {
      newMonth -= 1;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
    }

    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  };

  return (
    <div className="flex items-center space-x-4 p-4 bg-white rounded-lg border">
      <Calendar className="h-5 w-5 text-gray-500" />
      
      {/* Quick Select Buttons */}
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect('current')}
          data-testid="button-current-month"
        >
          Current Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect('last')}
          data-testid="button-last-month"
        >
          Last Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect('prev')}
          data-testid="button-previous-month"
        >
          Previous Month
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('prev')}
          data-testid="button-prev-month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-32" data-testid="select-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value.toString()}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-20" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('next')}
          data-testid="button-next-month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}