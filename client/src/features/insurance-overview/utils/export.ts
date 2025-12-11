/**
 * Export Utilities
 * 
 * Functions for exporting data to CSV and PDF formats
 */

import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

interface ExportData {
  overview: {
    totalRevenue: number;
    activeProviders: number;
    vsLastMonth: number;
    avgRevenuePerProvider?: number;
    projectedMonthlyTotal?: number | null;
    ytdRevenue?: number;
  };
  providerShares: Array<{
    name: string;
    value: number;
  }>;
  topProviders: Array<{
    rank: number;
    name: string;
    revenue: number;
    share: number;
    vsLastMonth: number;
  }>;
}

interface TrendDataPoint {
  month: Date | string;
  revenue: number;
  [key: string]: any;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(
  data: ExportData,
  trendData: TrendDataPoint[],
  periodLabel: string
): void {
  // Create CSV content
  const lines: string[] = [];
  
  // Header
  lines.push(`Insurance Revenue Report - ${periodLabel}`);
  lines.push(``); // Empty line
  
  // Overview section
  lines.push(`Overview Metrics`);
  lines.push(`Total Revenue,${formatCurrency(data.overview.totalRevenue)}`);
  lines.push(`Active Providers,${data.overview.activeProviders}`);
  lines.push(`Change vs Last Month,${data.overview.vsLastMonth.toFixed(1)}%`);
  
  if (data.overview.avgRevenuePerProvider !== undefined) {
    lines.push(`Average Revenue per Provider,${formatCurrency(data.overview.avgRevenuePerProvider)}`);
  }
  
  if (data.overview.ytdRevenue !== undefined) {
    lines.push(`YTD Revenue,${formatCurrency(data.overview.ytdRevenue)}`);
  }
  
  if (data.overview.projectedMonthlyTotal !== null && data.overview.projectedMonthlyTotal !== undefined) {
    lines.push(`Projected Monthly Total,${formatCurrency(data.overview.projectedMonthlyTotal)}`);
  }
  
  lines.push(``); // Empty line
  
  // Provider Performance section
  lines.push(`Provider Performance`);
  lines.push(`Rank,Provider Name,Revenue,Share %,Change vs Last Month`);
  
  data.topProviders.forEach(provider => {
    lines.push(
      `${provider.rank},${provider.name},${formatCurrency(provider.revenue)},${provider.share.toFixed(1)}%,${provider.vsLastMonth.toFixed(1)}%`
    );
  });
  
  lines.push(``); // Empty line
  
  // Trend data section (if available)
  if (trendData && trendData.length > 0) {
    lines.push(`Historical Revenue Trend`);
    lines.push(`Month,Revenue`);
    
    trendData.forEach(point => {
      const monthStr = format(
        typeof point.month === 'string' ? new Date(point.month) : point.month,
        'MMM yyyy'
      );
      lines.push(`${monthStr},${formatCurrency(point.revenue)}`);
    });
  }
  
  // Create blob and download
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `insurance-revenue-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data to PDF format (via print)
 */
export function exportToPDF(
  data: ExportData,
  trendData: TrendDataPoint[],
  periodLabel: string
): void {
  // Create a print-friendly HTML document
  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Insurance Revenue Report - ${periodLabel}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #1f2937;
          }
          
          h1 {
            color: #0d9488;
            font-size: 28px;
            margin-bottom: 10px;
          }
          
          .subtitle {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 30px;
          }
          
          .section {
            margin-bottom: 40px;
          }
          
          .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .metric {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            padding: 15px;
            border-radius: 8px;
          }
          
          .metric-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
          }
          
          .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          
          th, td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: left;
          }
          
          th {
            background: #f8fafc;
            font-weight: bold;
            color: #1f2937;
          }
          
          .positive {
            color: #10b981;
          }
          
          .negative {
            color: #ef4444;
          }
          
          @media print {
            body {
              padding: 20px;
            }
            
            .section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1>Insurance Revenue Report</h1>
        <div class="subtitle">
          Period: ${periodLabel} | Generated: ${format(new Date(), 'PPP')}
        </div>
        
        <div class="section">
          <div class="section-title">Overview Metrics</div>
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-label">Total Revenue</div>
              <div class="metric-value">${formatCurrency(data.overview.totalRevenue)}</div>
            </div>
            
            <div class="metric">
              <div class="metric-label">Active Providers</div>
              <div class="metric-value">${data.overview.activeProviders}</div>
            </div>
            
            ${data.overview.avgRevenuePerProvider !== undefined ? `
            <div class="metric">
              <div class="metric-label">Avg Revenue per Provider</div>
              <div class="metric-value">${formatCurrency(data.overview.avgRevenuePerProvider)}</div>
            </div>
            ` : ''}
            
            <div class="metric">
              <div class="metric-label">Change vs Last Month</div>
              <div class="metric-value ${data.overview.vsLastMonth >= 0 ? 'positive' : 'negative'}">
                ${data.overview.vsLastMonth >= 0 ? '+' : ''}${data.overview.vsLastMonth.toFixed(1)}%
              </div>
            </div>
            
            ${data.overview.ytdRevenue !== undefined ? `
            <div class="metric">
              <div class="metric-label">YTD Revenue</div>
              <div class="metric-value">${formatCurrency(data.overview.ytdRevenue)}</div>
            </div>
            ` : ''}
            
            ${data.overview.projectedMonthlyTotal !== null && data.overview.projectedMonthlyTotal !== undefined ? `
            <div class="metric">
              <div class="metric-label">Projected Monthly Total</div>
              <div class="metric-value">${formatCurrency(data.overview.projectedMonthlyTotal)}</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Provider Performance</div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Provider</th>
                <th>Revenue</th>
                <th>Share %</th>
                <th>vs Last Month</th>
              </tr>
            </thead>
            <tbody>
              ${data.topProviders.map(provider => `
                <tr>
                  <td>${provider.rank}</td>
                  <td>${provider.name}</td>
                  <td>${formatCurrency(provider.revenue)}</td>
                  <td>${provider.share.toFixed(1)}%</td>
                  <td class="${provider.vsLastMonth >= 0 ? 'positive' : 'negative'}">
                    ${provider.vsLastMonth >= 0 ? '+' : ''}${provider.vsLastMonth.toFixed(1)}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${trendData && trendData.length > 0 ? `
        <div class="section">
          <div class="section-title">Historical Revenue Trend</div>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${trendData.map(point => `
                <tr>
                  <td>${format(typeof point.month === 'string' ? new Date(point.month) : point.month, 'MMMM yyyy')}</td>
                  <td>${formatCurrency(point.revenue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </body>
    </html>
  `;
  
  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
