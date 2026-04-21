'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Plus, Trash2, Calendar, User, AlignLeft, ReceiptText, FileText, Building2, Phone, Mail, MapPin, ChevronDown, ChevronUp, Check, Send } from 'lucide-react';
import './InvoiceForm.css';
import DatePicker from '@/components/ui/DatePicker';

type ClientParams = { id: string; name: string; company: string | null; email: string | null; phone: string | null; address: string | null };
type ServiceParams = { id: string; name: string; price: number; category: string };

type InvoiceItemState = {
  id: string; // temp id for UI
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export default function InvoiceForm({ 
  clients, 
  services 
}: { 
  clients: ClientParams[]; 
  services: ServiceParams[]; 
}) {
  const router = useRouter();
  
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<InvoiceItemState[]>([
    { id: '1', serviceId: '', description: '', quantity: 1, unitPrice: 0 }
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState('Late payments will incur a 10% annual fee, calculated daily.');
  const [paymentTerms, setPaymentTerms] = useState('EFT Bank Transfer');

  const [project, setProject] = useState('Design Services');
  const [invoiceNumber, setInvoiceNumber] = useState('# INV-345442-000');
  const [dueDateStr, setDueDateStr] = useState('');
  
  // Accordion state
  const [expandedSection, setExpandedSection] = useState<'info'|'items'|'payment'>('info');
  // Type Tab
  const [invoiceType, setInvoiceType] = useState<'Standard'|'Split'|'Recurring'>('Standard');

  const selectedClient = clients.find(c => c.id === clientId);

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), serviceId: '', description: '', quantity: 1, unitPrice: 0 }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItemState, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'serviceId' && value) {
          const service = services.find(s => s.id === value);
          if (service) {
            updatedItem.unitPrice = service.price;
            updatedItem.description = service.name;
          }
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { alert('Please select a client'); return; }
    const validItems = items.filter(i => i.description && i.quantity > 0 && i.unitPrice >= 0);
    if (validItems.length === 0) { alert('Please add at least one valid line item'); return; }

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          items: validItems,
          subtotal,
          tax: taxAmount,
          discount,
          total,
          notes,
          paymentTerms
        })
      });

      if (response.ok) {
        const invoice = (await response.json()) as {
          id: string;
          invoiceNumber: string;
          total: number;
        };
        const clientName = clients.find((c) => c.id === clientId)?.name ?? 'Customer';
        const next = new URLSearchParams({
          ft_toast: 'invoice_created',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName,
          invoiceTotal: String(Number(invoice.total) || 0),
        });
        router.push(`/invoices?${next.toString()}`);
        router.refresh();
      } else {
        const error = await response.json();
        alert('Failed to save invoice: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the invoice');
    }
  };

  const toggleSection = (section: 'info'|'items'|'payment') => {
      setExpandedSection(expandedSection === section ? section : section); // Forcing open for now, can make toggleable
  };

  const handleDownloadPdf = () => {
    if (typeof window === 'undefined') return;
    window.print();
  };

  return (
    <div className="invoice-builder-layout">
      
      {/* LEFT COLUMN: Controls */}
      <div className="invoice-builder-controls">
        {/* Type Tabs */}
        <div className="type-tabs">
          <button
            type="button"
            className={`type-tab ${invoiceType === 'Standard' ? 'active' : ''}`}
            onClick={() => setInvoiceType('Standard')}
          >
            Standard
          </button>
          <button
            type="button"
            className={`type-tab ${invoiceType === 'Split' ? 'active' : ''}`}
            onClick={() => setInvoiceType('Split')}
          >
            Split
          </button>
          <button
            type="button"
            className={`type-tab ${invoiceType === 'Recurring' ? 'active' : ''}`}
            onClick={() => setInvoiceType('Recurring')}
          >
            Recurring
          </button>
        </div>

        <form onSubmit={handleSubmit} className="builder-form-sections">
            
            {/* 1. Invoice Information */}
            <div className={`accordion-section ${expandedSection === 'info' ? 'expanded' : ''}`}>
                <div className="accordion-header" onClick={() => toggleSection('info')}>
                    <span style={{ fontWeight: 600 }}>Invoice Detail</span>
                    {expandedSection === 'info' ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </div>
                {expandedSection === 'info' && (
                    <div className="accordion-content">
                        
                        <div className="form-group-row">
                            <div className="form-group modern-input-group">
                                <label>Full Name *</label>
                                <div className="input-wrapper">
                                    <User size={16} className="input-icon" />
                                    <input type="text" className="modern-input" value="Angelina Carol" readOnly />
                                </div>
                            </div>
                            <div className="form-group modern-input-group">
                                <label>Billed To *</label>
                                <div className="input-wrapper">
                                    <Building2 size={16} className="input-icon" style={{ color: 'var(--success)' }} />
                                    <select 
                                        className="modern-input" 
                                        value={clientId} 
                                        onChange={(e) => setClientId(e.target.value)}
                                        required
                                        style={{ paddingLeft: '2.5rem' }}
                                    >
                                        <option value="">Select a Client</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.company ? `(${c.company})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-group-row">
                            <div className="form-group modern-input-group">
                                <label>Date Issue *</label>
                                <div className="input-wrapper">
                                    <Calendar size={16} className="input-icon" />
                                    <input type="text" className="modern-input" value={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} readOnly />
                                </div>
                            </div>
                            <div className="form-group modern-input-group">
                                <label>Due Date *</label>
                                <div className="input-wrapper">
                                    <Calendar size={16} className="input-icon" />
                                    <div style={{ width: '100%', paddingLeft: '2.25rem' }}>
                                      <DatePicker value={dueDateStr} onChange={setDueDateStr} placeholder="Upon Receipt" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group modern-input-group mb-0">
                            <label>Invoice Number</label>
                            <div className="input-wrapper">
                                <span className="input-icon" style={{ fontWeight: 'bold' }}>#</span>
                                <input type="text" className="modern-input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Invoice Items/Service */}
            <div className={`accordion-section ${expandedSection === 'items' ? 'expanded' : ''}`}>
                <div className="accordion-header" onClick={() => toggleSection('items')}>
                    <span style={{ fontWeight: 600 }}>Invoice Items/Service</span>
                    {expandedSection === 'items' ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </div>
                {expandedSection === 'items' && (
                    <div className="accordion-content">
                        
                        <div className="form-group modern-input-group mb-6">
                            <label>Currency *</label>
                            <div className="input-wrapper">
                                <span className="input-icon" style={{ fontSize: '1.2rem', left: '0.8rem' }}>🇺🇸</span>
                                <select className="modern-input" style={{ paddingLeft: '2.75rem' }}>
                                    <option>US Dollar ($)</option>
                                </select>
                            </div>
                        </div>

                        {items.map((item, index) => (
                            <div key={item.id} className="item-card">
                                <div className="flex justify-between items-center mb-2">
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Item {index + 1}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => removeItem(item.id)}
                                        className="icon-btn-danger"
                                        disabled={items.length === 1}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="form-group modern-input-group">
                                    <label>Item Name</label>
                                    <div className="input-wrapper">
                                        <select 
                                            className="modern-input" 
                                            value={item.serviceId}
                                            onChange={(e) => updateItem(item.id, 'serviceId', e.target.value)}
                                        >
                                            <option value="">Custom Item...</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {!item.serviceId && (
                                        <input 
                                            type="text" 
                                            className="modern-input mt-2" 
                                            placeholder="Brand Guidelines"
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            required
                                        />
                                    )}
                                </div>

                                <div className="form-group-row mb-0">
                                    <div className="form-group modern-input-group mb-0" style={{ flex: 1 }}>
                                        <label>QTY</label>
                                        <div className="input-wrapper">
                                            <span className="input-icon" style={{ left: '0.75rem' }}>📦</span>
                                            <input 
                                                type="number" className="modern-input" min="1" step="0.01" style={{ paddingLeft: '2.5rem' }}
                                                value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group modern-input-group mb-0" style={{ flex: 1 }}>
                                        <label>Tax</label>
                                        <div className="input-wrapper">
                                            <span className="input-icon" style={{ left: '0.75rem' }}>💰</span>
                                            <input 
                                                type="number" className="modern-input" min="0" step="0.1" style={{ paddingLeft: '2.5rem' }} value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                            />
                                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>%</span>
                                        </div>
                                    </div>
                                    <div className="form-group modern-input-group mb-0" style={{ flex: 1.5 }}>
                                        <label>Amount</label>
                                        <div className="input-wrapper">
                                            <span className="input-icon" style={{ left: '0.75rem', fontWeight: 'bold' }}>$</span>
                                            <input 
                                                type="number" className="modern-input" min="0" step="0.01" style={{ paddingLeft: '2rem' }}
                                                value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button type="button" onClick={addItem} className="btn-add-item">
                            <Plus size={16} /> Add Items
                        </button>
                    </div>
                )}
            </div>

            {/* Discounts & Final Options outside accordians */}
            <div className="flex justify-between items-center mt-4">
                <label className="checkbox-wrap">
                    <input type="checkbox" checked={discount > 0} onChange={(e) => setDiscount(e.target.checked ? 10 : 0)} />
                    <span>Add Discount</span>
                </label>
                {discount > 0 && (
                     <div className="input-wrapper" style={{ width: '120px' }}>
                        <span className="input-icon" style={{ left: '0.5rem' }}>$</span>
                        <input type="number" className="modern-input" style={{ padding: '0.4rem 0.5rem 0.4rem 1.5rem', height: 'auto' }} value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}/>
                    </div>
                )}
            </div>

        </form>
      </div>

      {/* RIGHT COLUMN: Live Preview */}
      <div className="invoice-builder-preview">
        
        {/* Top Preview Controls */}
        <div className="preview-header">
            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>Preview</h2>
            <div className="preview-actions">
                <button type="button" className="action-tag" onClick={handleDownloadPdf}>
                  <FileText size={14}/> Download PDF
                </button>
                <div className="flex gap-2 ml-4">
                    <button type="button" className="btn btn-outline" style={{ borderRadius: '20px', fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>Save as Draft</button>
                    <button type="button" onClick={handleSubmit} className="btn btn-primary" style={{ borderRadius: '20px', fontSize: '0.85rem', padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Send size={14} /> Send Invoice
                    </button>
                </div>
            </div>
        </div>

        {/* The Actual Preview Document - Minimal & Elegant */}
        <div className="preview-document-wrapper">
            <div className="preview-document">
                
                <div className="flex justify-between items-start" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '0.05em' }}>INVOICE</h1>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                            <span>Invoice Number</span>
                            <span>{invoiceNumber}</span>
                        </p>
                    </div>
                    <div style={{
                        width: '48px', height: '48px', backgroundColor: '#064e3b', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                    }}>
                        <Building2 size={24} />
                    </div>
                </div>

                <div className="flex justify-between mb-8" style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ marginBottom: '0.25rem' }}>Billed By:</p>
                        <p style={{ fontWeight: 600, color: '#0f172a', margin: 0 }}>Angelina Caroline</p>
                        <p style={{ margin: 0 }}>angelina.creativ@gmail.com</p>
                        <p style={{ margin: 0 }}>1v Persimmon, Springfield, IN 54129</p>
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ marginBottom: '0.25rem' }}>Billed To:</p>
                        <p style={{ fontWeight: 600, color: '#0f172a', margin: 0 }}>{selectedClient?.name || 'Client Name'}</p>
                        <p style={{ margin: 0 }}>{selectedClient?.email || 'client@email.com'}</p>
                        <p style={{ margin: 0 }}>{selectedClient?.address || 'Client Address'}</p>
                    </div>
                </div>

                <div className="flex justify-between mb-8" style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ marginBottom: '0.25rem' }}>Date Issue:</p>
                        <p style={{ fontWeight: 600, color: '#0f172a', margin: 0 }}>
                            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ marginBottom: '0.25rem' }}>Due Date:</p>
                        <p style={{ fontWeight: 600, color: '#0f172a', margin: 0 }}>
                            {dueDateStr || 'Upon Receipt'}
                        </p>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>Invoice Items/Service:</p>
                    
                    <div style={{ display: 'flex', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
                        <div style={{ flex: 3 }}>Item Name</div>
                        <div style={{ flex: 1, textAlign: 'center' }}>QTY</div>
                        <div style={{ flex: 1, textAlign: 'center' }}>Tax</div>
                        <div style={{ flex: 1.5, textAlign: 'right' }}>Amount</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', padding: '0.75rem 0.5rem', fontSize: '0.875rem', color: '#0f172a', fontWeight: 500 }}>
                                <div style={{ flex: 3 }}>{item.description || '—'}</div>
                                <div style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</div>
                                <div style={{ flex: 1, textAlign: 'center' }}>{taxRate}%</div>
                                <div style={{ flex: 1.5, textAlign: 'right' }}>${(item.quantity * item.unitPrice).toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.875rem', color: '#0f172a', gap: '0.5rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', width: '250px', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Subtotal</span>
                        <span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', width: '250px', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Discount</span>
                        <span style={{ fontWeight: 600 }}>${discount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', width: '250px', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '1rem' }}>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>Grand Total</span>
                        <span style={{ fontWeight: 700 }}>${Math.max(0, total).toFixed(2)}</span>
                    </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.75rem', color: '#64748b', marginBottom: '2rem' }}>
                    Note: {notes}
                </div>

                <div className="flex justify-between items-end mt-8" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    <div style={{ lineHeight: 1.5 }}>
                        <p style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Payment Method</p>
                        <p style={{ margin: 0 }}>{paymentTerms}</p>
                        <p style={{ margin: 0 }}>Account Number : 332176141310371</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '30px', borderBottom: '1px solid #0f172a', margin: '0 auto 0.25rem auto', width: '120px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                            <span style={{ fontStyle: 'italic', fontWeight: 500, fontSize: '1.25rem', color: '#0f172a', transform: 'translateY(5px)' }}>Acr</span>
                        </div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>Soke Bahtera Abr</p>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
}
