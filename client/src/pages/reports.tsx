import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Lock, Trash2, Calendar } from "lucide-react";

export default function Reports() {
  const { toast } = useToast();
  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/reports"],
  });

  // State for month/year selection
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());

  // Generate year options (current year and past 2 years)
  const yearOptions = [];
  for (let i = 0; i < 3; i++) {
    yearOptions.push((currentDate.getFullYear() - i).toString());
  }

  // Month options
  const monthOptions = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'locked': return 'secondary';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const generateReport = async (year: number, month: number) => {
    try {
      const response = await fetch(`/api/reports/generate/${year}/${month}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const result = await response.json();
      
      // Refresh the reports list to show the newly generated report
      await queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      
      toast({
        title: "Report Generated",
        description: `Monthly report for ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} has been generated successfully.`
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive"
      });
    }
  };

  const downloadReport = async (pdfPath: string, filename: string) => {
    try {
      console.log('Downloading report:', pdfPath, filename);
      
      const downloadUrl = `/api${pdfPath}`;
      const response = await fetch(downloadUrl, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'report.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);
      
      toast({
        title: "Download Started",
        description: "The monthly report PDF is being downloaded."
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Error",
        description: "Failed to download report. Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete report');
      }
      
      // Refresh the reports list
      await queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      
      toast({
        title: "Report Deleted",
        description: "The monthly report has been deleted successfully."
      });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: "Error",
        description: "Failed to delete report. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <Header 
        title="Monthly Reports" 
        subtitle="Generate and manage monthly financial reports"
        actions={
          <div className="flex items-center space-x-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={() => generateReport(parseInt(selectedYear), parseInt(selectedMonth))}
              data-testid="button-generate-report"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Reports</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading reports...</p>
              </div>
            ) : !(reports as any)?.length ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No reports generated yet.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Reports are automatically generated at month-end or you can generate them manually.
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => generateReport(parseInt(selectedYear), parseInt(selectedMonth))}
                  data-testid="button-generate-first-report"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Generate First Report
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(reports as any).map((report: any) => (
                  <div 
                    key={report.id} 
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`card-report-${report.id}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {new Date(report.year, report.month - 1).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long' 
                          })} Report
                        </h3>
                        <p className="text-sm text-gray-500">
                          Net Income: <span className={`font-medium ${parseFloat(report.netIncome) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            SSP {Math.round(parseFloat(report.netIncome)).toLocaleString()}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge variant={getStatusColor(report.status)}>
                        {report.status === 'locked' && <Lock className="h-3 w-3 mr-1" />}
                        {report.status}
                      </Badge>
                      
                      {report.pdfPath ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => downloadReport(report.pdfPath, `Bahr_El_Ghazal_${new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long' })}_${report.year}_Report.pdf`)}
                          data-testid={`button-download-${report.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => generateReport(report.year, report.month)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate PDF
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => deleteReport(report.id)}
                        data-testid={`button-delete-${report.id}`}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
