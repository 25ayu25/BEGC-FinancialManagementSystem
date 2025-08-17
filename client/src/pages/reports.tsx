import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Lock } from "lucide-react";

export default function Reports() {
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

  const generateReport = async (year: number, month: number) => {
    // TODO: Implement PDF generation
    console.log(`Generating report for ${year}-${month}`);
  };

  return (
    <div className="flex-1 overflow-auto">
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

      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Reports</CardTitle>
          </CardHeader>
          <CardContent>
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
                            ${report.netIncome}
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
                        <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}>
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => generateReport(report.year, report.month)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate PDF
                        </Button>
                      )}
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
