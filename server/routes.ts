import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertReceiptSchema, insertUserSchema } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "./auth";
import bcrypt from "bcryptjs";
import session from "express-session";
import cors from "cors";
import { Pool } from '@neondatabase/serverless';
import type { Response, NextFunction } from 'express';
import ConnectPgSimple from 'connect-pg-simple';

// Database pool for session management queries
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Trust proxy for proper cookie handling
  app.set('trust proxy', 1);
  
  // Configure CORS for cross-origin requests
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
  }));
  
  // Configure session store
  const PgSession = ConnectPgSimple(session);
  const sessionStore = new PgSession({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: false,
  });

  // Configure session middleware
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "clinic-finance-secret-key",
    resave: false,
    saveUninitialized: false,
    name: 'bgc.sid',
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'none', // Required for cross-origin
      secure: false, // Set to true in production with HTTPS
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      path: '/',
    }
  }));

  // Session metadata tracking middleware
  app.use((req, res, next) => {
    if (req.session?.userId) {
      const m = (req.session as any).meta || {};
      (req.session as any).meta = {
        ua: req.get('user-agent') || m.ua || '',
        ip: req.ip || m.ip || '',
        createdAt: m.createdAt || Date.now(),
        lastSeen: Date.now(),
      };
      // Keep cookie rolling according to per-user timeout
      req.session.save(() => next());
    } else {
      next();
    }
  });

  // Authentication routes
  app.post('/api/auth/login', async (req: AuthRequest, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Regenerate session for security and proper cookie setting
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regenerate error:', err);
          return res.status(500).json({ message: 'Session error' });
        }
        
        req.session.userId = user.id;
        req.session.role = user.role;
        
        // Add session metadata for device tracking
        req.session.meta = {
          ua: req.get('user-agent') || '',
          ip: req.ip,
          createdAt: Date.now(),
          lastSeen: Date.now(),
        };
        
        req.session.save((err2) => {
          if (err2) {
            console.error('Session save error:', err2);
            return res.status(500).json({ message: 'Session save error' });
          }
          
          console.log('Login - Session regenerated and saved');
          console.log('Login - Setting session userId:', user.id);
          console.log('Login - Session ID:', req.sessionID);
          
          res.json({ 
            message: 'Login successful',
            user: {
              id: user.id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
              location: user.location,
            },
          });
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req: AuthRequest, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('bgc.sid'); // Clear the correct cookie name
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/auth/user', requireAuth, async (req: AuthRequest, res) => {
    res.json({
      id: req.user!.id,
      username: req.user!.username,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      email: req.user!.email,
      role: req.user!.role,
      location: req.user!.location
    });
  });

  // User profile management routes
  app.put('/api/user/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      const userId = req.user!.id;

      const updates = {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null
      };

      const updatedUser = await storage.updateUser(userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          role: updatedUser.role,
          location: updatedUser.location
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  app.put('/api/user/password', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password update error:', error);
      res.status(500).json({ message: 'Failed to update password' });
    }
  });

  // Session management routes
  // List sessions for current user
  app.get('/api/sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.session.userId;
      console.log('Getting sessions for user:', userId);
      console.log('Current session ID:', req.sessionID);
      
      const { rows } = await pool.query(`
        SELECT sid,
               sess,
               expire
        FROM "sessions"
        WHERE (sess::jsonb ->> 'userId') = $1
          AND expire > NOW()
        ORDER BY expire DESC
      `, [String(userId)]);

      console.log('Found sessions:', rows.length);

      const sessions = rows.map((r: any) => {
        const sessData = r.sess;
        const meta = sessData?.meta || {};
        return {
          sid: r.sid,
          expiresAt: new Date(r.expire).getTime(),
          ua: meta.ua || 'Unknown Browser',
          ip: meta.ip || 'Unknown',
          createdAt: meta.createdAt || Date.now(),
          lastSeen: meta.lastSeen || Date.now(),
          current: r.sid === req.sessionID,
        };
      });
      
      console.log('Processed sessions:', sessions.length);
      res.json({ sessions });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      res.status(500).json({ message: 'Failed to fetch sessions' });
    }
  });

  // Revoke a specific session
  app.post('/api/sessions/revoke', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.session.userId;
      const { sid } = req.body as { sid: string };
      
      if (!sid) {
        return res.status(400).json({ error: 'sid required' });
      }

      await pool.query(`
        DELETE FROM "sessions"
        WHERE sid = $1 AND (sess::jsonb ->> 'userId') = $2
      `, [sid, String(userId)]);
      
      res.json({ ok: true });
    } catch (error) {
      console.error('Failed to revoke session:', error);
      res.status(500).json({ message: 'Failed to revoke session' });
    }
  });

  // Revoke all sessions except current
  app.post('/api/sessions/revoke-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.session.userId;
      const currentSid = req.sessionID;

      console.log('Revoking sessions for user:', userId);
      console.log('Current session ID:', currentSid);
      
      // First check what sessions exist for this user
      const existingSessions = await pool.query(`
        SELECT sid, sess::jsonb ->> 'userId' as user_id 
        FROM "sessions" 
        WHERE (sess::jsonb ->> 'userId') = $1
      `, [String(userId)]);
      
      console.log('Found sessions for user:', existingSessions.rows);

      const result = await pool.query(`
        DELETE FROM "sessions"
        WHERE (sess::jsonb ->> 'userId') = $1
          AND sid <> $2
      `, [String(userId), currentSid]);
      
      console.log('Deleted sessions count:', result.rowCount);
      
      res.json({ ok: true, deletedCount: result.rowCount });
    } catch (error) {
      console.error('Failed to revoke all sessions:', error);
      res.status(500).json({ message: 'Failed to revoke sessions' });
    }
  });

  // Get current session timeout
  app.get('/api/sessions/timeout', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.session.userId;
      const { rows } = await pool.query(
        'SELECT session_timeout_minutes FROM users WHERE id = $1',
        [userId]
      );
      
      res.json({ minutes: rows[0]?.session_timeout_minutes ?? 480 }); // default 8h
    } catch (error) {
      console.error('Failed to get session timeout:', error);
      res.status(500).json({ message: 'Failed to get session timeout' });
    }
  });

  // Update session timeout
  app.put('/api/sessions/timeout', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.session.userId;
      const { minutes } = req.body as { minutes: number | null };

      await pool.query(
        'UPDATE users SET session_timeout_minutes = $1 WHERE id = $2',
        [minutes, userId]
      );

      // Apply immediately to current cookie
      const ms = (minutes ?? 480) * 60 * 1000;
      req.session.cookie.maxAge = ms;
      
      await new Promise<void>((resolve) => req.session.save(() => resolve()));

      res.json({ ok: true, minutes: minutes ?? 480 });
    } catch (error) {
      console.error('Failed to update session timeout:', error);
      res.status(500).json({ message: 'Failed to update session timeout' });
    }
  });

  // User management routes (admin only)
  const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  };

  app.get('/api/users', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        location: user.location,
        createdAt: user.createdAt
      })));
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Failed to get users' });
    }
  });

  app.post('/api/users', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { username, password, firstName, lastName, email, role, location } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        role: role || 'staff',
        location: location || 'south_sudan'
      });

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: newUser.id,
          username: newUser.username,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          location: newUser.location
        }
      });
    } catch (error) {
      console.error('Create user error:', error);
      if ((error as any).code === '23505') { // Unique constraint violation
        res.status(409).json({ message: 'Username or email already exists' });
      } else {
        res.status(500).json({ message: 'Failed to create user' });
      }
    }
  });

  app.delete('/api/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      if (id === req.user!.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Departments
  app.get("/api/departments", requireAuth, async (req: AuthRequest, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  // Insurance Providers
  app.get("/api/insurance-providers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const providers = await storage.getInsuranceProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching insurance providers:", error);
      res.status(500).json({ error: "Failed to fetch insurance providers" });
    }
  });

  // Transactions
  app.get("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
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

  app.post("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Convert date string to Date object if it's a string
      // Handle insurance provider - convert "no-insurance" to null
      // Set sync status based on user location - USA users get "synced", South Sudan users get "pending"
      const userLocation = req.user!.location;
      const syncStatus = userLocation === "usa" ? "synced" : "pending";
      
      const bodyWithDate = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        createdBy: req.user!.id,
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
  app.delete("/api/transactions/:id", requireAuth, async (req: AuthRequest, res) => {
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
  app.get("/api/dashboard/:year/:month", requireAuth, async (req: AuthRequest, res) => {
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
  app.get("/api/income-trends", requireAuth, async (req: AuthRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const data = await storage.getIncomeTrends(days);
      res.json(data);
    } catch (error) {
      console.error("Error fetching income trends:", error);
      res.status(500).json({ error: "Failed to fetch income trends" });
    }
  });

  app.get("/api/income-trends/:year/:month", requireAuth, async (req: AuthRequest, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const data = await storage.getIncomeTrendsForMonth(year, month);
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
      
      // Footer section - simple page number only
      const footerY = doc.internal.pageSize.height - 20;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Page 1 of 1`, pageWidth / 2, footerY, { align: 'center' });
      
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
