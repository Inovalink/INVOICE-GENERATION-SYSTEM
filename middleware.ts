import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_COOKIE = 'ft_session';

const PUBLIC_PATHS = ['/login', '/signup'];
const PUBLIC_PATH_PREFIXES = ['/api/auth/', '/_next/', '/favicon.ico'];

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || 'dev-local-auth-secret-min-32-characters-long!',
  );
}

async function isValidSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === 'string';
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and public API routes through
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const authenticated = token ? await isValidSession(token) : false;

  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  // Redirect unauthenticated users to login
  if (!authenticated && !isPublicPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup to dashboard
  if (authenticated && isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder files (images, icons, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot)$).*)',
  ],
};
