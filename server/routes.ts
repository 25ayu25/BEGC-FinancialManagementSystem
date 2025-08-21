import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertReceiptSchema } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      // Check for session cookie
      const sessionCookie = req.cookies?.user_session;
      
      if (!sessionCookie) {
        // No session - require authentication
        console.log("No session found, authentication required");
        return res.status(401).json({ error: "Authentication required" });
      }

      try {
        const userSession = JSON.parse(sessionCookie);
        
        // Verify user still exists and is active
        const user = await storage.getUser(userSession.id);
        if (!user || user.status === 'inactive') {
          res.clearCookie('user_session');
          return res.status(401).json({ error: "Session invalid" });
        }

        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          location: user.location,
          fullName: user.fullName
        };
        
        next();
      } catch (parseError) {
        // Invalid session cookie, clear it
        res.clearCookie('user_session');
        console.log("Invalid session cookie");
        return res.status(401).json({ error: "Invalid session" });
      }
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ error: "Authentication error" });
    }
  };

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check password (in production, use bcrypt to compare hashed passwords)
      if (user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if user is active
      if (user.status === 'inactive') {
        return res.status(401).json({ error: "Account is deactivated" });
      }

      // Update last login
      await storage.updateUser(user.id, { lastLogin: new Date() });

      // Create session (simplified - in production use proper session management)
      const userSession = {
        id: user.id,
        username: user.username,
        role: user.role,
        location: user.location,
        fullName: user.fullName
      };

      // Set session cookie (simplified)
      res.cookie('user_session', JSON.stringify(userSession), {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json(userSession);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Clear session/cookies if using them
    res.clearCookie('user_session');
    res.clearCookie('session');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current user info
  app.get("/api/auth/user", requireAuth, (req, res) => {
    res.json(req.user);
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }

      // TODO: Implement actual password verification and update
      // For now, simulate success
      console.log(`Password change requested for user ${req.user.id}`);
      
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // User Management Routes
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      // Only admins can view all users
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const updates = req.body;

      // Validate user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user
      const updatedUser = await storage.updateUser(userId, updates);
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      // Only admins can create users
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      const { username, email, fullName, role, location, password, permissions } = req.body;
      
      if (!username || !email || !role || !location) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const userData = {
        username,
        email,
        fullName: fullName || null,
        role,
        location,
        password: password || "defaultPassword123", // In production, generate secure password
        permissions: JSON.stringify(permissions || []),
        status: "active"
      };

      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      // Handle database constraint violations
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_username_key') {
          return res.status(400).json({ error: `Username "${userData.username}" already exists. Please choose a different username.` });
        } else if (error.constraint === 'users_email_key') {
          return res.status(400).json({ error: `Email "${userData.email}" is already registered. Please use a different email address.` });
        }
      }
      
      res.status(500).json({ error: "Failed to create user" });
    }
  });



  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Only admins can delete users
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === req.user.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

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
      // Handle insurance provider - convert "no-insurance" to null
      // Set sync status based on user location - USA users get "synced", South Sudan users get "pending"
      const userLocation = (req as any).user.location;
      const syncStatus = userLocation === "usa" ? "synced" : "pending";
      
      const bodyWithDate = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        createdBy: (req as any).user.id,
        insuranceProviderId: req.body.insuranceProviderId === "no-insurance" ? null : req.body.insuranceProviderId,
        syncStatus: syncStatus
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

  // DELETE /api/transactions/:id - Delete a transaction
  app.delete("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTransaction(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Dashboard data
  app.get("/api/dashboard/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const range = req.query.range as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      const data = await storage.getDashboardData(year, month, range, startDate, endDate);
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

  app.get("/api/income-trends/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const range = req.query.range as string;
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      let data;
      
      if (range === 'custom' && startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        data = await storage.getIncomeTrendsForDateRange(startDate, endDate);
      } else if (range === 'last-3-months') {
        // Calculate last 3 months from current date
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 3);
        data = await storage.getIncomeTrendsForDateRange(startDate, endDate);
      } else {
        // For other ranges, use the existing month-based logic
        data = await storage.getIncomeTrendsForMonth(year, month);
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching income trends for month:", error);
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

  // Delete a monthly report
  app.delete("/api/reports/:reportId", requireAuth, async (req, res) => {
    try {
      const { reportId } = req.params;
      await storage.deleteMonthlyReport(reportId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // Download report PDF 
  app.get("/api/reports/:path", requireAuth, async (req, res) => {
    try {
      const path = req.params.path;
      const pathParts = path.replace('.pdf', '').split('-');
      const year = parseInt(pathParts[0]);
      const month = parseInt(pathParts[1]);
      
      // Get fresh dashboard data for accurate reporting
      const dashboardData = await storage.getDashboardData(year, month);
      
      // Get the report data
      const report = await storage.getMonthlyReport(year, month);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      // Use fresh data for accurate calculations
      const reportData = {
        ...report,
        totalIncome: dashboardData.totalIncome,
        totalExpenses: dashboardData.totalExpenses,
        netIncome: dashboardData.netIncome,
        departmentBreakdown: dashboardData.departmentBreakdown,
        insuranceBreakdown: dashboardData.insuranceBreakdown
      };
      
      // Generate PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      
      // Add header background and logo area
      doc.setFillColor(20, 83, 75); // Teal header background
      doc.rect(0, 0, pageWidth, 60, 'F');
      
      // Clinic name and title in white
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text('Bahr El Ghazal Clinic', margin, 25);
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'normal');
      doc.text('Financial Management System', margin, 35);
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Monthly Financial Report', margin, 50);
      
      // Reset text color for body
      doc.setTextColor(0, 0, 0);
      
      // Report period and generation info
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Report Period: ${monthName} ${year}`, margin, 80);
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, margin, 90);
      
      // Financial Summary Section
      let currentY = 110;
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(20, 83, 75);
      doc.text('Financial Summary', margin, currentY);
      
      // Add underline
      doc.setDrawColor(20, 83, 75);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, margin + 60, currentY + 2);
      
      currentY += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      
      // Summary table
      const summaryData = [
        ['Total Income', `SSP ${parseFloat(reportData.totalIncome).toLocaleString()}`],
        ['Total Expenses', `SSP ${parseFloat(reportData.totalExpenses).toLocaleString()}`],
        ['Net Income', `SSP ${parseFloat(reportData.netIncome).toLocaleString()}`]
      ];
      
      summaryData.forEach(([label, value], index) => {
        const isNetIncome = label === 'Net Income';
        const bgColor = isNetIncome ? (parseFloat(reportData.netIncome) >= 0 ? [220, 252, 231] : [254, 226, 226]) : [249, 250, 251];
        
        // Row background
        doc.setFillColor(...bgColor);
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 12, 'F');
        
        // Text
        doc.setFont(undefined, isNetIncome ? 'bold' : 'normal');
        doc.setFontSize(isNetIncome ? 13 : 12);
        doc.text(label, margin + 5, currentY);
        doc.text(value, pageWidth - margin - 5, currentY, { align: 'right' });
        
        currentY += 15;
      });
      
      // Department Breakdown Section
      if (reportData.departmentBreakdown && Object.keys(reportData.departmentBreakdown).length > 0) {
        currentY += 10;
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(20, 83, 75);
        doc.text('Department Performance', margin, currentY);
        
        // Add underline
        doc.line(margin, currentY + 2, margin + 80, currentY + 2);
        
        currentY += 20;
        doc.setTextColor(0, 0, 0);
        
        // Department table header
        doc.setFillColor(20, 83, 75);
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text('Department', margin + 5, currentY);
        doc.text('Revenue', pageWidth - margin - 5, currentY, { align: 'right' });
        doc.text('% of Total', pageWidth - margin - 60, currentY, { align: 'right' });
        
        currentY += 15;
        doc.setTextColor(0, 0, 0);
        
        // Department data
        const deptEntries = Object.entries(reportData.departmentBreakdown).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
        const totalIncome = parseFloat(reportData.totalIncome);
        
        deptEntries.forEach(([deptId, amount], index) => {
          let deptName = 'Unknown Department';
          if (deptId === '4242abf4-e68e-48c8-9eaf-ada2612bd4c2') deptName = 'Consultation';
          else if (deptId === 'ae648a70-c159-43b7-b814-7dadb213ae8d') deptName = 'Laboratory';
          else if (deptId === '09435c53-9061-429b-aecf-677b12bbdbd7') deptName = 'Ultrasound';
          else if (deptId === '6a06d917-a94a-4637-b1f6-a3fd6855ddd6') deptName = 'X-Ray';
          else if (deptId === '8fb395f9-ae59-4ddc-9ad3-e56b7fda161c') deptName = 'Pharmacy';
          
          const percentage = totalIncome > 0 ? ((parseFloat(amount) / totalIncome) * 100).toFixed(1) : '0.0';
          
          // Alternating row colors
          const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
          doc.setFillColor(...bgColor);
          doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 12, 'F');
          
          doc.setFont(undefined, 'normal');
          doc.setFontSize(11);
          doc.text(deptName, margin + 5, currentY);
          doc.text(`SSP ${parseFloat(amount).toLocaleString()}`, pageWidth - margin - 5, currentY, { align: 'right' });
          doc.text(`${percentage}%`, pageWidth - margin - 60, currentY, { align: 'right' });
          
          currentY += 12;
        });
      }
      
      // Footer section
      const footerY = doc.internal.pageSize.height - 30;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Bahr El Ghazal Clinic Financial Management System', margin, footerY);
      doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });
      doc.text('Confidential - For Internal Use Only', pageWidth / 2, footerY, { align: 'center' });
      
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      const filename = `Bahr_El_Ghazal_${monthName}_${year}_Report.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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
