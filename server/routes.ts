import type { Express, Request, Response, NextFunction } from "express";
// Removed unused imports
import { storage } from "./storage";
import { insertTransactionSchema, insertReceiptSchema, insertPatientVolumeSchema } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
        location: string;
        fullName: string;
      };
    }
  }
}

export async function registerRoutes(app: Express): Promise<void> {
  
  // Authentication middleware with Safari fallback support
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userSession = null;
      
      // First try cookie-based auth
      const sessionCookie = req.cookies?.user_session;
      console.log("Debug - Cookies received:", Object.keys(req.cookies || {}));
      console.log("Debug - Session cookie exists:", !!sessionCookie);
      
      if (sessionCookie) {
        try {
          userSession = JSON.parse(sessionCookie);
        } catch (parseError) {
          console.log("Cookie parse error:", parseError);
        }
      }
      
      // Safari fallback: check for session token in request headers
      if (!userSession) {
        const authHeader = req.headers['x-session-token'];
        if (authHeader) {
          try {
            userSession = JSON.parse(authHeader as string);
            console.log("Using header-based auth for Safari compatibility");
          } catch (parseError) {
            console.log("Header session parse error:", parseError);
          }
        }
      }
      
      if (!userSession) {
        console.log("No session found, authentication required");
        return res.status(401).json({ error: "Authentication required" });
      }

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
      // Case-insensitive username lookup
      const user = await storage.getUserByUsername(username.toLowerCase());
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

      // Cross-site cookie settings for Netlify → Render
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('user_session', JSON.stringify(userSession), {
        httpOnly: true, // Security: prevent XSS
        secure: isProduction, // HTTPS only in production
        sameSite: isProduction ? 'none' : 'lax', // REQUIRED for cross-site requests
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/', // Available for all paths
      });

      res.json(userSession);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Clear session/cookies with same settings as when set
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('user_session', {
      httpOnly: true, // Security: prevent XSS
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'none' : 'lax', // MUST match login cookie settings
      path: '/'
    });
    res.clearCookie('session');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current user info - with Safari fallback support
  app.get("/api/auth/user", async (req, res) => {
    try {
      // First try cookie-based auth
      const sessionCookie = req.cookies?.user_session;
      console.log("Auth check - Cookie exists:", !!sessionCookie);
      
      if (sessionCookie) {
        try {
          const userSession = JSON.parse(sessionCookie);
          const user = await storage.getUser(userSession.id);
          if (user && user.status !== 'inactive') {
            return res.json({
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
              location: user.location,
              fullName: user.fullName,
              defaultCurrency: user.defaultCurrency,
              emailNotifications: user.emailNotifications,
              reportAlerts: user.reportAlerts
            });
          }
        } catch (parseError) {
          console.log("Cookie parse error:", parseError);
        }
      }
      
      // Safari fallback: check for session token in request headers
      const authHeader = req.headers['x-session-token'];
      if (authHeader) {
        try {
          const userSession = JSON.parse(authHeader as string);
          const user = await storage.getUser(userSession.id);
          if (user && user.status !== 'inactive') {
            return res.json({
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
              location: user.location,
              fullName: user.fullName,
              defaultCurrency: user.defaultCurrency,
              emailNotifications: user.emailNotifications,
              reportAlerts: user.reportAlerts
            });
          }
        } catch (parseError) {
          console.log("Header session parse error:", parseError);
        }
      }
      
      res.status(401).json({ error: "Authentication required" });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Authentication error" });
    }
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

      // Get current user to verify current password
      const currentUser = await storage.getUser(req.user!.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      if (currentUser.password !== currentPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Update password in database
      const updatedUser = await storage.updateUser(req.user.id, { 
        password: newPassword 
      });

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update password" });
      }

      console.log(`Password successfully changed for user ${req.user!.id}`);
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Update user settings (profile and preferences)
  app.put("/api/user/settings", requireAuth, async (req, res) => {
    try {
      const { firstName, lastName, email, emailNotifications, reportAlerts } = req.body;
      
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: "First name, last name, and email are required" });
      }

      // Combine names for fullName
      const fullName = `${firstName} ${lastName}`;
      
      // Update user preferences
      const updatedUser = await storage.updateUser(req.user.id, {
        fullName,
        email,
        emailNotifications: emailNotifications ?? true,
        reportAlerts: reportAlerts ?? true
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ 
        success: true, 
        message: 'Settings updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          role: updatedUser.role,
          location: updatedUser.location,
          defaultCurrency: updatedUser.defaultCurrency,
          emailNotifications: updatedUser.emailNotifications,
          reportAlerts: updatedUser.reportAlerts
        }
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
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

  // Reset user password (admin only)
  app.patch("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    try {
      // Only admins can reset passwords
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      const userId = req.params.id;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: "New password is required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
      }

      // Validate user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update password
      const updatedUser = await storage.updateUser(userId, { 
        password: newPassword
      });
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update password" });
      }

      console.log(`Password reset successfully for user ${userId} by admin ${req.user?.id}`);
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
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
          return res.status(400).json({ error: `Username "${req.body.username}" already exists. Please choose a different username.` });
        } else if (error.constraint === 'users_email_key') {
          return res.status(400).json({ error: `Email "${req.body.email}" is already registered. Please use a different email address.` });
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
      if (id === req.user!.id) {
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
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // Default 50 per page
      const offset = (page - 1) * limit;

      // Parse date range (only filter if dates are explicitly provided)
      let startDate = null;
      let endDate = null;
      
      // Use provided dates if they exist
      if (req.query.startDate && req.query.startDate !== 'undefined') {
        startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate && req.query.endDate !== 'undefined') {
        endDate = new Date(req.query.endDate as string);
      }
      
      if (startDate && endDate) {
        console.log('Date filtering - Start:', startDate.toISOString().split('T')[0], 'End:', endDate.toISOString().split('T')[0]);
      } else {
        console.log('No date filtering applied - showing all transactions');
      }

      const filters: any = {
        limit,
        offset
      };
      
      // Only add date filters if they're explicitly provided
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      if (req.query.departmentId) filters.departmentId = req.query.departmentId as string;
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.insuranceProviderId) filters.insuranceProviderId = req.query.insuranceProviderId as string;
      if (req.query.searchQuery) filters.searchQuery = req.query.searchQuery as string;

      const result = await storage.getTransactionsPaginated(filters);
      res.json(result);
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

  // PUT /api/transactions/:id - Update a transaction
  app.put("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Convert date string to Date object if it's a string
      const updates = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined,
        insuranceProviderId: req.body.insuranceProviderId === "no-insurance" ? null : req.body.insuranceProviderId,
      };
      
      // Remove undefined values
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });
      
      const transaction = await storage.updateTransaction(id, updates);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update transaction" });
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

  // New endpoint for detailed transactions for data table
  app.get("/api/detailed-transactions/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const data = await storage.getDetailedTransactionsForMonth(year, month);
      res.json(data);
    } catch (error) {
      console.error("Error fetching detailed transactions:", error);
      res.status(500).json({ error: "Failed to fetch detailed transactions" });
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
      
      // Use fresh data for accurate calculations with currency separation
      const reportData = {
        ...report,
        totalIncomeSSP: dashboardData.totalIncomeSSP,
        totalIncomeUSD: dashboardData.totalIncomeUSD,
        totalIncome: dashboardData.totalIncome,
        totalExpenses: dashboardData.totalExpenses,
        netIncome: dashboardData.netIncome,
        departmentBreakdown: dashboardData.departmentBreakdown,
        insuranceBreakdown: dashboardData.insuranceBreakdown,
        expenseBreakdown: dashboardData.expenseBreakdown
      };
      
      // Generate PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 25;
      
      // Executive Header Design
      doc.setFillColor(20, 83, 75); // Professional teal header
      doc.rect(0, 0, pageWidth, 70, 'F');
      
      // Clinic Branding (Executive Style)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('BAHR EL GHAZAL CLINIC', margin, 30);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('EXECUTIVE FINANCIAL REPORT', margin, 45);
      
      // Professional Date Box
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
      doc.setFillColor(255, 255, 255, 0.9);
      doc.rect(pageWidth - 80, 15, 70, 40, 'F');
      
      doc.setTextColor(20, 83, 75);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`${monthName.toUpperCase()}`, pageWidth - 75, 32);
      doc.text(`${year}`, pageWidth - 75, 47);
      
      // Reset for body content
      doc.setTextColor(33, 37, 41);
      
      // Executive Summary Header with Professional Spacing
      let currentY = 95;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 83, 75);
      doc.text('EXECUTIVE SUMMARY', margin, currentY);
      
      // Professional underline
      doc.setDrawColor(20, 83, 75);
      doc.setLineWidth(1);
      doc.line(margin, currentY + 3, margin + 85, currentY + 3);
      
      // Generation timestamp (smaller, professional)
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125);
      doc.text(`Report generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, pageWidth - margin, currentY, { align: 'right' });
      
      // Executive KPI Cards
      currentY += 25;
      
      // Calculate key metrics for executive display
      const totalRevenue = parseFloat(reportData.totalIncomeSSP || "0") + parseFloat(reportData.totalIncomeUSD || "0") * 600; // Convert USD to SSP
      const totalExpenses = parseFloat(reportData.totalExpenses || "0");
      const netIncome = parseFloat(reportData.netIncome || "0");
      const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100) : 0;
      
      // Executive KPI Cards Layout
      const cardWidth = (pageWidth - 2 * margin - 30) / 3;
      const cardHeight = 35;
      
      // Revenue Card
      doc.setFillColor(33, 150, 243); // Professional blue
      doc.rect(margin, currentY, cardWidth, cardHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(`SSP ${Math.round(totalRevenue).toLocaleString()}`, margin + cardWidth/2, currentY + 15, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('TOTAL REVENUE', margin + cardWidth/2, currentY + 28, { align: 'center' });
      
      // Expenses Card
      doc.setFillColor(244, 67, 54); // Professional red
      doc.rect(margin + cardWidth + 15, currentY, cardWidth, cardHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(`SSP ${Math.round(totalExpenses).toLocaleString()}`, margin + cardWidth + 15 + cardWidth/2, currentY + 15, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('TOTAL EXPENSES', margin + cardWidth + 15 + cardWidth/2, currentY + 28, { align: 'center' });
      
      // Net Income Card
      const netIncomeColor = netIncome >= 0 ? [76, 175, 80] : [244, 67, 54]; // Green for positive, red for negative
      doc.setFillColor(netIncomeColor[0], netIncomeColor[1], netIncomeColor[2]);
      doc.rect(margin + 2 * (cardWidth + 15), currentY, cardWidth, cardHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(`SSP ${Math.round(netIncome).toLocaleString()}`, margin + 2 * (cardWidth + 15) + cardWidth/2, currentY + 15, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('NET INCOME', margin + 2 * (cardWidth + 15) + cardWidth/2, currentY + 28, { align: 'center' });
      
      currentY += cardHeight + 20;
      
      // Profit Margin Indicator
      doc.setTextColor(33, 37, 41);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Profit Margin:', margin, currentY);
      
      // Profit margin with color coding
      const marginColor = profitMargin >= 20 ? [76, 175, 80] : profitMargin >= 10 ? [255, 193, 7] : [244, 67, 54];
      doc.setTextColor(marginColor[0], marginColor[1], marginColor[2]);
      doc.setFontSize(16);
      doc.text(`${profitMargin.toFixed(1)}%`, margin + 50, currentY);
      
      // Performance indicator
      const performanceText = profitMargin >= 20 ? '⬆ Excellent' : profitMargin >= 10 ? '→ Good' : '⬇ Needs Attention';
      doc.setFontSize(12);
      doc.text(performanceText, margin + 90, currentY);
      
      currentY += 20;
      
      // Executive Financial Breakdown
      doc.setTextColor(33, 37, 41);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL BREAKDOWN', margin, currentY);
      
      currentY += 15;
      
      // Professional table for detailed breakdown
      const tableData = [];
      
      // Revenue breakdown
      if (parseFloat(reportData.totalIncomeSSP || "0") > 0) {
        tableData.push(['Direct Revenue (SSP)', `SSP ${parseFloat(reportData.totalIncomeSSP || "0").toLocaleString()}`, 'primary']);
      }
      
      if (parseFloat(reportData.totalIncomeUSD || "0") > 0) {
        tableData.push(['Insurance Revenue (USD)', `USD ${parseFloat(reportData.totalIncomeUSD || "0").toLocaleString()}`, 'secondary']);
      }
      
      if (parseFloat(reportData.totalExpenses || "0") > 0) {
        tableData.push(['Operating Expenses', `SSP ${parseFloat(reportData.totalExpenses || "0").toLocaleString()}`, 'expense']);
      }
      
      tableData.push(['Net Operating Income', `SSP ${Math.round(netIncome).toLocaleString()}`, netIncome >= 0 ? 'profit' : 'loss']);
      
      // Render executive table
      tableData.forEach(([label, value, type], index) => {
        let bgColor, textColor;
        
        switch (type) {
          case 'primary':
            bgColor = [227, 242, 253];
            textColor = [21, 101, 192];
            break;
          case 'secondary':
            bgColor = [230, 247, 255];
            textColor = [2, 136, 209];
            break;
          case 'expense':
            bgColor = [255, 235, 238];
            textColor = [183, 28, 28];
            break;
          case 'profit':
            bgColor = [232, 245, 233];
            textColor = [27, 94, 32];
            break;
          case 'loss':
            bgColor = [255, 235, 238];
            textColor = [183, 28, 28];
            break;
          default:
            bgColor = [248, 249, 250];
            textColor = [33, 37, 41];
        }
        
        // Professional row styling
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(margin, currentY - 6, pageWidth - 2 * margin, 16, 'F');
        
        // Add subtle border
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(margin, currentY - 6, pageWidth - 2 * margin, 16);
        
        // Text styling
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', type === 'profit' || type === 'loss' ? 'bold' : 'normal');
        doc.setFontSize(type === 'profit' || type === 'loss' ? 13 : 12);
        
        doc.text(label, margin + 8, currentY + 3);
        doc.text(value, pageWidth - margin - 8, currentY + 3, { align: 'right' });
        
        currentY += 18;
      });
      
      // Executive Expenditure Analysis
      if (reportData.expenseBreakdown && Object.keys(reportData.expenseBreakdown).length > 0) {
        currentY += 25;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 83, 75);
        doc.text('EXPENDITURE ANALYSIS', margin, currentY);
        
        // Professional underline
        doc.setDrawColor(20, 83, 75);
        doc.setLineWidth(1);
        doc.line(margin, currentY + 3, margin + 95, currentY + 3);
        
        currentY += 25;
        
        // Executive-style expense table header
        doc.setFillColor(37, 47, 63); // Executive dark blue
        doc.rect(margin, currentY - 10, pageWidth - 2 * margin, 18, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('EXPENSE CATEGORY', margin + 10, currentY);
        doc.text('AMOUNT (SSP)', pageWidth - margin - 80, currentY);
        doc.text('% OF TOTAL', pageWidth - margin - 15, currentY, { align: 'right' });
        
        currentY += 20;
        
        // Calculate total for percentages
        const expenseEntries = Object.entries(reportData.expenseBreakdown)
          .filter(([category, amount]) => parseFloat(amount) > 0)
          .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
        
        const totalExpenseAmount = expenseEntries.reduce((sum, [, amount]) => sum + parseFloat(amount), 0);
        
        // Render expense data with executive styling
        expenseEntries.forEach(([category, amount], index) => {
          const numAmount = parseFloat(amount);
          const percentage = ((numAmount / totalExpenseAmount) * 100).toFixed(1);
          
          // Executive row colors
          const bgColor = index % 2 === 0 ? [248, 249, 250] : [255, 255, 255];
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 16, 'F');
          
          // Subtle borders
          doc.setDrawColor(230, 230, 230);
          doc.setLineWidth(0.2);
          doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 16);
          
          // Text styling
          doc.setTextColor(33, 37, 41);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          
          doc.text(category.toUpperCase(), margin + 10, currentY);
          doc.text(`SSP ${Math.round(numAmount).toLocaleString()}`, pageWidth - margin - 80, currentY);
          doc.text(`${percentage}%`, pageWidth - margin - 15, currentY, { align: 'right' });
          
          currentY += 16;
        });
        
        // Executive Summary Total
        doc.setFillColor(20, 83, 75); // Professional teal
        doc.rect(margin, currentY - 5, pageWidth - 2 * margin, 20, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('TOTAL EXPENDITURE', margin + 10, currentY + 5);
        doc.text(`SSP ${Math.round(totalExpenseAmount).toLocaleString()}`, pageWidth - margin - 80, currentY + 5);
        doc.text('100.0%', pageWidth - margin - 15, currentY + 5, { align: 'right' });
        
        currentY += 30;
      }
      
      // Calculate departmental revenue for analysis (outside conditional scope)
      let clinicRevenue = 0, physiciansRevenue = 0, laboratoryRevenue = 0, radiologyRevenue = 0, insuranceRevenue = 0;
      const colWidth = (pageWidth - 2 * margin) / 5; // Define colWidth outside conditional scope
      
      // Executive Department Performance Analysis
      if (reportData.departmentBreakdown && Object.keys(reportData.departmentBreakdown).length > 0) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 83, 75);
        doc.text('DEPARTMENT PERFORMANCE', margin, currentY);
        
        // Professional underline
        doc.setDrawColor(20, 83, 75);
        doc.setLineWidth(1);
        doc.line(margin, currentY + 3, margin + 120, currentY + 3);
        
        currentY += 25;
        
        // Executive department header
        doc.setFillColor(37, 47, 63); // Executive dark blue
        doc.rect(margin, currentY - 10, pageWidth - 2 * margin, 18, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        
        // Professional column headers
        doc.text('CLINIC', margin + colWidth/2, currentY, { align: 'center' });
        doc.text('PHYSICIANS', margin + colWidth + colWidth/2, currentY, { align: 'center' });  
        doc.text('LABORATORY', margin + 2 * colWidth + colWidth/2, currentY, { align: 'center' });
        doc.text('RADIOLOGY', margin + 3 * colWidth + colWidth/2, currentY, { align: 'center' });
        doc.text('INSURANCE', margin + 4 * colWidth + colWidth/2, currentY, { align: 'center' });
        
        currentY += 20;
        
        // Calculate revenue breakdown
        Object.entries(reportData.departmentBreakdown).forEach(([deptId, amount]) => {
          const numAmount = parseFloat(amount);
          
          // Professional department mapping
          if (deptId === '4242abf4-e68e-48c8-9eaf-ada2612bd4c2') { // Consultation
            clinicRevenue += numAmount;
          } else if (deptId === 'ae648a70-c159-43b7-b814-7dadb213ae8d') { // Laboratory  
            laboratoryRevenue += numAmount;
          } else if (deptId === '6a06d917-a94a-4637-b1f6-a3fd6855ddd6') { // X-Ray
            radiologyRevenue += numAmount;
          } else if (deptId === '09435c53-9061-429b-aecf-677b12bbdbd7') { // Ultrasound
            radiologyRevenue += numAmount;
          } else if (deptId === '8fb395f9-ae59-4ddc-9ad3-e56b7fda161c') { // Pharmacy
            clinicRevenue += numAmount;
          } else {
            clinicRevenue += numAmount;
          }
        });
      }
      
      // Insurance revenue (USD converted) - calculate outside conditional
      insuranceRevenue = parseFloat(reportData.totalIncomeUSD || "0") * 600; // Convert to SSP for comparison
      
      // Continue with department performance display if data exists
      if (reportData.departmentBreakdown && Object.keys(reportData.departmentBreakdown).length > 0) {
        
        // Executive performance display
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 20, 'F');
        
        // Add subtle border
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 20);
        
        doc.setTextColor(33, 37, 41);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        
        // Performance values with professional formatting
        const values = [clinicRevenue, physiciansRevenue, laboratoryRevenue, radiologyRevenue, insuranceRevenue];
        values.forEach((value, index) => {
          const x = margin + index * colWidth + colWidth/2;
          const displayValue = Math.round(value).toLocaleString();
          
          // Color code based on performance
          if (value > 0) {
            doc.setTextColor(27, 94, 32); // Success green
          } else {
            doc.setTextColor(108, 117, 125); // Muted gray
          }
          
          doc.text(value > 0 ? displayValue : '—', x, currentY + 2, { align: 'center' });
        });
        
        currentY += 30;
        
        // Executive Total Revenue Summary
        const totalDepartmentRevenue = clinicRevenue + physiciansRevenue + laboratoryRevenue + radiologyRevenue + insuranceRevenue;
        
        doc.setFillColor(20, 83, 75); // Professional teal
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 22, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('TOTAL DEPARTMENTAL REVENUE', margin + 10, currentY + 2);
        doc.text(`SSP ${Math.round(totalDepartmentRevenue).toLocaleString()}`, pageWidth - margin - 10, currentY + 2, { align: 'right' });
        
        currentY += 35;
      }
      
      // Executive Insights Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 83, 75);
      doc.text('EXECUTIVE INSIGHTS', margin, currentY);
      
      // Professional underline
      doc.setDrawColor(20, 83, 75);
      doc.setLineWidth(1);
      doc.line(margin, currentY + 3, margin + 85, currentY + 3);
      
      currentY += 20;
      
      // Key insights with professional styling
      const insights = [];
      
      // Performance analysis
      if (profitMargin >= 20) {
        insights.push('• Strong profitability with healthy profit margins');
      } else if (profitMargin >= 10) {
        insights.push('• Moderate profitability - opportunities for optimization');
      } else if (profitMargin >= 0) {
        insights.push('• Break-even operations - review cost structure');
      } else {
        insights.push('• Operating at a loss - immediate attention required');
      }
      
      // Department performance
      const topDepartment = Math.max(clinicRevenue, laboratoryRevenue, radiologyRevenue);
      if (topDepartment === laboratoryRevenue && laboratoryRevenue > 0) {
        insights.push('• Laboratory services driving primary revenue growth');
      } else if (topDepartment === radiologyRevenue && radiologyRevenue > 0) {
        insights.push('• Radiology department showing strong performance');
      } else if (topDepartment === clinicRevenue && clinicRevenue > 0) {
        insights.push('• General clinic services remain core revenue driver');
      }
      
      // Insurance revenue analysis
      if (parseFloat(reportData.totalIncomeUSD || "0") > 0) {
        const usdPercentage = ((parseFloat(reportData.totalIncomeUSD || "0") * 600) / totalRevenue * 100);
        insights.push(`• Insurance revenue represents ${usdPercentage.toFixed(1)}% of total income`);
      }
      
      // Expense ratio
      const expenseRatio = (totalExpenses / totalRevenue) * 100;
      if (expenseRatio <= 60) {
        insights.push('• Efficient cost management with low expense ratio');
      } else if (expenseRatio <= 80) {
        insights.push('• Moderate expense levels - monitor cost efficiency');
      } else {
        insights.push('• High expense ratio - cost reduction opportunities available');
      }
      
      // Render insights with executive styling
      doc.setTextColor(33, 37, 41);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      insights.forEach((insight, index) => {
        doc.text(insight, margin + 5, currentY);
        currentY += 12;
      });
      
      currentY += 20;
      
      // Executive Footer
      const minFooterY = currentY + 15;
      const footerY = Math.max(pageHeight - 40, minFooterY);
      
      // Professional footer line
      doc.setDrawColor(20, 83, 75);
      doc.setLineWidth(0.8);
      doc.line(margin, footerY - 15, pageWidth - margin, footerY - 15);
      
      // Executive footer content
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 83, 75);
      doc.text('BAHR EL GHAZAL CLINIC', margin, footerY - 3);
      doc.text('CONFIDENTIAL EXECUTIVE REPORT', pageWidth - margin, footerY - 3, { align: 'right' });
      
      // Confidentiality notice
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125);
      doc.text('This document contains confidential financial information. Distribution limited to authorized executive personnel only.', 
               pageWidth / 2, footerY + 8, { align: 'center' });
      
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
        uploadedBy: req.user!.id
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

  // Patient Volume routes
  app.post("/api/patient-volume", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPatientVolumeSchema.parse({
        ...req.body,
        recordedBy: req.user?.id
      });

      const volume = await storage.createPatientVolume(validatedData);
      res.status(201).json(volume);
    } catch (error) {
      console.error("Error creating patient volume:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create patient volume record" });
      }
    }
  });

  app.get("/api/patient-volume/date/:date", requireAuth, async (req, res) => {
    try {
      const dateParam = req.params.date;
      console.log("Date parameter received:", dateParam);
      
      const date = new Date(dateParam);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const departmentId = req.query.departmentId as string;
      console.log("Searching for patient volume on date:", date, "department:", departmentId);
      
      const volumes = await storage.getPatientVolumeByDate(date, departmentId);
      console.log("Found volumes:", volumes);
      res.json(volumes);
    } catch (error) {
      console.error("Error getting patient volume by date:", error);
      res.status(500).json({ error: "Failed to get patient volume data" });
    }
  });

  app.get("/api/patient-volume/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const volumes = await storage.getPatientVolumeForMonth(year, month);
      res.json(volumes);
    } catch (error) {
      console.error("Error getting patient volume for month:", error);
      res.status(500).json({ error: "Failed to get patient volume data" });
    }
  });

  // Patient volume by period (matches the time range filters)
  app.get("/api/patient-volume/period/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const range = req.query.range as string || 'current-month';
      
      let volumes = [];
      
      switch(range) {
        case 'current-month': {
          volumes = await storage.getPatientVolumeForMonth(year, month);
          break;
        }
        case 'last-month': {
          volumes = await storage.getPatientVolumeForMonth(year, month);
          break;
        }
        case 'last-3-months': {
          // Get volumes for current month and 2 previous months
          const months = [];
          for (let i = 0; i < 3; i++) {
            const date = new Date(year, month - 1 - i);
            const monthVolumes = await storage.getPatientVolumeForMonth(date.getFullYear(), date.getMonth() + 1);
            months.push(...monthVolumes);
          }
          volumes = months;
          break;
        }
        case 'year': {
          // Get all months in the year
          const allMonths = [];
          for (let m = 1; m <= 12; m++) {
            const monthVolumes = await storage.getPatientVolumeForMonth(year, m);
            allMonths.push(...monthVolumes);
          }
          volumes = allMonths;
          break;
        }
        case 'custom': {
          const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(year, month - 1, 1);
          const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(year, month, 0);
          volumes = await storage.getPatientVolumeByDateRange(startDate, endDate);
          break;
        }
        default: {
          volumes = await storage.getPatientVolumeForMonth(year, month);
        }
      }
      
      res.json(volumes);
    } catch (error) {
      console.error("Error getting patient volume for period:", error);
      res.status(500).json({ error: "Failed to get patient volume data" });
    }
  });

  app.put("/api/patient-volume/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updatePatientVolume(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Patient volume record not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating patient volume:", error);
      res.status(500).json({ error: "Failed to update patient volume record" });
    }
  });

  app.delete("/api/patient-volume/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePatientVolume(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting patient volume:", error);
      res.status(500).json({ error: "Failed to delete patient volume record" });
    }
  });

  // Routes registered successfully
}
