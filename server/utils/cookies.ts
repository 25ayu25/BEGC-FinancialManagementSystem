import { Request } from 'express';

export function getCookieOptions(req: Request) {
  const forwardedHost = (req.headers['x-forwarded-host'] as string) || '';
  const envDomain = process.env.SESSION_COOKIE_DOMAIN || '';
  const domain = envDomain || (forwardedHost && !forwardedHost.includes('localhost') ? forwardedHost.split(':')[0] : undefined);

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain, // undefined -> host-only cookie
    path: '/',
  };
}
