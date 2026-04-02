import { useEffect, useState, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { HiSearch, HiPlus, HiMinus, HiTrash, HiShoppingCart } from 'react-icons/hi';
import { useCartStore } from '../../../stores/cartStore';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Product, Client, SalesTransaction } from '../../../types';

export function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processing, setProcessing] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [lastSale, setLastSale] = useState<SalesTransaction | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const cart = useCartStore();

  useEffect(() => {
    api.get('/products', { params: { per_page: 100, is_active: true } }).then((res) => setProducts(res.data.data));
    api.get('/clients', { params: { per_page: 100 } }).then((res) => setClients(res.data.data));
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = async (product: Product) => {
    let price = product.base_selling_price;
    if (cart.client) {
      try {
        const res = await api.get(`/products/${product.id}/price`, { params: { client_id: cart.client.id } });
        price = res.data.price;
      } catch { /* use base */ }
    }
    cart.addItem(product, 1, price);
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
        payments: [{ payment_method: paymentMethod, amount: cart.getTotal() }],
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
        <div className="mb-3 flex gap-3">
          <div className="flex-1 relative">
            <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input ref={searchRef} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder='Search products (press "/" to focus)' value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={cart.client?.id || ''} onChange={(e) => {
            const c = clients.find((cl) => cl.id === Number(e.target.value));
            cart.setClient(c || null);
          }} options={clients.map((c) => ({ value: c.id, label: `${c.business_name} (${c.tier?.name || 'N/A'})` }))} placeholder="Walk-in Customer" className="w-64" />
        </div>

        <Card className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredProducts.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="flex flex-col items-start p-3 rounded-xl border border-gray-100 hover:border-amber hover:bg-amber/5 transition-all text-left min-h-[80px]" style={{ minHeight: '44px' }}>
                <span className="text-sm font-semibold text-navy-dark truncate w-full">{p.name}</span>
                <span className="text-xs text-gray-500 mt-1">{p.sku} - {p.unit}</span>
                <span className="text-sm font-bold text-amber-dark mt-auto">{p.base_selling_price.toFixed(2)}</span>
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
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{cart.getSubtotal().toFixed(2)}</span></div>
            {cart.getDiscountTotal() > 0 && <div className="flex justify-between text-sm text-red-600"><span>Discount</span><span>-{cart.getDiscountTotal().toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-navy-dark"><span>TOTAL</span><span>{cart.getTotal().toFixed(2)}</span></div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={[
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'credit', label: 'Credit' },
              ]} />
              <Select value={cart.fulfillmentType} onChange={(e) => cart.setFulfillmentType(e.target.value as 'delivery' | 'pickup')} options={[
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
              <Button variant="outline" onClick={() => window.open(`http://localhost:8000/api/v1/pos/sales/${lastSale.id}/receipt`, '_blank')}>
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
