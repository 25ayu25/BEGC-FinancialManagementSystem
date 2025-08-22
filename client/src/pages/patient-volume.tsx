import { useState } from "react";
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all-departments");
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

  // Get patient volume data for selected date
  const { data: volumeData = [], isLoading } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/date", selectedDate.toISOString().split('T')[0], selectedDepartment],
    queryFn: () => {
      const params = selectedDepartment !== "all" ? `?departmentId=${selectedDepartment}` : "";
      return fetch(`/api/patient-volume/date/${selectedDate.toISOString().split('T')[0]}${params}`, {
        credentials: 'include'
      }).then(res => res.json());
    }
  });

  // Create patient volume mutation
  const createVolumeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      // Force refresh the data by clearing all patient volume queries
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume"] });
      queryClient.removeQueries({ queryKey: ["/api/patient-volume/date"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/date"] });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-slate-600">Record and monitor daily patient visits</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Date and Filter Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Date & Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                    data-testid="button-select-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>



            {/* Summary */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Patients:</span>
                <span className="text-lg font-semibold text-teal-600" data-testid="text-total-patients">
                  {totalPatients}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Volume Data */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Patient Volume - {format(selectedDate, "MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : volumeData.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No patient volume data recorded for this date
                </div>
              ) : (
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
        </div>
      </div>

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
                    <PopoverContent className="w-auto p-0">
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