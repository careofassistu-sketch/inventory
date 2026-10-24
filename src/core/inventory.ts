import {
  Product,
  ReorderRequest,
  ScanRecord,
  StockCategorization,
  EmailMessage,
  EmailConfig,
  InventoryStoreState,
  ProcessScanResult,
} from './types';

export type { InventoryStoreState, ProcessScanResult };

/**
 * Categorizes inventory items into:
 * 1. "Items to Reorder Today" (Current Stock < Minimum Required Stock)
 *    Calculate: Reorder Quantity = Minimum Required Stock - Current Stock
 *    Action: "Reorder [Quantity]"
 * 2. "Items in Healthy Stock" (Current Stock >= Minimum Required Stock)
 *    Action: "No reorder"
 */
export function categorizeInventory(
  products: Product[],
  pendingReorders: ReorderRequest[] = []
): StockCategorization {
  const pendingByProductId = new Map<string, ReorderRequest>();
  for (const reorder of pendingReorders) {
    if (reorder.status === 'pending_approval') {
      pendingByProductId.set(reorder.productId, reorder);
    }
  }

  const reorderToday: StockCategorization['reorderToday'] = [];
  const healthyStock: StockCategorization['healthyStock'] = [];

  let totalUnitsDeficit = 0;

  for (const product of products) {
    const current = product.availableStock;
    const min = product.minRequiredStock;

    if (current < min) {
      // Reorder Quantity = Minimum Required Stock - Current Stock
      const deficit = min - current;
      totalUnitsDeficit += deficit;
      const pendingOrder = pendingByProductId.get(product.id);

      reorderToday.push({
        product,
        deficit,
        action: `Reorder ${deficit} ${product.unit}`,
        hasPendingReorder: !!pendingOrder,
        pendingReorderId: pendingOrder?.id,
      });
    } else {
      const surplus = current - min;
      healthyStock.push({
        product,
        surplus,
        action: 'No reorder',
      });
    }
  }

  // Sort reorder today by largest deficit first
  reorderToday.sort((a, b) => b.deficit - a.deficit);
  // Sort healthy stock by lowest surplus first (closest to threshold)
  healthyStock.sort((a, b) => a.surplus - b.surplus);

  return {
    reorderToday,
    healthyStock,
    summary: {
      totalProducts: products.length,
      itemsNeedingReorder: reorderToday.length,
      itemsHealthy: healthyStock.length,
      totalUnitsDeficit,
      pendingApprovalsCount: pendingByProductId.size,
    },
  };
}

/**
 * Generates email content for the owner's approval draft
 */
