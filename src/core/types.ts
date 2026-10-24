export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  leadTimeDays: number;
  notes?: string;
}

export interface Product {
  id: string;
  barcode: string; // EAN, UPC, or custom code
  sku: string;
  name: string;
  category: string;
  unit: string; // e.g. "units", "pcs", "boxes", "kg"
  availableStock: number;
  minRequiredStock: number; // Reorder threshold point
  unitCost: number;
  unitPrice: number;
  supplierId: string;
  supplierEmail: string; // Direct supplier email contact
  supplierName: string;
  updatedAt: string;
}

export type OrderStatus = 'pending_approval' | 'approved' | 'sent' | 'cancelled' | 'fulfilled';

export interface ReorderRequest {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  productSku: string;
  currentStockAtTrigger: number;
  minThreshold: number;
  deficitQuantity: number; // Minimum Required - Current Stock
  suggestedQuantity: number; // Editable by owner before approval
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  ownerEmail: string;
  status: OrderStatus;
  approvalToken: string;
  draftCreatedAt: string;
  approvedAt?: string;
  sentAt?: string;
  cancelledAt?: string;
  notes?: string;
  draftEmailSubject: string;
  draftEmailBody: string;
  dispatchEmailSubject?: string;
  dispatchEmailBody?: string;
}

export interface ScanRecord {
  id: string;
  timestamp: string;
  barcode: string;
  success: boolean;
  productId?: string;
  productName?: string;
  previousStock?: number;
  newStock?: number;
  triggeredReorder: boolean;
  reorderId?: string;
  message: string;
}

export interface EmailMessage {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  orderId?: string;
  type: 'draft_reorder_approval' | 'order_placed_supplier' | 'test_ping';
  status: 'delivered' | 'simulated';
}

export interface EmailConfig {
  provider: 'in_app' | 'resend' | 'sendgrid' | 'smtp';
  ownerEmail: string;
  senderEmail: string;
  senderName: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
}

export interface StockCategorization {
  reorderToday: {
    product: Product;
    deficit: number;
    action: string;
    hasPendingReorder: boolean;
    pendingReorderId?: string;
  }[];
  healthyStock: {
    product: Product;
    surplus: number;
    action: string;
  }[];
  summary: {
    totalProducts: number;
    itemsNeedingReorder: number;
    itemsHealthy: number;
    totalUnitsDeficit: number;
    pendingApprovalsCount: number;
  };
}

export interface InventoryStoreState {
  products: Product[];
  reorders: ReorderRequest[];
  scanLogs: ScanRecord[];
  emailLogs: EmailMessage[];
  emailConfig: EmailConfig;
}

export interface ProcessScanResult {
  scanRecord: ScanRecord;
  product?: Product;
  reorderCreated?: ReorderRequest;
  duplicatePrevented: boolean;
  status: 'success' | 'unknown_barcode' | 'out_of_stock';
}

