import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { AccountType, MembershipRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE } from '@/lib/auth/constants';
import { createSessionToken } from '@/lib/auth/session';
import { consumeSignupEmailVerification } from '@/lib/auth/otpStore';

const ALLOWED_LOGO_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function parseAccountType(raw: unknown): AccountType | null {
  if (raw === 'SOLO' || raw === 'TEAM') return raw as AccountType;
  return null;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: 'Invalid form data' }, { status: 400 });
  }

  const accountType = parseAccountType(form.get('accountType'));
  const firstName = String(form.get('firstName') ?? '').trim();
  const lastName = String(form.get('lastName') ?? '').trim();
  const phoneRaw = String(form.get('phone') ?? '').trim();
  const phone = phoneRaw.length > 0 ? phoneRaw : null;
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');
  const businessName = String(form.get('businessName') ?? '').trim();
  const businessLocation = String(form.get('businessLocation') ?? '').trim();
  const logo = form.get('logo');

  if (!accountType || !firstName || !lastName || !email || !password) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }
  if (!businessName || !businessLocation) {
    return NextResponse.json({ message: 'Missing business details' }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ message: 'Passwords do not match' }, { status: 400 });
  }
  if (!consumeSignupEmailVerification(email)) {
    return NextResponse.json({ message: 'Please verify your email first' }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ message: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const name = `${firstName} ${lastName}`.trim();

  const { userId, workspaceId } = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        password: passwordHash,
        firstName,
        lastName,
        phone,
        name,
        accountType,
      },
    });
    const newWorkspace = await tx.workspace.create({
      data: {
        name: businessName,
        location: businessLocation,
      },
    });
    await tx.workspaceMember.create({
      data: {
        userId: newUser.id,
        workspaceId: newWorkspace.id,
        role: MembershipRole.OWNER,
      },
    });
    return { userId: newUser.id, workspaceId: newWorkspace.id };
  });

  const logoFile = logo && typeof logo === 'object' && 'arrayBuffer' in logo ? (logo as File) : null;
  if (logoFile && logoFile.size > 0 && logoFile.size <= MAX_LOGO_BYTES) {
    const origName = typeof logoFile.name === 'string' ? logoFile.name : 'logo';
    const extMatch = origName.match(/(\.[a-zA-Z0-9]{1,8})$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    if (ALLOWED_LOGO_EXT.has(ext)) {
      const fileName = `${randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'public', 'uploads', 'logos');
      await mkdir(dir, { recursive: true });
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await writeFile(path.join(dir, fileName), buffer);
      const logoUrl = `/uploads/logos/${fileName}`;
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { logoUrl },
      });
    }
  }

  const token = await createSessionToken(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
