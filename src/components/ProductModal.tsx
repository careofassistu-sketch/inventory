import React, { useState, useEffect } from 'react';
import { Product, Supplier } from '../core/types';
import { X, Barcode, Package, AlertCircle } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<Product>) => Promise<void>;
  product?: Product | null;
  suppliers: Supplier[];
  initialBarcode?: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  suppliers,
  initialBarcode,
}) => {
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Coffee Beans');
  const [unit, setUnit] = useState('units');
  const [availableStock, setAvailableStock] = useState<number>(10);
  const [minRequiredStock, setMinRequiredStock] = useState<number>(5);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (product) {
      setBarcode(product.barcode);
      setSku(product.sku);
      setName(product.name);
      setCategory(product.category);
      setUnit(product.unit);
      setAvailableStock(product.availableStock);
      setMinRequiredStock(product.minRequiredStock);
      setUnitCost(product.unitCost || 0);
      setUnitPrice(product.unitPrice || 0);
      setSupplierId(product.supplierId || '');
      setSupplierName(product.supplierName || '');
      setSupplierEmail(product.supplierEmail || '');
    } else {
      setBarcode(initialBarcode || '');
      setSku(initialBarcode ? `SKU-${initialBarcode.slice(-4)}` : '');
      setName('');
      setCategory('Coffee Beans');
      setUnit('units');
      setAvailableStock(10);
      setMinRequiredStock(5);
      setUnitCost(5);
      setUnitPrice(10);
      if (suppliers.length > 0) {
        setSupplierId(suppliers[0].id);
        setSupplierName(suppliers[0].name);
        setSupplierEmail(suppliers[0].email);
      }
    }
    setErrorMsg('');
  }, [product, initialBarcode, suppliers, isOpen]);

  if (!isOpen) return null;

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supId = e.target.value;
    setSupplierId(supId);
    const found = suppliers.find((s) => s.id === supId);
    if (found) {
      setSupplierName(found.name);
      setSupplierEmail(found.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !name.trim()) {
      setErrorMsg('Barcode and Product Name are required.');
      return;
    }
    if (!supplierEmail.trim()) {
      setErrorMsg('Supplier Email is required for purchase order generation.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onSave({
        id: product ? product.id : undefined,
        barcode: barcode.trim(),
        sku: sku.trim() || `SKU-${barcode.trim().slice(-4)}`,
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim() || 'units',
        availableStock: Number(availableStock),
        minRequiredStock: Number(minRequiredStock),
        unitCost: Number(unitCost),
        unitPrice: Number(unitPrice),
        supplierId,
        supplierName,
        supplierEmail: supplierEmail.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {product ? 'Edit Inventory Item' : 'Add New Inventory Product'}
              </h2>
              <p className="text-xs text-slate-500">Configure minimum threshold and available stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Barcode Number (UPC / EAN) *
              </label>
              <div className="relative">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 012345678905"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU Code</label>
              <input
                type="text"
                placeholder="e.g. COF-ETH-250G"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:ring-2 focus:ring-slate-900 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ethiopian Yirgacheffe Washed (250g)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Coffee Beans"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
              <input
                type="text"
                placeholder="bags, cartons, pcs, units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Core Inventory Stock Levels */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Stock Thresholds &amp; Availability
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Current Available Stock
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={availableStock}
                  onChange={(e) => setAvailableStock(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Subtracted by 1 on each barcode sale
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Minimum Required Stock (Reorder Point) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={minRequiredStock}
                  onChange={(e) => setMinRequiredStock(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-base font-mono font-bold text-amber-900 focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-amber-700 mt-0.5 block">
                  Triggers reorder draft when stock &lt;= threshold
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Details */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Supplier &amp; PO Dispatch Info
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Supplier</label>
                <select
                  value={supplierId}
                  onChange={handleSupplierChange}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
                >
                  <option value="">Custom Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mountain Roasters Supply"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Supplier Email (Where &quot;ORDER PLACED&quot; will be dispatched) *
              </label>
              <input
                type="email"
                required
                placeholder="orders@supplier.com"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
