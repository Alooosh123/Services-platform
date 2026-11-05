'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Gamepad2,
  CheckCircle,
  AlertCircle,
  Wallet,
  Zap,
  ArrowRight,
  ShieldCheck,
  Check,
  Copy,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { apiRequest, apiUrl, getCustomerToken } from '../../../lib/api';

export default function GameTopupPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<'YER' | 'USD' | 'SAR'>('YER');
  const [userWallets, setUserWallets] = useState<Record<string, any>>({});

  // Form State
  const [playerInputs, setPlayerInputs] = useState<Record<string, string>>({});
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [playerValidation, setPlayerValidation] = useState<{
    tested: boolean;
    valid?: boolean;
    playerName?: string;
    message?: string;
  }>({ tested: false });
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);

  // Fetch Service Catalog and User Wallets
  useEffect(() => {
    fetchGameDetails();
    fetchCustomerWallets();
    fetchLinkedAccounts();
  }, [slug]);

  const fetchLinkedAccountsLegacy = async () => {
    try {
      const res = await fetch(apiUrl('/service-accounts'), {
        headers: { Authorization: 'Bearer mock-customer-token' },
      });
      if (res.ok) {
        const data = await res.json();
        setLinkedAccounts(data.data || []);
      }
    } catch {}
  };

  const fetchCustomerWalletsLegacy = async () => {
    try {
      const token = getCustomerToken();
      if (!token) return;
      const res = await fetch(apiUrl('/wallet/balances'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        for (const w of data) {
          map[w.currency] = w;
        }
        setUserWallets(map);
      }
    } catch {}
  };

  const fetchLinkedAccounts = async () => {
    if (!getCustomerToken()) return;
    try {
      const data = await apiRequest<any[] | { data?: any[] }>('/service-accounts');
      setLinkedAccounts(Array.isArray(data) ? data : data.data || []);
    } catch {
      setLinkedAccounts([]);
    }
  };

  const fetchCustomerWallets = async () => {
    if (!getCustomerToken()) {
      setUserWallets({});
      return;
    }
    try {
      const data = await apiRequest<any[]>('/wallet/balances');
      const map: Record<string, any> = {};
      for (const wallet of data) map[wallet.currency] = wallet;
      setUserWallets(map);
    } catch {
      setUserWallets({});
    }
  };

  const fetchGameDetails = async () => {
    try {
      const service = await apiRequest<any>(`/products/service/${encodeURIComponent(slug)}`);
      const packages = (service.products || []).map((product: any) => ({
        ...product,
        isActive: product.isAvailable,
      }));
      const normalizedService = {
        ...service,
        playerFields: (service.playerFields || service.fields || []).map((field: any) => ({
          ...field,
          key: field.key || field.fieldKey,
        })),
        products: [{ packages }],
      };
      setGame(normalizedService);
      setSelectedPackage(packages[0] || null);
      setGameError(null);
    } catch (err) {
      setGame(null);
      setGameError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الخدمة');
    } finally {
      setLoading(false);
    }
  };

  const getPackagePrice = (pkg: any, currency: 'YER' | 'USD' | 'SAR') => {
    if (!pkg) return 0;
    if (pkg.prices && typeof pkg.prices === 'object') {
      if (Array.isArray(pkg.prices)) {
        const found = pkg.prices.find((p: any) => p.currency === currency);
        if (found) return Number(found.retailPrice);
      } else if (pkg.prices[currency] !== undefined) {
        return Number(pkg.prices[currency]);
      }
    }
    return Number(pkg.retailPrice || 0);
  };

  const handleInputChange = (key: string, val: string) => {
    setPlayerInputs((prev) => ({ ...prev, [key]: val }));
    setPlayerValidation({ tested: false });
    setCheckoutError(null);
  };

  const handleValidatePlayer = async () => {
    if (!playerInputs.player_id && !playerInputs.userId) {
      alert('يرجى إدخال معرف اللاعب أولاً');
      return;
    }
    setIsValidating(true);
    try {
      const data = await apiRequest<any>('/providers/validate-player', {
        method: 'POST',
        body: JSON.stringify({
          providerCode: 'MOCK',
          serviceId: game?.id,
          fields: playerInputs,
        }),
      });
      setPlayerValidation({
        tested: true,
        valid: data.isValid === true,
        playerName: data.isValid === true ? data.playerName : undefined,
        message: data.errorMessage || (data.isValid === true ? undefined : 'لم يتم التحقق من معرف اللاعب'),
      });
    } catch (err) {
      setPlayerValidation({
        tested: true,
        valid: false,
        message: err instanceof Error ? err.message : 'تعذر الاتصال بخدمة التحقق',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleCheckout = async () => {
    setCheckoutError(null);

    // Validate Dynamic Inputs
    for (const field of game.playerFields || []) {
      if (field.required && !playerInputs[field.key]) {
        setCheckoutError(`الحقل "${field.labelAr || field.label}" مطلوب.`);
        return;
      }
      if (playerInputs[field.key] && field.validationRegex) {
        const regex = new RegExp(field.validationRegex);
        if (!regex.test(playerInputs[field.key])) {
          setCheckoutError(`صيغة المدخل للحقل "${field.labelAr || field.label}" غير صحيحة.`);
          return;
        }
      }
    }

    if (!selectedPackage) {
      setCheckoutError('يرجى اختيار باقة الشحن.');
      return;
    }

    if (selectedPackage.isActive === false) {
      setCheckoutError('⚠️ هذه الباقة متوقفة حالياً بموجب زر الإيقاف الطارئ (Emergency Kill Switch). لا يمكن إتمام الشحن لمنع الخسائر.');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }

    const currentWallet = userWallets[selectedCurrency];
    const itemPrice = getPackagePrice(selectedPackage, selectedCurrency);
    if (currentWallet && Number(currentWallet.availableBalance) < itemPrice) {
      setCheckoutError(
        `الرصيد المتاح في محفظة ${selectedCurrency} غير كافٍ. المطلوب: ${itemPrice} ${selectedCurrency}، المتاح: ${Number(currentWallet.availableBalance).toLocaleString()} ${selectedCurrency}. يرجى إيداع رصيد أولاً.`,
      );
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(apiUrl('/orders/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: selectedPackage.id,
          currency: selectedCurrency,
          playerFields: playerInputs,
          idempotencyKey,
          paymentMethod: 'WALLET',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setOrderResult(data);
        // Refresh wallets
        fetchCustomerWallets();
      } else {
        setCheckoutError(data.message || 'فشلت عملية إنشاء الطلب. تحقق من بياناتك ورصيدك.');
      }
    } catch (err: any) {
      setCheckoutError(err?.message || 'حدث خطأ في الاتصال بالخادم أثناء تأكيد الشحن.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-slate-400">
        {loading ? 'جاري تحميل بيانات الخدمة...' : gameError || 'الخدمة غير متاحة حالياً.'}
      </div>
    );
  }

  const packagesList = game.products?.[0]?.packages || [];
  const activeWallet = userWallets[selectedCurrency] || { availableBalance: 0, isFrozen: false };
  const currentPrice = getPackagePrice(selectedPackage, selectedCurrency);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right">
      {/* Breadcrumb */}
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowRight className="w-3.5 h-3.5" /> العودة إلى متجر الخدمات
      </Link>

      {/* Header Info */}
      <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
          <Gamepad2 className="w-8 h-8" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">{game.nameAr || game.name}</h1>
            <span className="text-slate-400 text-sm font-mono">({game.name})</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            شحن فوري ومباشر إلى حسابك داخل اللعبة. حجز الرصيد الذري وتسوية السجل المالي المزدوج.
          </p>
        </div>
      </div>

      {/* Error Alert if any */}
      {checkoutError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold">{checkoutError}</span>
        </div>
      )}

      {/* Checkout Form Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* STEP 1: Dynamic Player Form Fields */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <h2 className="text-sm font-bold text-white tracking-wider">
                  إدخال بيانات حساب المستفيد واللاعب
                </h2>
              </div>
            </div>

            {/* Quick Fill from Linked Accounts if available */}
            {linkedAccounts.filter((a) => a.serviceSlug === slug && a.status !== 'REVOKED').length > 0 && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                  <span>⚡ استخدام حساب مرتبط مسبقاً:</span>
                </span>
                <div className="flex gap-2">
                  {linkedAccounts
                    .filter((a) => a.serviceSlug === slug && a.status !== 'REVOKED')
                    .map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          handleInputChange('player_id', acc.accountIdentifier);
                          if (acc.serverZoneId) handleInputChange('zone_id', acc.serverZoneId);
                        }}
                        className="bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white px-3 py-1.5 rounded-lg border border-indigo-500/40 font-mono transition-all text-xs font-bold"
                      >
                        {acc.accountName || acc.accountIdentifier} ({acc.accountIdentifier})
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {((game.playerFields as any[]) || []).map((field: any) => (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-slate-300 font-medium">
                      {field.labelAr || field.label}
                      {field.required && <span className="text-rose-400 mr-1">*</span>}
                    </label>
                    {field.validationRegex && (
                      <span className="text-[10px] text-slate-500 font-mono">حقل خاضع للتحقق</span>
                    )}
                  </div>
                  <input
                    type="text"
                    required={field.required}
                    placeholder={field.placeholderAr || field.placeholder || `أدخل ${field.labelAr || field.label}`}
                    value={playerInputs[field.key] || ''}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors text-right font-mono"
                  />
                  {(field.helperTextAr || field.helperText) && (
                    <p className="text-[11px] text-slate-400">{field.helperTextAr || field.helperText}</p>
                  )}
                </div>
              ))}

              {/* Verify Player ID Button & Badge */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleValidatePlayer}
                  disabled={isValidating}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl transition-colors"
                >
                  {isValidating ? 'جاري الفحص المباشر...' : 'التحقق من اسم الحساب'}
                </button>

                {playerValidation.tested && (
                  <div>
                    {playerValidation.valid ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        اسم اللاعب الموثق: <strong>{playerValidation.playerName}</strong>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {playerValidation.message || 'معرف اللاعب غير موجود'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: Currency Selector & Package Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <h2 className="text-sm font-bold text-white tracking-wider">
                  اختر الباقة والعملة
                </h2>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['YER', 'USD', 'SAR'] as const).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => setSelectedCurrency(cur)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      selectedCurrency === cur
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cur === 'YER' ? 'ريال يمني' : cur === 'USD' ? 'دولار ($)' : 'ريال سعودي'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {packagesList.map((pkg: any) => {
                const isKillSwitched = pkg.isActive === false;
                const isSelected = selectedPackage?.id === pkg.id && !isKillSwitched;
                const price = getPackagePrice(pkg, selectedCurrency);
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    disabled={isKillSwitched}
                    onClick={() => !isKillSwitched && setSelectedPackage(pkg)}
                    className={`p-4 rounded-xl border text-right transition-all relative ${
                      isKillSwitched
                        ? 'opacity-50 bg-rose-950/20 border-rose-900/40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-600/20 scale-[1.02]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <span className="text-xs font-bold text-white block">{pkg.nameAr || pkg.name}</span>
                    <span className="text-sm font-black font-mono text-emerald-400 mt-2 block">
                      {price.toLocaleString()} {selectedCurrency}
                    </span>
                    {isKillSwitched && (
                      <span className="mt-1.5 inline-block text-[10px] text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded font-mono">
                        ⚠️ متوقفة مؤقتاً (صيانة)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* STEP 3: Order Summary & Checkout Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 sticky top-24 shadow-xl">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              ملخص تفاصيل الشحن
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>الخدمة:</span>
                <span className="text-white font-medium">{game.nameAr || game.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>الباقة المختارة:</span>
                <span className="text-white font-medium">{selectedPackage?.nameAr || selectedPackage?.name || 'لم تحدد'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>معرف اللاعب:</span>
                <span className="text-indigo-400 font-mono font-medium">
                  {playerInputs.player_id || playerInputs.userId || 'لم يُدخل بعد'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>العملة المعتمدة:</span>
                <span className="text-white font-bold">{selectedCurrency}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>سرعة التسليم:</span>
                <span className="text-emerald-400 font-medium">فوري ومباشر ⚡</span>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-300">السعر الإجمالي:</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {currentPrice.toLocaleString()} {selectedCurrency}
              </span>
            </div>

            {/* Real Wallet Balance Card */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" /> رصيد محفظة {selectedCurrency}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {Number(activeWallet.availableBalance || 0).toLocaleString()} {selectedCurrency}
                </span>
              </div>
              {activeWallet.isFrozen ? (
                <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> المحفظة مجمدة من الإدارة
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  يتم حجز الرصيد ذرياً فوراً والتسوية عبر السجل المزدوج.
                </p>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting || activeWallet.isFrozen}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 group"
            >
              <Zap className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
              {isSubmitting ? 'جاري حجز الرصيد والتنفيذ...' : 'تأكيد وشحن الحساب الآن'}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>حماية كاملة، حجز رصيد ذري، وضمان استرداد فوري عند الفشل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {orderResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">تم إنشاء الشحنة بنجاح!</h3>
              <p className="text-xs text-slate-400">
                تم حجز الرصيد وتسجيل القيد في السجل المالي المزدوج.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2 text-right font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">رقم الطلب:</span>
                <span className="text-indigo-400 font-bold">{orderResult.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الخدمة:</span>
                <span className="text-white">{orderResult.snapshotServiceNameAr || game.nameAr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ المحجوز:</span>
                <span className="text-emerald-400 font-bold">
                  {Number(orderResult.snapshotRetailPrice).toLocaleString()} {orderResult.snapshotCurrency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الحالة:</span>
                <span className="text-emerald-400 font-bold">{orderResult.status}</span>
              </div>
              {orderResult.voucherCode && (
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">كود القسيمة:</span>
                  <span className="text-amber-400 font-bold">{orderResult.voucherCode}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOrderResult(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                شحن طلب آخر
              </button>
              <Link
                href={`/orders/${orderResult.id}`}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center"
              >
                تتبع مسار الطلب
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
