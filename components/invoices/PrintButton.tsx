'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button className="btn btn-outline flex items-center gap-2" onClick={() => window.print()}>
      <Printer size={16} /> Print / Save PDF
    </button>
  );
}
