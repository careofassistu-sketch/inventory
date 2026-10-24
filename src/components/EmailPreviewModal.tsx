import React, { useState } from 'react';
import { EmailMessage, ReorderRequest } from '../core/types';
import { X, Mail, Send, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: EmailMessage | null;
  reorder?: ReorderRequest | null;
  onApproveOrder?: (reorderId: string) => Promise<void>;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  email,
  reorder,
  onApproveOrder,
}) => {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [copied, setCopied] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  if (!isOpen || (!email && !reorder)) return null;

  const subject = email?.subject || reorder?.draftEmailSubject || 'Email Notification';
  const to = email?.to || (reorder?.status === 'pending_approval' ? reorder.ownerEmail : reorder?.supplierEmail) || '';
  const from = email?.from || 'StockPilot Operations <orders@stockpilot.ops>';
  const htmlContent = email?.htmlContent || reorder?.draftEmailBody || '';
  const textContent = email?.textContent || '';
  const isDraftApproval = email?.type === 'draft_reorder_approval' || reorder?.status === 'pending_approval';

  const copyApprovalLink = () => {
    if (reorder?.approvalToken) {
      const link = `${window.location.origin}?action=approve&token=${reorder.approvalToken}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApprove = async () => {
    if (!reorder?.id || !onApproveOrder) return;
    setIsApproving(true);
    try {
      await onApproveOrder(reorder.id);
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDraftApproval ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}
            >
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isDraftApproval ? 'Owner Approval Draft Email' : 'Supplier Purchase Order Email'}
              </h2>
              <span className="text-xs text-slate-500">
                {isDraftApproval
                  ? 'Delivered to owner · Supplier not yet contacted'
                  : 'Official PO dispatched to supplier'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-md text-xs">
              <button
                onClick={() => setViewMode('html')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'html' ? 'bg-white shadow-xs font-semibold' : 'text-slate-600'
                }`}
              >
                Rendered HTML
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'text' ? 'bg-white shadow-xs font-semibold' : 'text-slate-600'
                }`}
              >
                Plain Text
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Envelope Metadata */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 my-3 text-xs space-y-1.5 font-mono">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-slate-400">Subject: </span>
              <strong className="text-slate-900">{subject}</strong>
            </div>
          </div>
          <div>
            <span className="text-slate-400">To: </span>
            <span className="text-slate-800">{to}</span>
          </div>
          <div>
            <span className="text-slate-400">From: </span>
            <span className="text-slate-600">{from}</span>
          </div>
        </div>

        {/* Body Viewer */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-4 bg-white">
          {viewMode === 'html' ? (
            <div
              className="prose prose-sm max-w-none text-slate-800"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap text-slate-800 leading-relaxed">
              {textContent || htmlContent.replace(/<[^>]*>/g, '')}
            </pre>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-3">
          <div>
            {reorder?.approvalToken && (
              <button
                onClick={copyApprovalLink}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link copied to clipboard!' : 'Copy Approval Link'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Close
            </button>

            {isDraftApproval && reorder?.status === 'pending_approval' && onApproveOrder && (
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isApproving ? 'Approving...' : 'Approve & Dispatch Order'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
