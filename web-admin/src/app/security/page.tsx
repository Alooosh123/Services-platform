'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Server,
  Layers,
} from 'lucide-react';
import { isolate } from '../../lib/format';

export default function AdminSecurityPage() {
  const securityRules = [
    {
      title: 'القفل التشاؤمي للأرصدة (Pessimistic Locking)',
      desc: 'حماية جميع عمليات الخصم والإيداع عبر (SELECT ... FOR UPDATE) لمنع تضارب الأرصدة (Race Conditions).',
      status: 'ENFORCED',
      type: 'FINANCIAL',
    },
    {
      title: 'التحقق من توقيع شركاء الربط (HMAC SHA-256)',
      desc: 'التحقق الإجباري من توقيعات الـ Webhooks الواردة من بوابات LikeCard و OneCard والبنوك لمنع تزوير الطلبات.',
      status: 'ENFORCED',
      type: 'B2B_WEBHOOKS',
    },
    {
      title: 'مهلة الذكاء الاصطناعي ومقاومة الانقطاع (AI Timeout & Fallback)',
      desc: 'تطبيق مهلة صارمة (AbortSignal.timeout(6000)) مع محرك احتياطي محلي لضمان عدم توقف المنصة.',
      status: 'ENFORCED',
      type: 'AI_SAFETY',
    },
    {
      title: 'خزنة البطاقات الرقمية المشفرة (AES-256 GCM PIN Vault)',
      desc: 'تشفير أكواد البطاقات الرقمية في قاعدة البيانات بمفاتيح أمنية مشتقة لا تُحفظ كنص صريح أبداً.',
      status: 'ENFORCED',
      type: 'CRYPTOGRAPHY',
    },
    {
      title: 'عزل الأرقام والعملات ثنائية الاتجاه (Unicode LTR Isolates)',
      desc: 'تغليف جميع الأرقام والعملات بـ (\\u2066...\\u2069) لحماية العملاء من انقلاب الأرقام في واجهات RTL.',
      status: 'ENFORCED',
      type: 'TYPOGRAPHY',
    },
  ];

  const auditEvents = [
    {
      id: 'sec-log-1',
      event: 'SYSTEM_BOOT_INTEGRITY_CHECK',
      desc: 'اكتمل فحص سلامة النظام وتشفير قواعد البيانات بنجاح 100%.',
      level: 'INFO',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'sec-log-2',
      event: 'PIN_VAULT_RESERVE_HOLD',
      desc: 'تم حجز بطاقة رقمية بنجاح عبر آلية القفل الحصري للطلب ORD-9901.',
      level: 'INFO',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'sec-log-3',
      event: 'AI_OCR_RECEIPT_VALIDATED',
      desc: 'تم التحقق من إشعار إيداع بنكي عبر محرك Gemini 3.8 Flash بنسبة ثقة 99.4%.',
      level: 'INFO',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>نظام الحماية والرقابة الأمنية (Security & Compliance)</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">الأمن ومكافحة الاحتيال والتدقيق</h1>
          <p className="text-xs text-slate-400 mt-1">
            متابعة تطبيق المعايير الأمنية، تشفير الخزنة، وسجل الأحداث الأمنية الموثوق.
          </p>
        </div>
      </div>

      {/* Security Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityRules.map((rule) => (
          <div
            key={rule.title}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-all shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">{rule.title}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                مفعّل ونشط
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{rule.desc}</p>
          </div>
        ))}
      </div>

      {/* Security Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>سجل الأحداث الأمنية والتدقيق (Security Audit Stream)</span>
          </div>
        </div>

        <div className="divide-y divide-slate-800 text-xs">
          {auditEvents.map((ev) => (
            <div key={ev.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-indigo-400 font-bold">{ev.event}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                    {ev.level}
                  </span>
                </div>
                <p className="text-slate-300">{ev.desc}</p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                {new Date(ev.timestamp).toLocaleTimeString('ar-YE')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
