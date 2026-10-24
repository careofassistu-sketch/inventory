import React, { useState } from 'react';
import { Supplier, Product } from '../core/types';
import { Truck, Plus, Mail, Phone, Calendar, Package, Check } from 'lucide-react';

interface SuppliersTabProps {
  suppliers: Supplier[];
  products: Product[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
}

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  suppliers,
  products,
  onAddSupplier,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onAddSupplier({
        name,
        email,
        phone,
        leadTimeDays,
        notes,
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Supplier Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier email addresses used for official &quot;ORDER PLACED&quot; purchase order
            dispatch upon owner approval.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.map((supplier) => {
          const linkedProducts = products.filter((p) => p.supplierEmail === supplier.email || p.supplierId === supplier.id);

          return (
            <div
              key={supplier.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {supplier.leadTimeDays}d lead time
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{supplier.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${supplier.email}`} className="hover:underline font-mono">
                    {supplier.email}
                  </a>
                </div>
                {supplier.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
              </div>

              {supplier.notes && (
                <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {supplier.notes}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Linked Catalog SKUs:</span>
                <span className="font-mono font-bold text-slate-900">
                  {linkedProducts.length} items
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Add New Supplier</h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Packaging Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Order Dispatch Email (Mandatory)
                </label>
                <input
                  type="email"
                  required
                  placeholder="orders@supplier.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone (Optional)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ordering Notes</label>
                <textarea
                  rows={2}
                  placeholder="Minimum order values, packing specs..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
                >
                  {isSubmitting ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
