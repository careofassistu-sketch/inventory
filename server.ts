import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  InventoryStoreState,
  Product,
  ReorderRequest,
  Supplier,
  EmailConfig,
} from './src/core/types';
import {
  categorizeInventory,
  processBarcodeSaleSync,
  approveReorderSync,
  AsyncLock,
} from './src/core/inventory';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from './src/core/seedData';
import { defaultEmailService } from './src/core/emailService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// In-Memory Database for local operations
const store: InventoryStoreState & { suppliers: Supplier[] } = {
  products: [...INITIAL_PRODUCTS],
  suppliers: [...INITIAL_SUPPLIERS],
  reorders: [],
  scanLogs: [],
  emailLogs: [],
  emailConfig: {
    provider: 'in_app',
    ownerEmail: 'careofassistu@gmail.com', // Pre-populated from user metadata
    senderEmail: 'orders@stockpilot.ops',
    senderName: 'StockPilot Operations',
  },
};

// Generate initial pending draft reorders for products that start below threshold
for (const prod of store.products) {
  if (prod.availableStock < prod.minRequiredStock) {
    const deficit = prod.minRequiredStock - prod.availableStock;
    const reorderId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const approvalToken = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const reorder: ReorderRequest = {
      id: reorderId,
      productId: prod.id,
      productName: prod.name,
      productBarcode: prod.barcode,
      productSku: prod.sku,
      currentStockAtTrigger: prod.availableStock,
      minThreshold: prod.minRequiredStock,
      deficitQuantity: deficit,
      suggestedQuantity: deficit,
      supplierId: prod.supplierId,
      supplierName: prod.supplierName,
      supplierEmail: prod.supplierEmail,
      ownerEmail: store.emailConfig.ownerEmail,
      status: 'pending_approval',
      approvalToken,
      draftCreatedAt: new Date().toISOString(),
      draftEmailSubject: `[APPROVAL NEEDED] Low Stock Reorder Draft: ${prod.name}`,
      draftEmailBody: `<p>Product <strong>${prod.name}</strong> is currently at ${prod.availableStock} ${prod.unit} (minimum ${prod.minRequiredStock} ${prod.unit}). Deficit: ${deficit} ${prod.unit}.</p>`,
    };

    store.reorders.push(reorder);
    store.emailLogs.push({
      id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      from: `${store.emailConfig.senderName} <${store.emailConfig.senderEmail}>`,
      to: store.emailConfig.ownerEmail,
      subject: reorder.draftEmailSubject,
      htmlContent: reorder.draftEmailBody,
      textContent: `Approval needed for ${prod.name}. Deficit: ${deficit}.`,
      orderId: reorderId,
      type: 'draft_reorder_approval',
      status: 'delivered',
    });
  }
}

