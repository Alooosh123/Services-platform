'use client';

import React, { useState } from 'react';
import { BrandIdentity } from '@/types';
import { COLOR_PALETTES } from '@/lib/constants';
import {
  Palette,
  Image,
  Type,
  Building,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Stamp,
  Globe,
  MapPin,
  Mail,
} from 'lucide-react';

interface BrandSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: BrandIdentity;
  onSaveBrand: (updated: BrandIdentity) => void;
}

const PRESET_LOGOS = [
  {
    name: 'شعار رقمي حديث',
    url: 'https://cdn-icons-png.flaticon.com/512/9068/9068712.png',
  },
  {
    name: 'شعار درع أمان رسمي',
    url: 'https://cdn-icons-png.flaticon.com/512/1067/1067566.png',
  },
  {
    name: 'شعار خدمات مالية وتقنية',
    url: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
  },
  {
    name: 'شعار سحابي مؤسسي',
    url: 'https://cdn-icons-png.flaticon.com/512/4149/4149678.png',
  },
  {
    name: 'شعار مونوغرام إداري',
    url: 'https://cdn-icons-png.flaticon.com/512/3233/3233483.png',
  },
];

export const BrandSettingsModal: React.FC<BrandSettingsModalProps> = ({
  isOpen,
  onClose,
  brand,
  onSaveBrand,
}) => {
  const [formData, setFormData] = useState<BrandIdentity>({ ...brand });

  if (!isOpen) return null;

  const handleApplyPalette = (palette: (typeof COLOR_PALETTES)[0]) => {
    setFormData((prev) => ({
      ...prev,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.accent,
    }));
  };

  const handleSave = () => {
    onSaveBrand(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                تخصيص الهوية البصرية والشعار
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                  ديناميكي وفوري
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                إرسال وضبط الشعار وألوان العلامة التجارية لتطبيقها تلقائياً على كافة القوالب والإيميلات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Preview Card */}
          <div className="p-4 rounded-xl border border-slate-700/80 bg-slate-950/60">
            <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              معاينة فورية لترويسة الإيميل الرسمي مع الشعار والألوان:
            </div>
            <div
              className="p-5 rounded-xl shadow-lg flex items-center justify-between text-white transition-all"
              style={{
                background: `linear-gradient(135deg, ${formData.primaryColor} 0%, ${formData.secondaryColor} 100%)`,
              }}
            >
              <div className="flex items-center gap-3">
                {formData.logoUrl && (
                  <img
                    src={formData.logoUrl}
                    alt="Logo Preview"
                    className="w-12 h-12 object-contain bg-white/20 p-1.5 rounded-xl backdrop-blur-sm"
                  />
                )}
                <div>
                  <div className="font-extrabold text-base tracking-tight">
                    {formData.companyName || 'اسم المنصة الرسمية'}
                  </div>
                  <div className="text-xs text-white/80">
                    {formData.companySubtitle || 'البوابة الموحدة للمراسلات'}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm"
                  style={{
                    backgroundColor: formData.accentColor,
                    color: '#ffffff',
                  }}
                >
                  قالب معتمد
                </span>
              </div>
            </div>
          </div>

          {/* Logo Settings */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-2">
              <Image className="w-4 h-4 text-sky-400" />
              رابط شعار المؤسسة (Logo URL)
            </label>
            <input
              type="text"
              placeholder="https://your-domain.com/logo.png"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
            <div className="mt-2.5">
              <span className="text-[11px] text-slate-400 block mb-1.5">
                أو اختر من النماذج والشعارات الجاهزة للتجربة الفورية:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_LOGOS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setFormData({ ...formData, logoUrl: preset.url })}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      formData.logoUrl === preset.url
                        ? 'border-amber-500 bg-amber-500/20 text-white'
                        : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-4 h-4 object-contain" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Color Palettes */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" />
              حزم الألوان المؤسسية الجاهزة (Color Palettes)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COLOR_PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  type="button"
                  onClick={() => handleApplyPalette(palette)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-right"
                >
                  <span className="text-xs font-medium text-slate-200">{palette.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: palette.primary }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: palette.secondary }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: palette.accent }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Granular Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">اللون الأساسي (Primary)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">اللون الثانوي (Secondary)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">لون التمييز (Accent)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Company Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">اسم المؤسسة / المنصة</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">العنوان الفرعي / الوصف</label>
              <input
                type="text"
                value={formData.companySubtitle}
                onChange={(e) => setFormData({ ...formData, companySubtitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">الموقع الإلكتروني</label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني الرسمي للدعم</label>
              <input
                type="text"
                value={formData.supportEmail}
                onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          {/* Typography & Official Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">نوع الخط المعتمد للقوالب</label>
              <select
                value={formData.fontFamily}
                onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="Cairo">Cairo (خط القاهرة المؤسسي)</option>
                <option value="Tajawal">Tajawal (خط تجوال العصري)</option>
                <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                <option value="system-ui">الخط الافتراضي للنظام</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-white block">ختم التوثيق الرسمي في التذييل</span>
                <span className="text-[11px] text-slate-400">إظهار ختم التحقق والرقم المرجعي</span>
              </div>
              <input
                type="checkbox"
                checked={formData.officialStamp}
                onChange={(e) => setFormData({ ...formData, officialStamp: e.target.checked })}
                className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Legal Notice */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">نص إشعار السرية والتنبيه القانوني في ذيل الإيميل</label>
            <textarea
              rows={2}
              value={formData.footerLegalNotice}
              onChange={(e) => setFormData({ ...formData, footerLegalNotice: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            إلغاء التغييرات
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-900/30"
          >
            <Check className="w-4 h-4" />
            تطبيق وحفظ الهوية على جميع القوالب
          </button>
        </div>
      </div>
    </div>
  );
};