export function buildOwnerDraftEmail(
  reorder: Pick<
    ReorderRequest,
    | 'id'
    | 'productName'
    | 'productBarcode'
    | 'productSku'
    | 'currentStockAtTrigger'
    | 'minThreshold'
    | 'deficitQuantity'
    | 'suggestedQuantity'
    | 'supplierName'
    | 'supplierEmail'
    | 'approvalToken'
  >,
  appUrl: string,
  unit: string = 'units'
): { subject: string; html: string; text: string } {
  const approvalLink = `${appUrl.replace(/\/$/, '')}?action=approve&token=${reorder.approvalToken}`;
  const subject = `[APPROVAL NEEDED] Low Stock Reorder Draft: ${reorder.productName}`;

  const text = `
LOW STOCK REORDER DRAFT AWAITING YOUR APPROVAL
------------------------------------------------
Product: ${reorder.productName}
SKU / Barcode: ${reorder.productSku} (${reorder.productBarcode})
Current Stock: ${reorder.currentStockAtTrigger} ${unit}
Minimum Threshold: ${reorder.minThreshold} ${unit}
Stock Deficit: ${reorder.deficitQuantity} ${unit}
Suggested Reorder Quantity: ${reorder.suggestedQuantity} ${unit}

Supplier Contact:
${reorder.supplierName} (${reorder.supplierEmail})

NOTE: The supplier has NOT been contacted yet.
To approve this reorder and immediately dispatch the purchase order email to ${reorder.supplierEmail}, click the link below:
${approvalLink}

Or review and adjust the order quantity inside the StockPilot dashboard.
  `.trim();

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
    <h1 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">StockPilot · Replenishment Approval</h1>
    <p style="font-size: 13px; color: #64748b; margin: 0;">Automated alert triggered by barcode sales scan</p>
  </div>

  <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #92400e;">
      ⚠️ Stock Breached Minimum Threshold
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #b45309;">
      <strong>${reorder.productName}</strong> has dropped to <strong>${reorder.currentStockAtTrigger} ${unit}</strong>, which is at or below the safety threshold of <strong>${reorder.minThreshold} ${unit}</strong>.
    </p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
    <tbody>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b; width: 40%;">Product Name</td>
        <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">${reorder.productName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b;">SKU / Barcode</td>
        <td style="padding: 10px 0; font-family: monospace; color: #334155;">${reorder.productSku} (${reorder.productBarcode})</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b;">Current Stock</td>
        <td style="padding: 10px 0; font-weight: 600; color: #dc2626;">${reorder.currentStockAtTrigger} ${unit}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b;">Minimum Threshold</td>
        <td style="padding: 10px 0; color: #0f172a;">${reorder.minThreshold} ${unit}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b;">Deficit</td>
        <td style="padding: 10px 0; font-weight: 600; color: #b45309;">${reorder.deficitQuantity} ${unit}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b;">Suggested Order Qty</td>
        <td style="padding: 10px 0; font-size: 15px; font-weight: 700; color: #0f172a;">${reorder.suggestedQuantity} ${unit}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #64748b;">Supplier</td>
        <td style="padding: 10px 0; color: #0f172a;">${reorder.supplierName} &lt;${reorder.supplierEmail}&gt;</td>
      </tr>
    </tbody>
  </table>

  <div style="text-align: center; margin: 28px 0;">
    <a href="${approvalLink}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
      Approve &amp; Send Order to Supplier
    </a>
  </div>

  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 16px 0 0 0;">
    Supplier has not been contacted. Clicking approve will instantly dispatch an official "ORDER PLACED" email to ${reorder.supplierEmail}.
  </p>
</div>
  `.trim();

  return { subject, html, text };
}

/**
 * Generates the official email sent to the supplier once approved by the owner
 * Requirement: Subject line must be "ORDER PLACED" and include order details.
 */
export function buildSupplierOrderEmail(
  reorder: ReorderRequest,
  ownerName: string = 'Purchasing Dept',
  ownerEmail: string = 'careofassistu@gmail.com',
  unit: string = 'units'
): { subject: string; html: string; text: string } {
  const subject = `ORDER PLACED - Purchase Order for ${reorder.productName} (PO-${reorder.id.slice(0, 8).toUpperCase()})`;

  const text = `
ORDER PLACED
------------------------------------------------
Purchase Order Reference: PO-${reorder.id.slice(0, 8).toUpperCase()}
Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}

Dear ${reorder.supplierName},

Please accept this official purchase order for the following item:

Item: ${reorder.productName}
SKU: ${reorder.productSku}
Barcode: ${reorder.productBarcode}
Quantity Ordered: ${reorder.suggestedQuantity} ${unit}
${reorder.notes ? `Special Notes: ${reorder.notes}\n` : ''}
Please reply to this email (${ownerEmail}) to confirm receipt, estimated ship date, and tracking details.

Thank you,
${ownerName}
${ownerEmail}
  `.trim();

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline;">
      <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0;">ORDER PLACED</h1>
    </div>
    <p style="font-size: 13px; color: #64748b; margin: 6px 0 0 0;">
      Purchase Order Reference: <strong>PO-${reorder.id.slice(0, 8).toUpperCase()}</strong> · ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}
    </p>
  </div>

  <p style="font-size: 14px; margin: 0 0 16px 0;">
    Dear <strong>${reorder.supplierName}</strong>,
  </p>
  <p style="font-size: 14px; margin: 0 0 20px 0; color: #334155;">
    Please accept this official purchase order for immediate replenishment:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
    <thead>
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 10px; text-align: left; font-weight: 600; color: #475569;">Description</th>
        <th style="padding: 10px; text-align: left; font-weight: 600; color: #475569;">SKU / Code</th>
        <th style="padding: 10px; text-align: right; font-weight: 600; color: #475569;">Order Qty</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 10px; font-weight: 600; color: #0f172a;">${reorder.productName}</td>
        <td style="padding: 12px 10px; font-family: monospace; color: #475569;">${reorder.productSku}</td>
        <td style="padding: 12px 10px; text-align: right; font-size: 15px; font-weight: 700; color: #0f172a;">${reorder.suggestedQuantity} ${unit}</td>
      </tr>
    </tbody>
  </table>

  ${
    reorder.notes
      ? `<div style="background-color: #f8fafc; border-left: 3px solid #64748b; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; color: #334155;">
          <strong>Order Instructions:</strong> ${reorder.notes}
         </div>`
      : ''
  }

  <p style="font-size: 13px; color: #475569; margin: 0 0 24px 0;">
    Please reply to this email (<a href="mailto:${ownerEmail}" style="color: #0f172a; font-weight: 600;">${ownerEmail}</a>) to confirm receipt and provide an estimated delivery date and invoice.
  </p>

  <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8;">
    Purchasing &amp; Operations · Direct contact: ${ownerEmail}
  </div>
</div>
  `.trim();

  return { subject, html, text };
}

