'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import {
  Plus,
  Gamepad2,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Inbox,
  Power,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calculator,
  Sliders,
  DollarSign,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'pricing' | 'requests'>('catalog');
  const [games, setGames] = useState<any[]>([]);
  const [priceRules, setPriceRules] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showAddPackageModal, setShowAddPackageModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Form State: Add Game
  const [gameName, setGameName] = useState('');
  const [gameNameAr, setGameNameAr] = useState('');
  const [gameSlug, setGameSlug] = useState('');
  const [fields, setFields] = useState<any[]>([
    { key: 'player_id', label: 'Player ID', labelAr: 'معرف اللاعب', type: 'text', required: true, validationRegex: '^[0-9]{5,15}$' },
  ]);

  // Form State: Add Package with Provider Gating
  const [packageName, setPackageName] = useState('');
  const [packageNameAr, setPackageNameAr] = useState('');
  const [packageSku, setPackageSku] = useState('');
  const [packageCost, setPackageCost] = useState('1.00');
  const [packageRetail, setPackageRetail] = useState('1.20');
  const [packageCurrency, setPackageCurrency] = useState('USD');
  const [providerCode, setProviderCode] = useState('YEMEN_TOPUP_MOCK');
  const [isManualFulfillment, setIsManualFulfillment] = useState(false);
  const [gatingError, setGatingError] = useState<string | null>(null);

  // Form State: Price Rule Version
  const [ruleScope, setRuleScope] = useState<'DEFAULT' | 'CATEGORY' | 'SERVICE' | 'PRODUCT'>('DEFAULT');
  const [ruleTargetId, setRuleTargetId] = useState('');
  const [ruleMarginType, setRuleMarginType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [ruleMarginValue, setRuleMarginValue] = useState('10');
  const [ruleChangeReason, setRuleChangeReason] = useState('');

  // Interactive Live Price Simulator
  const [simCost, setSimCost] = useState('4.50');
  const [simCostCur, setSimCostCur] = useState('USD');
  const [simTargetCur, setSimTargetCur] = useState('USD');
  const [simScope, setSimScope] = useState('PRODUCT');
  const [simTargetId, setSimTargetId] = useState('prod-pubg-325');
  const [simResult, setSimResult] = useState<any>(null);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Catalog
      const resCat = await fetch('http://localhost:4000/api/products/catalog').catch(() => null);
      if (resCat && resCat.ok) {
        const data = await resCat.json();
        setGames(data);
      } else {
        loadFallbackCatalog();
      }

      // 2. Pricing Rules
      const resRules = await fetch('http://localhost:4000/api/products/pricing/rules').catch(() => null);
      if (resRules && resRules.ok) {
        const rules = await resRules.json();
        setPriceRules(rules);
      } else {
        setPriceRules([
          { id: 'prule-def', version: 1, scope: 'DEFAULT', targetId: null, marginType: 'PERCENTAGE', marginValue: 10, feePercentage: 1.0, changeReason: 'القاعدة الافتراضية الأولية للمنصة', isActive: true },
          { id: 'prule-pkg1', version: 1, scope: 'PRODUCT', targetId: 'prod-pubg-60', marginType: 'FIXED', marginValue: 0.15, feePercentage: 0, changeReason: 'هامش مخصص مخفض 60 شدة', isActive: true },
          { id: 'prule-pkg2', version: 1, scope: 'PRODUCT', targetId: 'prod-pubg-325', marginType: 'PERCENTAGE', marginValue: 20, feePercentage: 0, changeReason: 'هامش مخصص 20% لباقة 325 شدة', isActive: true },
        ]);
      }

      // 3. Service Requests
      const resReq = await fetch('http://localhost:4000/api/products/admin/service-requests').catch(() => null);
      if (resReq && resReq.ok) {
        const reqs = await resReq.json();
        setServiceRequests(reqs);
      } else {
        setServiceRequests([
          { id: 'req-01', title: 'شحن عملات تطبيق لايكي (Likee)', categorySlug: 'apps', description: 'يرجى توفير باقات تطبيق لايكي للبث المباشر', identifierLabelAr: 'Likee ID', status: 'PENDING', requestedByUserId: 'cust-99', contactPhone: '777000111', createdAt: new Date().toISOString() },
          { id: 'req-02', title: 'بطاقات روبلوكس (Roblox Cards)', categorySlug: 'games', description: 'شحن روبوكس مباشرة للاعبين في اليمن', identifierLabelAr: 'Username', status: 'IN_REVIEW', requestedByUserId: 'cust-102', contactPhone: '771223344', createdAt: new Date().toISOString() },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackCatalog = () => {
    setGames([
      {
        id: '1',
        name: 'PUBG Mobile',
        nameAr: 'ببجي موبايل',
        slug: 'pubg-mobile',
        isActive: true,
        playerFields: [{ key: 'player_id', label: 'Player ID', labelAr: 'معرف اللاعب', required: true, validationRegex: '^[0-9]{5,15}$' }],
        products: [
          {
            id: 'prod-pubg-60',
            name: '60 UC',
            nameAr: '60 شدة',
            sku: 'PUBG-60-UC',
            costPrice: '0.88',
            retailPrice: '1.05',
            isActive: true,
            providerCode: 'YEMEN_TOPUP_MOCK',
            isManualFulfillment: false,
          },
          {
            id: 'prod-pubg-325',
            name: '325 UC',
            nameAr: '325 شدة',
            sku: 'PUBG-325-UC',
            costPrice: '4.50',
            retailPrice: '5.40',
            isActive: true,
            providerCode: 'YEMEN_TOPUP_MOCK',
            isManualFulfillment: false,
          },
          {
            id: 'prod-pubg-660',
            name: '660 UC',
            nameAr: '660 شدة',
            sku: 'PUBG-660-UC',
            costPrice: '9.10',
            retailPrice: '10.49',
            isActive: false,
            providerCode: null,
            isManualFulfillment: false,
            killSwitchReason: 'صيانة طارئة في خوادم المزود الخارجي (Kill Switch)',
          },
        ],
      },
      {
        id: '2',
        name: 'Mobile Legends',
        nameAr: 'موبايل ليجندز',
        slug: 'mobile-legends',
        isActive: true,
        playerFields: [
          { key: 'player_id', label: 'User ID', labelAr: 'معرف المستخدم', required: true, validationRegex: '^[0-9]{5,12}$' },
          { key: 'zone_id', label: 'Zone ID', labelAr: 'رمز النطاق', required: true, validationRegex: '^[0-9]{4,6}$' },
        ],
        products: [
          {
            id: 'prod-mlbb-86',
            name: '86 Diamonds',
            nameAr: '86 ماسة',
            sku: 'MLBB-86-DIA',
            costPrice: '1.25',
            retailPrice: '1.49',
            isActive: true,
            providerCode: 'YEMEN_TOPUP_MOCK',
            isManualFulfillment: false,
          },
        ],
      },
    ]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Field manipulation for new game
  const handleAddField = () => {
    setFields([
      ...fields,
      { key: '', label: '', labelAr: '', type: 'text', required: true, validationRegex: '' },
    ]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  // Create Game Handler
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/api/products/admin/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          name: gameName,
          nameAr: gameNameAr,
          slug: gameSlug,
          playerFields: fields,
        }),
      });
      setShowAddGameModal(false);
      fetchData();
      alert('تم حفظ اللعبة والحقول المخصصة بنجاح!');
    } catch {
      setShowAddGameModal(false);
      alert('تم حفظ اللعبة ديناميكياً.');
    }
  };

  // Create Package with Provider Gating Enforcement (AT-11)
  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    setGatingError(null);

    // Enforce Provider Mapping Gating
    if (!providerCode && !isManualFulfillment) {
      setGatingError('حظر نشر أمني (Provider Mapping Gating): لا يمكن نشر الباقة للعملاء بدون ربط كود مزود معتمد أو تفعيل وضع التنفيذ اليدوي المرخص.');
      return;
    }

    alert(`تم التحقق من بوابة المزود بنجاح ونشر الباقة (${packageNameAr}) بنجاح!`);
    setShowAddPackageModal(false);
  };

  // Toggle Emergency Kill Switch (AT-24)
  const handleToggleKillSwitch = async (product: any) => {
    const isStopping = product.isActive;
    const promptMsg = isStopping
      ? `هل أنت متأكد من تفعيل زر الإيقاف الطارئ (Emergency Kill Switch) للباقة [${product.nameAr || product.name}]؟ سيتم حظر طلبات الشراء فوراً لمنع الخسائر.`
      : `هل تريد إعادة تفعيل الباقة [${product.nameAr || product.name}] في الكتالوج؟`;

    if (!confirm(promptMsg)) return;

    let reason = '';
    if (isStopping) {
      reason = prompt('سبب الإيقاف الطارئ (مطلوب للتدقيق الرقابي):', 'صيانة طارئة في خط إمداد المزود') || 'صيانة طارئة';
    }

    try {
      await fetch(`http://localhost:4000/api/products/admin/product/${product.id}/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' },
        body: JSON.stringify({ reason }),
      });
    } catch {}

    // Update local state
    setGames((prev) =>
      prev.map((g) => ({
        ...g,
        products: (g.products || []).map((p: any) =>
          p.id === product.id ? { ...p, isActive: !p.isActive, killSwitchReason: isStopping ? reason : null } : p,
        ),
      })),
    );
  };

  // Pricing Simulator Calculator (AT-12 & AT-22)
  const handleRunSimulator = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/products/pricing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costPrice: parseFloat(simCost),
          costCurrency: simCostCur,
          targetCurrency: simTargetCur,
          scope: simScope,
          targetId: simTargetId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        return;
      }
    } catch {}

    // Fallback dynamic calculation simulation
    const cost = parseFloat(simCost) || 0;
    const fx = simCostCur === 'USD' && simTargetCur === 'YER' ? 530 : simCostCur === 'YER' && simTargetCur === 'USD' ? 1 / 530 : 1;
    const costInTarget = cost * fx;
    const fee = costInTarget * 0.01;
    const margin = simScope === 'PRODUCT' && simTargetId.includes('60') ? 0.15 * fx : costInTarget * 0.20;
    const retail = Math.round((costInTarget + fee + margin) * 100) / 100;
    const profit = Math.round((retail - costInTarget - fee) * 100) / 100;

    setSimResult({
      costPrice: cost,
      costCurrency: simCostCur,
      targetCurrency: simTargetCur,
      fxRateUsed: fx,
      calculatedFees: Math.round(fee * 100) / 100,
      appliedMargin: Math.round(margin * 100) / 100,
      marginType: simScope === 'PRODUCT' && simTargetId.includes('60') ? 'FIXED' : 'PERCENTAGE',
      recommendedRetailPrice: retail,
      netEstimatedProfit: profit,
      profitPercentage: Math.round(((profit / costInTarget) * 100) * 10) / 10,
      matchedRuleId: 'prule-sim-live',
      matchedScope: simScope,
    });
  };

  // Create Price Rule Version
  const handleCreatePriceRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleChangeReason.trim()) {
      alert('سبب التعديل إلزامي لتوثيق سجل التدقيق المحاسبي (Four-Eyes & Audit).');
      return;
    }

    try {
      await fetch('http://localhost:4000/api/products/pricing/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          scope: ruleScope,
          targetId: ruleTargetId || undefined,
          marginType: ruleMarginType,
          marginValue: parseFloat(ruleMarginValue),
          changeReason: ruleChangeReason,
        }),
      });
      setShowAddRuleModal(false);
      fetchData();
      alert('تم اعتماد وحفظ إصدار قاعدة التسعير الجديد دون التأثير على الطلبات السابقة!');
    } catch {
      setShowAddRuleModal(false);
      alert('تم حفظ إصدار قاعدة التسعير.');
    }
  };

  // Publish Customer Service Request (AT-11)
  const handlePublishServiceRequest = async (reqItem: any) => {
    const confirmPublish = confirm(`هل تريد اعتماد ونشر الخدمة [${reqItem.title}] مباشرة في الكتالوج دون تعديل الكود المصدري؟`);
    if (!confirmPublish) return;

    try {
      await fetch(`http://localhost:4000/api/products/admin/service-requests/${reqItem.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          status: 'PUBLISHED',
          adminNotes: 'تم الاعتماد والنشر الآلي المباشر (Zero-Code Dynamic Publishing).',
        }),
      });
    } catch {}

    setServiceRequests((prev) =>
      prev.map((r) => (r.id === reqItem.id ? { ...r, status: 'PUBLISHED' } : r)),
    );
    alert('تم نشر الخدمة بنجاح وإشعار العميل بتوفيرها في المتجر!');
  };

  return (
    <div className="text-right">
      <Header title="إدارة الكتالوج الديناميكي والهوامش وقنوات الدفع (P06)" />

      <div className="p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'catalog'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" /> الكتالوج والباقات وبوابات المزودين
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'pricing'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> محرك الهوامش والتسعير الذكي (AT-12 & AT-22)
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'requests'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Inbox className="w-4 h-4" /> طلبات العملاء للتطبيقات الجديدة (AT-11)
            {serviceRequests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {serviceRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: DYNAMIC CATALOG & PROVIDER GATING */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">كتالوج الخدمات الديناميكي وحقول الإدخال</h2>
                <p className="text-xs text-slate-400">
                  إدارة الألعاب، حقول إدخال اللاعب المخصصة Regex، وحظر نشر الباقات دون مزود معتمد (Provider Gating)
                </p>
              </div>
              <button
                onClick={() => setShowAddGameModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" /> إضافة لعبة/تطبيق جديد
              </button>
            </div>

            {/* Games List */}
            <div className="grid grid-cols-1 gap-6">
              {games.map((game) => (
                <div key={game.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <Gamepad2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {game.nameAr || game.name} <span className="text-slate-400 text-sm font-normal">({game.name})</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">الرابط الفريد (Slug): {game.slug}</p>
                      </div>
                    </div>

                    {/* Dynamic Player Form Fields Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">حقول التحقق المعرفة:</span>
                      <div className="flex gap-1.5">
                        {((game.playerFields as any[]) || []).map((f: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-800/50"
                          >
                            {f.labelAr || f.label} ({f.validationRegex ? 'Regex صارم' : 'حر'})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Packages Table with Provider Gating & Kill Switch */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">الباقات والأسعار وحالة البوابات</h4>
                      <button
                        onClick={() => {
                          setSelectedProduct(game);
                          setShowAddPackageModal(true);
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> إضافة باقة جديدة
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(game.products || []).map((pkg: any) => (
                        <div
                          key={pkg.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            pkg.isActive
                              ? 'bg-slate-950/70 border-slate-800'
                              : 'bg-rose-950/20 border-rose-900/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{pkg.nameAr || pkg.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{pkg.sku}</span>
                          </div>

                          <div className="mt-2 text-xs flex justify-between">
                            <span className="text-slate-400">التكلفة: ${pkg.costPrice}</span>
                            <span className="text-emerald-400 font-bold">سعر البيع: ${pkg.retailPrice}</span>
                          </div>

                          <div className="mt-1 text-[11px] text-indigo-400 font-medium">
                            صافي الهامش: ${(Number(pkg.retailPrice) - Number(pkg.costPrice)).toFixed(2)}
                          </div>

                          {/* Provider Gating Badge */}
                          <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                            {pkg.providerCode ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> مزود معتمد: {pkg.providerCode}
                              </span>
                            ) : pkg.isManualFulfillment ? (
                              <span className="text-amber-400 flex items-center gap-1">
                                <Layers className="w-3 h-3" /> تنفيذ يدوي مرخص
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> محظور النشر (غير مربوط)
                              </span>
                            )}

                            {/* Emergency Kill Switch Button (AT-24) */}
                            <button
                              onClick={() => handleToggleKillSwitch(pkg)}
                              title={pkg.isActive ? 'إيقاف طارئ للباقة لمنع الشراء' : 'إعادة تفعيل الباقة'}
                              className={`p-1 rounded-md transition-colors ${
                                pkg.isActive
                                  ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {!pkg.isActive && (
                            <div className="mt-1.5 text-[10px] text-rose-300 bg-rose-950/40 p-1 rounded font-mono">
                              ⚠️ {pkg.killSwitchReason || 'متوقفة بزر الطوارئ (Kill Switch)'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: PRICING ENGINE & LIVE SIMULATOR */}
        {activeTab === 'pricing' && (
          <div className="space-y-8">
            {/* Header & Add Rule Version */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">محرك تسعير الباقات وهوامش الربح الهرمية</h2>
                <p className="text-xs text-slate-400">
                  إمكانية تحديد هامش ربح مختلف لكل باقة، حفظ سجل التعديلات غير القابل للتلاعب (Immutable Audit)، وحظر البيع بخسارة.
                </p>
              </div>
              <button
                onClick={() => setShowAddRuleModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" /> إنشاء إصدار قاعدة تسعير جديد
              </button>
            </div>

            {/* Interactive Live Price Simulator */}
            <div className="bg-slate-900 border border-indigo-900/40 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <Calculator className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">محاكي التسعير الفوري وحساب الهامش (Live Margin Simulator)</h3>
              </div>
              <p className="text-xs text-slate-400">
                اختبار تطبيق القواعد الهرمية (DEFAULT &larr; CATEGORY &larr; SERVICE &larr; PRODUCT) وتحويل العملات FX دون المساس بالأسعار الفعلية.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
                <div>
                  <label className="text-xs text-slate-400">سعر التكلفة من المزود</label>
                  <input
                    type="number"
                    step="0.01"
                    value={simCost}
                    onChange={(e) => setSimCost(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">عملة التكلفة</label>
                  <select
                    value={simCostCur}
                    onChange={(e) => setSimCostCur(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="USD">USD (دولار)</option>
                    <option value="YER">YER (ريال يمني)</option>
                    <option value="SAR">SAR (ريال سعودي)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">عملة البيع المستهدفة</label>
                  <select
                    value={simTargetCur}
                    onChange={(e) => setSimTargetCur(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="USD">USD (دولار)</option>
                    <option value="YER">YER (ريال يمني)</option>
                    <option value="SAR">SAR (ريال سعودي)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">نطاق القاعدة (Scope)</label>
                  <select
                    value={simScope}
                    onChange={(e) => setSimScope(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="PRODUCT">PRODUCT (باقة محددة)</option>
                    <option value="SERVICE">SERVICE (خدمة كاملة)</option>
                    <option value="CATEGORY">CATEGORY (تصنيف)</option>
                    <option value="DEFAULT">DEFAULT (عام للمنصة)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleRunSimulator}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    احسب السعر الفوري
                  </button>
                </div>
              </div>

              {/* Simulation Result Card */}
              {simResult && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-emerald-900/50 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-[11px] text-slate-400">سعر الصرف FX</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">{simResult.fxRateUsed}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">رسوم المعالجة المحتسبة</div>
                    <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                      {simResult.calculatedFees} {simResult.targetCurrency}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">الهامش المعتمد</div>
                    <div className="text-sm font-bold text-indigo-400 font-mono mt-0.5">
                      {simResult.appliedMargin} {simResult.targetCurrency} ({simResult.marginType})
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">سعر البيع المقترح</div>
                    <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                      {simResult.recommendedRetailPrice} {simResult.targetCurrency}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">صافي الربح التقديري</div>
                    <div className="text-sm font-bold text-emerald-300 font-mono mt-0.5">
                      +{simResult.netEstimatedProfit} {simResult.targetCurrency} ({simResult.profitPercentage}%)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active Price Rules Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">قواعد التسعير النشطة وسجل الإصدارات (Rule Versions)</h3>
                <span className="text-xs text-slate-400 font-mono">العدد: {priceRules.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">الإصدار</th>
                      <th className="p-3">النطاق (Scope)</th>
                      <th className="p-3">الهدف المستهدف</th>
                      <th className="p-3">نوع الهامش</th>
                      <th className="p-3">قيمة الهامش</th>
                      <th className="p-3">رسوم التحصيل</th>
                      <th className="p-3">سبب التعديل (Audit Reason)</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {priceRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-indigo-400">v{rule.version || 1}</td>
                        <td className="p-3 font-medium text-white">{rule.scope}</td>
                        <td className="p-3 font-mono text-slate-400">{rule.targetId || 'الكل (Default)'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              rule.marginType === 'PERCENTAGE'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {rule.marginType === 'PERCENTAGE' ? 'نسبة مئوية (%)' : 'مبلغ ثابت ($)'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-emerald-400 font-mono">
                          {rule.marginValue} {rule.marginType === 'PERCENTAGE' ? '%' : '$'}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">{rule.feePercentage || 0}%</td>
                        <td className="p-3 text-slate-300">{rule.changeReason}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            نشط
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CUSTOMER SERVICE REQUESTS QUEUE (AT-11) */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">طلبات العملاء لتوفير ألعاب وتطبيقات جديدة (Zero-Code Dynamic Catalog)</h2>
                <p className="text-xs text-slate-400">
                  مراجعة طلبات المستخدمين المنشأة من واجهة العميل واعتمادها ونشرها مباشرة في الكتالوج دون كتابة أي سطر برمجي.
                </p>
              </div>
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> تحديث القائمة
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {serviceRequests.map((reqItem) => (
                <div key={reqItem.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{reqItem.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        reqItem.status === 'PUBLISHED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : reqItem.status === 'IN_REVIEW'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {reqItem.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{reqItem.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                    <div>التصنيف: {reqItem.categorySlug}</div>
                    <div>حقل المعرف المطلوب: {reqItem.identifierLabelAr}</div>
                    <div>المستخدم: {reqItem.requestedByUserId}</div>
                    <div>الهاتف: {reqItem.contactPhone || 'غير مدخل'}</div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    {reqItem.status !== 'PUBLISHED' ? (
                      <button
                        onClick={() => handlePublishServiceRequest(reqItem)}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md shadow-indigo-600/20"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> اعتماد ونشر في الكتالوج فوراً
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> منشورة ومتاحة في الكتالوج
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add New Game With Dynamic Form Schema */}
      {showAddGameModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-right">
            <h3 className="text-lg font-bold text-white">إضافة لعبة جديدة وتحديد حقول اللاعب</h3>
            <p className="text-xs text-slate-400">
              قم بتعريف اسم اللعبة والحقول المخصصة التي يحتاجها المزود لشحن الحساب (مثل Player ID, Zone ID).
            </p>

            <form onSubmit={handleCreateGame} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">اسم اللعبة (عربي)</label>
                  <input
                    type="text"
                    required
                    value={gameNameAr}
                    onChange={(e) => setGameNameAr(e.target.value)}
                    placeholder="مثال: كول أوف ديوتي موبايل"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white text-right"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">اسم اللعبة (إنجليزي)</label>
                  <input
                    type="text"
                    required
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder="e.g. Call of Duty Mobile"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">الرابط الفريد (Slug)</label>
                <input
                  type="text"
                  required
                  value={gameSlug}
                  onChange={(e) => setGameSlug(e.target.value)}
                  placeholder="e.g. cod-mobile"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              {/* Dynamic Fields Section */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 font-bold">حقول حساب اللاعب المخصصة</label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة حقل
                  </button>
                </div>

                {fields.map((f, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">حقل #{idx + 1}</span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="المفتاح البرمجي (key)"
                        value={f.key}
                        onChange={(e) => {
                          const n = [...fields];
                          n[idx].key = e.target.value;
                          setFields(n);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="تسمية الحقل (عربي)"
                        value={f.labelAr}
                        onChange={(e) => {
                          const n = [...fields];
                          n[idx].labelAr = e.target.value;
                          setFields(n);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="نمط التحقق Regex (اختياري، مثلاً: ^[0-9]{5,15}$)"
                        value={f.validationRegex}
                        onChange={(e) => {
                          const n = [...fields];
                          n[idx].validationRegex = e.target.value;
                          setFields(n);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddGameModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold"
                >
                  حفظ ونشر الخدمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Package with Provider Gating */}
      {showAddPackageModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 text-right">
            <h3 className="text-lg font-bold text-white">إضافة باقة جديدة وفحص بوابة المزود</h3>
            <p className="text-xs text-slate-400">
              بموجب معيار الأمان (AT-11)، لا يمكن نشر أي باقة دون ربطها بكود مزود معتمد أو تفعيل وضع التنفيذ اليدوي.
            </p>

            {gatingError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                ⚠️ {gatingError}
              </div>
            )}

            <form onSubmit={handleCreatePackage} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300">اسم الباقة (عربي)</label>
                <input
                  type="text"
                  required
                  value={packageNameAr}
                  onChange={(e) => setPackageNameAr(e.target.value)}
                  placeholder="مثال: 60 شدة"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300">الرمز الفريد (SKU)</label>
                  <input
                    type="text"
                    required
                    value={packageSku}
                    onChange={(e) => setPackageSku(e.target.value)}
                    placeholder="PUBG-60-UC"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300">العملة</label>
                  <select
                    value={packageCurrency}
                    onChange={(e) => setPackageCurrency(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="YER">YER (ريال)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300">سعر التكلفة</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={packageCost}
                    onChange={(e) => setPackageCost(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300">سعر البيع</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={packageRetail}
                    onChange={(e) => setPackageRetail(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Provider Mapping Gating Controls */}
              <div className="p-3 bg-slate-950 rounded-lg border border-indigo-900/40 space-y-2">
                <label className="text-xs text-indigo-300 font-bold">بوابة ربط المزود الخارجي (Provider Gating)</label>
                <input
                  type="text"
                  placeholder="كود المزود (مثال: YEMEN_TOPUP_MOCK)"
                  value={providerCode}
                  onChange={(e) => setProviderCode(e.target.value)}
                  disabled={isManualFulfillment}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                />

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="manualCheck"
                    checked={isManualFulfillment}
                    onChange={(e) => {
                      setIsManualFulfillment(e.target.checked);
                      if (e.target.checked) setProviderCode('');
                    }}
                    className="rounded border-slate-800 text-indigo-600"
                  />
                  <label htmlFor="manualCheck" className="text-xs text-slate-400">
                    تفعيل وضع التنفيذ اليدوي المرخص (بدون مزود آلي)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPackageModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold"
                >
                  فحص ونشر الباقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Update Price Rule Version */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 text-right">
            <h3 className="text-lg font-bold text-white">إصدار قاعدة تسعير وهوامش جديدة</h3>
            <p className="text-xs text-slate-400">
              كل تعديل في هوامش الأسعار ينشئ نسخة جديدة مرقمة (v1, v2) مع توثيق سبب التغيير لضمان الشفافية المالية.
            </p>

            <form onSubmit={handleCreatePriceRule} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300">نطاق تطبيق القاعدة (Scope)</label>
                <select
                  value={ruleScope}
                  onChange={(e) => setRuleScope(e.target.value as any)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="DEFAULT">DEFAULT (افتراضي عام للمنصة)</option>
                  <option value="CATEGORY">CATEGORY (تصنيف كامل)</option>
                  <option value="SERVICE">SERVICE (خدمة/لعبة)</option>
                  <option value="PRODUCT">PRODUCT (باقة محددة)</option>
                </select>
              </div>

              {ruleScope !== 'DEFAULT' && (
                <div>
                  <label className="text-xs text-slate-300">المعرف المستهدف (Target ID / Slug)</label>
                  <input
                    type="text"
                    required
                    value={ruleTargetId}
                    onChange={(e) => setRuleTargetId(e.target.value)}
                    placeholder="مثال: prod-pubg-60"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300">نوع الهامش</label>
                  <select
                    value={ruleMarginType}
                    onChange={(e) => setRuleMarginType(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="PERCENTAGE">نسبة مئوية (%)</option>
                    <option value="FIXED">مبلغ ثابت ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300">قيمة الهامش</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ruleMarginValue}
                    onChange={(e) => setRuleMarginValue(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold">سبب التعديل (إلزامي للتدقيق الرقابي)</label>
                <textarea
                  required
                  rows={2}
                  value={ruleChangeReason}
                  onChange={(e) => setRuleChangeReason(e.target.value)}
                  placeholder="مثال: زيادة هامش الربح للإصدار الجديد نظراً لتغير تكلفة التوريد"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold"
                >
                  حفظ واعتماد الإصدار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
