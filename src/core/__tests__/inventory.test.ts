import { describe, it, expect, beforeEach } from 'vitest';
import {
  categorizeInventory,
  processBarcodeSaleSync,
  approveReorderSync,
  AsyncLock,
  InventoryStoreState,
} from '../inventory';
import { Product, ReorderRequest } from '../types';

describe('Inventory Domain & Sales Logic', () => {
  let mockState: InventoryStoreState;
  const mockProduct: Product = {
    id: 'prod_coffee_01',
    barcode: '012345678905',
    sku: 'COF-ETH-250G',
    name: 'Ethiopian Yirgacheffe Beans (250g)',
    category: 'Coffee Beans',
    unit: 'bags',
    availableStock: 5,
    minRequiredStock: 4, // Reorder point
    unitCost: 8.5,
    unitPrice: 16.0,
    supplierId: 'sup_roaster_01',
    supplierEmail: 'orders@mountainroasters.com',
    supplierName: 'Mountain Roasters Supply',
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockState = {
      products: [JSON.parse(JSON.stringify(mockProduct))],
      reorders: [],
      scanLogs: [],
      emailLogs: [],
      emailConfig: {
        provider: 'in_app',
        ownerEmail: 'careofassistu@gmail.com',
        senderEmail: 'inventory@stockpilot.local',
        senderName: 'StockPilot Ops',
      },
    };
  });

  it('1. Decrements available stock by 1 when scanned while stock is healthy', () => {
    // Initial stock is 5, min is 4
    const result = processBarcodeSaleSync(mockState, '012345678905');

    expect(result.status).toBe('success');
    expect(result.scanRecord.previousStock).toBe(5);
    expect(result.scanRecord.newStock).toBe(4);
    expect(mockState.products[0].availableStock).toBe(4);
    // At 4, it reaches the threshold (stock <= minRequiredStock), so reorder draft is generated
    expect(result.reorderCreated).toBeDefined();
    expect(mockState.reorders).toHaveLength(1);
    expect(mockState.reorders[0].status).toBe('pending_approval');
  });

  it('2. Correctly calculates deficit and sets suggested order quantity on breach', () => {
    // Set stock to 3, min to 5. After scan, stock becomes 2.
    mockState.products[0].availableStock = 3;
    mockState.products[0].minRequiredStock = 5;

    const result = processBarcodeSaleSync(mockState, '012345678905');

    expect(mockState.products[0].availableStock).toBe(2);
    expect(result.reorderCreated).toBeDefined();
    // Deficit = Min (5) - Current (2) = 3
    expect(result.reorderCreated?.deficitQuantity).toBe(3);
    expect(result.reorderCreated?.suggestedQuantity).toBe(3);
    expect(result.reorderCreated?.ownerEmail).toBe('careofassistu@gmail.com');
    expect(result.reorderCreated?.supplierEmail).toBe('orders@mountainroasters.com');
  });

  it('3. Categorizes stock into "Items to Reorder Today" and "Items in Healthy Stock"', () => {
    const products: Product[] = [
      {
        ...mockProduct,
        id: 'p1',
        availableStock: 2,
        minRequiredStock: 6, // Deficit 4
      },
      {
        ...mockProduct,
        id: 'p2',
        barcode: '999888777666',
        name: 'Colombian Supremo',
        availableStock: 10,
        minRequiredStock: 5, // Surplus 5
      },
    ];

    const categorization = categorizeInventory(products, []);

    expect(categorization.reorderToday).toHaveLength(1);
    expect(categorization.reorderToday[0].product.id).toBe('p1');
    expect(categorization.reorderToday[0].deficit).toBe(4);
    expect(categorization.reorderToday[0].action).toBe('Reorder 4 bags');

    expect(categorization.healthyStock).toHaveLength(1);
    expect(categorization.healthyStock[0].product.id).toBe('p2');
    expect(categorization.healthyStock[0].surplus).toBe(5);
    expect(categorization.healthyStock[0].action).toBe('No reorder');
  });

  it('4. Prevents duplicate pending reorder requests for the same product', () => {
    // Initial stock: 5, min: 4
    // First scan brings stock from 5 to 4 (<= 4). Creates pending reorder #1
    const scan1 = processBarcodeSaleSync(mockState, '012345678905');
    expect(mockState.products[0].availableStock).toBe(4);
    expect(scan1.reorderCreated).toBeDefined();
    expect(scan1.duplicatePrevented).toBe(false);
    expect(mockState.reorders).toHaveLength(1);

    // Second scan immediately follows, bringing stock from 4 to 3.
    // Stock is still <= min threshold, but reorder #1 is still pending approval!
    const scan2 = processBarcodeSaleSync(mockState, '012345678905');
    expect(mockState.products[0].availableStock).toBe(3);
    expect(scan2.reorderCreated).toBeUndefined();
    expect(scan2.duplicatePrevented).toBe(true);
    // Still only 1 reorder in list
    expect(mockState.reorders).toHaveLength(1);
  });

  it('5. Handles unknown barcodes gracefully', () => {
    const result = processBarcodeSaleSync(mockState, 'UNKNOWN_CODE_999');
    expect(result.status).toBe('unknown_barcode');
    expect(result.scanRecord.success).toBe(false);
    expect(result.scanRecord.message).toContain('Unknown barcode');
    expect(mockState.products[0].availableStock).toBe(5); // Unchanged
  });

  it('6. Handles race condition edge case: multiple concurrent scans on the same product', async () => {
    const lock = new AsyncLock();
    mockState.products[0].availableStock = 10;
    mockState.products[0].minRequiredStock = 4;

    // Simulate 5 simultaneous barcode scans racing in parallel
    const scanPromises = Array.from({ length: 5 }, () =>
      lock.acquire(async () => {
        return processBarcodeSaleSync(mockState, '012345678905');
      })
    );

    const results = await Promise.all(scanPromises);

    // Exactly 5 scans should have succeeded
    expect(results.filter((r) => r.status === 'success')).toHaveLength(5);
    // Stock should be precisely 10 - 5 = 5
    expect(mockState.products[0].availableStock).toBe(5);
    expect(mockState.scanLogs).toHaveLength(5);
  });

  it('7. Handles approval workflow: owner approves draft, dispatches "ORDER PLACED" email to supplier', () => {
    // Bring stock down to trigger reorder
    mockState.products[0].availableStock = 4;
    processBarcodeSaleSync(mockState, '012345678905');

    const pendingOrder = mockState.reorders[0];
    expect(pendingOrder.status).toBe('pending_approval');
    expect(mockState.emailLogs).toHaveLength(1);
    expect(mockState.emailLogs[0].type).toBe('draft_reorder_approval');
    expect(mockState.emailLogs[0].to).toBe('careofassistu@gmail.com');

    // Owner approves with edited order quantity (e.g. increase from deficit to round pack size)
    const approval = approveReorderSync(
      mockState,
      pendingOrder.id,
      12, // adjusted quantity
      'Please deliver by Wednesday afternoon.'
    );

    expect(approval.success).toBe(true);
    expect(approval.reorder?.status).toBe('sent');
    expect(approval.reorder?.suggestedQuantity).toBe(12);

    // Verify supplier email dispatch
    expect(mockState.emailLogs).toHaveLength(2);
    const supplierEmail = mockState.emailLogs[0]; // Newest email is unshifted to front
    expect(supplierEmail.type).toBe('order_placed_supplier');
    expect(supplierEmail.to).toBe('orders@mountainroasters.com');
    expect(supplierEmail.subject).toContain('ORDER PLACED');
    expect(supplierEmail.textContent).toContain('ORDER PLACED');
    expect(supplierEmail.textContent).toContain('Quantity Ordered: 12 bags');
    expect(supplierEmail.textContent).toContain('Please deliver by Wednesday afternoon.');
  });
});
