import { SignJWT, jwtVerify } from 'jose';

const getSecret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET || 'dev-local-auth-secret-min-32-characters-long!',
  );

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = payload.sub;
    if (typeof sub !== 'string') return null;
    return { sub };
  } catch {
    return null;
  }
}
