import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getCurrentContext, type CurrentContext } from '@/lib/auth/getCurrentUser';

export type TenantScope = {
  userId: string;
  workspaceId: string | null;
};

export async function requireCurrentContext(): Promise<CurrentContext> {
  const context = await getCurrentContext();
  if (!context) {
    redirect('/login');
  }
  return context;
}

export function scopeFromContext(context: CurrentContext): TenantScope {
  return {
    userId: context.user.id,
    workspaceId: context.workspace?.id ?? null,
  };
}

export function invoiceTenantWhere(scope: TenantScope): Prisma.InvoiceWhereInput {
  return scope.workspaceId
    ? { OR: [{ workspaceId: scope.workspaceId }, { userId: scope.userId }] }
    : { userId: scope.userId };
}

export function clientTenantWhere(scope: TenantScope): Prisma.ClientWhereInput {
  return scope.workspaceId ? { workspaceId: scope.workspaceId } : { invoices: { some: { userId: scope.userId } } };
}

export function serviceTenantWhere(scope: TenantScope): Prisma.ServiceWhereInput {
  return scope.workspaceId ? { workspaceId: scope.workspaceId } : { items: { some: { invoice: { userId: scope.userId } } } };
}

export function paymentTenantWhere(scope: TenantScope): Prisma.PaymentWhereInput {
  return { invoice: invoiceTenantWhere(scope) };
}

export function receiptTenantWhere(scope: TenantScope): Prisma.ReceiptWhereInput {
  return { invoice: invoiceTenantWhere(scope) };
}
