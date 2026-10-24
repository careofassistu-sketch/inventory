import React, { useState } from 'react';
import { EmailMessage, EmailConfig } from '../core/types';
import {
  Mail,
  Send,
  Inbox,
  CheckCircle2,
  ExternalLink,
  Settings,
  RefreshCw,
  Key,
  Shield,
  Eye,
} from 'lucide-react';

interface EmailInboxTabProps {
  emailLogs: EmailMessage[];
  emailConfig: EmailConfig;
  onUpdateEmailConfig: (config: Partial<EmailConfig>) => Promise<void>;
  onSelectEmail: (email: EmailMessage) => void;
  onQuickApproveFromToken?: (token: string) => void;
}

export const EmailInboxTab: React.FC<EmailInboxTabProps> = ({
  emailLogs,
  emailConfig,
  onUpdateEmailConfig,
  onSelectEmail,
}) => {
  const [activeView, setActiveView] = useState<'owner' | 'supplier' | 'all'>('owner');
  const [ownerEmailInput, setOwnerEmailInput] = useState(emailConfig.ownerEmail);
  const [senderNameInput, setSenderNameInput] = useState(emailConfig.senderName);
  const [resendKeyInput, setResendKeyInput] = useState(emailConfig.resendApiKey || '');
  const [providerInput, setProviderInput] = useState(emailConfig.provider);
  const [showConfig, setShowConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const ownerDrafts = emailLogs.filter((e) => e.type === 'draft_reorder_approval');
  const supplierOrders = emailLogs.filter((e) => e.type === 'order_placed_supplier');

  const filteredLogs = emailLogs.filter((e) => {
    if (activeView === 'owner') return e.type === 'draft_reorder_approval';
    if (activeView === 'supplier') return e.type === 'order_placed_supplier';
    return true;
  });

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateEmailConfig({
        ownerEmail: ownerEmailInput,
        senderName: senderNameInput,
        provider: providerInput,
        resendApiKey: resendKeyInput,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Transactional Email Center</h1>
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-100 text-emerald-800 rounded">
              Active Provider: {emailConfig.provider === 'resend' ? 'Resend API' : 'In-App Delivery'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Audit log of all transactional notifications. Owner drafts are sent to{' '}
            <strong className="text-slate-700">{emailConfig.ownerEmail}</strong> for approval.
            Once approved, official &quot;ORDER PLACED&quot; emails are delivered directly to suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{showConfig ? 'Hide Config' : 'Configure SMTP / API'}</span>
          </button>
        </div>
      </div>

      {/* Config Drawer */}
      {showConfig && (
        <form
          onSubmit={handleSaveConfig}
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-600" />
              Transactional Email Service Configuration
            </h3>
            <span className="text-xs text-slate-500">
              Clean adapter interface · Credentials never hardcoded
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Email (Draft Approval Recipient)
              </label>
              <input
                type="email"
                required
                value={ownerEmailInput}
                onChange={(e) => setOwnerEmailInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                required
                value={senderNameInput}
                onChange={(e) => setSenderNameInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delivery Provider
              </label>
              <select
                value={providerInput}
                onChange={(e) => setProviderInput(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="in_app">In-App Delivery (Default &amp; Sandbox)</option>
                <option value="resend">Resend API (Live Emails)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resend API Key (Optional)
              </label>
              <input
                type="password"
                placeholder="re_..."
                value={resendKeyInput}
                onChange={(e) => setResendKeyInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Settings saved successfully
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Update Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* Segmented Mailbox Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveView('owner')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeView === 'owner'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 text-amber-500" />
            <span>Owner Draft Approvals Inbox</span>
            <span className="font-mono text-[10px] px-1 bg-amber-100 text-amber-800 rounded">
              {ownerDrafts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('supplier')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeView === 'supplier'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-500" />
            <span>Supplier &quot;ORDER PLACED&quot; Outbox</span>
            <span className="font-mono text-[10px] px-1 bg-blue-100 text-blue-800 rounded">
              {supplierOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Logs ({emailLogs.length})
          </button>
        </div>
      </div>

      {/* Email Messages Feed */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">No Emails Recorded in This View</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Emails are generated whenever barcode sales drop stock below minimum thresholds or when
            you approve a purchase order.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredLogs.map((email) => {
            const isDraft = email.type === 'draft_reorder_approval';

            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className="p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isDraft
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {isDraft ? <Inbox className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.2 rounded ${
                          isDraft
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isDraft ? 'DRAFT APPROVAL (TO OWNER)' : 'ORDER PLACED (TO SUPPLIER)'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(email.timestamp).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900">{email.subject}</div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                      <div>
                        To: <span className="font-mono text-slate-800">{email.to}</span>
                      </div>
                      <div>·</div>
                      <div>
                        From: <span className="text-slate-600">{email.from}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1 pt-0.5">
                      {email.textContent}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEmail(email);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Rendered HTML</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
