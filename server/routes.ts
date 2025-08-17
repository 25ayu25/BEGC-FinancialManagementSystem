import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertReceiptSchema } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication middleware (simplified for now)
  const requireAuth = (req: any, res: any, next: any) => {
    // TODO: Implement proper authentication - using seeded admin user
    req.user = { id: "de2bba16-93e6-4a6d-b0a9-a0b99ec805d4", role: "admin", location: "usa" };
    next();
  };

  // Departments
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  // Insurance Providers
  app.get("/api/insurance-providers", requireAuth, async (req, res) => {
    try {
      const providers = await storage.getInsuranceProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching insurance providers:", error);
      res.status(500).json({ error: "Failed to fetch insurance providers" });
    }
  });

  // Transactions
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, departmentId, type, limit } = req.query;
      
      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (departmentId) filters.departmentId = departmentId as string;
      if (type) filters.type = type as string;
      if (limit) filters.limit = parseInt(limit as string);

      const transactions = await storage.getTransactions(filters);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
      // Convert date string to Date object if it's a string
      const bodyWithDate = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        createdBy: (req as any).user.id
      };
      

      
      const validatedData = insertTransactionSchema.parse(bodyWithDate);

      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create transaction" });
      }
    }
  });

  // Dashboard data
  app.get("/api/dashboard/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const data = await storage.getDashboardData(year, month);
      res.json(data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Income trends data
  app.get("/api/income-trends", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const data = await storage.getIncomeTrends(days);
      res.json(data);
    } catch (error) {
      console.error("Error fetching income trends:", error);
      res.status(500).json({ error: "Failed to fetch income trends" });
    }
  });

  // Monthly Reports
  app.get("/api/reports", requireAuth, async (req, res) => {
    try {
      const { limit } = req.query;
      const reports = await storage.getMonthlyReports(limit ? parseInt(limit as string) : undefined);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const report = await storage.getMonthlyReport(year, month);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.post("/api/reports/generate/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const userId = (req as any).user.id;
      
      // Get dashboard data for the month
      const dashboardData = await storage.getDashboardData(year, month);
      
      // Create the monthly report
      const reportData = {
        year,
        month,
        totalIncome: dashboardData.totalIncome,
        totalExpenses: dashboardData.totalExpenses,
        netIncome: dashboardData.netIncome,
        departmentBreakdown: dashboardData.departmentBreakdown,
        insuranceBreakdown: dashboardData.insuranceBreakdown,
        status: "draft" as const,
        pdfPath: `/reports/${year}-${month.toString().padStart(2, '0')}.pdf`, // Mock path for now
        generatedBy: userId
      };
      
      const report = await storage.createMonthlyReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Download report PDF 
  app.get("/api/reports/:path", requireAuth, async (req, res) => {
    try {
      const path = req.params.path;
      const pathParts = path.replace('.pdf', '').split('-');
      const year = parseInt(pathParts[0]);
      const month = parseInt(pathParts[1]);
      
      // Get the report data
      const report = await storage.getMonthlyReport(year, month);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      // Generate PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Add clinic header
      doc.setFontSize(20);
      doc.text('Bahr El Ghazal Clinic', 20, 25);
      doc.setFontSize(16);
      doc.text('Monthly Financial Report', 20, 35);
      
      // Add report date
      doc.setFontSize(12);
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
      doc.text(`${monthName} ${year}`, 20, 45);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55);
      
      // Add financial summary
      doc.setFontSize(14);
      doc.text('Financial Summary', 20, 75);
      doc.setFontSize(11);
      doc.text(`Total Income: $${report.totalIncome}`, 20, 90);
      doc.text(`Total Expenses: $${report.totalExpenses}`, 20, 100);
      doc.text(`Net Income: $${report.netIncome}`, 20, 110);
      
      // Add department breakdown
      if (report.departmentBreakdown && Object.keys(report.departmentBreakdown).length > 0) {
        doc.setFontSize(14);
        doc.text('Department Breakdown', 20, 130);
        doc.setFontSize(11);
        
        let yPos = 145;
        for (const [deptId, amount] of Object.entries(report.departmentBreakdown)) {
          // Get department name (simplified mapping)
          let deptName = 'Unknown Department';
          if (deptId === '4242abf4-e68e-48c8-9eaf-ada2612bd4c2') deptName = 'Consultation';
          else if (deptId === 'ae648a70-c159-43b7-b814-7dadb213ae8d') deptName = 'Laboratory';
          else if (deptId === '09435c53-9061-429b-aecf-677b12bbdbd7') deptName = 'Ultrasound';
          else if (deptId === '6a06d917-a94a-4637-b1f6-a3fd6855ddd6') deptName = 'X-Ray';
          else if (deptId === '8fb395f9-ae59-4ddc-9ad3-e56b7fda161c') deptName = 'Pharmacy';
          
          doc.text(`${deptName}: $${amount}`, 25, yPos);
          yPos += 10;
        }
      }
      
      // Add footer
      doc.setFontSize(10);
      doc.text('This report was generated by the Bahr El Ghazal Clinic Financial Management System', 20, 280);
      
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${path}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // File upload for receipts
  app.post("/api/receipts/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/receipts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse({
        ...req.body,
        uploadedBy: req.user.id
      });

      const receipt = await storage.createReceipt(validatedData);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create receipt" });
      }
    }
  });

  // Serve receipt files
  app.get("/receipts/:receiptPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(`/objects/${req.params.receiptPath}`);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving receipt:", error);
      res.status(404).json({ error: "Receipt not found" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
