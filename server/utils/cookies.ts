/**
 * Cookie utility functions for secure session management behind proxies.
 * 
 * Context:
 * - Production runs behind Netlify (frontend) → Render (backend) proxy
 * - Express needs trust proxy enabled to read x-forwarded-* headers
 * - Cookies must be configured to work cross-origin with proper security settings
 * 
 * Why this module exists:
 * - Centralize cookie options for consistency across auth routes
 * - Handle proxy-aware cookie domain configuration
 * - Support optional explicit domain override via SESSION_COOKIE_DOMAIN env var
 * - Ensure httpOnly, secure, and sameSite are properly set for security
 */

import type { Request, CookieOptions } from "express";

/**
 * Get secure cookie options for session cookies.
 * 
 * In production behind a proxy:
 * - Sets secure: true (requires HTTPS)
 * - Sets httpOnly: true (prevents XSS access)
 * - Sets sameSite: 'lax' (allows navigation from external sites)
 * - Sets path: '/' (cookie valid for entire domain)
 * - Optionally sets domain if SESSION_COOKIE_DOMAIN env var is provided
 * 
 * In development:
 * - Sets secure: false (allows HTTP)
 * - Other settings same as production
 * 
 * @param req - Express request object (used to detect environment)
 * @returns CookieOptions object ready for res.cookie()
 */
export function getCookieOptions(req: Request): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax", // Changed from "none" to "lax" for better compatibility
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  };

  // Optional: Allow explicit cookie domain override
  // Use SESSION_COOKIE_DOMAIN=finance.bahrelghazalclinic.com if needed
  // By default, we don't set domain (host-only cookie) which works fine
  // when all requests go through the same hostname after proxy
  const explicitDomain = process.env.SESSION_COOKIE_DOMAIN;
  if (explicitDomain) {
    options.domain = explicitDomain;
  }

  return options;
}
