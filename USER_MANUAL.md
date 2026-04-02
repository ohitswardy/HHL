# HardhatLedger — User Manual

## Getting Started

### Logging In
1. Open your browser and go to `http://localhost:5173` (or your deployed URL)
2. Enter your email and password
3. Click **Login**

You will be redirected to the Dashboard based on your assigned role.

---

## Dashboard

The Dashboard shows a real-time snapshot of your business:

| Metric | Description |
|---|---|
| Today's Sales | Total sales revenue for the current day |
| Pending POS | Sales transactions not yet completed |
| Low Stock | Products that have fallen below their reorder level |
| Total Clients | Number of active clients on record |
| Total Products | Number of active products in the catalog |

**Sales Trend** shows a 30-day chart of daily revenue.

**Recent Transactions** shows the last 10 sales.

---

## Inventory

### Products

**Viewing Products**
- Go to **Inventory → Products**
- Use the search bar to find by product name or SKU
- Filter by **Category**, **Supplier**, or **Status** (active/inactive)

**Adding a Product**
1. Click **Add Product**
2. Fill in: SKU, Name, Category, Supplier, Unit (e.g., bag, piece, meter)
3. Set **Cost Price** (your purchase cost) and **Base Selling Price** (default retail price)
4. Set **Reorder Level** — you will be alerted when stock falls below this
5. (Optional) Under **Tier Prices**, set custom prices per client tier
6. Click **Save**

**Editing a Product**
- Click the edit icon next to any product
- Update fields as needed and save

> Deactivating a product (toggle **Is Active**) hides it from POS without deleting it.

---

### Categories

**Adding a Category**
1. Go to **Inventory → Categories**
2. Click **Add Category**
3. Enter the category name
4. (Optional) Select a **Parent Category** to create a subcategory (e.g., Cement → OPC, PPC)
5. Click **Save**

---

### Stock Levels

**Viewing Stock**
- Go to **Inventory → Stock**
- See all products with their current **Quantity on Hand**, **Reserved**, and **Available** quantities

**Adjusting Stock Manually**
1. Click **Adjust Stock** on any product
2. Choose the type: **In** (add stock), **Out** (remove stock), or **Adjustment** (correction)
3. Enter the quantity and an optional note
4. Click **Confirm**

Every adjustment is recorded in the movement history.

---

### Stock Movements

- Go to **Inventory → Movements**
- See every stock change: sales, purchase order receipts, manual adjustments
- Filter by product, type, or date range

---

## Purchasing (Purchase Orders)

### Creating a Purchase Order
1. Go to **POS → Purchase Orders**
2. Click **Create PO**
3. Select the **Supplier**
4. Set the **Expected Delivery Date**
5. Add products: search for each product, set quantity ordered and unit cost
6. Click **Save** — the PO is created in **Draft** status

### Sending / Confirming a PO
- Change the PO status to **Sent** once submitted to the supplier

### Receiving Goods
1. When goods arrive, open the PO and click **Receive**
2. Enter the **quantity received** for each item (may differ from ordered quantity)
3. Click **Confirm Receipt**
4. Stock levels will automatically increase and a journal entry will be recorded

### PO Statuses
| Status | Meaning |
|---|---|
| Draft | Being prepared, not yet sent |
| Sent | Submitted to supplier |
| Partial | Some items received, waiting for the rest |
| Received | All items received |
| Cancelled | PO was cancelled |

---

## Point of Sale (POS)

### Making a Sale
1. Go to **POS → Sales**
2. Search for products and click **Add to Cart**
3. Adjust quantities as needed; apply per-item discounts if applicable
4. (Optional) Select a **Client** — their tier price will automatically apply
5. Choose **Fulfillment Type**: Pickup or Delivery
6. Click **Proceed to Payment**
7. Select payment method(s): Cash, Card, Bank Transfer, Check, or Credit
8. Enter the amount. Multiple payment methods can be combined (split payment)
9. Click **Complete Sale**

A receipt is generated and inventory is automatically updated.

### Payment Methods
| Method | When to use |
|---|---|
| Cash | Physical cash payment |
| Card | Credit/debit card (enter reference number) |
| Bank Transfer | Wire transfer (enter reference/confirmation number) |
| Check | Check payment (enter check number) |
| Credit | Charge to client's account (requires credit limit) |

### Printing a Receipt
- After completing a sale, click **Print Receipt** to download/print a PDF receipt
- Receipts can also be re-printed from the sales history

### Voiding a Sale
- Only **completed** sales can be voided
- Go to the sale, click **Void**, and confirm
- Inventory will be reversed automatically
- Voided sales remain in the system for audit purposes

---

## Clients

### Adding a Client
1. Go to **Clients**
2. Click **Add Client**
3. Fill in business name, contact person, phone, email, address
4. Assign a **Client Tier** — this determines their pricing
5. Set a **Credit Limit** if they will be purchasing on credit
6. Click **Save**

### Client Tiers
Client tiers allow you to set different prices for different customer groups. Go to **Settings → Client Tiers** to manage tiers.

Each tier can have:
- A **Discount %** applied to the base price
- Or a **Markup %** (for special pricing above base)
- Or **specific per-product prices** set on each product

---

## Suppliers

### Adding a Supplier
1. Go to **Suppliers**
2. Click **Add Supplier**
3. Fill in name, contact details, address, and payment terms
4. Click **Save**

---

## Accounting

### Chart of Accounts
- Go to **Accounting → Chart of Accounts**
- View the hierarchical account structure (Assets, Liabilities, Equity, Revenue, Expenses)
- Each account shows its current **balance**

### Journal Entries
- Go to **Accounting → Journal Entries**
- All journal entries are system-generated (sales, PO receipts automatically create entries)
- Filter by date range or reference type

### Financial Reports

| Report | Location | Purpose |
|---|---|---|
| Income Statement | Accounting → Reports → Income Statement | Revenue vs. expenses, net income |
| Balance Sheet | Accounting → Reports → Balance Sheet | Assets, liabilities, equity at a point in time |
| Cash Flow | Accounting → Reports → Cash Flow | Cash inflows and outflows |
| Client Statements | Accounting → Reports → Client Statements | AR aging per client |

**To generate a report:**
1. Select the date range (or as-of date for Balance Sheet)
2. Click **Generate**

---

## User Management (Super Admin Only)

### Adding a User
1. Go to **Settings → Users**
2. Click **Add User**
3. Enter name, email, password
4. Assign a **Role**: Sales Clerk, Manager, Admin, or Super Admin
5. Click **Save**

### Deactivating a User
- Click the toggle next to a user to deactivate their account
- Deactivated users cannot log in but their historical records are preserved

---

## Frequently Asked Questions

**Q: A client's price is different from what I expected.**
A: Prices are resolved by client tier. Check the client's assigned tier, and verify the product's tier prices under Inventory → Products.

**Q: A product doesn't appear in POS search.**
A: The product may be set to inactive. Go to Inventory → Products and check the product's status.

**Q: I made a sale with the wrong client. Can I fix it?**
A: Void the original sale and create a new one. Voided sales are kept for audit.

**Q: Stock didn't update after receiving a purchase order.**
A: Ensure you clicked **Confirm Receipt** — changing the PO status to "Sent" alone does not update stock.

**Q: I can't access the Accounting module.**
A: The Accounting module requires Manager, Admin, or Super Admin role. Contact your Super Admin to update your permissions.
