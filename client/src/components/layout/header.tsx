import { ReactNode } from "react";
import AppContainer from "@/components/layout/AppContainer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const { toast } = useToast();

  const generateCurrentMonthReport = async () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    try {
      const response = await fetch(`/api/reports/generate/${year}/${month}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to generate report");
      await queryClient.invalidateQueries({ queryKey: ["/api/reports"] });

      toast({
        title: "Report Generated",
        description: `Monthly report for ${currentDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })} has been generated successfully.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <AppContainer>
        <div className="py-4 sm:py-6 grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900" data-testid="text-page-title">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-500 mt-1" data-testid="text-page-subtitle">
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-3 md:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            {actions ?? (
              <>
                <Select defaultValue="current-month">
                  <SelectTrigger className="w-full sm:w-48 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-month">Current Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                    <SelectItem value="custom-range">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={generateCurrentMonthReport} className="min-h-[44px]" data-testid="button-generate-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Generate PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </AppContainer>
    </header>
  );
}
