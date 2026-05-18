import { cookies } from 'next/headers';
import type { User, Workspace } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE } from '@/lib/auth/constants';
import { verifySessionToken } from '@/lib/auth/session';

export async function getSessionClaims(): Promise<{ sub: string } | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export type CurrentContext = {
  user: User;
  workspace: Workspace | null;
};

/** Authenticated user id, or null when the request is not signed in. */
export async function getDefaultUserId(): Promise<string | null> {
  const session = await getSessionClaims();
  if (session?.sub) return session.sub;
  return null;
}

export async function getCurrentContext(): Promise<CurrentContext | null> {
  const session = await getSessionClaims();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      memberships: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        include: { workspace: true },
      },
    },
  });

  if (!user) return null;

  const workspace = user.memberships[0]?.workspace ?? null;
  return { user, workspace };
}