/**
 * Mutex / queue lock helper to handle race conditions where two rapid scans arrive concurrently
 */
export class AsyncLock {
  private promise: Promise<void> = Promise.resolve();

  async acquire<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = this.promise.then(async () => {
      return await fn();
    });
    this.promise = next.then(
      () => {},
      () => {}
    );
    return next;
  }
}


/**
 * Pure and atomic scan handler that:
 * 1. Finds product by barcode
 * 2. Decrements availableStock by exactly 1 unit
 * 3. Checks if availableStock <= minRequiredStock
 * 4. If breached:
 *    - Checks if there's already an existing reorder request with status 'pending_approval'
 *    - If NO pending request exists: generates draft reorder and triggers owner approval draft email
 *    - If pending request already exists: prevents duplicate reorder creation!
 */
export function processBarcodeSaleSync(
  state: InventoryStoreState,
  barcode: string,
  appUrl: string = 'http://localhost:3000'
): ProcessScanResult {
  const cleanBarcode = barcode.trim();
  const timestamp = new Date().toISOString();
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Find product
  const productIndex = state.products.findIndex(
    (p) => p.barcode.toLowerCase() === cleanBarcode.toLowerCase()
  );

  if (productIndex === -1) {
    const record: ScanRecord = {
      id: scanId,
      timestamp,
      barcode: cleanBarcode,
      success: false,
      triggeredReorder: false,
      message: `Unknown barcode: "${cleanBarcode}". Item not found in catalog.`,
    };
    state.scanLogs.unshift(record);
    return {
      scanRecord: record,
      duplicatePrevented: false,
      status: 'unknown_barcode',
    };
  }

  const product = state.products[productIndex];
  const previousStock = product.availableStock;
  const newStock = previousStock - 1; // Exactly subtract 1 unit

  // Update product stock
  product.availableStock = newStock;
  product.updatedAt = timestamp;

  // Threshold check: Whenever a sale brings a product's available quantity to or below its minimum threshold
  const isBreached = newStock <= product.minRequiredStock;
  let reorderCreated: ReorderRequest | undefined;
  let duplicatePrevented = false;

  if (isBreached) {
    // Check if there is already a pending approval order for this product
    const existingPending = state.reorders.find(
      (r) => r.productId === product.id && r.status === 'pending_approval'
    );

    if (existingPending) {
      duplicatePrevented = true;
    } else {
      // Calculate deficit: Minimum Required Stock - Current Stock
      // If currentStock < minRequiredStock, deficit = min - current
      // If currentStock == minRequiredStock, deficit = 1 (or standard safety replenishment)
      const deficit = Math.max(1, product.minRequiredStock - newStock);
      const suggestedQuantity = deficit; // Default suggested quantity is the deficit

      const reorderId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const approvalToken = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const emailDraft = buildOwnerDraftEmail(
        {
          id: reorderId,
          productName: product.name,
          productBarcode: product.barcode,
          productSku: product.sku,
          currentStockAtTrigger: newStock,
          minThreshold: product.minRequiredStock,
          deficitQuantity: deficit,
          suggestedQuantity,
          supplierName: product.supplierName || 'Primary Supplier',
          supplierEmail: product.supplierEmail || 'supplier@example.com',
          approvalToken,
        },
        appUrl,
        product.unit
      );

      reorderCreated = {
        id: reorderId,
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode,
        productSku: product.sku,
        currentStockAtTrigger: newStock,
        minThreshold: product.minRequiredStock,
        deficitQuantity: deficit,
        suggestedQuantity,
        supplierId: product.supplierId || 'sup_default',
        supplierName: product.supplierName || 'Primary Supplier',
        supplierEmail: product.supplierEmail || 'supplier@example.com',
        ownerEmail: state.emailConfig.ownerEmail,
        status: 'pending_approval',
        approvalToken,
        draftCreatedAt: timestamp,
        draftEmailSubject: emailDraft.subject,
        draftEmailBody: emailDraft.html,
      };

      state.reorders.unshift(reorderCreated);

      // Create outgoing email message for owner's inbox
      const emailMessage: EmailMessage = {
        id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp,
        from: `${state.emailConfig.senderName} <${state.emailConfig.senderEmail}>`,
        to: state.emailConfig.ownerEmail,
        subject: emailDraft.subject,
        htmlContent: emailDraft.html,
        textContent: emailDraft.text,
        orderId: reorderId,
        type: 'draft_reorder_approval',
        status: 'delivered',
      };

      state.emailLogs.unshift(emailMessage);
    }
  }

  const recordMessage = isBreached
    ? duplicatePrevented
      ? `Sold 1 ${product.unit}. Stock dropped to ${newStock} (<= min ${product.minRequiredStock}). Note: A pending reorder draft is already awaiting your approval.`
      : `Sold 1 ${product.unit}. Stock reached threshold (${newStock}/${product.minRequiredStock}). Draft reorder email sent to owner for approval.`
    : `Sold 1 ${product.unit}. Stock updated from ${previousStock} to ${newStock}. Healthy level.`;

  const record: ScanRecord = {
    id: scanId,
    timestamp,
    barcode: cleanBarcode,
    success: true,
    productId: product.id,
    productName: product.name,
    previousStock,
    newStock,
    triggeredReorder: !!reorderCreated,
    reorderId: reorderCreated?.id,
    message: recordMessage,
  };

  state.scanLogs.unshift(record);

  return {
    scanRecord: record,
    product,
    reorderCreated,
    duplicatePrevented,
    status: 'success',
  };
}

