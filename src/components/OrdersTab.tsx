import React, { useState } from 'react';
import { ReorderRequest, OrderStatus } from '../core/types';
import {
  Clock,
  Send,
  CheckCircle,
  PackageCheck,
  Edit3,
  ExternalLink,
  ChevronRight,
  Eye,
  Mail,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface OrdersTabProps {
  reorders: ReorderRequest[];
  onApproveOrder: (reorderId: string, updatedQty?: number, notes?: string) => Promise<void>;
  onReceiveRestock: (reorderId: string) => Promise<void>;
  onPreviewEmail: (reorder: ReorderRequest) => void;
  highlightProductId?: string;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  reorders,
  onApproveOrder,
  onReceiveRestock,
  onPreviewEmail,
  highlightProductId,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEdit = (order: ReorderRequest) => {
    setEditingId(order.id);
    setEditQty(order.suggestedQuantity);
    setEditNotes(order.notes || '');
  };

  const handleApproveWithEdit = async (orderId: string) => {
    setIsSubmitting(true);
    try {
      await onApproveOrder(orderId, editQty, editNotes);
      setEditingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = reorders.filter((order) => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  const pendingOrders = reorders.filter((o) => o.status === 'pending_approval');
  const sentOrders = reorders.filter((o) => o.status === 'sent');
  const fulfilledOrders = reorders.filter((o) => o.status === 'fulfilled');

  return (
    <div className="space-y-8">
      {/* Top Banner: Workflow Explanation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchase Orders &amp; Supplier Dispatch</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Strict 2-step governance: Drafts are delivered first to the owner&apos;s email. The supplier is{' '}
            <strong>never</strong> contacted until you review, customize quantity, and approve the order.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Orders ({reorders.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending_approval')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              statusFilter === 'pending_approval'
                ? 'bg-white text-amber-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending Owner Approval</span>
            <span className="font-mono px-1 py-0.2 bg-amber-100 text-amber-800 rounded-sm text-[10px]">
              {pendingOrders.length}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('sent')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'sent'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dispatched to Supplier ({sentOrders.length})
          </button>
          <button
            onClick={() => setStatusFilter('fulfilled')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'fulfilled'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Restocked ({fulfilledOrders.length})
          </button>
        </div>
      </div>

      {/* PENDING APPROVAL QUEUE (High Priority Section) */}
      {pendingOrders.length > 0 && statusFilter !== 'sent' && statusFilter !== 'fulfilled' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="text-base font-bold text-slate-900">
                Draft Reorders Awaiting Owner Approval ({pendingOrders.length})
              </h2>
            </div>
            <div className="text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              Duplicate requests are locked while awaiting your decision
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pendingOrders.map((order) => {
              const isHighlighted = highlightProductId === order.productId;
              const isEditing = editingId === order.id;

              return (
                <div
                  key={order.id}
                  className={`bg-white border rounded-xl p-5 shadow-xs transition-all ${
                    isHighlighted
                      ? 'border-amber-400 ring-2 ring-amber-300'
                      : 'border-amber-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                    {/* Left: Product & Threshold info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold font-mono bg-amber-100 text-amber-800 rounded">
                          PO-{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          Triggered{' '}
                          {new Date(order.draftCreatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-xs text-amber-700 font-medium">
                          · Draft sent to {order.ownerEmail}
                        </span>
                      </div>

                      <div className="text-lg font-bold text-slate-900">{order.productName}</div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                        <div>
                          SKU: <span className="font-mono text-slate-900">{order.productSku}</span>
                        </div>
                        <div>
                          Barcode:{' '}
                          <span className="font-mono text-slate-900">{order.productBarcode}</span>
                        </div>
                        <div>
                          Stock at trigger:{' '}
                          <span className="font-mono font-bold text-rose-600">
                            {order.currentStockAtTrigger}
                          </span>
                        </div>
                        <div>
                          Threshold:{' '}
                          <span className="font-mono text-slate-900">{order.minThreshold}</span>
                        </div>
                        <div>
                          Deficit:{' '}
                          <span className="font-mono font-bold text-amber-700">
                            {order.deficitQuantity} units
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                        <span>Supplier:</span>
                        <span className="font-medium text-slate-900">{order.supplierName}</span>
                        <span>&lt;{order.supplierEmail}&gt;</span>
                      </div>
                    </div>

                    {/* Middle: Suggested Order Quantity (Editable) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shrink-0 min-w-[240px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700">
                          Order Quantity
                        </span>
                        {!isEditing && (
                          <button
                            onClick={() => startEdit(order)}
                            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditQty(Math.max(1, editQty - 1))}
                              className="w-8 h-8 rounded bg-white border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={editQty}
                              onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 text-center font-mono font-bold text-base py-1 border border-slate-300 rounded bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setEditQty(editQty + 1)}
                              className="w-8 h-8 rounded bg-white border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Optional supplier notes..."
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
                            {order.suggestedQuantity}{' '}
                            <span className="text-xs font-normal text-slate-500">units</span>
                          </div>
                          {order.notes && (
                            <p className="text-xs text-slate-500 italic truncate max-w-[200px]">
                              Note: {order.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full sm:w-auto">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveWithEdit(order.id)}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Save &amp; Send</span>
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onApproveOrder(order.id)}
                          className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center justify-center gap-2"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Approve &amp; Send to Supplier</span>
                        </button>
                      )}

                      <button
                        onClick={() => onPreviewEmail(order)}
                        className="px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Draft Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* COMPREHENSIVE ORDERS TABLE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">All Order Records</h2>
          <span className="text-xs text-slate-500 font-mono">
            Audit log of all reorders and supplier dispatches
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            <CheckCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No Purchase Orders Found</p>
            <p className="text-xs text-slate-500 mt-1">
              Purchase orders appear automatically when barcode scans cause inventory to breach
              thresholds.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">PO Reference</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Order Qty</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Timestamps</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900">
                        PO-{order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{order.productName}</div>
                        <div className="text-xs text-slate-500 font-mono">{order.productSku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {order.status === 'pending_approval' && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            Pending Approval
                          </span>
                        )}
                        {order.status === 'sent' && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                            Sent to Supplier
                          </span>
                        )}
                        {order.status === 'fulfilled' && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Restocked &amp; Fulfilled
                          </span>
                        )}
                        {order.status === 'cancelled' && (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-600">
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {order.suggestedQuantity} units
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-900">{order.supplierName}</div>
                        <div className="text-slate-500">{order.supplierEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                        <div>
                          Draft: {new Date(order.draftCreatedAt).toLocaleDateString()}
                        </div>
                        {order.sentAt && (
                          <div className="text-blue-700">
                            Sent: {new Date(order.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onPreviewEmail(order)}
                            title="Inspect Email"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {order.status === 'pending_approval' && (
                            <button
                              onClick={() => onApproveOrder(order.id)}
                              className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 transition-colors"
                            >
                              Approve
                            </button>
                          )}

                          {order.status === 'sent' && (
                            <button
                              onClick={() => onReceiveRestock(order.id)}
                              title="Mark order received from supplier & add units to available stock"
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-xs"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Restock</span>
                            </button>
                          )}
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
    </div>
  );
};
