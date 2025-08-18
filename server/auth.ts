import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: string;
  }
}

// Simple session-based auth middleware
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role: string;
    location: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - User ID:', userId);
  console.log('Auth check - Session data:', req.session);
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      location: user.location
    };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};