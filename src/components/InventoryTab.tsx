import React, { useState, useMemo } from 'react';
import {
  Product,
  ReorderRequest,
  StockCategorization,
} from '../core/types';
import {
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Edit2,
  Trash2,
  Plus,
  ArrowUpRight,
  TrendingDown,
  Clock,
  Layers,
} from 'lucide-react';

interface InventoryTabProps {
  products: Product[];
  reorders: ReorderRequest[];
  categorization: StockCategorization;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAddProduct: () => void;
  onNavigateToOrders: (productId?: string) => void;
  onNavigateToScanner: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products,
  reorders,
  categorization,
  onEditProduct,
  onDeleteProduct,
  onAddProduct,
  onNavigateToOrders,
  onNavigateToScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<'all' | 'reorder' | 'healthy'>('all');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter items
  const filterList = <T extends { product: Product }>(list: T[]): T[] => {
    return list.filter((item) => {
      const p = item.product;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  };

  const filteredReorderToday = useMemo(
    () => filterList(categorization.reorderToday),
    [categorization.reorderToday, searchQuery, selectedCategory]
  );

  const filteredHealthyStock = useMemo(
    () => filterList(categorization.healthyStock),
    [categorization.healthyStock, searchQuery, selectedCategory]
  );

  return (
    <div className="space-y-8">
      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Total Catalog</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
            {categorization.summary.totalProducts}
          </div>
          <div className="text-xs text-slate-500 mt-1">Active inventory SKUs</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs bg-amber-50/30">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Items to Reorder Today</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-amber-700 font-mono tabular-nums">
            {categorization.summary.itemsNeedingReorder}
          </div>
          <div className="text-xs text-amber-800/80 mt-1">
            Current Stock &lt; Minimum Required ({categorization.summary.totalUnitsDeficit} units deficit)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Items in Healthy Stock</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
            {categorization.summary.itemsHealthy}
          </div>
          <div className="text-xs text-slate-500 mt-1">Stock &gt;= Minimum Threshold</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
            {categorization.summary.pendingApprovalsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Draft emails awaiting owner confirmation
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category, Section Segmented Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product, SKU, barcode, supplier..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Filter Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setActiveSection('reorder')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeSection === 'reorder'
                ? 'bg-white text-amber-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Items to Reorder Today</span>
            <span className="font-mono px-1 py-0.2 bg-amber-100 text-amber-800 rounded-sm text-[10px]">
              {categorization.reorderToday.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSection('healthy')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'healthy'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Healthy Stock ({categorization.healthyStock.length})
          </button>
        </div>
      </div>

      {/* SECTION 1: ITEMS TO REORDER TODAY */}
      {(activeSection === 'all' || activeSection === 'reorder') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Items to Reorder Today
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                (Current Stock &lt; Minimum Required Stock)
              </span>
            </div>
            <div className="text-xs text-amber-700 font-medium">
              Deficit = Minimum Required - Current Stock
            </div>
          </div>

          {filteredReorderToday.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">No Reorder Deficits Today</p>
              <p className="text-xs text-slate-500 mt-1">
                All inventory items are currently at or above their required minimum thresholds.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-amber-50/70 border-b border-amber-200/80 text-xs text-amber-900 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-4">Barcode / SKU</th>
                      <th className="py-3 px-4 text-right">Current Stock</th>
                      <th className="py-3 px-4 text-right">Min Threshold</th>
                      <th className="py-3 px-4 text-right">Deficit</th>
                      <th className="py-3 px-4 text-center">Required Action</th>
                      <th className="py-3 px-4">Supplier Contact</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60">
                    {filteredReorderToday.map(({ product, deficit, action, hasPendingReorder, pendingReorderId }) => (
                      <tr
                        key={product.id}
                        className="hover:bg-amber-50/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{product.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <span>{product.category}</span>
                            <span>·</span>
                            <span>Unit: {product.unit}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                          <div>{product.barcode}</div>
                          <div className="text-[11px] text-slate-400">{product.sku}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-amber-600 text-base tabular-nums">
                            {product.availableStock}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">{product.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                          {product.minRequiredStock} {product.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-amber-700 tabular-nums">
                            -{deficit} {product.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                              {action}
                            </span>
                            {hasPendingReorder ? (
                              <button
                                onClick={() => onNavigateToOrders(product.id)}
                                className="text-[11px] text-amber-700 font-medium hover:underline mt-1 flex items-center gap-0.5"
                              >
                                Draft Pending Approval
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                onClick={onNavigateToScanner}
                                className="text-[11px] text-slate-500 hover:text-slate-800 mt-1"
                              >
                                Ready for PO trigger
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-medium text-slate-900">{product.supplierName}</div>
                          <a
                            href={`mailto:${product.supplierEmail}`}
                            className="text-slate-500 hover:text-slate-800 hover:underline"
                          >
                            {product.supplierEmail}
                          </a>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onEditProduct(product)}
                              title="Edit product"
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteProduct(product.id)}
                              title="Delete product"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: ITEMS IN HEALTHY STOCK */}
      {(activeSection === 'all' || activeSection === 'healthy') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Items in Healthy Stock
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                (Current Stock &gt;= Minimum Required Stock)
              </span>
            </div>
            <div className="text-xs text-emerald-700 font-medium">
              Surplus = Current Stock - Minimum Required
            </div>
          </div>

          {filteredHealthyStock.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">No Healthy Stock Items Found</p>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing your search query or add new stock.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-4">Barcode / SKU</th>
                      <th className="py-3 px-4 text-right">Current Stock</th>
                      <th className="py-3 px-4 text-right">Min Threshold</th>
                      <th className="py-3 px-4 text-right">Surplus Cushion</th>
                      <th className="py-3 px-4 text-center">Required Action</th>
                      <th className="py-3 px-4">Supplier Contact</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHealthyStock.map(({ product, surplus, action }) => (
                      <tr
                        key={product.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{product.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <span>{product.category}</span>
                            <span>·</span>
                            <span>Unit: {product.unit}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">
                          <div>{product.barcode}</div>
                          <div className="text-[11px] text-slate-400">{product.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {product.availableStock}{' '}
                          <span className="text-xs font-normal text-slate-500">{product.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                          {product.minRequiredStock} {product.unit}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                            +{surplus} {product.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-medium text-slate-900">{product.supplierName}</div>
                          <a
                            href={`mailto:${product.supplierEmail}`}
                            className="text-slate-500 hover:text-slate-800 hover:underline"
                          >
                            {product.supplierEmail}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onEditProduct(product)}
                              title="Edit product"
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteProduct(product.id)}
                              title="Delete product"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
