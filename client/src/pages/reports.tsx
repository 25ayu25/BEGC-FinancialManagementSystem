import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, api } from "@/lib/queryClient";
import { PageHeader, headerControlStyles } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Lock, Trash2, Calendar } from "lucide-react";

/** Helper: month name from 1-based month */
function monthName(month1Based: number) {
  return [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ][month1Based - 1];
}

/** Helper: numeric report path that the API accepts (robust) */
function numericPdfPath(year: number, month1Based: number) {
  return `/reports/${year}-${String(month1Based).padStart(2, "0")}.pdf`;
}

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
  const yearOptions: string[] = [];
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
      case "approved": return "default";
      case "locked": return "secondary";
      case "draft": return "outline";
      default: return "outline";
    }
  };

  const generateReport = async (year: number, month: number) => {
    try {
      await api.post(`/api/reports/generate/${year}/${month}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({
        title: "Report Generated",
        description: `Monthly report for ${new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })} has been generated successfully.`,
      });
    } catch (error: any) {
      console.error("Error generating report:", error);
      const errorMessage =
        error?.response?.status === 401
          ? "Please log in again to generate reports."
          : "Failed to generate report. Please try again.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  /**
   * Download a PDF from the API using axios so cookies/credentials are included.
   * Expects a path like /reports/YYYY-MM.pdf (we prefix /api below).
   */
  const downloadReport = async (pdfPath: string, filename: string) => {
    try {
      const response = await api.get(`/api${pdfPath}`, { responseType: "blob" });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: "The monthly report PDF is being downloaded." });
    } catch (error) {
      console.error("Error downloading report:", error);
      toast({ title: "Error", description: "Failed to download report. Please try again.", variant: "destructive" });
    }
  };

  /** Wrapper: always hit the numeric endpoint to avoid empty PDFs */
  const handleDownloadReport = async (report: any) => {
    const y = report.year as number;
    const m = report.month as number;
    const path = numericPdfPath(y, m);
    const fname = `Bahr_El_Ghazal_${monthName(m)}_${y}_Report.pdf`;
    return downloadReport(path, fname);
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report? This action cannot be undone.")) {
      return;
    }
    try {
      await api.delete(`/api/reports/${reportId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report Deleted", description: "The monthly report has been deleted successfully." });
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({ title: "Error", description: "Failed to delete report. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <PageHeader
        title="Monthly Reports"
        subtitle="Generate and view reports"
      >
        <div className="flex items-center space-x-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className={cn(headerControlStyles, "w-32 rounded-full")}>
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
            <SelectTrigger className={cn(headerControlStyles, "w-24 rounded-full")}>
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
            className="bg-white text-slate-900 hover:bg-slate-100 rounded-full"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </PageHeader>

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
                {(reports as any).map((report: any) => {
                  const net = Number(report.netIncome ?? 0);
                  const netLabel = isNaN(net) ? "0" : Math.round(net).toLocaleString();
                  return (
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
                            {new Date(report.year, report.month - 1).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                            })}{" "}
                            Report
                          </h3>
                          <p className="text-sm text-gray-500">
                            Net Income:{" "}
                            <span className={`font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                              SSP {netLabel}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Badge variant={getStatusColor(report.status)}>
                          {report.status === "locked" && <Lock className="h-3 w-3 mr-1" />}
                          {report.status}
                        </Badge>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(report)}
                          data-testid={`button-download-${report.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>

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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
