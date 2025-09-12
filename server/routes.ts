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
  
  // Health check endpoint for Render deployment
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ 
      status: "ok", 
      service: "Bahr El Ghazal Clinic API", 
      timestamp: new Date().toISOString() 
    });
  });
  
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
      const isProd = process.env.NODE_ENV === 'production';
      const cookieOpts = {
        httpOnly: true,
        secure: isProd,       // Render is HTTPS
        sameSite: "none" as const,     // REQUIRED for Netlify -> Render
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      };
      
      res.cookie('user_session', JSON.stringify(userSession), cookieOpts);

      res.json(userSession);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Clear session/cookies with same settings as when set
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProd,
      sameSite: "none" as const,
      path: "/",
    };
    
    res.clearCookie('user_session', cookieOpts);
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
      const updatedUser = await storage.updateUser(req.user!.id, { 
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
      const updatedUser = await storage.updateUser(req.user!.id, {
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
      if (req.user!.role !== 'admin') {
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
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      const { username, email, fullName, role, password, permissions } = req.body;
      const location = "clinic"; // Default location for all users
      
      if (!username || !email || !fullName || !role) {
        return res.status(400).json({ error: "Missing required fields: username, email, fullName, and role are required" });
      }

      const userData = {
        username,
        email,
        fullName: fullName || "", // Ensure fullName is never null - database requires NOT NULL
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



  // Update user route - MISSING PATCH ROUTE
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Only admins can update users  
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;
      const updates = req.body;

      // Ensure we don't update sensitive fields directly
      delete updates.id;
      delete updates.password; // Use separate password reset endpoint

      const updatedUser = await storage.updateUser(id, updates);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      // Handle database constraint violations
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_username_key') {
          return res.status(400).json({ error: `Username "${req.body.username}" already exists. Please choose a different username.` });
        } else if (error.constraint === 'users_email_key') {
          return res.status(400).json({ error: `Email "${req.body.email}" is already registered. Please use a different email address.` });
        }
      }
      
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Only admins can delete users
      if (req.user!.role !== 'admin') {
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
      // Set all transactions as synced by default
      const syncStatus = "synced";
      
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
  // GET /api/dashboard?year=2025&month=8&range=current-month
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const year  = Number(req.query.year)  || new Date().getUTCFullYear();
      const month = Number(req.query.month) || (new Date().getUTCMonth() + 1);
      const range = (req.query.range as string) || "current-month";
      // When range === "custom", these will be passed to storage.getDashboardData
      const startDate = req.query.startDate as string | undefined;
      const endDate   = req.query.endDate as string | undefined;

      const data = await storage.getDashboardData({ year, month, range, startDate, endDate });
      // absolutely no caching for dashboard responses
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json(data);
    } catch (err) {
      console.error("[dashboard-error]", err);
      res.status(500).json({ error: "Failed to load dashboard" });
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
      } else if (range === 'year') {
        // Get full year data from January to December
        const startDate = new Date(year, 0, 1); // January 1st
        const endDate = new Date(year, 11, 31); // December 31st
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
      const dashboardData = await storage.getDashboardData({ year, month, range: 'current-month' });
      
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
      const dashboardData = await storage.getDashboardData({ year, month, range: 'current-month' });
      
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
      const margin = 20;
      
      // Add header background and logo area
      doc.setFillColor(20, 83, 75); // Teal header background
      doc.rect(0, 0, pageWidth, 60, 'F');
      
      // Clinic name and title in white
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Bahr El Ghazal Clinic — Monthly Financial Report', margin, 25);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('Financial Management System', margin, 40);
      
      // Reset text color for body
      doc.setTextColor(0, 0, 0);
      
      // Report period and generation info
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${monthName} ${year}`, margin, 80);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
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
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 83, 75);
      doc.text('Financial Summary', margin, currentY);
      
      // Add underline that matches text width
      doc.setDrawColor(20, 83, 75);
      doc.setLineWidth(0.5);
      const summaryTextWidth = doc.getTextWidth('Financial Summary');
      doc.line(margin, currentY + 2, margin + summaryTextWidth, currentY + 2);
      
      currentY += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      
      // Summary table with currency separation
      const summaryData = [];
      
      // Add SSP totals if they exist
      if (parseFloat(reportData.totalIncomeSSP || "0") > 0) {
        summaryData.push(['Total Income', `SSP ${parseFloat(reportData.totalIncomeSSP || "0").toLocaleString()}`]);
      }
      
      // Add USD totals if they exist  
      if (parseFloat(reportData.totalIncomeUSD || "0") > 0) {
        summaryData.push(['Total Income (Insurance)', `USD ${parseFloat(reportData.totalIncomeUSD || "0").toLocaleString()}`]);
      }
      
      // Add expenses and net income (currently SSP only)
      if (parseFloat(reportData.totalExpenses || "0") > 0) {
        summaryData.push(['Total Expenses', `SSP ${parseFloat(reportData.totalExpenses || "0").toLocaleString()}`]);
      }
      
      summaryData.push(['Net Income', `SSP ${parseFloat(reportData.netIncome || "0").toLocaleString()}`]);
      
      summaryData.forEach(([label, value], index) => {
        const isNetIncome = label === 'Net Income';
        const bgColor = isNetIncome ? (parseFloat(reportData.netIncome) >= 0 ? [220, 252, 231] : [254, 226, 226]) : [249, 250, 251];
        
        // Row background
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 12, 'F');
        
        // Text with tabular numerals
        doc.setFont('helvetica', isNetIncome ? 'bold' : 'normal');
        doc.setFontSize(isNetIncome ? 13 : 12);
        doc.text(label, margin + 5, currentY);
        // Right-align with tabular numerals
        doc.text(value, pageWidth - margin - 5, currentY, { align: 'right' });
        
        currentY += 15;
      });
      
      // Monthly Expenditure Section (Simple format)
      if (reportData.expenseBreakdown && Object.keys(reportData.expenseBreakdown).length > 0) {
        currentY += 20;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 83, 75);
        doc.text('Monthly Expenditure', margin, currentY);
        
        // Add underline that matches text width
        const expenditureTextWidth = doc.getTextWidth('Monthly Expenditure');
        doc.line(margin, currentY + 2, margin + expenditureTextWidth, currentY + 2);
        
        currentY += 20;
        doc.setTextColor(0, 0, 0);
        
        // Expense table header with 3 columns: Date (empty), Description, Amount
        doc.setFillColor(20, 83, 75);
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Date', margin + 5, currentY);
        doc.text('Description', margin + 40, currentY);
        doc.text('Amount', pageWidth - margin - 5, currentY, { align: 'right' });
        
        currentY += 15;
        doc.setTextColor(0, 0, 0);
        
        // Expense data - filter out zero amounts and sort by amount descending
        const expenseEntries = Object.entries(reportData.expenseBreakdown)
          .filter(([category, amount]) => parseFloat(amount) > 0)
          .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
        
        let totalExpenses = 0;
        expenseEntries.forEach(([category, amount], index) => {
          const numAmount = parseFloat(amount);
          totalExpenses += numAmount;
          
          // Alternating row colors (white background for clean look)
          const bgColor = index % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 12, 'F');
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          
          // Leave Date column empty (as shown in your image)
          doc.text('', margin + 5, currentY);
          // Category name in Description column
          doc.text(category, margin + 40, currentY);
          // Amount right-aligned with proper formatting
          doc.text(`${Math.round(numAmount).toLocaleString()}`, pageWidth - margin - 5, currentY, { align: 'right' });
          
          currentY += 12;
        });
        
        // Add TOTAL SUM row (like in your South Sudan report)
        doc.setFillColor(255, 192, 203); // Light pink background for total
        doc.rect(margin, currentY - 8, pageWidth - 2 * margin, 14, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(220, 20, 60); // Dark red for TOTAL SUM
        doc.text('TOTAL SUM', margin + 40, currentY);
        doc.text(`${Math.round(totalExpenses).toLocaleString()}`, pageWidth - margin - 5, currentY, { align: 'right' });
        
        currentY += 25;
      }
      
      // Remove complex department analysis - keep it simple
      
      // Add some spacing before footer
      currentY += 20;
      
      // Footer section - ensure it doesn't overlap with content
      const minFooterY = currentY + 20;
      const footerY = Math.max(doc.internal.pageSize.height - 30, minFooterY);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Bahr El Ghazal Clinic Financial Management System', margin, footerY);
      doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });
      
      // Add tiny footer note
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('This report contains confidential financial information for internal use only.', margin, footerY + 8);
      
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