// Mutex lock to serialize sales scans & eliminate race condition drops
const scanMutex = new AsyncLock();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());

  // --- API ROUTES ---

  // Health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get complete dashboard state
  app.get('/api/dashboard', (_req: Request, res: Response) => {
    const categorization = categorizeInventory(store.products, store.reorders);
    res.json({
      products: store.products,
      suppliers: store.suppliers,
      reorders: store.reorders,
      scanLogs: store.scanLogs,
      emailLogs: store.emailLogs,
      emailConfig: store.emailConfig,
      categorization,
    });
  });

  // Products CRUD
  app.get('/api/products', (_req: Request, res: Response) => {
    res.json(store.products);
  });

  app.post('/api/products', (req: Request, res: Response) => {
    const {
      barcode,
      sku,
      name,
      category,
      unit,
      availableStock,
      minRequiredStock,
      unitCost,
      unitPrice,
      supplierId,
      supplierEmail,
      supplierName,
    } = req.body;

    if (!barcode || !name || typeof minRequiredStock !== 'number') {
      res.status(400).json({ error: 'Barcode, Name, and Minimum Required Stock are mandatory.' });
      return;
    }

    const cleanBarcode = String(barcode).trim();
    // Check barcode uniqueness
    if (store.products.some((p) => p.barcode.toLowerCase() === cleanBarcode.toLowerCase())) {
      res.status(409).json({ error: `Barcode ${cleanBarcode} already exists in the catalog.` });
      return;
    }

    const newProduct: Product = {
      id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      barcode: cleanBarcode,
      sku: (sku || `SKU-${cleanBarcode.slice(-4)}`).trim().toUpperCase(),
      name: name.trim(),
      category: category?.trim() || 'General Inventory',
      unit: unit?.trim() || 'units',
      availableStock: Math.max(0, Number(availableStock) || 0),
      minRequiredStock: Math.max(0, Number(minRequiredStock) || 0),
      unitCost: Number(unitCost) || 0,
      unitPrice: Number(unitPrice) || 0,
      supplierId: supplierId || 'sup_default',
      supplierName: supplierName || 'Default Supplier',
      supplierEmail: supplierEmail || 'supplier@example.com',
      updatedAt: new Date().toISOString(),
    };

    store.products.unshift(newProduct);

    // If initial stock is below minimum, generate draft reorder immediately
    if (newProduct.availableStock < newProduct.minRequiredStock) {
      const deficit = newProduct.minRequiredStock - newProduct.availableStock;
      const reorderId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const approvalToken = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const reorder: ReorderRequest = {
        id: reorderId,
        productId: newProduct.id,
        productName: newProduct.name,
        productBarcode: newProduct.barcode,
        productSku: newProduct.sku,
        currentStockAtTrigger: newProduct.availableStock,
        minThreshold: newProduct.minRequiredStock,
        deficitQuantity: deficit,
        suggestedQuantity: deficit,
        supplierId: newProduct.supplierId,
        supplierName: newProduct.supplierName,
        supplierEmail: newProduct.supplierEmail,
        ownerEmail: store.emailConfig.ownerEmail,
        status: 'pending_approval',
        approvalToken,
        draftCreatedAt: new Date().toISOString(),
        draftEmailSubject: `[APPROVAL NEEDED] Low Stock Reorder Draft: ${newProduct.name}`,
        draftEmailBody: `<p>Product <strong>${newProduct.name}</strong> is currently at ${newProduct.availableStock} ${newProduct.unit} (minimum ${newProduct.minRequiredStock} ${newProduct.unit}). Deficit: ${deficit} ${newProduct.unit}.</p>`,
      };

      store.reorders.unshift(reorder);
    }

    res.status(201).json(newProduct);
  });

  app.put('/api/products/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const index = store.products.findIndex((p) => p.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const current = store.products[index];
    const updated: Product = {
      ...current,
      ...req.body,
      id: current.id,
      availableStock:
        typeof req.body.availableStock === 'number'
          ? Math.max(0, req.body.availableStock)
          : current.availableStock,
      minRequiredStock:
        typeof req.body.minRequiredStock === 'number'
          ? Math.max(0, req.body.minRequiredStock)
          : current.minRequiredStock,
      updatedAt: new Date().toISOString(),
    };

    store.products[index] = updated;
    res.json(updated);
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const initialLen = store.products.length;
    store.products = store.products.filter((p) => p.id !== id);
    if (store.products.length === initialLen) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    // Also remove pending reorders for deleted product
    store.reorders = store.reorders.filter((r) => r.productId !== id);
    res.json({ success: true, message: 'Product deleted.' });
  });

  // Barcode Sales Scanning Endpoint (with concurrency mutex lock)
  app.post('/api/scan', async (req: Request, res: Response) => {
    const { barcode } = req.body;
    if (!barcode) {
      res.status(400).json({ error: 'Barcode is required.' });
      return;
    }

    // Acquire mutex lock to prevent race conditions during rapid consecutive scans
    const result = await scanMutex.acquire(async () => {
      return processBarcodeSaleSync(store, barcode, APP_URL);
    });

    res.json(result);
  });

  // Reorders Endpoints
  app.get('/api/reorders', (_req: Request, res: Response) => {
    res.json(store.reorders);
  });

  // Edit suggested quantity or notes on a pending reorder
  app.put('/api/reorders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { suggestedQuantity, notes } = req.body;

    const reorder = store.reorders.find((r) => r.id === id);
    if (!reorder) {
      res.status(404).json({ error: 'Reorder request not found.' });
      return;
    }

    if (reorder.status !== 'pending_approval') {
      res.status(400).json({ error: 'Cannot edit reorder that is already approved or sent.' });
      return;
    }

    if (typeof suggestedQuantity === 'number' && suggestedQuantity > 0) {
      reorder.suggestedQuantity = Math.floor(suggestedQuantity);
    }
    if (notes !== undefined) {
      reorder.notes = String(notes);
    }

    res.json(reorder);
  });

  // Owner Approves Order (via App button or direct POST)
  app.post('/api/reorders/:id/approve', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { suggestedQuantity, notes } = req.body;

    const result = approveReorderSync(store, id, suggestedQuantity, notes);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    // Also dispatch via transactional email service
    if (result.email) {
      await defaultEmailService.send(
        {
          to: result.email.to,
          subject: result.email.subject,
          html: result.email.htmlContent,
          text: result.email.textContent,
          type: 'order_placed_supplier',
          orderId: id,
        },
        store.emailConfig
      );
    }

    res.json(result);
  });

  // Direct Approval Link Handler (clicked from owner email)
  app.get('/api/approve/:token', async (req: Request, res: Response) => {
    const { token } = req.params;
    const result = approveReorderSync(store, token);

    if (result.success && result.email) {
      await defaultEmailService.send(
        {
          to: result.email.to,
          subject: result.email.subject,
          html: result.email.htmlContent,
          text: result.email.textContent,
          type: 'order_placed_supplier',
          orderId: result.reorder?.id,
        },
        store.emailConfig
      );
    }

    // Redirect to frontend with status query param
    const targetUrl = result.success
      ? `/?approved=true&po=${result.reorder?.id}`
      : `/?approval_error=${encodeURIComponent(result.message)}`;

    res.redirect(targetUrl);
  });

  // Mark received / Restock inventory
  app.post('/api/reorders/:id/receive', (req: Request, res: Response) => {
    const { id } = req.params;
    const reorder = store.reorders.find((r) => r.id === id);
    if (!reorder) {
      res.status(404).json({ error: 'Reorder not found.' });
      return;
    }

    const product = store.products.find((p) => p.id === reorder.productId);
    if (!product) {
      res.status(404).json({ error: 'Associated product not found.' });
      return;
    }

    // Add replenished stock to availableStock
    const addedUnits = reorder.suggestedQuantity;
    product.availableStock += addedUnits;
    product.updatedAt = new Date().toISOString();
    reorder.status = 'fulfilled';

    res.json({
      success: true,
      product,
      reorder,
      message: `Restocked ${addedUnits} ${product.unit} for "${product.name}". Available stock is now ${product.availableStock}.`,
    });
  });

  // Emails audit log
  app.get('/api/emails', (_req: Request, res: Response) => {
    res.json(store.emailLogs);
  });

  // Email Config
  app.get('/api/emails/config', (_req: Request, res: Response) => {
    res.json(store.emailConfig);
  });

  app.post('/api/emails/config', (req: Request, res: Response) => {
    const { ownerEmail, senderEmail, senderName, provider, resendApiKey } = req.body;
    if (ownerEmail) store.emailConfig.ownerEmail = ownerEmail.trim();
    if (senderEmail) store.emailConfig.senderEmail = senderEmail.trim();
    if (senderName) store.emailConfig.senderName = senderName.trim();
    if (provider) store.emailConfig.provider = provider;
    if (resendApiKey !== undefined) store.emailConfig.resendApiKey = resendApiKey;

    res.json(store.emailConfig);
  });

  // Suppliers CRUD
  app.get('/api/suppliers', (_req: Request, res: Response) => {
    res.json(store.suppliers);
  });

  app.post('/api/suppliers', (req: Request, res: Response) => {
    const { name, email, phone, leadTimeDays, notes } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: 'Supplier name and email are required.' });
      return;
    }

    const newSupplier: Supplier = {
      id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      leadTimeDays: Number(leadTimeDays) || 3,
      notes: notes?.trim(),
    };

    store.suppliers.push(newSupplier);
    res.status(201).json(newSupplier);
  });

  // Reset to initial seed data
  app.post('/api/reset', (_req: Request, res: Response) => {
    store.products = [...INITIAL_PRODUCTS];
    store.suppliers = [...INITIAL_SUPPLIERS];
    store.reorders = [];
    store.scanLogs = [];
    store.emailLogs = [];
    res.json({ success: true, message: 'Catalog reset to sample small business data.' });
  });

  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`StockPilot operations server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
