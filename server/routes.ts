import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertReceiptSchema } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication middleware (simplified for now)
  const requireAuth = (req: any, res: any, next: any) => {
    // TODO: Implement proper authentication
    req.user = { id: "user-1", role: "admin", location: "usa" };
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
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        createdBy: req.user.id
      });

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
