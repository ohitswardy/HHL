export interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
  created_at: string;
}

export interface ClientTier {
  id: number;
  name: string;
  discount_percent: number;
  markup_percent: number;
  description: string | null;
}

export interface Client {
  id: number;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  client_tier_id: number;
  tier?: ClientTier;
  credit_limit: number;
  outstanding_balance: number;
  notes: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  children?: Category[];
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductStock {
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
}

export interface ProductTierPrice {
  id: number;
  client_tier_id: number;
  price: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  category?: Category;
  unit: string;
  supplier_id: number | null;
  supplier?: Supplier;
  cost_price: number;
  base_selling_price: number;
  reorder_level: number;
  is_active: boolean;
  stock?: ProductStock;
  tier_prices?: ProductTierPrice[];
  created_at: string;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  product?: { id: number; name: string; sku: string };
  type: 'in' | 'out' | 'adjustment';
  reference_type: string | null;
  reference_id: number | null;
  quantity: number;
  unit_cost: number;
  notes: string | null;
  user?: User;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: number;
  product_id: number;
  product?: { id: number; name: string; sku: string };
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier?: Supplier;
  user?: User;
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  total_amount: number;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  items?: PurchaseOrderItem[];
  created_at: string;
}

export interface SaleItem {
  id: number;
  product_id: number;
  product?: { id: number; name: string; sku: string };
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface Payment {
  id: number;
  sales_transaction_id: number;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'credit';
  amount: number;
  reference_number: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  paid_at: string | null;
}

export interface SalesTransaction {
  id: number;
  transaction_number: string;
  client_id: number | null;
  client?: Client;
  user_id: number;
  user?: User;
  fulfillment_type: 'delivery' | 'pickup';
  status: 'pending' | 'completed' | 'voided' | 'refunded';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  total_paid: number;
  balance_due: number;
  notes: string | null;
  items?: SaleItem[];
  payments?: Payment[];
  created_at: string;
}

export interface ChartOfAccount {
  id: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id: number | null;
  is_active: boolean;
  balance: number;
  children?: ChartOfAccount[];
}

export interface JournalLine {
  id: number;
  account_id: number;
  account?: { id: number; code: string; name: string };
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  reference_type: string | null;
  reference_id: number | null;
  description: string;
  date: string;
  user?: User;
  lines?: JournalLine[];
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface DashboardSummary {
  todays_sales: number;
  pending_pos: number;
  low_stock_count: number;
  total_clients: number;
  total_products: number;
  recent_transactions: {
    id: number;
    transaction_number: string;
    client: string;
    user: string;
    total_amount: number;
    status: string;
    created_at: string;
  }[];
  sales_trend: { date: string; total: number; count: number }[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}
