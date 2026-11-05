'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Gamepad2, CreditCard, Flame, ArrowLeft, MessageCircle, PlusCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';

export default function StorefrontHomePage() {
  const [services, setServices] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Service Request Modal State (AT-11)
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestCategory, setRequestCategory] = useState('games');
  const [requestIdentifier, setRequestIdentifier] = useState('معرف اللاعب (Player ID)');
  const [requestDesc, setRequestDesc] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const handleServiceRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSubmitting(true);
    setRequestError(null);
    try {
      await apiRequest('/products/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: requestTitle,
          categorySlug: requestCategory,
          identifierLabelAr: requestIdentifier,
          description: requestDesc,
          contactPhone: requestPhone,
        }),
      });
      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestSuccess(false);
        setRequestTitle('');
        setRequestDesc('');
        setRequestPhone('');
      }, 2500);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'تعذر إرسال الطلب');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const data = await apiRequest<any[]>('/products/catalog');
      const flattened = data.flatMap((category) =>
        Array.isArray(category.services)
          ? category.services.map((service: any) => {
              const startingPrice = (currency: string) => {
                const prices = (service.products || [])
                  .flatMap((product: any) => product.prices || [])
                  .filter((price: any) => price.currency === currency)
                  .map((price: any) => Number(price.retailPrice))
                  .filter(Number.isFinite);
                return prices.length ? Math.min(...prices).toLocaleString() : undefined;
              };
              return {
                ...service,
                categorySlug: category.slug,
                categoryNameAr: category.nameAr,
                startingPriceYer: startingPrice('YER'),
                startingPriceUsd: startingPrice('USD'),
              };
            })
          : [category],
      );
      setServices(flattened);
      setCatalogError(null);
    } catch (err) {
      setServices([]);
      setCatalogError(err instanceof Error ? err.message : 'تعذر تحميل كتالوج الخدمات');
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const filteredServices = services.filter((s) => {
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'games' && (s.categorySlug === 'games' || !s.categorySlug)) ||
      (selectedCategory === 'apps' && s.categorySlug === 'apps') ||
      (selectedCategory === 'cards' && s.categorySlug === 'cards');

    const matchesSearch =
      (s.name && s.name.toLowerCase().includes(search.toLowerCase())) ||
      (s.nameAr && s.nameAr.includes(search));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950 border-b border-slate-900 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>نظام شحن رقمي مؤتمت بالكامل في اليمن • دفع بمحافظ جيب، جوالي، كاش، ون كاش</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            اشحن ألعابك وتطبيقاتك المفضلة <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              في أقل من 30 ثانية بالريال اليمني والدولار
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
            تسليم فوري لحساب اللاعب مباشرة عبر الـ ID. شدات ببجي موبايل، عملات يويو، ماسات توب توب، وبطاقات الهدايا الرقمية العالمية بأفضل الأسعار وأمان تام.
          </p>

          {/* Quick Search */}
          <div className="max-w-xl mx-auto relative pt-4">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-7" />
            <input
              type="text"
              placeholder="ابحث عن لعبتك أو تطبيقك (مثال: ببجي، يويو، توب توب، جوجل بلاي)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-12 pl-4 py-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Category Filters */}
        <div className="flex items-center gap-3 border-b border-slate-900 pb-4 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            جميع الخدمات المتاحة
          </button>
          <button
            onClick={() => setSelectedCategory('games')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'games'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" /> ألعاب الموبايل والكمبيوتر
          </button>
          <button
            onClick={() => setSelectedCategory('apps')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'apps'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" /> تطبيقات الدردشة والترفيه
          </button>
          <button
            onClick={() => setSelectedCategory('cards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'cards'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> بطاقات الهدايا الرقمية
          </button>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {catalogLoading && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">جاري تحميل الخدمات من الخادم...</p>
          )}
          {!catalogLoading && catalogError && (
            <p role="alert" className="col-span-full py-10 text-center text-sm text-rose-400">{catalogError}</p>
          )}
          {!catalogLoading && !catalogError && filteredServices.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">لا توجد خدمات متاحة حالياً.</p>
          )}
          {filteredServices.map((service) => (
            <Link
              key={service.id}
              href={`/topup/${service.slug}`}
              className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 text-right"
            >
              <div className="space-y-4">
                <div className="h-32 rounded-xl bg-gradient-to-br from-indigo-900/40 to-slate-950 flex items-center justify-center p-4 border border-slate-800/80 group-hover:border-indigo-500/30 transition-colors">
                  <Gamepad2 className="w-14 h-14 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors">
                      {service.nameAr || service.name}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">{service.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {service.descriptionAr || service.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">يبدأ من</span>
                  <div className="flex items-center gap-1.5 font-bold font-mono">
                    <span className="text-emerald-400 text-sm">
                      {service.startingPriceYer ?? '—'} ر.ي
                    </span>
                    <span className="text-slate-500 text-xs">/</span>
                    <span className="text-slate-400 text-xs">
                      ${service.startingPriceUsd ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 group-hover:bg-indigo-600 text-indigo-400 group-hover:text-white flex items-center justify-center transition-all">
                  <ArrowLeft className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Request New Game/App Banner (AT-11) */}
        <div className="mt-12 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 border border-indigo-800/50 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-right">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-block">
              الكتالوج الديناميكي التفاعلي
            </span>
            <h3 className="text-xl font-black text-white">لم تجد لعبتك أو تطبيقك المفضل في المتجر؟</h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              أرسل لنا اسم اللعبة أو التطبيق وسيقوم فريق العمل بتوفيرها وضبط حقول معرف اللاعب في غضون دقائق دون توقف الخدمة!
            </p>
          </div>

          <button
            onClick={() => setShowRequestModal(true)}
            className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs transition-all shadow-xl shadow-indigo-600/30 hover:scale-105"
          >
            <PlusCircle className="w-4 h-4" /> اطلب إضافة لعبة أو تطبيق جديد
          </button>
        </div>
      </div>

      {/* Service Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-indigo-400" />
                طلب توفير لعبة أو تطبيق جديد
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {requestSuccess ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-white">تم استلام طلبك بنجاح!</h4>
                <p className="text-xs text-slate-300">
                  سيتم تدقيق التطبيق وربطه بالبوابة وتوفيره بالكتالوج فوراً وإشعارك عبر الواتساب.
                </p>
              </div>
            ) : (
              <form onSubmit={handleServiceRequestSubmit} className="space-y-3">
                {requestError && <p role="alert" className="text-xs text-rose-400">{requestError}</p>}
                <div>
                  <label className="text-xs text-slate-300 font-bold">اسم اللعبة أو التطبيق *</label>
                  <input
                    type="text"
                    required
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    placeholder="مثال: كول أوف ديوتي، لايكي، تانجو، بيجو لايف..."
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-300 font-bold">التصنيف</label>
                    <select
                      value={requestCategory}
                      onChange={(e) => setRequestCategory(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="games">ألعاب موبايل</option>
                      <option value="apps">تطبيقات ترفيه ودردشة</option>
                      <option value="cards">بطاقات رقمية وقسائم</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-bold">حقل الشحن المطلوب</label>
                    <input
                      type="text"
                      value={requestIdentifier}
                      onChange={(e) => setRequestIdentifier(e.target.value)}
                      placeholder="Player ID, User ID..."
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold">الباقات أو الملاحظات المطلوبة</label>
                  <textarea
                    rows={2}
                    value={requestDesc}
                    onChange={(e) => setRequestDesc(e.target.value)}
                    placeholder="مثال: يرجى توفير باقة 500 عملة أسبوعية..."
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold">رقم هاتفك لإشعارك عند التوفير (اختياري)</label>
                  <input
                    type="text"
                    value={requestPhone}
                    onChange={(e) => setRequestPhone(e.target.value)}
                    placeholder="770000000"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 bg-slate-800 text-slate-300 rounded-xl py-2.5 text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={requestSubmitting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-xs font-bold shadow-lg shadow-indigo-600/30"
                  >
                    {requestSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
