import { useEffect, useState, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { HiSearch, HiPlus, HiMinus, HiTrash, HiShoppingCart, HiLightningBolt } from 'react-icons/hi';
import { useCartStore } from '../../../stores/cartStore';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Product, Client, SalesTransaction, Category } from '../../../types';

export function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processing, setProcessing] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [lastSale, setLastSale] = useState<SalesTransaction | null>(null);
  const [skuInput, setSkuInput] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);

  const cart = useCartStore();

  // Resolve the correct price for a product based on the selected client's tier
  // Uses tier_prices already loaded on the product — no extra API calls needed
  const resolvePrice = (product: Product, client: typeof cart.client): number => {
    if (client?.client_tier_id && product.tier_prices?.length) {
      const tp = product.tier_prices.find((t) => t.client_tier_id === client.client_tier_id);
      if (tp) return Number(tp.price);
    }
    return Number(product.base_selling_price);
  };

  const handleClientChange = (clientId: number | string) => {
    const c = clients.find((cl) => cl.id === Number(clientId)) || null;
    cart.setClient(c);
    // Reprice all items already in the cart
    const priceMap: Record<number, number> = {};
    cart.items.forEach((item) => {
      priceMap[item.product.id] = resolvePrice(item.product, c);
    });
    cart.repriceAll(priceMap);
  };

  useEffect(() => {
    api.get('/clients', { params: { per_page: 200 } }).then((res) => setClients(res.data.data));
    api.get('/categories').then((res) => setCategories(res.data.data));
  }, []);

  // Debounced server-side product search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchLoading(true);
      const params: Record<string, unknown> = { per_page: 80, is_active: true };
      if (search.trim()) params.search = search.trim();
      if (filterCategory) params.category_id = filterCategory;
      api.get('/products', { params })
        .then((res) => setProducts(res.data.data))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterCategory]);

  const addToCart = (product: Product, qty = 1) => {
    const stock = product.stock?.quantity_on_hand ?? 0;
    const inCart = cart.items.find((i) => i.product.id === product.id)?.quantity ?? 0;
    if (inCart >= stock) {
      toast.error(`Max stock reached (${stock})`);
      return;
    }
    const price = resolvePrice(product, cart.client);
    cart.addItem(product, qty, price);
  };

  const handleSkuAdd = async () => {
    const sku = skuInput.trim().toUpperCase();
    if (!sku) return;
    let found = products.find((p) => p.sku.toUpperCase() === sku);
    if (!found) {
      try {
        const res = await api.get('/products', { params: { search: sku, per_page: 5, is_active: true } });
        found = (res.data.data as Product[]).find((p) => p.sku.toUpperCase() === sku);
      } catch { /* silent */ }
    }
    if (!found) {
      toast.error(`SKU "${skuInput.trim()}" not found`);
    } else {
      addToCart(found, 1);
      toast.success(`Added: ${found.name}`);
    }
    setSkuInput('');
    skuRef.current?.focus();
  };

  const handleCompleteSale = async () => {
    if (cart.items.length === 0) { toast.error('Cart is empty'); return; }
    setProcessing(true);
    try {
      const payload = {
        client_id: cart.client?.id || null,
        fulfillment_type: cart.fulfillmentType,
        items: cart.items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          discount: i.discount,
        })),
        payments: [{ payment_method: paymentMethod, amount: cart.getTotal() + (cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0) }],
        delivery_fee: cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0,
        notes: '',
      };
      const res = await api.post('/pos/sales', payload);
      setLastSale(res.data.data);
      toast.success(`Sale completed: ${res.data.data.transaction_number}`);
      cart.clear();
      setReceiptModal(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setProcessing(false);
    }
  };

  // Keyboard shortcut: focus search with /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        handleCompleteSale();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.items, paymentMethod]);

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* Left Panel - Product Selection */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Row 1: Search + Client */}
        <div className="mb-2 flex gap-3">
          <div className="flex-1 relative">
            <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            {searchLoading && (
              <svg className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <input ref={searchRef} className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder='Search by name or SKU (press "/" to focus)' value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1">
            <Select value={cart.client?.id || ''} onChange={(e) => handleClientChange(e.target.value)} options={clients.map((c) => ({ value: c.id, label: `${c.business_name} (${c.tier?.name || 'N/A'})` }))} placeholder="Walk-in Customer" />
          </div>
        </div>

        {/* Row 2: SKU quick-add */}
        <div className="mb-2 relative">
          <HiLightningBolt className="absolute left-3 top-2.5 text-amber w-4 h-4" />
          <input
            ref={skuRef}
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-dashed border-amber/50 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber bg-amber/5 placeholder:normal-case placeholder:font-sans placeholder:text-gray-400"
            placeholder="Quick-add: type or scan a SKU then press Enter…"
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSkuAdd(); }}
          />
        </div>

        {/* Row 3: Category filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              filterCategory === '' ? 'bg-navy text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.flatMap((c: Category & { children?: Category[] }) => [c, ...(c.children || [])]).map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(String(c.id))}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                filterCategory === String(c.id) ? 'bg-navy text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <Card className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {products.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="flex flex-col items-start p-3 rounded-xl border border-gray-100 hover:border-amber hover:bg-amber/5 transition-all text-left min-h-20" style={{ minHeight: '44px' }}>
                <span className="text-sm font-semibold text-navy-dark truncate w-full">{p.name}</span>
                <span className="text-xs text-gray-500 mt-1">{p.sku} - {p.unit}</span>
                <div className="mt-auto w-full">
                  <span className="text-sm font-bold text-amber-dark">
                    {resolvePrice(p, cart.client).toFixed(2)}
                  </span>
                  {cart.client?.client_tier_id && (p.tier_prices ?? []).some(t => t.client_tier_id === cart.client!.client_tier_id) && (
                    <span className="ml-1.5 text-xs text-gray-400 line-through">{Number(p.base_selling_price).toFixed(2)}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">Stock: {p.stock?.quantity_on_hand ?? 0}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-96 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b bg-navy text-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HiShoppingCart className="w-5 h-5" />
                <span className="font-semibold">Cart ({cart.items.length})</span>
              </div>
              {cart.client && <Badge variant="info">{cart.client.tier?.name}</Badge>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {cart.items.map((item) => (
              <div key={item.product.id} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.unit_price.toFixed(2)} each</p>
                  </div>
                  <button onClick={() => cart.removeItem(item.product.id)} className="p-1 text-red-400 hover:text-red-600"><HiTrash className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => cart.updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"><HiMinus className="w-3 h-3" /></button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button onClick={() => cart.updateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"><HiPlus className="w-3 h-3" /></button>
                  </div>
                  <span className="font-semibold">{item.line_total.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {cart.items.length === 0 && <p className="text-center text-gray-400 py-12 text-sm">No items in cart</p>}
          </div>

          <div className="border-t p-4 space-y-3">
            {cart.fulfillmentType === 'delivery' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Delivery Fee</label>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{cart.getSubtotal().toFixed(2)}</span></div>
            {cart.getDiscountTotal() > 0 && <div className="flex justify-between text-sm text-red-600"><span>Discount</span><span>-{cart.getDiscountTotal().toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-navy-dark"><span>TOTAL</span><span>{(cart.getTotal() + (cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0)).toFixed(2)}</span></div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={[
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'credit', label: 'Credit' },
              ]} />
              <Select value={cart.fulfillmentType} onChange={(e) => { cart.setFulfillmentType(e.target.value as 'delivery' | 'pickup'); if (e.target.value !== 'delivery') setDeliveryFee(''); }} options={[
                { value: 'pickup', label: 'Pickup' },
                { value: 'delivery', label: 'Delivery' },
              ]} />
            </div>

            <Button variant="amber" size="lg" className="w-full" onClick={handleCompleteSale} loading={processing} disabled={cart.items.length === 0}>
              Complete Sale (F9)
            </Button>
            <Button variant="secondary" size="sm" className="w-full" onClick={cart.clear}>Clear Cart</Button>
          </div>
        </Card>
      </div>

      {/* Receipt Modal */}
      <Modal isOpen={receiptModal} onClose={() => setReceiptModal(false)} title="Sale Complete" width="md">
        {lastSale && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-green-600 text-2xl">&#10003;</span>
            </div>
            <h3 className="text-xl font-bold text-navy-dark">{lastSale.transaction_number}</h3>
            <p className="text-3xl font-bold text-amber-dark">{lastSale.total_amount.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
            <p className="text-sm text-gray-500">
              {lastSale.client?.business_name || 'Walk-in Customer'} | {lastSale.fulfillment_type}
            </p>
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={async () => {
                try {
                  const res = await api.get(`/pos/sales/${lastSale.id}/receipt`, { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                  const a = document.createElement('a');
                  a.href = url; a.download = `receipt-${lastSale.transaction_number}.pdf`; a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Receipt downloaded');
                } catch { toast.error('Failed to download receipt'); }
              }}>
                Download Receipt
              </Button>
              <Button variant="amber" onClick={() => setReceiptModal(false)}>New Sale</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
