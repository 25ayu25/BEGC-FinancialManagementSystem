import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Users, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PatientVolume {
  id: string;
  date: string;
  departmentId?: string;
  patientCount: number;
  notes?: string;
  recordedBy: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

export default function PatientVolumePage() {
  // Check URL parameters for view mode and date parameters
  const urlParams = new URLSearchParams(window.location.search);
  const viewMode = urlParams.get('view');
  const yearParam = urlParams.get('year');
  const monthParam = urlParams.get('month');
  const dateParam = urlParams.get('date');
  const rangeParam = urlParams.get('range'); // New: time range from dashboard
  
  // Determine if we're in monthly view mode
  const isMonthlyView = viewMode === 'monthly' && yearParam && monthParam;
  
  // Determine if we're in multi-period view (last-3-months or year)
  const isMultiPeriodView = rangeParam === 'last-3-months' || rangeParam === 'year';
  
  // Set initial date and view type based on parameters
  // Default to monthly view showing current month when no specific parameters are provided
  const shouldDefaultToMonthly = !dateParam && !isMonthlyView;
  const initialViewType = isMonthlyView ? 'monthly' : (shouldDefaultToMonthly ? 'monthly' : 'daily');
  
  const initialDate = dateParam 
    ? new Date(dateParam + 'T12:00:00')
    : isMonthlyView 
      ? new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1)
      : shouldDefaultToMonthly 
        ? new Date() // For monthly view, current date is fine as it will show the whole month
        : new Date();
  
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all-departments");
  const [viewType, setViewType] = useState<'daily' | 'monthly'>(initialViewType);
  const [newEntry, setNewEntry] = useState({
    date: new Date(),
    departmentId: "",
    patientCount: "",
    notes: ""
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const queryClient = useQueryClient();

  // Get departments
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Get patient volume data - either daily, monthly, or multi-period
  const { data: volumeData = [], isLoading, error } = useQuery<PatientVolume[]>({
    queryKey: isMultiPeriodView
      ? ["/api/patient-volume/multi-period", rangeParam, parseInt(yearParam || '0'), parseInt(monthParam || '0'), selectedDepartment]
      : viewType === 'monthly' 
        ? ["/api/patient-volume/period", selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDepartment]
        : ["/api/patient-volume/date", selectedDate.toISOString().split('T')[0], selectedDepartment],
    queryFn: async () => {
      if (isMultiPeriodView) {
        // Fetch data for multiple periods
        const currentDate = new Date();
        let monthsToFetch: {year: number, month: number}[] = [];
        
        if (rangeParam === 'last-3-months') {
          // Get June, July, August (last 3 months)
          for (let i = 2; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i);
            monthsToFetch.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
          }
        } else if (rangeParam === 'year') {
          // Get all 12 months of current year
          const year = parseInt(yearParam || currentDate.getFullYear().toString());
          for (let month = 1; month <= 12; month++) {
            monthsToFetch.push({ year, month });
          }
        }
        
        // Fetch all months data
        const allData: PatientVolume[] = [];
        for (const { year, month } of monthsToFetch) {
          try {
            const response = await fetch(`/api/patient-volume/period/${year}/${month}`, {
              credentials: 'include'
            });
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data)) {
                allData.push(...data);
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch data for ${year}/${month}:`, error);
          }
        }
        
        return allData;
      } else if (viewType === 'monthly') {
        const response = await fetch(`/api/patient-volume/period/${selectedDate.getFullYear()}/${selectedDate.getMonth() + 1}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch monthly patient volume data');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } else {
        const params = selectedDepartment !== "all-departments" ? `?departmentId=${selectedDepartment}` : "?departmentId=all-departments";
        const response = await fetch(`/api/patient-volume/date/${selectedDate.toISOString().split('T')[0]}${params}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch patient volume data');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: false
  });

  // Create patient volume mutation
  const createVolumeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      // Force refresh all patient volume data and dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume"] });
      queryClient.removeQueries({ queryKey: ["/api/patient-volume/date"] });
      queryClient.removeQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume recorded successfully" });
      setShowAddForm(false);
      setNewEntry({ date: new Date(), departmentId: "", patientCount: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Failed to record patient volume", variant: "destructive" });
    }
  });

  // Delete patient volume mutation
  const deleteVolumeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/patient-volume/${id}`),
    onSuccess: () => {
      // Invalidate ALL patient volume related queries including dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume"] });
      queryClient.removeQueries({ queryKey: ["/api/patient-volume/date"] });
      queryClient.removeQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume record deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete record", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEntry.patientCount || parseInt(newEntry.patientCount) < 0) {
      toast({ title: "Please enter a valid patient count", variant: "destructive" });
      return;
    }

    createVolumeMutation.mutate({
      date: newEntry.date.toISOString(),
      departmentId: null,
      patientCount: parseInt(newEntry.patientCount),
      notes: newEntry.notes || null
    });
  };

  const totalPatients = Array.isArray(volumeData) ? volumeData.reduce((sum, entry) => sum + entry.patientCount, 0) : 0;

  // Group data by month for multi-period views
  const groupedByMonth = isMultiPeriodView ? volumeData.reduce((acc, entry) => {
    const entryDate = new Date(entry.date);
    const monthKey = `${entryDate.getFullYear()}-${(entryDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthName = format(entryDate, 'MMMM yyyy');
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        monthName,
        entries: [],
        total: 0
      };
    }
    
    acc[monthKey].entries.push(entry);
    acc[monthKey].total += entry.patientCount;
    return acc;
  }, {} as Record<string, { monthName: string; entries: PatientVolume[]; total: number }>) : {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-slate-600">
            {isMultiPeriodView 
              ? rangeParam === 'last-3-months' 
                ? 'Multi-month summary for last 3 months'
                : rangeParam === 'year'
                  ? `Year summary for ${parseInt(yearParam || new Date().getFullYear().toString())}`
                  : 'Multi-period summary'
              : viewType === 'monthly' 
                ? `Monthly summary for ${format(selectedDate, 'MMMM yyyy')}` 
                : 'Record and monitor daily patient visits'}
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-teal-600 hover:bg-teal-700"
          data-testid="button-add-volume"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </div>

      {/* Date Selector - Hidden for multi-period views */}
      {!isMultiPeriodView && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-select-date"
                >
                  <CalendarIcon className="w-4 h-4" />
                  {format(selectedDate, "MMMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl" 
                sideOffset={8}
                align="start"
                style={{ zIndex: 50 }}
              >
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <div className="text-sm text-slate-600">
              Total: <span className="font-semibold text-teal-600" data-testid="text-total-patients">{totalPatients}</span> patients
            </div>
          </div>
        </div>
      )}

      {/* Multi-period summary */}
      {isMultiPeriodView && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-slate-600">
            Total: <span className="font-semibold text-teal-600" data-testid="text-total-patients">{totalPatients}</span> patients
            <span className="ml-4 text-slate-500">
              {rangeParam === 'last-3-months' ? '(June - August 2025)' : rangeParam === 'year' ? `(${parseInt(yearParam || new Date().getFullYear().toString())})` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Patient Volume Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isMultiPeriodView 
              ? rangeParam === 'last-3-months' 
                ? 'Patient Volume - Last 3 Months'
                : rangeParam === 'year'
                  ? `Patient Volume - ${parseInt(yearParam || new Date().getFullYear().toString())}`
                  : 'Patient Volume - Multi-Period'
              : viewType === 'monthly' 
                ? `Patient Volume - ${format(selectedDate, "MMMM yyyy")}` 
                : `Patient Volume - ${format(selectedDate, "MMMM d, yyyy")}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : volumeData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No patient volume data recorded for this period
            </div>
          ) : isMultiPeriodView ? (
            // Multi-period view: Show month-by-month breakdown
            <div className="space-y-4">
              {Object.entries(groupedByMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([monthKey, monthData]) => (
                  <div key={monthKey} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-slate-900">{monthData.monthName}</h3>
                      <span className="text-lg font-semibold text-teal-600">{monthData.total} patients</span>
                    </div>
                    <div className="space-y-2">
                      {monthData.entries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                          <span className="text-slate-600">{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                          <span className="font-medium">{entry.patientCount} patients</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Single period view: Show individual entries
            <div className="space-y-3">
              {Array.isArray(volumeData) && volumeData.map((entry) => {
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">
                            {entry.patientCount} patients
                          </div>
                          <div className="text-sm text-slate-600">
                            {format(new Date(entry.date), "PPP")}
                          </div>
                          {entry.notes && (
                            <div className="text-xs text-slate-500 mt-1">{entry.notes}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteVolumeMutation.mutate(entry.id)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
        </CardContent>
      </Card>

      {/* Add New Entry Modal/Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md shadow-2xl border-0 bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Add Patient Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-entry-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newEntry.date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 z-[60] bg-white border border-slate-200 shadow-2xl" 
                      sideOffset={8}
                      style={{ zIndex: 60 }}
                    >
                      <Calendar
                        mode="single"
                        selected={newEntry.date}
                        onSelect={(date) => date && setNewEntry(prev => ({ ...prev, date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>



                <div className="space-y-2">
                  <Label>Patient Count</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEntry.patientCount}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, patientCount: e.target.value }))}
                    placeholder="Number of patients"
                    data-testid="input-patient-count"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about the day..."
                    data-testid="textarea-notes"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700"
                    disabled={createVolumeMutation.isPending}
                    data-testid="button-save-volume"
                  >
                    {createVolumeMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}