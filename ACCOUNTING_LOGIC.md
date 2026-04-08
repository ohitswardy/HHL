# HardhatLedger — Accounting System Logic & Specifications
 
**VAT Rate:** 12% (Philippines)

---

## Table of Contents
1. [Overview](#overview)
2. [Chart of Accounts](#chart-of-accounts)
3. [Income Recognition](#income-recognition)
4. [Cost of Goods Sold (COGS)](#cost-of-goods-sold)
5. [VAT Management](#vat-management)
6. [Balance Sheet Components](#balance-sheet-components)
7. [Journal Entry Patterns](#journal-entry-patterns)
8. [Financial Statement Generation](#financial-statement-generation)
9. [Compliance & Validation](#compliance--validation)

---

## Overview

### Accounting Equation
```
ASSETS = LIABILITIES + SHAREHOLDERS' EQUITY

Balance Sheet Components:
├── ASSETS (Left Side)
│   ├── Current Assets
│   │   ├── Cash & Cash Equivalents (Banks + Physical Cash)
│   │   ├── Accounts Receivable (A/R)
│   │   ├── VAT on Purchases (Input VAT Asset)
│   │   └── Inventory
│   └── Non-Current Assets
│
├── LIABILITIES (Right Side - Top)
│   ├── Current Liabilities
│   │   └── VAT Payable (Output VAT Liability)
│   └── Non-Current Liabilities
│
└── SHAREHOLDERS' EQUITY (Right Side - Bottom)
    ├── Share Capital
    └── Retained Earnings (includes Net Income)
```

### Income Statement (P&L) Flow
```
INCOME
├── Sales - NON-VAT (0% tax)
├── Sales - VATable ÷ 1.12 (taxable amount only)
│   └── VAT from Sales @ 12% (tracked separately → Liability)
└── Total Income

LESS: COST OF SALES
├── COGS - NON-VAT (actual cost)
├── COGS - VAT ÷ 1.12 (taxable cost only)
│   └── VAT from Purchases @ 12% (tracked separately → Asset)
└── Total COGS

= GROSS PROFIT

LESS: EXPENSES
├── Operating Expenses
├── Administrative Expenses
└── Other Expenses

= NET EARNINGS
```

---

## Chart of Accounts

### Master Account Structure
All accounts organized by **type** and **nature** (normal debit vs credit):

#### ASSETS (Normal Debit Balance)
```
10xx  CURRENT ASSETS
├── 1001  Cash on Hand
├── 1010  Bank - CBS Account (TMHT)
├── 1020  Bank - MBT Account (TMHT)
├── 1025  Bank - Online Transfer (TMHT/RJ)
├── 1030  Bank - PNB Accounts (All entities)
├── 1040  Bank - BDO Accounts
├── 1050  Bank - Other Banks
├── 1100  Accounts Receivable (A/R)
├── 1120  Allowance for Bad Debts (contra account)
├── 1200  Inventory - Raw Materials/Products
├── 1250  Inventory - Finished Goods
└── 1300  Prepaid Expenses

11xx  VAT & TAX ASSETS
├── 1310  VAT on Purchases (Input VAT)
│         Account Code: VAT-IN
│         Debit Normal ✓
│         Description: Accumulates 12% VAT from supplier purchases
│         Formula: COGS VAT × 0.12
└── 1320  Other Tax Receivables

15xx  FIXED ASSETS
├── 1500  Property, Plant & Equipment
└── 1550  Accumulated Depreciation (contra)

19xx  OTHER ASSETS
└── 1900  Goodwill, Long-term Investments
```

#### LIABILITIES (Normal Credit Balance)
```
20xx  CURRENT LIABILITIES
├── 2001  Accounts Payable (A/P)
├── 2010  Short-term Loans
└── 2100  VAT Payable (Output VAT)
          Account Code: VAT-OUT
          Credit Normal ✓
          Description: Accumulates 12% VAT from customer sales
          Formula: (VATable Sales / 1.12) × 0.12

21xx  OTHER CURRENT LIABILITIES
├── 2110  Income Tax Payable
├── 2120  Employee Withholdings
└── 2130  Accrued Expenses
```

#### SHAREHOLDERS' EQUITY (Normal Credit Balance)
```
30xx  EQUITY
├── 3000  Share Capital (Cash contributed)
├── 3100  Retained Earnings (P&L carryover)
├── 3200  Dividend Disbursed (negative equity)
└── 3300  Other Comprehensive Income
```

#### REVENUE (Normal Credit Balance)
```
40xx  OPERATING REVENUE
├── 4010  Sales - NON-VAT Retail (0% VAT)
│         Account Code: SALES-NONVAT
│         Credit Normal ✓
│         Recognition: Full receipt amount (no adjustment)
│         Example: Item sells for ₱460 (inclusive) → Entire ₱460 recorded
│
├── 4020  Sales - VATable / Wholesale (12% VAT)
│         Account Code: SALES-VAT
│         Credit Normal ✓
│         Recognition: Amount ÷ 1.12 = taxable amount recorded
│         VAT portion tracked separately → VAT Payable liability
│         Example: Item sells for ₱560 (inclusive of 12% VAT)
│                  → Record Revenue: ₱500 (560 ÷ 1.12)
│                  → Track VAT: ₱60 liability
│
└── 4030  Other Operating Revenue
```

#### COST OF SALES (Normal Debit Balance)
```
50xx  COST OF GOODS SOLD
├── 5010  COGS - NON-VAT
│         Account Code: COGS-NONVAT
│         Debit Normal ✓
│         Source: Supplier purchase orders tagged "NON-VAT"
│         Formula: Sum of all confirmed NON-VAT PO item costs
│         Recognition: On PO receipt confirmation
│
├── 5020  COGS - VAT (Taxable Purchases)
│         Account Code: COGS-VAT
│         Debit Normal ✓
│         Source: Supplier purchase orders tagged "VAT"
│         Formula: (PO Amount ÷ 1.12) posted; VAT portion → VAT Asset
│         Recognition: On PO receipt confirmation
│         Example: Purchase invoice ₱560 (inclusive of 12% VAT)
│                  → Record COGS: ₱500 (560 ÷ 1.12)
│                  → Create VAT Asset: ₱60 → VAT on Purchases (1310)
│
└── 5030  Inventory Adjustment
```

#### EXPENSES (Normal Debit Balance)
```
60xx  OPERATING EXPENSES
├── 6010  Salaries & Wages
├── 6020  Utilities (Electricity, Water, Gas)
├── 6030  Rent or Lease Payments
├── 6040  Office Expenses & Supplies
├── 6050  Repairs & Maintenance
├── 6060  Shipping & Delivery Expenses
├── 6070  Insurance Expenses
├── 6080  Bank Charges & Fees
└── 6090  Depreciation Expense

61xx  ADMINISTRATIVE EXPENSES
├── 6110  Salaries - General & Admin
├── 6120  Legal & Professional Fees
├── 6130  Dues & Subscriptions
├── 6140  Advertising & Promotional
└── 6150  Travel Expenses

62xx  OTHER EXPENSES
├── 6210  Bad Debts Expense
├── 6220  Loss on Disposal of Assets
├── 6230  Reconciliation Discrepancies
│         Account Code: DISC-ADJUST
│         Debit Normal ✓
│         Use: For unexplained variances in inventory or cash
│
└── 6240  Interest Expense
```

---

## Income Recognition

### Sales Transactions (Point of Sale)

#### Case 1: NON-VAT Sale
**Scenario:** Item sells for ₱460 (no VAT included, retail selling to walk-in)

```
Transaction Entry:
├── Selling Price: ₱460 (final price, no VAT breakdown)
├── Is VATable: NO
└── Result: 
    └── Revenue Account 4010 (Sales - NON-VAT): ₱460 credit
        └── Full amount recorded as income
        └── NO VAT liability created
        └── Customer pays exactly what was sold

Journal Entry Example:
┌─────────────────────────────────┐
│ DR Cash/Bank/A/R    ₱460        │
│   CR Sales-NONVAT             │
│      (4010)         ₱460        │
└─────────────────────────────────┘
```

#### Case 2: VATable Sale
**Scenario:** Item sells for ₱560 total (includes 12% VAT, wholesale to contractor)

```
Breakdown:
├── Selling Price (Inclusive): ₱560
├── VAT Rate: 12%
├── Calculation: ₱560 ÷ 1.12 = ₱500 (taxable amount)
├── VAT Amount: ₱560 - ₱500 = ₱60
└── Result:
    ├── Revenue Account 4020 (Sales - VATable): ₱500 credit
    ├── VAT Payable Account 2100: ₱60 credit (liability to gov)
    └── Customer paid ₱560 to settle the invoice

Journal Entry Example:
┌──────────────────────────────────────────┐
│ DR Cash/Bank/A/R        ₱560             │
│   CR Sales-VATable    ₱500                │
│   (4020)                                  │
│   CR VAT Payable       ₱60                │
│   (2100)                                  │
└──────────────────────────────────────────┘
```

### Recognition Rules
1. **Payment Method**:
   - If PAID IN CASH → Debit Cash on Hand (1001) or specific bank account (101x)
   - If CREDIT SALE → Debit Accounts Receivable (1100)
   - If MIXED → Split debit between Cash and A/R

2. **Account Receivable Tracking**:
   - Every credit sale creates an A/R record with `client_id`
   - Track by client for aging analysis
   - Link to client tier for discount validation

3. **Multi-Item Sales**:
   - Aggregate by VAT category (NON-VAT vs VATable)
   - Create ONE journal entry per sale transaction
   - Summarize COGS similarly

---

## Cost of Goods Sold

### Purchase Order Processing

#### Stage 1: PO Creation (Draft)
```
Status: "draft"
Action: No journal entry yet (commitment only)
Accounting: Off-balance-sheet (memo)
```

#### Stage 2: PO Confirmed (Sent to Supplier)
```
Status: "sent"
Action: No journal entry yet (awaiting receipt)
Accounting: Off-balance-sheet (memo)
```

#### Stage 3: PO Received (Goods In)
```
Status: "partial" or "received"
Action: POST JOURNAL ENTRY immediately

Case A: NON-VAT Purchase (0% VAT)
├── PO Amount: ₱5,000 (exact cost, no VAT)
├── Tag: "is_vatable" = false
└── Journal Entry:
    ┌──────────────────────────────┐
    │ DR Inventory (1200)   ₱5,000 │
    │ DR COGS-NONVAT (5010) ₱5,000 │
    │   CR Accounts Payable (2001)  │
    │      ₱10,000                  │
    └──────────────────────────────┘
    
    OR if paid immediately:
    ┌──────────────────────────────┐
    │ DR Inventory (1200)   ₱5,000 │
    │ DR COGS-NONVAT (5010) ₱5,000 │
    │   CR Cash/Bank (101x)         │
    │      ₱10,000                  │
    └──────────────────────────────┘

Case B: VATable Purchase (includes 12% VAT)
├── PO Invoice Amount: ₱5,600 (inclusive of VAT)
├── Tag: "is_vatable" = true
├── Breakdown:
│   ├── Taxable Cost: ₱5,600 ÷ 1.12 = ₱5,000
│   ├── VAT Amount: ₱5,600 - ₱5,000 = ₱600
│   └── Supplier invoice shows:
│       ├── Net: ₱5,000
│       ├── VAT (12%): ₱600
│       └── Total: ₱5,600
│
└── Journal Entry (Proper VAT Treatment):
    ┌──────────────────────────────────────────┐
    │ DR Inventory (1200)        ₱5,000        │
    │ DR COGS-VAT (5020)         ₱5,000        │
    │ DR VAT on Purchases (1310) ₱600          │
    │   CR Accounts Payable (2001) ₱10,600     │
    │      (or CR Cash if paid)                 │
    └──────────────────────────────────────────┘
    
    Notes:
    ├── Inventory & COGS: ₱5,000 (net of VAT)
    ├── VAT Asset: ₱600 (can be recovered/offset against sales VAT)
    └── Total cash outflow: ₱5,600
```

### COGS Recognition (At Time of Cost)
1. **For Sales COGS**:
   - When sale posted → Calculate COGS from product cost_price
   - COGS entry depends on whether product was purchased VATable or NON-VAT
   - Track separately for proper income statement reporting

2. **For Purchase COGS**:
   - When PO received → Record per above categories
   - VAT amount flows to asset account (recoverable)

---

## VAT Management

### VAT Flow Architecture

```
VAT IN (Asset)                        VAT OUT (Liability)
├── Source: Purchases from suppliers  ├── Source: Sales to customers
├── Account: 1310                     ├── Account: 2100
├── Category: CURRENT ASSET           ├── Category: CURRENT LIABILITY
├── Treatment: Recoverable            ├── Treatment: Payable to BIR
└── Formula:                          └── Formula:
    For VATable POs:                      For VATable Sales:
    PO Amount = Invoice Total             Sale Amount = Total ÷ 1.12
    VAT In = (Invoice ÷ 1.12) × 0.12     VAT Out = Amount × 0.12

Example Cycle:
1. Buy from supplier for ₱5,600 (incl 12% VAT)
   → VAT In Asset increases ₱600
   → COGS recorded ₱5,000

2. Sell to customer for ₱5,600 (incl 12% VAT)
   → VAT Out Liability increases ₱600
   → Revenue recorded ₱5,000

3. VAT Reconciliation:
   VAT In: ₱600  (can offset)
   VAT Out: ₱600 (must pay)
   Net Tax Due: ₱0
```

### VAT Return Filing (Monthly/Quarterly)
```
Calculation for BIR Return:
Total Sales (incl VAT):       ₱X,XXX
÷ 1.12 = Taxable Sales:       ₱Y,YYY
× 0.12 = Output VAT:          ₱Z,ZZZ (2100 balance)

Total Purchases (incl VAT):   ₱A,AAA
÷ 1.12 = Taxable Purchases:   ₱B,BBB
× 0.12 = Input VAT:           ₱C,CCC (1310 balance)

VAT Liability to Pay = Output VAT - Input VAT
                    = ₱Z,ZZZ - ₱C,CCC
```

---

## Balance Sheet Components

### Assets Section

#### Current Assets

**1. Cash and Cash Equivalents**
```
Accounts to Aggregate (Sum all balances):
├── 1001  Cash on Hand
├── 1010  Bank - CBS Account (TMHT) - 3556
├── 1020  Bank - MBT Account (TMHT) - 8251
├── 1025  Bank - Online Transfer (TMHT/RJ)
├── 1030  Bank - PNB Accounts (Multiple)
├── 1040  Bank - BDO Accounts
└── 1050  Bank - Other Banks

Display Format on Balance Sheet:
Cash and Cash Equivalents        ₱X,XXX,XXX
  Bank (TMHT) CBS - 3556        ₱X,XXX
  Bank (TMHT) MBT - 8251        ₱X,XXX
  Bank (TMHT) PNB 9145          ₱X,XXX
  [... list each bank with last 4 digits ...]
  
Calculation: Sum all bank account balances
Note: Show negative balances (overdrafts) as separate line if TMHT CBS is negative
```

**2. Accounts Receivable**
```
Definition: All sales not yet paid in full
Calculation Method:
├── Get all Sales Transactions with status "completed"
├── For each transaction:
│   ├── Total Amount = total_amount field
│   ├── Total Paid = SUM(payments WHERE status='confirmed')
│   ├── Balance Due = Total Amount - Total Paid
│   └── If Balance Due > 0 → Include in A/R
├── Group by client (for aging detail)
└── Sum all outstanding balances

Example:
Sale TXN-001 to ABC Corp:  ₱10,000
  Paid so far:             ₱6,000
  Outstanding:             ₱4,000 ← Include in A/R

Display Format:
Accounts Receivable (A/R)           ₱X,XXX,XXX
  ABC Construction                  ₱1,500,000
  XYZ Developers                     ₱850,000
  [... other clients ...]
  Less: Allowance for Bad Debts      (₱50,000)
  Net A/R:                          ₱X,XXX,XXX

Aging Analysis (optional):
  Current (0-30 days):             ₱X,XXX
  30-60 days:                      ₱X,XXX
  Over 60 days:                    ₱X,XXX
```

**3. VAT on Purchases (Input VAT Asset)**
```
Definition: Recoverable VAT from supplier purchases
Calculation Method:
├── Sum all VAT amounts from VATable purchases
├── Formula: (VATable Purchase Invoice ÷ 1.12) × 0.12
├── Source: journal_lines where account_id = 1310 (VAT In)
└── Total = Balance of account 1310

Reconciliation Check:
├── For each PO marked "is_vatable" = true:
│   └── VAT In = (PO total ÷ 1.12) × 0.12
├── Sum all VAT In amounts
└── Should equal Account 1310 balance

Example:
Purchase PO-001:         ₱5,600 (incl VAT)
  VAT (12%):            ₱600 ← Asset
Purchase PO-002:        ₱11,200 (incl VAT)
  VAT (12%):           ₱1,200 ← Asset
Total VAT on Purchases: ₱1,800

Display Format:
VAT on Purchases (Input VAT)        ₱1,800,000
  [recoverable from BIR]
```

**4. Inventory**
```
Definition: Goods held for sale
Calculation Method:
├── Sum total cost of all on-hand inventory
├── Source: inventory_stock table
├── For each product:
│   ├── quantity_on_hand × cost_price
│   └── Add to total
├── Less valuation reserves if applicable
└── Net Inventory = Total cost

Example:
Product A: 100 units @ ₱50 cost = ₱5,000
Product B: 50 units @ ₱200 cost = ₱10,000
Product C: 200 units @ ₱30 cost = ₱6,000
Total Inventory:                ₱21,000

Display Format:
Inventory - Raw Materials           ₱X,XXX,XXX
Inventory - Work in Progress        ₱X,XXX,XXX
Inventory - Finished Goods          ₱X,XXX,XXX
Total Inventory:                   ₱X,XXX,XXX
```

### Liabilities Section

#### Current Liabilities

**1. VAT Payable (Output VAT Liability)**
```
Definition: VAT owed to Philippine Bureau of Internal Revenue (BIR)
Calculation Method:
├── Sum all VAT amounts from VATable sales
├── Formula: (VATable Sales ÷ 1.12) × 0.12
├── Source: journal_lines where account_id = 2100 (VAT Out)
└── Total = Balance of account 2100

Reconciliation Check:
├── For each sale marked with VATable items:
│   ├── Revenue = Sale Total ÷ 1.12
│   └── VAT Out = Revenue × 0.12
├── Sum all VAT Out amounts
└── Should equal Account 2100 balance

Example:
Sale TXN-001:          ₱5,600 (customer paid)
  Revenue:            ₱5,000
  VAT (12%):         ₱600 ← Liability
Sale TXN-002:         ₱11,200 (customer paid)
  Revenue:           ₱10,000
  VAT (12%):        ₱1,200 ← Liability
Total VAT Payable:    ₱1,800

NET VAT POSITION:
  Input VAT (Asset):     ₱1,800
  Output VAT (Liability):₱1,800
  Net due to BIR:        ₱0

Display Format:
Current Liabilities
  VAT Payable (Output VAT)          ₱X,XXX,XXX
    [Due to Philippine BIR]
  Accounts Payable                  ₱X,XXX,XXX
  Other Current Liabilities         ₱X,XXX,XXX
Total Current Liabilities:          ₱X,XXX,XXX
```

### Shareholders' Equity Section

**1. Retained Earnings / Net Income**
```
Definition: Cumulative profits from income statement
Calculation Method:
├── Start with beginning Retained Earnings balance
├── Add: Net Income from current period P&L
├── Less: Dividends paid/declared
└── Ending Retained Earnings = Opening + Net Income - Dividends

Components:
├── Opening Balance of Retained Earnings (Previous period CY)
├── Plus: Net Income for current period (from P&L)
└── Less: Dividend Disbursials

Display Format:
Shareholders' Equity
  Share Capital                     ₱X,XXX,XXX
  Retained Earnings                 ₱X,XXX,XXX
    Opening Balance                 ₱X,XXX,XXX
    Add: Net Income                 ₱X,XXX,XXX
    Less: Dividends                 (₱X,XXX,XXX)
  Less: Treasury Stock              (₱X,XXX,XXX)
Total Shareholders' Equity:         ₱X,XXX,XXX
```

### Balance Sheet Equation Validation
```
TOTAL ASSETS = TOTAL LIABILITIES + TOTAL SHAREHOLDERS' EQUITY

Audit Steps:
1. Calculate Total Assets
   = Sum of all Asset accounts (with proper signs)
   
2. Calculate Total Liabilities
   = Sum of all Liability accounts
   
3. Calculate Total Equity
   = Share Capital + Retained Earnings + Net Income
   
4. Verify: Assets = Liabilities + Equity
   If NOT balanced → Find discrepancy
   └── Check journal entries for imbalance
   └── Verify all transactions posted correctly
   └── Reconcile suspense accounts
```

---

## Journal Entry Patterns

### System Design Principle
Every financial event must create balanced journal entries (Σ Debit = Σ Credit).

### Pattern 1: Sales Transaction (Complete)

**Event:** Customer purchases items and pays

```
Input Data:
├── Sale Transaction ID: TXN-001
├── Items:
│   ├── Item A (NON-VAT): ₱300
│   └── Item B (VATable): ₱560 (inclusive)
├── Total: ₱860
├── Payment Method: Cash ₱860
└── Client: ABC Corp

Processing Logic:
1. Segment items by VAT category:
   ├── NON-VAT Total: ₱300
   └── VATable Total: ₱560

2. VATable Breakdown:
   ├── Revenue: ₱560 ÷ 1.12 = ₱500
   ├── VAT: ₱560 - ₱500 = ₱60

3. Determine Cash Account (payment method):
   ├── If "cash" → Account 1001 (Cash on Hand)
   ├── Or specific bank account
   └── Or if credit → Account 1100 (A/R)

4. GET COGS by checking product cost_price:
   ├── Item A cost: ₱150
   ├── Item B cost: ₱280
   └── Total COGS: ₱430

5. Determine COGS accounts by VAT flag on product:
   ├── Item A (NON-VAT product): → 5010
   ├── Item B (VATable product): → 5020
   └── VAT from Item B: → 1310 (Asset)

Journal Entry Generated:
┌──────────────────────────────────────────────────┐
│ SALES TRANSACTION ENTRY:                         │
│                                                  │
│ DR Cash (1001)                      ₱860        │
│   CR Sales - NON-VAT (4010)                ₱300 │
│   CR Sales - VATable (4020)           ₱500     │
│   CR VAT Payable (2100)                 ₱60    │
│                                                  │
│ Debit Total: ₱860  |  Credit Total: ₱860 ✓     │
│                                                  │
│ INVENTORY ADJUSTMENT ENTRY:                      │
│                                                  │
│ DR COGS - NON-VAT (5010)            ₱150        │
│ DR COGS - VAT (5020)                ₱280        │
│   CR Inventory (1200)                    ₱430   │
│                                                  │
│ Debit Total: ₱430  |  Credit Total: ₱430 ✓     │
└──────────────────────────────────────────────────┘

Entry Properties:
├── reference_type: "sale"
├── reference_id: TXN-001
├── date: today
├── description: "Sales transaction TXN-001 from ABC Corp"
└── user_id: (cashier ID)
```

### Pattern 2: Purchase Order Receipt (Complete)

**Event:** Supplier goods received, PO marked received

```
Input Data:
├── PO ID: PO-042
├── Supplier: Widget Corp
├── Items:
│   ├── Product X: 100 units @ ₱50 = ₱5,000 (NON-VAT tagged)
│   └── Product Y: 50 units @ ₱112 = ₱5,600 (VATable tagged)
├── PO Total (pre-VAT): ₱5,000
├── PO Total (with VAT): ₱5,600 + ₱500 = ₱6,100
└── Invoice Total: ₱11,200 (both lines combined @ ₱11,200)

Processing Logic:
1. Iterate through PO items:

   For Product X (NON-VAT):
   ├── Cost: ₱5,000
   ├── VAT flag: false
   ├── Accounting treatment:
   │   ├── Inventory: ₱5,000
   │   ├── COGS-NONVAT: ₱5,000
   │   └── No VAT asset created

   For Product Y (VATable):
   ├── Invoice amount: ₱5,600 (inclusive)
   ├── VAT flag: true
   ├── Breakdown:
   │   ├── Net cost: ₱5,600 ÷ 1.12 = ₱5,000
   │   ├── VAT: ₱600
   ├── Accounting treatment:
   │   ├── Inventory: ₱5,000
   │   ├── COGS-VAT: ₱5,000
   │   └── VAT Asset (1310): ₱600

2. Total Payable Calculation:
   ├── NON-VAT portion: ₱5,000
   ├── VATable portion (invoice): ₱5,600
   └── Total due to supplier: ₱10,600

Journal Entry Generated:
┌──────────────────────────────────────────────────┐
│ PURCHASE ORDER RECEIPT ENTRY:                    │
│                                                  │
│ DR Inventory (1200)                 ₱10,000     │
│ DR COGS - NON-VAT (5010)             ₱5,000     │
│ DR COGS - VAT (5020)                 ₱5,000     │
│ DR VAT on Purchases (1310)             ₱600     │
│   CR Accounts Payable (2001)             ₱10,600 │
│                                                  │
│ Debit Total: ₱10,600  |  Credit Total: ₱10,600 ✓│
│                                                  │
│ Notes:                                           │
│ Inventory Dr: ₱5,000 + ₱5,000 = ₱10,000         │
│ COGS Dr: ₱5,000 + ₱5,000 = ₱10,000              │
│ BUT both are recorded (for proper tracking)     │
│ and inventory is reduced on sale                │
└──────────────────────────────────────────────────┘

Entry Properties:
├── reference_type: "purchase"
├── reference_id: PO-042
├── date: (PO receipt date)
├── description: "Purchase order PO-042 from Widget Corp received"
└── user_id: (receiver ID)
```

### Pattern 3: Payment Posted (Cash / Bank)

**Event:** Customer pays an outstanding invoice or company pays supplier

```
INPUT CASE A: Collection from A/R

Event: ABC Corp pays ₱4,000 of their ₱10,000 invoice

Journal Entry:
┌──────────────────────────────────────────┐
│ DR Bank (1010)              ₱4,000       │
│   CR Accounts Receivable (1100)      ₱4,000 │
│                                          │
│ Debit Total: ₱4,000  |  Credit Total: ₱4,000 ✓ │
└──────────────────────────────────────────┘

INPUT CASE B: Payment to Supplier

Event: Company pays supplier ₱10,600 for PO-042

Journal Entry:
┌──────────────────────────────────────────┐
│ DR Accounts Payable (2001)  ₱10,600      │
│   CR Bank (1010)                   ₱10,600 │
│                                          │
│ Debit Total: ₱10,600  |  Credit Total: ₱10,600 ✓ │
└──────────────────────────────────────────┘

INPUT CASE C: Expense Payment (Direct)

Event: Company pays ₱5,000 for office rent

Journal Entry:
┌──────────────────────────────────────────┐
│ DR Rent Expense (6030)      ₱5,000       │
│   CR Bank (1010)                   ₱5,000 │
│                                          │
│ Debit Total: ₱5,000  |  Credit Total: ₱5,000 ✓ │
└──────────────────────────────────────────┘
```

### Pattern 4: Expense Recognition

**Event:** Operating expense incurred (Accrual basis)

```
Input Data:
├── Expense Type: Office Supplies
├── Amount: ₱2,500
├── Date: April 5
└── Approval Status: Approved

Journal Entry (Accrual):
┌──────────────────────────────────────────┐
│ DR Office Expenses (6040)   ₱2,500       │
│   CR Accrued Liabilities (2130)     ₱2,500 │
│                                          │
│ Debit Total: ₱2,500  |  Credit Total: ₱2,500 ✓ │
└──────────────────────────────────────────┘

Later (When Paid):
┌──────────────────────────────────────────┐
│ DR Accrued Liabilities (2130) ₱2,500     │
│   CR Bank (1010)                   ₱2,500 │
│                                          │
│ Debit Total: ₱2,500  |  Credit Total: ₱2,500 ✓ │
└──────────────────────────────────────────┘
```

---

## Financial Statement Generation

### Income Statement (P&L Statement)

**Reporting Period:** 1 January - 8 April 2026  
**Accounting Basis:** Accrual  
**Presentation:** Internal Reporting

**Generation Logic:**

```
INCOME SECTION:
1. Get all Sales Transactions (completed) in period:

   For each transaction:
   ├── Identify payment status (paid/credit)
   ├── Segment line items by VAT:
   │   ├── NON-VAT items: Sum and post to 4010
   │   └── VATable items: Calculate as (Total ÷ 1.12) and post to 4020
   └── Accrue VAT Liability: (VATable Total ÷ 1.12) × 0.12 → 2100

   Calculation Method:
   ├── For NON-VAT Sales:
   │   └── Sum revenue from all 4010 journal postings
   ├── For VATable Sales:
   │   ├── Sum revenue from all 4020 journal postings
   │   └── Display line item labeled "Sales VATable/NonVAT"
   └── Total Income = 4010 balance + 4020 balance

2. Revenue Display Format:
   ┌────────────────────────────────────┐
   │ Income                             │
   │   Sales                    ₱189,593│
   │   Sales (VATable/NonVATA) ₱18,951,775│
   │ Total Income             ₱19,141,368│
   └────────────────────────────────────┘

COST OF SALES SECTION:
1. Get all confirmed PO receipts in period:

   For each PO marked "received":
   ├── If NON-VAT: Sum to COGS-NONVAT (5010)
   └── If VATable:
       ├── Sum net cost to COGS-VAT (5020)
       └── Track VAT for balance sheet asset (1310)

2. COGS Display Format:
   ┌────────────────────────────────────┐
   │ Cost of Sales                      │
   │   COGS NonVATable      ₱8,687,421 │
   │   COGS VATable           ₱885,894 │
   │   Cost of Sales [manual]₱1,670,174│
   │ Total COGS            ₱11,243,490│
   └────────────────────────────────────┘

3. Gross Profit:
   = Total Income - Total COGS
   = ₱19,141,368 - ₱11,243,490
   = ₱7,897,878

EXPENSES SECTION:
1. Get all Expense accounts (60xx, 61xx, 62xx) for period:

   For each expense posting:
   ├── Aggregate by account code
   └── Display with calculated total

2. Expenses Display Format:
   ┌────────────────────────────────────┐
   │ Expenses                           │
   │   Other Expenses:                  │
   │   Reconciliation Discrepancies (₱621,798)│
   │ Total Other Expenses       (₱621,798)│
   └────────────────────────────────────┘

   Note: Negative expense = reduction in expense (gain)

3. NET EARNINGS:
   = Gross Profit - Total Expenses
   = ₱7,897,878 - (₱621,798)
   = ₱8,519,676
```

### Balance Sheet (Statement of Financial Position)

**Date:** As of 7 April 2026  
**Accounting Basis:** Accrual  
**Presentation:** Internal Reporting

**Generation Logic:**

```
ASSETS SECTION (Left side):

Current Assets:
├── 1. Accounts Receivable (A/R)
│   Source: Sum of (Sale Total - Payments Received) for unclosed sales
│   Calculation:
│   ├── Query all Sales Transactions (status = "completed")
│   ├── For each transaction:
│   │   └── Balance Due = total_amount - sum(confirmed payments)
│   ├── Filter where Balance Due > 0
│   └── Sum all balances
│   Result: ₱6,590,711
│
├── 2. Cash & Bank Accounts
│   Source: Account balances for accounts 1001, 101x
│   Calculation:
│   ├── 1001 Cash on Hand: ₱X
│   ├── 1010 Bank CBS: (₱8,005,687) ← shown negative if overdrawn
│   ├── 1020 Bank MBT: (₱911,844)
│   ├── 1025 Bank Online: ₱812,264
│   ├── 1030 Bank PNB: ₱112,347
│   ├── 1040 Bank BDO: ₱454,731
│   ├── Other bank accounts: ...
│   └── Net Cash: ₱X,XXX,XXX
│
├── 3. VAT on Purchases (Input VAT Asset)
│   Source: Account 1310 balance
│   Calculation:
│   ├── Sum all VAT from VATable purchases
│   ├── Formula: (VATable PO Invoice ÷ 1.12) × 0.12
│   └── Balance: ₱X,XXX (shown as recoverable asset)
│
└── Total Current Assets: ₱X,XXX,XXX

Noncurrent Assets (if applicable):
├── Fixed Assets (1500 series)
├── Goodwill (1900 series)
└── Long-term Investments

TOTAL ASSETS: ₱8,534,584

---

LIABILITIES & EQUITY SECTION (Right side):

Current Liabilities:
├── 1. VAT Payable (Output VAT)
│   Source: Account 2100 balance
│   Calculation:
│   ├── Sum all VAT from VATable sales
│   ├── Formula: (VATable Sales Total ÷ 1.12) × 0.12
│   └── Balance: ₱14,908 (liability to BIR)
│
├── 2. Accounts Payable
│   Source: Account 2001 balance
│   Calculation:
│   ├── Sum of (PO Total - Cash Payments) for unpaid POs
│   └── Balance: ₱X,XXX
│
└── Total Current Liabilities: ₱14,908

Noncurrent Liabilities (if applicable)

TOTAL LIABILITIES: ₱14,908

---

Shareholders' Equity:
├── 1. Share Capital (Account 3000):
│   └── ₱0 (or amount contributed)
│
├── 2. Retained Earnings (Account 3100):
│   └── Opening balance from prior year
│
├── 3. Current Period Net Income (from P&L):
│   └── ₱8,519,676
│
└── Total Shareholders' Equity: ₱8,519,676

---

TOTAL LIABILITIES + EQUITY: ₱14,908 + ₱8,519,676 = ₱8,534,584

✓ BALANCE CHECK: ASSETS (₱8,534,584) = LIABILITIES (₱14,908) + EQUITY (₱8,519,676)
```

---

## Compliance & Validation

### Pre-Posting Validations

Before any journal entry is posted, the system must verify:

```
1. ENTRY BALANCE CHECK:
   ├── Sum all Debit amounts
   ├── Sum all Credit amounts
   └── IF Debit Total ≠ Credit Total → REJECT with error message

2. ACCOUNT VALIDITY:
   ├── Each account ID must exist in chart_of_accounts
   ├── Account must have is_active = true
   └── IF not found → REJECT: "Invalid account"

3. AMOUNT VALIDATION:
   ├── All amounts must be > 0
   ├── Precision: max 2 decimal places
   └── IF invalid → REJECT: "Invalid amount"

4. DATE LOGIC:
   ├── Entry date must be <= today (no future entries unless approved)
   ├── Entry date must be within fiscal period (Jan 1 - Dec 31)
   └── IF out of range → REJECT: "Invalid date"

5. REFERENCE VALIDATION:
   ├── IF reference_type is not null:
   │   ├── reference_id must exist
   │   └── Record must have status appropriate for posting
   └── IF missing → REJECT: "Invalid reference"

6. USER AUTHORIZATION:
   ├── User must have permission to post entries
   ├── Check user roles and permissions
   └── IF not authorized → REJECT: "Insufficient permission"
```

### Post-Posting Reconciliations

After statements are generated:

```
1. TRIAL BALANCE:
   Generate trial balance (all accounts with debit/credit balances)
   Verify: Total Debits = Total Credits
   If NOT balanced → Flag for investigation

2. INCOME STATEMENT VALIDATION:
   ├── Net Income should reconcile with change in Retained Earnings
   ├── Verify no balance sheet accounts in P&L
   ├── Check for orphaned transactions

3. BALANCE SHEET VALIDATION:
   ├── Verify: Assets = Liabilities + Equity
   ├── Check for negative account balances (flag if abnormal)
   ├── Reconcile A/R with individual sales aging
   └── Reconcile A/P with individual PO status

4. CASH RECONCILIATION:
   ├── Compare bank account balances with bank statements
   ├── Identify timing differences
   ├── Flag unusual transactions

5. VAT RECONCILIATION:
   ├── Input VAT (1310) vs. Output VAT (2100)
   ├── Calculate net tax liability for BIR filing
   ├── Verify against sales/purchases schedule
```

### Audit Trail & Controls

```
1. JOURNAL ENTRY AUDIT LOG:
   Every entry creation/modification logged:
   ├── Entry ID
   ├── Created By (user_id)
   ├── Created At (timestamp)
   ├── Modified By (if edited)
   ├── Modified At (if edited)
   ├── Reference (transaction ID)
   ├── Amount Total
   └── Posted Status

2. TRANSACTION LINKING:
   ├── Each sale → links to journal entry (reference_type="sale")
   ├── Each PO receipt → links to journal entry (reference_type="purchase")
   ├── Each payment → separate journal entry
   └── Each manual entry → audit log entry

3. EDIT RESTRICTIONS:
   ├── Posted entries for closed periods → NO EDIT allowed
   ├── Current period entries → Edit allowed with override trail
   ├── Admin only → Can reverse/adjust prior entries
   └── All edits → Create new entry with comment for audit
```

---

## Summary Table: Quick Reference

| Scenario | Revenue Account | COGS Account | Liability Account | Asset Account |
|----------|-----------------|--------------|-------------------|---------------|
| Sell ₱460 NON-VAT | 4010 ₱460 | 5010 (cost) | — | — |
| Sell ₱560 with VAT | 4020 ₱500 | 5020 (cost) | 2100 ₱60 | — |
| Buy ₱5,000 NON-VAT | — | 5010 ₱5,000 | 2001 ₱5,000 | — |
| Buy ₱5,600 with VAT | — | 5020 ₱5,000 | 2001 ₱5,600 | 1310 ₱600 |
| A/R Collection ₱4,000 | — | — | — | 1001/1010 ₱4,000 |
| VAT Payment to BIR | — | — | 2100 (—) | 1010 (—) |

---

## Implementation Roadmap

### Phase 1: Chart of Accounts Setup
- [ ] Create all master accounts (10xx-62xx)
- [ ] Set account types (asset/liability/equity/revenue/expense)
- [ ] Configure normal balance (debit/credit)
- [ ] Link to parent accounts (hierarchical)
- [ ] Activate all accounts needed

### Phase 2: Journal Entry Service Enhancement
- [ ] Implement `postSaleEntry()` with VAT handling
- [ ] Implement `postPurchaseEntry()` with VAT handling
- [ ] Add VAT amount tracking in journal lines
- [ ] Create validation layer for entry balance

### Phase 3: Financial Statement Generation
- [ ] Build P&L report generator (aggregate by account)
- [ ] Build Balance Sheet report generator
- [ ] Implement statement formatting
- [ ] Add period filtering and date range selection

### Phase 4: VAT Management
- [ ] Create VAT reconciliation report
- [ ] Build VAT return filing template
- [ ] Calculate net tax liability (Input vs Output)
- [ ] Add BIR compliance checks

### Phase 5: Reporting & Analytics
- [ ] Trial Balance report
- [ ] Aging analysis (A/R and A/P)
- [ ] Cash flow statement
- [ ] Profitability analysis by product/client

---

## References

**Philippine Tax Authority:** Bureau of Internal Revenue (BIR)  
**VAT Rate:** 12% (standard rate as of 2026)  
**Filing Frequency:** Monthly/Quarterly VAT returns  
**Accrual Basis:** Revenue and expenses recognized when incurred, not when cash changed  
**Double-Entry:** Every transaction balances (Debit = Credit)

---

**Document Approved By:** [Finance Team]  
**Last Revision:** April 8, 2026  
**Next Review:** April 30, 2026
