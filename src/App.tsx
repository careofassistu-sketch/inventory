/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  Supplier,
  ReorderRequest,
  ScanRecord,
  EmailMessage,
  EmailConfig,
  StockCategorization,
} from './core/types';
import { categorizeInventory } from './core/inventory';
import { Navbar, ActiveTab } from './components/Navbar';
import { InventoryTab } from './components/InventoryTab';
import { BarcodeSalesTab } from './components/BarcodeSalesTab';
import { OrdersTab } from './components/OrdersTab';
import { EmailInboxTab } from './components/EmailInboxTab';
import { SuppliersTab } from './components/SuppliersTab';
import { ProductModal } from './components/ProductModal';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import { sound } from './utils/audio';
import { CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'alert' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reorders, setReorders] = useState<ReorderRequest[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanRecord[]>([]);
  const [sessionScans, setSessionScans] = useState<ScanRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailMessage[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    provider: 'in_app',
    ownerEmail: 'careofassistu@gmail.com',
    senderEmail: 'orders@stockpilot.ops',
    senderName: 'StockPilot Operations',
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductBarcode, setNewProductBarcode] = useState<string>('');
  const [previewEmailModalOpen, setPreviewEmailModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedReorderForPreview, setSelectedReorderForPreview] = useState<ReorderRequest | null>(null);
  const [highlightOrderId, setHighlightOrderId] = useState<string | undefined>();

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch full dashboard state from backend
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const data = await res.json();
      setProducts(data.products || []);
      setSuppliers(data.suppliers || []);
      setReorders(data.reorders || []);
      setScanLogs(data.scanLogs || []);
      setEmailLogs(data.emailLogs || []);
      if (data.emailConfig) setEmailConfig(data.emailConfig);
    } catch (err) {
      console.error('Error loading dashboard state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle URL parameters for one-click email approvals (e.g. /?action=approve&token=xyz)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const token = params.get('token');
    const approved = params.get('approved');
    const approvalError = params.get('approval_error');

    if (approved) {
      addToast({
        type: 'success',
        title: 'Order Approved Successfully!',
        message: 'The official "ORDER PLACED" email has been dispatched to the supplier.',
      });
      setActiveTab('orders');
      // Clean query string without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (approvalError) {
      addToast({
        type: 'error',
        title: 'Approval Notice',
        message: decodeURIComponent(approvalError),
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (action === 'approve' && token) {
      // Execute direct token approval
      fetch(`/api/approve/${token}`)
        .then(() => {
          fetchDashboardData();
          addToast({
            type: 'success',
            title: 'Order Approved via Email Link',
            message: 'Purchase order sent to supplier with subject "ORDER PLACED".',
          });
          setActiveTab('orders');
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [addToast, fetchDashboardData]);

  // Dynamic categorization calculation (Rule 1 & Rule 2)
  const categorization: StockCategorization = useMemo(() => {
    return categorizeInventory(products, reorders);
  }, [products, reorders]);

  // Barcode Scan Handler
  const handleProcessScan = async (barcode: string) => {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to scan barcode');
    }

    // Refresh state from server
    await fetchDashboardData();

    // Append to session scans
    setSessionScans((prev) => [data.scanRecord, ...prev]);

    if (data.reorderCreated) {
      addToast({
        type: 'alert',
        title: 'Threshold Breached · Draft PO Generated',
        message: `Stock for "${data.product?.name}" reached threshold. Draft email sent to owner for approval.`,
        actionLabel: 'Review PO',
        onAction: () => {
          setActiveTab('orders');
          setHighlightOrderId(data.product?.id);
        },
      });
    } else if (data.status === 'unknown_barcode') {
      addToast({
        type: 'error',
        title: 'Unknown Barcode',
        message: `Barcode ${data.scanRecord.barcode} is not registered in the catalog.`,
        actionLabel: 'Add Product',
        onAction: () => {
          setNewProductBarcode(data.scanRecord.barcode);
          setEditingProduct(null);
          setProductModalOpen(true);
        },
      });
    }

    return data;
  };

  // Undo accidental scan
  const handleUndoScan = async (record: ScanRecord) => {
    if (!record.productId) return;
    const targetProduct = products.find((p) => p.id === record.productId);
    if (!targetProduct) return;

    // Restore 1 unit
    const restoredStock = targetProduct.availableStock + 1;
    await fetch(`/api/products/${targetProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availableStock: restoredStock }),
    });

    // Remove from session scans
    setSessionScans((prev) => prev.filter((s) => s.id !== record.id));
    await fetchDashboardData();
    sound.playSuccess();
    addToast({
      type: 'success',
      title: 'Sale Reversed',
      message: `Restored 1 unit to "${targetProduct.name}". Stock is now ${restoredStock}.`,
    });
  };

  // Add / Edit Product Save Handler
  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (productData.id) {
      // Update
      const res = await fetch(`/api/products/${productData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update product');
      }
      addToast({
        type: 'success',
        title: 'Product Updated',
        message: `"${productData.name}" has been updated.`,
      });
    } else {
      // Create
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create product');
      }
      addToast({
        type: 'success',
        title: 'Product Created',
        message: `"${productData.name}" is now ready for scanning.`,
      });
    }
    await fetchDashboardData();
  };

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Delete Product
  const handleDeleteProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setProductToDelete(product);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const target = productToDelete;
    setProductToDelete(null);
    const res = await fetch(`/api/products/${target.id}`, { method: 'DELETE' });
    if (res.ok) {
      addToast({
        type: 'success',
        title: 'Product Deleted',
        message: `"${target.name}" removed from inventory catalog.`,
      });
      await fetchDashboardData();
    }
  };

  // Approve Reorder Handler
  const handleApproveOrder = async (reorderId: string, updatedQty?: number, notes?: string) => {
    const res = await fetch(`/api/reorders/${reorderId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestedQuantity: updatedQty, notes }),
    });

    const data = await res.json();
    if (!res.ok) {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: data.error || 'Could not approve order.',
      });
      return;
    }

    sound.playSuccess();
    await fetchDashboardData();
    addToast({
      type: 'success',
      title: 'Order Placed with Supplier!',
      message: `Official purchase order dispatched to ${data.reorder?.supplierEmail} with subject "ORDER PLACED".`,
      actionLabel: 'View Outbox',
      onAction: () => setActiveTab('emails'),
    });
  };

  // Receive Restock Handler
  const handleReceiveRestock = async (reorderId: string) => {
    const res = await fetch(`/api/reorders/${reorderId}/receive`, {
      method: 'POST',
    });

    const data = await res.json();
    if (!res.ok) {
      addToast({
        type: 'error',
        title: 'Restock Failed',
        message: data.error || 'Could not restock order.',
      });
      return;
    }

    sound.playSuccess();
    await fetchDashboardData();
    addToast({
      type: 'success',
      title: 'Inventory Restocked!',
      message: data.message,
    });
  };

  // Update Email Config
  const handleUpdateEmailConfig = async (configUpdate: Partial<EmailConfig>) => {
    const res = await fetch('/api/emails/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configUpdate),
    });
    if (res.ok) {
      const updated = await res.json();
      setEmailConfig(updated);
      addToast({
        type: 'success',
        title: 'Email Config Updated',
        message: `Owner approval recipient set to ${updated.ownerEmail}.`,
      });
    }
  };

  // Add Supplier
  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplierData),
    });
    if (res.ok) {
      await fetchDashboardData();
      addToast({
        type: 'success',
        title: 'Supplier Added',
        message: `Supplier "${supplierData.name}" has been registered.`,
      });
    }
  };

  // Modal open helpers
  const handleOpenAddModal = (barcode?: string) => {
    setEditingProduct(null);
    setNewProductBarcode(barcode || '');
    setProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setNewProductBarcode('');
    setProductModalOpen(true);
  };

  const handlePreviewReorderEmail = (reorder: ReorderRequest) => {
    setSelectedReorderForPreview(reorder);
    setSelectedEmail(null);
    setPreviewEmailModalOpen(true);
  };

  const handleSelectEmailMessage = (email: EmailMessage) => {
    setSelectedEmail(email);
    const relatedReorder = email.orderId
      ? reorders.find((r) => r.id === email.orderId) || null
      : null;
    setSelectedReorderForPreview(relatedReorder);
    setPreviewEmailModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Loading StockPilot Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingApprovalsCount={categorization.summary.pendingApprovalsCount}
        onOpenAddModal={() => handleOpenAddModal()}
        onOpenEmailSettings={() => setActiveTab('emails')}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'inventory' && (
          <InventoryTab
            products={products}
            reorders={reorders}
            categorization={categorization}
            onEditProduct={handleOpenEditModal}
            onDeleteProduct={handleDeleteProduct}
            onAddProduct={() => handleOpenAddModal()}
            onNavigateToOrders={(productId) => {
              setActiveTab('orders');
              setHighlightOrderId(productId);
            }}
            onNavigateToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'scanner' && (
          <BarcodeSalesTab
            products={products}
            onProcessScan={handleProcessScan}
            onUndoScan={handleUndoScan}
            onAddNewProductWithBarcode={(code) => handleOpenAddModal(code)}
            onNavigateToOrders={(productId) => {
              setActiveTab('orders');
              setHighlightOrderId(productId);
            }}
            sessionScans={sessionScans}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTab
            reorders={reorders}
            onApproveOrder={handleApproveOrder}
            onReceiveRestock={handleReceiveRestock}
            onPreviewEmail={handlePreviewReorderEmail}
            highlightProductId={highlightOrderId}
          />
        )}

        {activeTab === 'emails' && (
          <EmailInboxTab
            emailLogs={emailLogs}
            emailConfig={emailConfig}
            onUpdateEmailConfig={handleUpdateEmailConfig}
            onSelectEmail={handleSelectEmailMessage}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersTab
            suppliers={suppliers}
            products={products}
            onAddSupplier={handleAddSupplier}
          />
        )}
      </main>

      {/* Product Add/Edit Modal */}
      <ProductModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        suppliers={suppliers}
        initialBarcode={newProductBarcode}
      />

      {/* Transactional Email Preview Modal */}
      <EmailPreviewModal
        isOpen={previewEmailModalOpen}
        onClose={() => {
          setPreviewEmailModalOpen(false);
          setSelectedEmail(null);
          setSelectedReorderForPreview(null);
        }}
        email={selectedEmail}
        reorder={selectedReorderForPreview}
        onApproveOrder={handleApproveOrder}
      />

      {/* Delete Product Confirmation Modal (Iframe safe) */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete Product</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong>{productToDelete.name}</strong> ({productToDelete.sku}) from the catalog? Any pending reorders will also be removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProduct}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border pointer-events-auto transition-all transform duration-200 flex items-start justify-between gap-3 ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : toast.type === 'alert'
                ? 'bg-amber-50 text-amber-950 border-amber-300'
                : 'bg-rose-50 text-rose-950 border-rose-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-xs font-bold">{toast.title}</div>
                <p className="text-xs opacity-90 leading-relaxed">{toast.message}</p>
                {toast.actionLabel && toast.onAction && (
                  <button
                    onClick={() => {
                      toast.onAction?.();
                      removeToast(toast.id);
                    }}
                    className={`text-xs font-semibold underline mt-1 block ${
                      toast.type === 'success' ? 'text-emerald-300 hover:text-white' : 'text-slate-900 hover:underline'
                    }`}
                  >
                    {toast.actionLabel} &rarr;
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
