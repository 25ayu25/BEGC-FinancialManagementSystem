import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Lock, Trash2 } from "lucide-react";

export default function Reports() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/reports"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'locked': return 'secondary';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const getDateRangeForPeriod = (period: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

    switch (period) {
      case "current-month":
        return { year: currentYear, month: currentMonth };
      
      case "last-month":
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        return { year: lastMonthYear, month: lastMonth };
      
      case "last-3-months":
        // For now, generate for 3 months ago (will improve this later to handle multiple months)
        const threeMonthsAgo = currentMonth - 2;
        if (threeMonthsAgo <= 0) {
          return { year: currentYear - 1, month: 12 + threeMonthsAgo };
        }
        return { year: currentYear, month: threeMonthsAgo };
      
      default:
        return { year: currentYear, month: currentMonth };
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

  const handleGenerateReport = () => {
    const dateRange = getDateRangeForPeriod(selectedPeriod);
    generateReport(dateRange.year, dateRange.month);
  };

  const downloadReport = async (pdfPath: string, filename: string) => {
    try {
      console.log('Downloading report:', pdfPath, filename);
      
      // Try direct window.open first (works well for PDFs)
      const downloadUrl = `/api${pdfPath}`;
      window.open(downloadUrl, '_blank');
      
      // Also try the blob method as backup
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
      a.target = '_blank';
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
          <Button onClick={() => generateReport(new Date().getFullYear(), new Date().getMonth() + 1)}>
            <Download className="h-4 w-4 mr-2" />
            Generate Current Month
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Date Filter and PDF Generation */}
        <Card>
          <CardHeader>
            <CardTitle>Report Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Select Time Period</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-month">Current Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                    <SelectItem value="custom-range">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleGenerateReport} data-testid="button-generate-pdf">
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
            </div>
          </CardContent>
        </Card>

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
                <Button className="mt-4" onClick={() => generateReport(new Date().getFullYear(), new Date().getMonth() + 1)}>
                  <Download className="h-4 w-4 mr-2" />
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
