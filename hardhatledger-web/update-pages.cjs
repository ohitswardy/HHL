const fs = require('fs');
const path = require('path');

const base = 'd:/XAMPP/htdocs/HHL/hardhatledger-web/src';

// Helper: find the `/*` that starts the comment block containing `keyword`
function findCommentBlockStart(c, keyword) {
  const kwIdx = c.indexOf(keyword);
  if (kwIdx === -1) return -1;
  return c.lastIndexOf('/*', kwIdx);
}

/* ── 1. ChartOfAccountsPage.tsx ─────────────────────────────────────────── */
{
  const file = path.join(base, 'modules/accounting/pages/ChartOfAccountsPage.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // Add new import after dayjs import
  c = c.replace(
    "import dayjs from 'dayjs';",
    "import dayjs from 'dayjs';\nimport { AccountFormModal, type AccountFormData, AccountLedgerModal, ImportModal } from '../components/ChartOfAccountsModals';"
  );

  // Remove everything from the "Account Form Modal" banner up to (but not including) the "Main Component" banner
  const si = findCommentBlockStart(c, 'Account Form Modal');
  const ei = findCommentBlockStart(c, 'Main Component');
  if (si === -1 || ei === -1) {
    console.error('ChartOfAccountsPage: markers not found! si=' + si + ' ei=' + ei);
    process.exit(1);
  }
  c = c.slice(0, si) + c.slice(ei);

  fs.writeFileSync(file, c, 'utf8');
  console.log('ChartOfAccountsPage.tsx updated ✓');
}

/* ── 2. PurchaseOrdersPage.tsx ──────────────────────────────────────────── */
{
  const file = path.join(base, 'modules/pos/pages/PurchaseOrdersPage.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // Add import after dayjs import
  c = c.replace(
    "import dayjs from 'dayjs';",
    "import dayjs from 'dayjs';\nimport { CreatePOModal, PODetailModal, CancelPOModal } from '../components/POModals';"
  );

  // Remove downloadPOPdf — from "async function downloadPOPdf" to just before "function downloadPOCsv"
  const pdfStart = c.indexOf('\nasync function downloadPOPdf(');
  const csvStart = c.indexOf('\nfunction downloadPOCsv(');
  if (pdfStart === -1 || csvStart === -1) {
    console.error('PurchaseOrdersPage: downloadPOPdf/Csv markers not found');
    process.exit(1);
  }
  c = c.slice(0, pdfStart) + c.slice(csvStart);

  // Remove downloadPOCsv — from "function downloadPOCsv" to just before "const getPageNumbers"
  const csv2Start = c.indexOf('\nfunction downloadPOCsv(');
  const pageNumStart = c.indexOf('\nconst getPageNumbers');
  if (csv2Start === -1 || pageNumStart === -1) {
    console.error('PurchaseOrdersPage: downloadPOCsv/getPageNumbers markers not found');
    process.exit(1);
  }
  c = c.slice(0, csv2Start) + c.slice(pageNumStart);

  // Remove DraftItem interface block (it's now in POModals.tsx)
  const draftItemComment = c.indexOf('/* \u2500\u2500\u2500 draft-item type');
  const draftItemEnd = c.indexOf('\n\n/* \u2550', draftItemComment); // next section banner
  if (draftItemComment !== -1 && draftItemEnd !== -1) {
    c = c.slice(0, draftItemComment) + c.slice(draftItemEnd + 2); // +2 to skip the blank line
  }

  // Remove all modal function definitions from the CreatePOModal banner to EOF
  const mi = findCommentBlockStart(c, 'Create PO Modal');
  if (mi === -1) {
    console.error('PurchaseOrdersPage: Create PO Modal marker not found');
    process.exit(1);
  }
  c = c.slice(0, mi).trimEnd() + '\n';

  fs.writeFileSync(file, c, 'utf8');
  console.log('PurchaseOrdersPage.tsx updated ✓');
}

/* ── 3. ExpensesPage.tsx ────────────────────────────────────────────────── */
{
  const file = path.join(base, 'modules/accounting/pages/ExpensesPage.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // Replace the Supplier import line to also import from ExpenseModals
  c = c.replace(
    "import type { Supplier } from '../../../types';",
    "import type { Supplier } from '../../../types';\nimport { ExpenseFormModal, ExpenseDetailModal, STATUS_VARIANT, type ExpenseCategory, type Expense } from '../components/ExpenseModals';"
  );

  // Remove local ExpenseCategory and Expense interface definitions
  // They are between "/* \u2500\u2500\u2500 types" and "interface ExpenseSummary"
  const typesStart = c.indexOf('/* \u2500\u2500\u2500 types');
  const expSummaryIdx = c.indexOf('interface ExpenseSummary');
  if (typesStart === -1 || expSummaryIdx === -1) {
    console.error('ExpensesPage: type section markers not found');
    process.exit(1);
  }
  // Replace the section header + ExpenseCategory + Expense definitions with just the header
  // Keep everything from ExpenseSummary onwards
  const typesHeader = '\n/* \u2500\u2500\u2500 types \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n';
  c = c.slice(0, typesStart) + typesHeader + c.slice(expSummaryIdx);

  // Remove local STATUS_VARIANT (now imported from ExpenseModals)
  const svStart = c.indexOf('\nconst STATUS_VARIANT:');
  const svEnd = c.indexOf('\n};\n', svStart) + 4; // include closing };\n
  if (svStart !== -1 && svEnd > 3) {
    c = c.slice(0, svStart) + c.slice(svEnd);
  }

  // Remove ExpenseFormModal and ExpenseDetailModal (from their banner to EOF)
  const mi = findCommentBlockStart(c, 'Expense Form Modal');
  if (mi === -1) {
    console.error('ExpensesPage: Expense Form Modal marker not found');
    process.exit(1);
  }
  c = c.slice(0, mi).trimEnd() + '\n';

  fs.writeFileSync(file, c, 'utf8');
  console.log('ExpensesPage.tsx updated ✓');
}

console.log('\nAll page files updated successfully.');
const fs = require('fs');
const path = require('path');

const base = 'd:/XAMPP/htdocs/HHL/hardhatledger-web/src';

// Find the last `/*` before a given index
function findBlockCommentStart(c, idx) {
  const slice = c.slice(0, idx);
  return slice.lastIndexOf('/*');
}

/* ── 1. ChartOfAccountsPage.tsx ─────────────────────────────────────────── */
{
  const file = path.join(base, 'modules/accounting/pages/ChartOfAccountsPage.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // Add new import after dayjs import
  c = c.replace(
    "import dayjs from 'dayjs';",
    "import dayjs from 'dayjs';\nimport { AccountFormModal, type AccountFormData, AccountLedgerModal, ImportModal } from '../components/ChartOfAccountsModals';"
  );

  // Remove everything from "Account Form Modal" banner up to (but not including) "Main Component" banner
  const START = '/* ═══════════════════════════════════════════════════════════\n   Account Form Modal\n   ═══════════════════════════════════════════════════════════ */';
  const END   = '/* ═══════════════════════════════════════════════════════════\n   Main Component\n   ═══════════════════════════════════════════════════════════ */';

  const si = c.indexOf(START);
  const ei = c.indexOf(END);
  if (si === -1 || ei === -1) {
    console.error('ChartOfAccountsPage: markers not found! si=' + si + ' ei=' + ei);
    process.exit(1);
  }
  c = c.slice(0, si) + c.slice(ei);

  fs.writeFileSync(file, c, 'utf8');
  console.log('ChartOfAccountsPage.tsx updated ✓');
}

/* ── 2. PurchaseOrdersPage.tsx ──────────────────────────────────────────── */
{
  const file = path.join(base, 'modules/pos/pages/PurchaseOrdersPage.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // Add import after dayjs import
  c = c.replace(
    "import dayjs from 'dayjs';",
    "import dayjs from 'dayjs';\nimport { CreatePOModal, PODetailModal, CancelPOModal } from '../components/POModals';"
  );

  // Remove downloadPOPdf — starts at "async function downloadPOPdf" and ends before "function downloadPOCsv"
  c = c.replace(/\nasync function downloadPOPdf[\s\S]*?\n(?=function downloadPOCsv)/, '\n');

  // Remove downloadPOCsv — starts at "function downloadPOCsv" and ends before "const getPageNumbers"
  c = c.replace(/\nfunction downloadPOCsv[\s\S]*?\n(?=const getPageNumbers)/, '\n');

  // Remove DraftItem interface (and surrounding blank lines) — it's now in POModals.tsx
  c = c.replace(/\n\/\* ─── draft-item type[\s\S]*?interface DraftItem \{[^\n]*\}\n/, '\n');

  // Remove all modal function definitions — from the CreatePOModal banner to EOF
  const MODAL_START = '/* ═══════════════════════════════════════════════════════════════════════════ */\n/*  Create PO Modal';
  const mi = c.indexOf(MODAL_START);
  if (mi === -1) {
    console.error('PurchaseOrdersPage: CreatePO modal marker not found');
    process.exit(1);
  }
  c = c.slice(0, mi);

  fs.writeFileSync(file, c, 'utf8');
  console.log('PurchaseOrdersPage.tsx updated ✓');
}

/* ── 3. ExpensesPage.tsx ────────────────────────────────────────────────── */
{
  const file = path.join(base, 'modules/accounting/pages/ExpensesPage.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // Replace local type defs + STATUS_VARIANT with imports from ExpenseModals
  c = c.replace(
    "import type { Supplier } from '../../../types';",
    "import type { Supplier } from '../../../types';\nimport { ExpenseFormModal, ExpenseDetailModal, STATUS_VARIANT, type ExpenseCategory, type Expense } from '../components/ExpenseModals';"
  );

  // Remove the now-redundant local type definitions for ExpenseCategory and Expense
  c = c.replace(/\n\/\* ─── types ─+\s*\*\/\n\ninterface ExpenseCategory[\s\S]*?interface ExpenseSummary \{/, '\n/* ─── types ─── */\n\ninterface ExpenseSummary {');

  // Remove the local STATUS_VARIANT constant (now imported)
  c = c.replace(/\nconst STATUS_VARIANT: Record<string, 'success' \| 'warning' \| 'danger'> = \{[\s\S]*?\};\n/, '\n');

  // Remove ExpenseFormModal and ExpenseDetailModal function definitions (everything from that banner to EOF)
  const MODAL_START = '/* ═══════════════════════════════════════════════════════════════════════════ */\n/*  Expense Form Modal';
  const mi = c.indexOf(MODAL_START);
  if (mi === -1) {
    console.error('ExpensesPage: ExpenseFormModal marker not found');
    process.exit(1);
  }
  c = c.slice(0, mi);

  fs.writeFileSync(file, c, 'utf8');
  console.log('ExpensesPage.tsx updated ✓');
}

console.log('\nAll page files updated successfully.');
