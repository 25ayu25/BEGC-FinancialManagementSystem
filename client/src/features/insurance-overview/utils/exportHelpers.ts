/**
 * Export helper functions for CSV, Excel, and PDF
 */

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import Papa from "papaparse";

/**
 * Export data to CSV format
 */
export function exportToCSV(
  data: any[],
  columns: string[],
  filename: string = "export.csv"
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const formattedData = formatDataForExport(data, columns);
  const csv = Papa.unparse(formattedData);
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

/**
 * Export data to Excel format
 */
export function exportToExcel(
  data: any[],
  columns: string[],
  filename: string = "export.xlsx"
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const formattedData = formatDataForExport(data, columns);
  
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  XLSX.writeFile(workbook, filename);
}

/**
 * Export data to PDF format
 */
export function exportToPDF(
  data: any[],
  columns: string[],
  filename: string = "export.pdf"
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const formattedData = formatDataForExport(data, columns);
  
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text("Insurance Overview Report", 14, 15);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
  
  // Add table
  let yPosition = 30;
  const pageHeight = doc.internal.pageSize.height;
  
  // Headers
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  let xPosition = 14;
  columns.forEach(col => {
    doc.text(col, xPosition, yPosition);
    xPosition += 40;
  });
  
  yPosition += 7;
  doc.setFont(undefined, "normal");
  
  // Data rows
  formattedData.forEach((row: any) => {
    if (yPosition > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }
    
    xPosition = 14;
    columns.forEach(col => {
      const value = String(row[col] || "");
      doc.text(value.substring(0, 20), xPosition, yPosition);
      xPosition += 40;
    });
    
    yPosition += 7;
  });
  
  doc.save(filename);
}

/**
 * Format raw data for export based on selected columns
 */
export function formatDataForExport(rawData: any[], selectedColumns: string[]): any[] {
  return rawData.map(row => {
    const formatted: any = {};
    selectedColumns.forEach(col => {
      formatted[col] = formatValue(row[col]);
    });
    return formatted;
  });
}

/**
 * Format a single value for export
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Get available columns from data
 */
export function getAvailableColumns(data: any[]): string[] {
  if (!data || data.length === 0) return [];
  
  const columns = new Set<string>();
  data.forEach(row => {
    Object.keys(row).forEach(key => columns.add(key));
  });
  
  return Array.from(columns);
}
