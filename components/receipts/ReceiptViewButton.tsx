'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

type Props = {
  receiptId: string;
  className?: string;
  /** Smaller icon + compact pill (e.g. tables) */
  compact?: boolean;
};

export default function ReceiptViewButton({
  receiptId,
  className = 'receipt-pill-link',
  compact = false,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpenId(receiptId)}
        aria-label="View receipt"
        title="View receipt"
      >
        <FileText size={compact ? 15 : 17} strokeWidth={2} aria-hidden />
        <span>View Receipt</span>
      </button>
      <ReceiptModal receiptId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
