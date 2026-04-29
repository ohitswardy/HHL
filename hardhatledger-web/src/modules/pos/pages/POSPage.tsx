import { useEffect, useState, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { HiSearch, HiPlus, HiMinus, HiTrash, HiShoppingCart, HiLightningBolt, HiClock, HiTag, HiPencilAlt, HiUserAdd, HiExclamation, HiPrinter } from 'react-icons/hi';
import { useCartStore } from '../../../stores/cartStore';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { PaymentTermsModal, type PaymentTermsData } from '../components/PaymentTermsModal';
import { PriceOverrideModal } from '../components/PriceOverrideModal';
import type { Product, Client, SalesTransaction, Category, ClientTier } from '../../../types';

export function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [productRefresh, setProductRefresh] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processing, setProcessing] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [confirmSaleModal, setConfirmSaleModal] = useState(false);
  const [lastSale, setLastSale] = useState<SalesTransaction | null>(null);
  const [skuInput, setSkuInput] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [paymentTermsModal, setPaymentTermsModal] = useState(false);
  const [paymentTermsData, setPaymentTermsData] = useState<PaymentTermsData | null>(null);
  const [discountEdit, setDiscountEdit] = useState<Record<number, string>>({});
  const [qtyEdit, setQtyEdit] = useState<Record<number, string>>({});
  const [applyTax, setApplyTax] = useState(false);
  const [systemTaxRate, setSystemTaxRate] = useState(12);
  const [priceOverrideModal, setPriceOverrideModal] = useState(false);
  const [priceOverrideTarget, setPriceOverrideTarget] = useState<{
    productId: number;
    productName: string;
    currentPrice: number;
    originalPrice: number;
  } | null>(null);
  const [stockOverrideModal, setStockOverrideModal] = useState(false);
  const [stockOverrideItems, setStockOverrideItems] = useState<{ name: string; sku: string; inCart: number; available: number }[]>([]);
  const [stockOverrideConfirmed, setStockOverrideConfirmed] = useState(false);
  const [quickAddClientModal, setQuickAddClientModal] = useState(false);
  const [tiers, setTiers] = useState<ClientTier[]>([]);
  const [clientForm, setClientForm] = useState({ business_name: '', tin: '', contact_person: '', phone: '', email: '', address: '', client_tier_id: '', credit_limit: '0', notes: '' });
  const [savingClient, setSavingClient] = useState(false);
  const [printing, setPrinting] = useState(false);
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

  const handlePrintReceipt = async () => {
    if (!lastSale) return;
    setPrinting(true);
    try {
      const res = await api.get(`/pos/sales/${lastSale.id}/receipt`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMobile) {
        // On mobile the native PDF viewer handles printing via the share sheet
        window.open(blobUrl, '_blank');
      } else {
        // On desktop, inject a hidden iframe and trigger the print dialog automatically
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);
        iframe.src = blobUrl;
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              URL.revokeObjectURL(blobUrl);
            }, 60_000); // keep alive until print dialog closes
          }, 300);
        };
      }
      toast.success('Opening print dialog…');
    } catch {
      toast.error('Failed to print receipt');
    } finally {
      setPrinting(false);
    }
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
    api.get('/settings').then((res) => {
      const rate = parseFloat(res.data.data?.tax_rate?.value ?? '12');
      if (!isNaN(rate) && rate >= 0) setSystemTaxRate(rate);
    });
    api.get('/client-tiers').then((res) => {
      const t: ClientTier[] = res.data.data;
      setTiers(t);
      setClientForm((f) => ({ ...f, client_tier_id: t[0]?.id?.toString() || '' }));
    });
  }, []);

  const PER_PAGE = 40;

  // Reset + fetch page 1 whenever search/filter/refresh changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchLoading(true);
      setCurrentPage(1);
      const params: Record<string, unknown> = { per_page: PER_PAGE, page: 1, is_active: true };
      if (search.trim()) params.search = search.trim();
      if (filterCategory) params.category_id = filterCategory;
      api.get('/products', { params })
        .then((res) => {
          setProducts(res.data.data);
          setLastPage(res.data.meta?.last_page ?? 1);
        })
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterCategory, productRefresh]);

  // Infinite scroll: load next page when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && currentPage < lastPage) {
          const nextPage = currentPage + 1;
          setLoadingMore(true);
          const params: Record<string, unknown> = { per_page: PER_PAGE, page: nextPage, is_active: true };
          if (search.trim()) params.search = search.trim();
          if (filterCategory) params.category_id = filterCategory;
          api.get('/products', { params })
            .then((res) => {
              setProducts((prev) => [...prev, ...res.data.data]);
              setCurrentPage(nextPage);
              setLastPage(res.data.meta?.last_page ?? lastPage);
            })
            .finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentPage, lastPage, loadingMore, search, filterCategory]);

  const addToCart = (product: Product, qty = 1) => {
    const stock = product.stock?.quantity_on_hand ?? 0;
    const inCart = cart.items.find((i) => i.product.id === product.id)?.quantity ?? 0;
    if (inCart + qty > stock) {
      if (stock <= 0) {
        toast(`Out of stock — will require override to complete sale`, { icon: '⚠️' });
      } else {
        toast(`Exceeds available stock (${stock}) — override required at checkout`, { icon: '⚠️' });
      }
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

  const handleQuickAddClient = async () => {
    if (!clientForm.business_name.trim()) { toast.error('Business name is required'); return; }
    setSavingClient(true);
    try {
      const payload = { ...clientForm, client_tier_id: Number(clientForm.client_tier_id), credit_limit: parseFloat(clientForm.credit_limit) || 0 };
      const res = await api.post('/clients', payload);
      const newClient: Client = res.data.data;
      setClients((prev) => [...prev, newClient]);
      handleClientChange(newClient.id);
      toast.success(`Client "${newClient.business_name}" created and selected`);
      setQuickAddClientModal(false);
      setClientForm({ business_name: '', tin: '', contact_person: '', phone: '', email: '', address: '', client_tier_id: tiers[0]?.id?.toString() || '', credit_limit: '0', notes: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create client');
    } finally {
      setSavingClient(false);
    }
  };

  const handleCompleteSale = async () => {
    if (cart.items.length === 0) { toast.error('Cart is empty'); return; }

    // Check for items that exceed available stock
    const overItems = cart.items
      .filter((i) => i.quantity > (i.product.stock?.quantity_on_hand ?? 0))
      .map((i) => ({
        name: i.product.name,
        sku: i.product.sku,
        inCart: i.quantity,
        available: i.product.stock?.quantity_on_hand ?? 0,
      }));

    if (overItems.length > 0 && !stockOverrideConfirmed) {
      setStockOverrideItems(overItems);
      setStockOverrideModal(true);
      return;
    }

    setConfirmSaleModal(true);
  };

  const handleConfirmSale = async () => {
    setConfirmSaleModal(false);
    setProcessing(true);
    try {
      const fee = cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0;
      const grandTotal = cart.getTotal() + fee;
      const taxAmt = applyTax ? parseFloat((grandTotal - grandTotal / (1 + systemTaxRate / 100)).toFixed(2)) : 0;

      // Build payments array — handle payment_terms specially
      let paymentsPayload: Array<{
        payment_method: string;
        amount: number;
        reference_number?: string | null;
        due_date?: string | null;
      }>;

      if (paymentMethod === 'payment_terms' && paymentTermsData) {
        paymentsPayload = [];
        if (paymentTermsData.downPayment > 0) {
          paymentsPayload.push({
            payment_method:   paymentTermsData.downPaymentMethod,
            amount:           paymentTermsData.downPayment,
            reference_number: paymentTermsData.referenceNumber || null,
          });
        }
        const creditBalance = Math.max(0, grandTotal - paymentTermsData.downPayment);
        if (paymentTermsData.useInstallments && paymentTermsData.installments.length > 0) {
          // Create one credit payment per installment
          paymentTermsData.installments.forEach((inst) => {
            paymentsPayload.push({
              payment_method:   'credit',
              amount:           inst.amount,
              reference_number: paymentTermsData.referenceNumber || null,
              due_date:         inst.dueDate,
            });
          });
        } else {
          paymentsPayload.push({
            payment_method:   'credit',
            amount:           creditBalance,
            reference_number: paymentTermsData.referenceNumber || null,
            due_date:         paymentTermsData.dueDate,
          });
        }
      } else {
        paymentsPayload = [{ payment_method: paymentMethod, amount: grandTotal }];
      }

      const payload = {
        client_id: cart.client?.id || null,
        fulfillment_type: cart.fulfillmentType,
        force_override: stockOverrideConfirmed,
        items: cart.items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount,
          price_override_reason: i.price_override_reason ?? null,
        })),
        payments: paymentsPayload,
        delivery_fee: fee,
        tax_amount: taxAmt,
        notes: [
          saleNotes.trim(),
          paymentMethod === 'payment_terms' && paymentTermsData?.notes
            ? `Payment Terms Notes: ${paymentTermsData.notes}`
            : null,
        ].filter(Boolean).join('\n') || null,
      };
      const res = await api.post('/pos/sales', payload);
      setLastSale(res.data.data);
      toast.success(`Sale completed: ${res.data.data.transaction_number}`);
      cart.clear();
      setSaleNotes('');
      setPaymentTermsData(null);
      setPaymentMethod('cash');
      setApplyTax(false);
      setStockOverrideConfirmed(false);
      setStockOverrideItems([]);
      setProductRefresh((n) => n + 1);
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
        if (cart.items.length > 0) handleCompleteSale();
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
            <HiSearch className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--n-text-dim)' }} />
            {searchLoading && (
              <svg className="absolute right-3 top-3 w-4 h-4 animate-spin" style={{ color: 'var(--n-text-dim)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <input ref={searchRef} className="neu-inline-input w-full" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} placeholder='Search by name or SKU (press "/" to focus)' value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 flex gap-1.5">
            <Select
              value={cart.client?.id || ''}
              onChange={(e) => handleClientChange(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: `${c.business_name} (${c.tier?.name || 'N/A'})` }))}
              placeholder="Walk-in Customer"
            />
            <button
              onClick={() => setQuickAddClientModal(true)}
              className="neu-btn-icon shrink-0"
              title="Add new customer"
              style={{ padding: '0.45rem 0.6rem', borderRadius: '0.5rem', background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-border)', color: 'var(--n-accent)' }}
            >
              <HiUserAdd className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: SKU quick-add */}
        <div className="mb-2 relative">
          <HiLightningBolt className="absolute left-3 top-2.5 text-amber w-4 h-4 z-10" />
          <input
            ref={skuRef}
            type="text"
            className="neu-inline-input mono w-full"
            style={{ paddingLeft: '2.25rem', borderLeft: '3px solid var(--n-accent)' }}
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
            className={`neu-pill shrink-0 ${filterCategory === '' ? 'active' : ''}`}
          >
            All
          </button>
          {categories.flatMap((c: Category & { children?: Category[] }) => [c, ...(c.children || [])]).map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(String(c.id))}
              className={`neu-pill shrink-0 ${filterCategory === String(c.id) ? 'active' : ''}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <Card className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {products.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="neu-pos-tile">
                <span className="text-sm font-semibold truncate w-full" style={{ color: 'var(--n-text)' }}>{p.name}</span>
                <span className="text-xs mt-1" style={{ color: 'var(--n-text-secondary)' }}>{p.sku} - {p.unit}</span>
                <div className="mt-auto w-full">
                  <span className="text-sm font-bold text-amber-dark">
                    {resolvePrice(p, cart.client).toFixed(2)}
                  </span>
                  {cart.client?.client_tier_id && (p.tier_prices ?? []).some(t => t.client_tier_id === cart.client!.client_tier_id) && (
                    <span className="ml-1.5 text-xs line-through" style={{ color: 'var(--n-text-dim)' }}>{Number(p.base_selling_price).toFixed(2)}</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--n-text-dim)' }}>Stock: {p.stock?.quantity_on_hand ?? 0}</span>
              </button>
            ))}
          </div>
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-3 flex justify-center">
            {loadingMore && (
              <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--n-text-dim)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {!loadingMore && currentPage >= lastPage && products.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--n-text-dim)' }}>All {products.length} products loaded</span>
            )}
          </div>
        </Card>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-96 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <div className="neu-cart-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HiShoppingCart className="w-5 h-5" />
                <span className="font-semibold">Cart ({cart.items.length})</span>
              </div>
              {cart.client && <Badge variant="info">{cart.client.tier?.name}</Badge>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ borderBottom: '1px solid var(--n-divider)' }}>
            {cart.items.map((item) => {
              const isEditingDiscount = item.product.id in discountEdit;
              const applyDiscount = () => {
                const val = Math.max(0, parseFloat(discountEdit[item.product.id] || '0') || 0);
                const maxDiscount = item.quantity * item.unit_price;
                cart.updateDiscount(item.product.id, Math.min(val, maxDiscount));
                setDiscountEdit((prev) => { const n = { ...prev }; delete n[item.product.id]; return n; });
              };
              return (
                <div key={item.product.id} className="p-3" style={{ borderBottom: '1px solid var(--n-divider)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>{item.unit_price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (isEditingDiscount) {
                            setDiscountEdit((prev) => { const n = { ...prev }; delete n[item.product.id]; return n; });
                          } else {
                            setDiscountEdit((prev) => ({ ...prev, [item.product.id]: item.discount > 0 ? item.discount.toFixed(2) : '' }));
                          }
                        }}
                        className="neu-btn-icon"
                        title="Apply item discount"
                        style={item.discount > 0 ? { color: 'var(--n-danger)' } : undefined}
                      >
                        <HiTag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setPriceOverrideTarget({
                            productId: item.product.id,
                            productName: item.product.name,
                            currentPrice: item.unit_price,
                            originalPrice: resolvePrice(item.product, cart.client),
                          });
                          setPriceOverrideModal(true);
                        }}
                        className="neu-btn-icon"
                        title="Override price for this transaction"
                        style={item.price_override != null ? { color: 'var(--n-accent)' } : undefined}
                      >
                        <HiPencilAlt className="w-4 h-4" />
                      </button>
                      <button onClick={() => cart.removeItem(item.product.id)} className="neu-btn-icon danger"><HiTrash className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {isEditingDiscount && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs" style={{ color: 'var(--n-text-dim)' }}>Disc ₱</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus
                        className="neu-inline-input flex-1 text-right"
                        style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                        value={discountEdit[item.product.id]}
                        onChange={(e) => setDiscountEdit((prev) => ({ ...prev, [item.product.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyDiscount(); if (e.key === 'Escape') setDiscountEdit((prev) => { const n = { ...prev }; delete n[item.product.id]; return n; }); }}
                      />
                      <button onClick={applyDiscount} className="neu-btn-icon" style={{ color: 'var(--n-success)' }} title="Apply">
                        ✓
                      </button>
                    </div>
                  )}
                  {!isEditingDiscount && item.discount > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--n-danger)' }}>-₱{item.discount.toFixed(2)} disc</p>
                  )}
                  {item.price_override != null && (
                    <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--n-accent)' }}>
                      Price overridden · {item.price_override_reason}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => cart.updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} className="neu-qty-btn"><HiMinus className="w-3 h-3" /></button>
                      {item.product.id in qtyEdit ? (
                        <input
                          type="number"
                          min="1"
                          autoFocus
                          className="neu-inline-input text-center font-semibold"
                          style={{ width: '3rem', fontSize: '0.875rem', padding: '0.1rem 0.25rem' }}
                          value={qtyEdit[item.product.id]}
                          onChange={(e) => setQtyEdit((prev) => ({ ...prev, [item.product.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              const val = Math.max(1, parseInt(qtyEdit[item.product.id], 10) || 1);
                              cart.updateQuantity(item.product.id, val);
                              setQtyEdit((prev) => { const n = { ...prev }; delete n[item.product.id]; return n; });
                            }
                            if (e.key === 'Escape') {
                              setQtyEdit((prev) => { const n = { ...prev }; delete n[item.product.id]; return n; });
                            }
                          }}
                          onBlur={() => {
                            const val = Math.max(1, parseInt(qtyEdit[item.product.id], 10) || 1);
                            cart.updateQuantity(item.product.id, val);
                            setQtyEdit((prev) => { const n = { ...prev }; delete n[item.product.id]; return n; });
                          }}
                        />
                      ) : (
                        <span
                          className="w-8 text-center font-semibold cursor-pointer hover:underline"
                          title="Click to edit quantity"
                          onClick={() => setQtyEdit((prev) => ({ ...prev, [item.product.id]: String(item.quantity) }))}
                        >
                          {item.quantity}
                        </span>
                      )}
                      <button onClick={() => cart.updateQuantity(item.product.id, item.quantity + 1)} className="neu-qty-btn"><HiPlus className="w-3 h-3" /></button>
                    </div>
                    <span className="font-semibold">{item.line_total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            {cart.items.length === 0 && <p className="text-center py-12 text-sm" style={{ color: 'var(--n-text-dim)' }}>No items in cart</p>}
          </div>

          <div className="p-4 space-y-3">
            {cart.fulfillmentType === 'delivery' && (
              <div className="flex items-center gap-2">
                <label className="neu-label whitespace-nowrap" style={{ marginBottom: 0 }}>Delivery Fee</label>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--n-text-dim)' }}>₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="0.00"
                    className="neu-inline-input w-full text-right"
                    style={{ paddingLeft: '1.5rem' }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{cart.getSubtotal().toFixed(2)}</span></div>
            {cart.getDiscountTotal() > 0 && <div className="flex justify-between text-sm" style={{ color: 'var(--n-danger)' }}><span>Discount</span><span>-{cart.getDiscountTotal().toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold" style={{ fontFamily: 'var(--n-font-display)' }}><span>TOTAL</span><span>{(cart.getTotal() + (cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0)).toFixed(2)}</span></div>

            <div className="grid grid-cols-2 gap-2">
              <Select
                value={paymentMethod}
                onChange={(e) => {
                  const v = e.target.value;
                  setPaymentMethod(v);
                  if (v === 'payment_terms') {
                    setPaymentTermsModal(true);
                  } else {
                    setPaymentTermsData(null);
                  }
                }}
                searchThreshold={10}
                options={[
                  { value: 'cash',          label: 'Cash' },
                  { value: 'payment_terms', label: 'Payment Terms' },
                  { value: 'credit',        label: 'Credit' },
                  { value: 'card',          label: 'Card' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'business_bank', label: 'Business Bank' },
                  { value: 'check',         label: 'Check' },
                ]}
              />
              <Select value={cart.fulfillmentType} onChange={(e) => { cart.setFulfillmentType(e.target.value as 'delivery' | 'pickup'); if (e.target.value !== 'delivery') setDeliveryFee(''); }} options={[
                { value: 'pickup', label: 'Pickup' },
                { value: 'delivery', label: 'Delivery' },
              ]} />
            </div>

            {/* Payment terms active indicator */}
            {paymentMethod === 'payment_terms' && paymentTermsData && (
              <button
                onClick={() => setPaymentTermsModal(true)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                style={{
                  background: 'var(--n-surface-raised, var(--n-surface))',
                  border: '1px solid var(--n-accent)',
                  color: 'var(--n-accent)',
                }}
              >
                <HiClock className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">
                  {paymentTermsData.useInstallments && paymentTermsData.installments.length > 0
                    ? `${paymentTermsData.installments.length} installments — ₱${paymentTermsData.installments.reduce((s, i) => s + i.amount, 0).toFixed(2)}`
                    : `Net ${paymentTermsData.termsDays}d — Due ${paymentTermsData.dueDate}`
                  }
                  {paymentTermsData.downPayment > 0 && ` — Down ₱${paymentTermsData.downPayment.toFixed(2)}`}
                </span>
                <span className="underline">Edit</span>
              </button>
            )}
            {paymentMethod === 'payment_terms' && !paymentTermsData && (
              <button
                onClick={() => setPaymentTermsModal(true)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                style={{
                  background: 'var(--n-surface-raised, var(--n-surface))',
                  border: '1px dashed var(--n-danger)',
                  color: 'var(--n-danger)',
                }}
              >
                <HiClock className="w-4 h-4 shrink-0" />
                <span>Click to set payment terms before completing sale</span>
              </button>
            )}

            <Button
              variant="amber"
              size="lg"
              className="w-full"
              onClick={handleCompleteSale}
              loading={processing}
              disabled={cart.items.length === 0 || (paymentMethod === 'payment_terms' && !paymentTermsData)}
            >
              Complete Sale (F9)
            </Button>
            <Button variant="secondary" size="sm" className="w-full" onClick={cart.clear}>Clear Cart</Button>
          </div>
        </Card>
      </div>

      {/* Confirm Sale Modal */}
      <Modal isOpen={confirmSaleModal} onClose={() => setConfirmSaleModal(false)} title="Confirm Sale" width="sm">
        <div className="space-y-4">
          {/* Order summary */}
          <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--n-surface-raised, var(--n-surface))' }}>
            {cart.items.map((item) => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span style={{ color: 'var(--n-text-secondary)' }}>{item.product.name} × {item.quantity}</span>
                <span className="font-medium">{item.line_total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Client</span>
              <span className="font-medium">{cart.client?.business_name || 'Walk-in'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Payment</span>
              {paymentMethod === 'payment_terms' && paymentTermsData ? (
                <span className="font-medium" style={{ color: 'var(--n-accent)' }}>
                  {paymentTermsData.useInstallments && paymentTermsData.installments.length > 0
                    ? `${paymentTermsData.installments.length}-installment plan`
                    : `Net ${paymentTermsData.termsDays}d — due ${paymentTermsData.dueDate}`
                  }
                </span>
              ) : (
                <span className="font-medium" style={{ textTransform: 'capitalize' }}>{paymentMethod.replace('_', ' ')}</span>
              )}
            </div>
            {paymentMethod === 'payment_terms' && paymentTermsData && paymentTermsData.downPayment > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--n-text-secondary)' }}>Down Payment ({paymentTermsData.downPaymentMethod})</span>
                <span className="font-medium" style={{ color: 'var(--n-success)' }}>₱{paymentTermsData.downPayment.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Fulfillment</span>
              <span className="font-medium" style={{ textTransform: 'capitalize' }}>{cart.fulfillmentType}</span>
            </div>
            {cart.fulfillmentType === 'delivery' && parseFloat(deliveryFee) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--n-text-secondary)' }}>Delivery Fee</span>
                <span className="font-medium">{parseFloat(deliveryFee).toFixed(2)}</span>
              </div>
            )}
            {cart.getDiscountTotal() > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--n-danger)' }}>
                <span>Discount</span>
                <span>-{cart.getDiscountTotal().toFixed(2)}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>
              Notes <span style={{ color: 'var(--n-text-dim)', fontWeight: 400 }}>(optional — e.g. bank name, reference #)</span>
            </label>
            <textarea
              className="neu-inline-input w-full"
              style={{ minHeight: '3.5rem', resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="e.g. BDO Transfer — Ref# 20260407-1234"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              maxLength={500}
            />
          </div>
          {paymentMethod === 'payment_terms' && paymentTermsData && (
            <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-accent)' }}>
              {paymentTermsData.useInstallments && paymentTermsData.installments.length > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--n-text-secondary)' }}>Terms</span>
                    <span className="font-medium" style={{ color: 'var(--n-accent)' }}>{paymentTermsData.installments.length}-installment plan</span>
                  </div>
                  {paymentTermsData.installments.map((inst, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span style={{ color: 'var(--n-text-secondary)' }}>Installment {idx + 1} — due {inst.dueDate}</span>
                      <span className="font-medium">₱{inst.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--n-text-secondary)' }}>Terms</span>
                    <span className="font-medium" style={{ color: 'var(--n-accent)' }}>Net {paymentTermsData.termsDays}d</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--n-text-secondary)' }}>Due Date</span>
                    <span className="font-medium">{paymentTermsData.dueDate}</span>
                  </div>
                </>
              )}
              {paymentTermsData.downPayment > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Down Payment ({paymentTermsData.downPaymentMethod})</span>
                  <span className="font-medium" style={{ color: 'var(--n-success)' }}>₱{paymentTermsData.downPayment.toFixed(2)}</span>
                </div>
              )}
              {paymentTermsData.referenceNumber && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Reference #</span>
                  <span className="font-medium">{paymentTermsData.referenceNumber}</span>
                </div>
              )}
            </div>
          )}
          {/* VAT / Sales Tax toggle */}
          {(() => {
            const baseFee = cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0;
            const grandTotal = cart.getTotal() + baseFee;
            const taxAmt = applyTax ? parseFloat((grandTotal - grandTotal / (1 + systemTaxRate / 100)).toFixed(2)) : 0;
            return (
              <>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm pt-1">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <span>Apply VAT / Sales Tax ({systemTaxRate}%)</span>
                </label>
                {applyTax && (
                  <div className="flex justify-between text-sm" style={{ color: 'var(--n-info)' }}>
                    <span>VAT incl. ({systemTaxRate}%)</span>
                    <span>{taxAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2" style={{ borderTop: '1px solid var(--n-divider)', fontFamily: 'var(--n-font-display)' }}>
                  <span>TOTAL</span>
                  <span className="text-amber-dark">{grandTotal.toFixed(2)}</span>
                </div>
              </>
            );
          })()}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmSaleModal(false)}>Back</Button>
            <Button variant="amber" className="flex-1" onClick={handleConfirmSale} loading={processing}>
              Confirm & Process
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment Terms Modal */}
      <PaymentTermsModal
        isOpen={paymentTermsModal}
        onClose={() => {
          if (!paymentTermsData) setPaymentMethod('cash');
          setPaymentTermsModal(false);
        }}
        onConfirm={(data) => {
          setPaymentTermsData(data);
          setPaymentTermsModal(false);
          toast.success(data.useInstallments && data.installments.length > 0
            ? `Terms set: ${data.installments.length}-installment plan — first due ${data.dueDate}`
            : `Terms set: Net ${data.termsDays}d — due ${data.dueDate}`
          );
        }}
        totalAmount={cart.getTotal() + (cart.fulfillmentType === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0)}
        initialData={paymentTermsData}
      />

      {/* Receipt Modal */}
      <Modal isOpen={receiptModal} onClose={() => setReceiptModal(false)} title="Sale Complete" width="md">
        {lastSale && (() => {
          const creditPayments = lastSale.payments?.filter((p) => p.payment_method === 'credit') ?? [];
          const downPayments   = lastSale.payments?.filter((p) => p.payment_method !== 'credit') ?? [];
          const isTermsSale    = creditPayments.length > 0;
          const isInstallment  = creditPayments.length > 1;
          return (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--n-success-glow)' }}>
                <span className="text-2xl" style={{ color: 'var(--n-success)' }}>&#10003;</span>
              </div>
              <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--n-font-display)' }}>{lastSale.transaction_number}</h3>
              <p className="text-3xl font-bold text-amber-dark">{lastSale.total_amount.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                {lastSale.client?.business_name || 'Walk-in Customer'} | {lastSale.fulfillment_type}
              </p>
              {lastSale.tax_amount > 0 && (
                <p className="text-xs" style={{ color: 'var(--n-info)' }}>
                  VAT included: ₱{lastSale.tax_amount.toFixed(2)}
                </p>
              )}

              {/* Payment Terms summary block */}
              {isTermsSale && (
                <div className="text-left rounded-lg px-4 py-3 space-y-1.5 text-sm" style={{ background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-accent)' }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--n-accent)' }}>
                    {isInstallment ? 'Installment Plan Applied' : 'Payment Terms Applied'}
                  </p>
                  {downPayments.length > 0 && downPayments.map((dp) => (
                    <div key={dp.id} className="flex justify-between">
                      <span style={{ color: 'var(--n-text-secondary)' }}>Down Payment ({dp.payment_method.replace('_', ' ')})</span>
                      <span className="font-semibold" style={{ color: 'var(--n-success)' }}>₱{dp.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {isInstallment ? (
                    creditPayments.map((cp, idx) => (
                      <div key={cp.id} className="flex justify-between">
                        <span style={{ color: 'var(--n-text-secondary)' }}>Installment {idx + 1} — due {cp.due_date ?? '—'}</span>
                        <span className="font-semibold text-amber-dark">₱{cp.amount.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      {creditPayments[0]?.due_date && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--n-text-secondary)' }}>Due Date</span>
                          <span className="font-semibold">{creditPayments[0].due_date}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
                        <span style={{ color: 'var(--n-text-secondary)' }}>Balance on Credit</span>
                        <span className="font-bold text-amber-dark">₱{creditPayments[0]?.amount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {isInstallment && (
                    <div className="flex justify-between pt-1 font-bold" style={{ borderTop: '1px solid var(--n-divider)' }}>
                      <span style={{ color: 'var(--n-text-secondary)' }}>Total on Credit</span>
                      <span className="text-amber-dark">₱{creditPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</span>
                    </div>
                  )}
                  <p className="text-xs pt-1" style={{ color: 'var(--n-text-dim)' }}>
                    Status is <strong>Pending</strong> — mark as Completed once payment is received.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-center pt-2 flex-wrap">
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
                <Button variant="outline" onClick={handlePrintReceipt} loading={printing}>
                  <HiPrinter className="w-4 h-4 mr-1.5" />
                  Print Receipt
                </Button>
                <Button variant="amber" onClick={() => setReceiptModal(false)}>New Sale</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Quick Add Client Modal */}
      <Modal isOpen={quickAddClientModal} onClose={() => setQuickAddClientModal(false)} title="Add New Customer" width="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Business Name *"
              value={clientForm.business_name}
              onChange={(e) => setClientForm({ ...clientForm, business_name: e.target.value })}
              placeholder="e.g. Twinbar Construction"
              required
            />
            <Input
              label="TIN #"
              value={clientForm.tin}
              onChange={(e) => setClientForm({ ...clientForm, tin: e.target.value })}
              placeholder="000-000-000-000"
            />
            <Input
              label="Contact Person"
              value={clientForm.contact_person}
              onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })}
              placeholder="e.g. Juan Dela Cruz"
            />
            <Input
              label="Phone"
              value={clientForm.phone}
              onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              placeholder="+63 9XX XXX XXXX"
            />
            <Input
              label="Email"
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              placeholder="email@example.com"
            />
            <Select
              label="Client Tier"
              value={clientForm.client_tier_id}
              onChange={(e) => setClientForm({ ...clientForm, client_tier_id: e.target.value })}
              options={tiers.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Input
              label="Credit Limit"
              type="number"
              step="0.01"
              value={clientForm.credit_limit}
              onChange={(e) => setClientForm({ ...clientForm, credit_limit: e.target.value })}
            />
            <div className="col-span-2">
              <Input
                label="Address"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                placeholder="Street, City, Province"
              />
            </div>
            <div className="col-span-2">
              <label className="neu-label">Notes</label>
              <textarea
                className="neu-inline-input w-full"
                style={{ minHeight: '4rem', resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Optional notes about this customer"
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setQuickAddClientModal(false)}>Cancel</Button>
            <Button variant="amber" onClick={handleQuickAddClient} loading={savingClient}>
              <HiUserAdd className="w-4 h-4 mr-1.5" /> Save &amp; Select
            </Button>
          </div>
        </div>
      </Modal>

      {/* Price Override Modal */}
      <PriceOverrideModal
        isOpen={priceOverrideModal}
        target={priceOverrideTarget}
        onClose={() => setPriceOverrideModal(false)}
        onApply={(productId, newPrice, reason) => {
          cart.overridePrice(productId, newPrice, reason);
          toast.success(`Price overridden: ₱${newPrice.toFixed(2)} (${reason})`);
        }}
      />

      {/* Stock Quantity Override Warning Modal */}
      <Modal isOpen={stockOverrideModal} onClose={() => setStockOverrideModal(false)} title="Stock quantity warning" width="sm">
        <div className="space-y-4">
          {/* Header notice */}
          <div className="flex gap-3 items-start rounded-lg p-3" style={{ background: 'rgba(245, 166, 35, 0.08)', border: '1px solid rgba(245, 166, 35, 0.3)' }}>
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 166, 35, 0.15)' }}>
              <HiExclamation className="w-5 h-5" style={{ color: 'var(--n-accent)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--n-text-secondary)' }}>
              The following items in the cart exceed current inventory.<br />
              The sale will result in negative stock.
            </p>
          </div>

          {/* Items table */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--n-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--n-surface-raised, var(--n-surface))', borderBottom: '1px solid var(--n-border)' }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Item</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>In cart</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Available</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Short by</th>
                </tr>
              </thead>
              <tbody>
                {stockOverrideItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: idx < stockOverrideItems.length - 1 ? '1px solid var(--n-border)' : undefined }}>
                    <td className="px-3 py-2">
                      <p className="font-medium" style={{ color: 'var(--n-text)' }}>{item.name}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>{item.sku}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--n-text)' }}>{item.inCart}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--n-text-secondary)' }}>{item.available}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: 'var(--n-danger)' }}>{item.available - item.inCart}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Explanation */}
          <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(245, 166, 35, 0.06)', border: '1px solid rgba(245, 166, 35, 0.25)', color: 'var(--n-text-secondary)' }}>
            <strong style={{ color: 'var(--n-text)' }}>Proceeding will post negative stock.</strong> This is allowed but
            should be corrected with a stock adjustment or purchase order receipt as soon as possible.
            Each overridden item will be flagged in the Inventory module.
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setStockOverrideModal(false);
                setStockOverrideConfirmed(false);
              }}
            >
              Cancel sale
            </Button>
            <Button
              variant="amber"
              className="flex-1"
              onClick={() => {
                setStockOverrideConfirmed(true);
                setStockOverrideModal(false);
                setConfirmSaleModal(true);
              }}
            >
              Proceed anyway
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
