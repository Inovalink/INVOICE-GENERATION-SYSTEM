/**
 * Hook for updating an external search index when invoices change.
 * No-op in this codebase snapshot (Topbar uses `/api/search/suggest` when implemented).
 */
export async function indexInvoiceById(_invoiceId: string): Promise<void> {}
