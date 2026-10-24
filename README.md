# StockPilot - Small Business Inventory & Replenishment Dashboard

StockPilot is an internal operations tool built for small business owners transitioning from manual pen-and-paper or spreadsheet tracking to an automated, barcode-driven inventory replenishment system.

---

## 1. Architectural Decisions & Technology Choices

- **Runtime & Full-Stack Engine: Express 4 + Vite + React 19 + TypeScript**
  - *Why:* Small retail businesses (coffee shops, bakeries, boutique grocers) need both instant client-side POS responsiveness (offline-resilient camera & USB scanner loops) and authoritative server-side locking to prevent concurrent scan race conditions. Express handles transactional email webhooks, direct token approval links, and audit logs cleanly while Vite provides fast bundling.
- **Data Model & In-Memory Store with REST APIs**:
  - *Why:* Avoids external database configuration overhead for initial setup while enforcing clean repository boundaries. Products, suppliers, orders, and emails are structured in modular TypeScript models ready for seamless SQLite or PostgreSQL persistence.
- **Race Condition Prevention via Async Mutex Lock**:
  - *Why:* Rapid consecutive barcode scans (e.g. scanning multiple items quickly with a handheld laser) can cause read-modify-write races. An asynchronous queue lock guarantees every scan decrements stock atomically and evaluates threshold breaches sequentially.
- **Transactional Email Service Adapter**:
  - *Why:* Follows the Provider pattern (`ITransactionalEmailProvider`). In-app delivery logs all outgoing emails with interactive rendered HTML previews for sandbox testing, while Resend or SMTP can be configured via environment variables or the in-app settings modal without hardcoding credentials.

---

## 2. Core Business Rules & Domain Logic

1. **Reorder Logic & Categorization**:
   - **Items to Reorder Today** (`Current Stock < Minimum Required Stock`):
     - `Deficit = Minimum Required Stock - Current Stock`
     - Action: `"Reorder [Quantity]"`
     - Triggers automated draft reorder email sent to the owner's email (`careofassistu@gmail.com`).
     - **Supplier is NOT contacted at this stage.**
   - **Items in Healthy Stock** (`Current Stock >= Minimum Required Stock`):
     - `Surplus Cushion = Current Stock - Minimum Required Stock`
     - Action: `"No reorder"`

2. **Duplicate Request Prevention**:
   - When a sale brings an item to or below its threshold, the system checks whether a reorder request is already in `pending_approval` for that product.
   - If a pending request already exists, stock is still decremented by 1, but duplicate drafts are suppressed.

3. **Owner Approval & Supplier Dispatch**:
   - The owner can review, edit suggested order quantities, and approve drafts via the UI or direct one-click email token links.
   - Upon owner approval, the system sends an email to the supplier with the subject line **"ORDER PLACED"** and records the order transition (`pending_approval` &rarr; `approved` &rarr; `sent`).
   - When the shipment arrives, the owner can click **"Restock"** to increment available inventory.

---

## 3. Data Models

```typescript
// Product Definition
interface Product {
  id: string;
  barcode: string;       // UPC/EAN or custom barcode
  sku: string;
  name: string;
  category: string;
  unit: string;          // e.g. "bags", "cartons", "sleeves"
  availableStock: number;
  minRequiredStock: number; // Reorder point threshold
  unitCost: number;
  unitPrice: number;
  supplierId: string;
  supplierName: string;
  supplierEmail: string; // Contact email for supplier POs
  updatedAt: string;
}

// Supplier Definition
interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  leadTimeDays: number;
  notes?: string;
}

// Reorder Request & Purchase Order
interface ReorderRequest {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  productSku: string;
  currentStockAtTrigger: number;
  minThreshold: number;
  deficitQuantity: number;    // Min Threshold - Current Stock
  suggestedQuantity: number;  // Editable by owner prior to approval
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  ownerEmail: string;
  status: 'pending_approval' | 'approved' | 'sent' | 'cancelled' | 'fulfilled';
  approvalToken: string;
  draftCreatedAt: string;
  approvedAt?: string;
  sentAt?: string;
  notes?: string;
}
```

---

## 4. Setup & Running the Application

### Prerequisites
- Node.js 18+ and npm installed.

### Development Mode
```bash
# Install dependencies
npm install

# Start the full-stack development server on port 3000
npm run dev
```

Visit `http://localhost:3000` to open the StockPilot dashboard.

### Running Automated Tests
```bash
# Execute unit test suite with Vitest
npm test
```
The test suite covers:
1. Exact single-unit stock decrements upon scan.
2. Deficit calculation and suggested quantity on threshold breach.
3. Inventory categorization into "Items to Reorder Today" vs "Items in Healthy Stock".
4. Duplicate pending reorder request suppression for the same product.
5. Unknown barcode graceful handling.
6. Race-condition concurrency locking across parallel rapid scans.
7. Approval workflow transitioning to "ORDER PLACED" email dispatch.

---

## 5. Email Configuration Steps

StockPilot supports both an interactive in-app sandbox (zero setup required) and external transactional email providers:

1. **In-App Delivery (Default)**:
   - All draft approval emails to the owner and "ORDER PLACED" emails to suppliers are recorded in the **Email Dispatch** tab.
   - You can inspect rendered HTML, verify headers, copy approval links, and approve orders directly.
2. **Resend API Integration (Optional for Live External Sending)**:
   - Obtain an API key from [resend.com](https://resend.com).
   - In the **Email Dispatch** tab, click **Configure SMTP / API** (or set `RESEND_API_KEY` in your `.env` file).
   - Select **Resend API** from the provider dropdown and paste your key.