/**
 * Approves a draft reorder:
 * 1. Updates status to 'approved'
 * 2. Generates 'ORDER PLACED' supplier email
 * 3. Transitions status to 'sent'
 */
export function approveReorderSync(
  state: InventoryStoreState,
  reorderIdOrToken: string,
  updatedQuantity?: number,
  notes?: string
): { success: boolean; reorder?: ReorderRequest; email?: EmailMessage; message: string } {
  const timestamp = new Date().toISOString();

  const reorder = state.reorders.find(
    (r) => r.id === reorderIdOrToken || r.approvalToken === reorderIdOrToken
  );

  if (!reorder) {
    return { success: false, message: 'Reorder request not found.' };
  }

  if (reorder.status !== 'pending_approval') {
    return {
      success: false,
      reorder,
      message: `Reorder is already in status '${reorder.status}'.`,
    };
  }

  // Update suggested quantity if owner adjusted it before approval
  if (typeof updatedQuantity === 'number' && updatedQuantity > 0) {
    reorder.suggestedQuantity = updatedQuantity;
  }
  if (notes) {
    reorder.notes = notes;
  }

  const product = state.products.find((p) => p.id === reorder.productId);
  const unit = product?.unit || 'units';

  // Mark approved
  reorder.status = 'approved';
  reorder.approvedAt = timestamp;

  // Build supplier email with subject "ORDER PLACED"
  const supplierEmail = buildSupplierOrderEmail(
    reorder,
    state.emailConfig.senderName,
    state.emailConfig.ownerEmail,
    unit
  );

  reorder.dispatchEmailSubject = supplierEmail.subject;
  reorder.dispatchEmailBody = supplierEmail.html;

  // Mark sent to supplier
  reorder.status = 'sent';
  reorder.sentAt = timestamp;

  // Log email to supplier
  const supplierEmailMsg: EmailMessage = {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp,
    from: `${state.emailConfig.senderName} <${state.emailConfig.ownerEmail}>`,
    to: reorder.supplierEmail,
    subject: supplierEmail.subject,
    htmlContent: supplierEmail.html,
    textContent: supplierEmail.text,
    orderId: reorder.id,
    type: 'order_placed_supplier',
    status: 'delivered',
  };

  state.emailLogs.unshift(supplierEmailMsg);

  return {
    success: true,
    reorder,
    email: supplierEmailMsg,
    message: `Order approved! "ORDER PLACED" email dispatched to supplier ${reorder.supplierEmail}.`,
  };
}
