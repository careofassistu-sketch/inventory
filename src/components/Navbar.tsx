import React from 'react';
import {
  Package,
  Barcode,
  ClipboardList,
  Mail,
  Truck,
  Plus,
  Settings,
} from 'lucide-react';

export type ActiveTab = 'inventory' | 'scanner' | 'orders' | 'emails' | 'suppliers';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingApprovalsCount: number;
  onOpenAddModal: () => void;
  onOpenEmailSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  onOpenAddModal,
  onOpenEmailSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('inventory')}
            className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-md"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tighter">
              SP
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              StockPilot
            </span>
          </button>
        </div>

        {/* Zone 2: Clean Single-line Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'scanner'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Barcode Sales</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 relative ${
              activeTab === 'orders'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Purchase Orders</span>
            {pendingApprovalsCount > 0 && (
              <span className="px-1.5 py-0.2 text-[11px] font-mono font-bold bg-amber-500 text-white rounded-md tabular-nums">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'emails'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Dispatch</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'suppliers'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Suppliers</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenEmailSettings}
            title="Email Settings & Configuration"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>
    </header>
  );
};
