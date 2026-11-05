'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([
    {
      id: 'log-1',
      createdAt: new Date().toISOString(),
      user: { fullName: 'المدير العام', email: 'admin@digitaltopup.com', role: 'SUPER_ADMIN' },
      action: 'تهيئة النظام الأولي (INITIALIZE)',
      entityName: 'SYSTEM',
      entityId: 'ROOT',
      ipAddress: '127.0.0.1',
      newValues: { الإصدار: '1.0.0', البيئة: 'بيئة التطوير', النمط: 'وضع التجربة' },
    },
    {
      id: 'log-2',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      user: { fullName: 'المدير المالي', email: 'finance@digitaltopup.com', role: 'FINANCIAL_OFFICER' },
      action: 'تدقيق قيود السجل المالي (AUDIT)',
      entityName: 'Wallet',
      entityId: 'ALL',
      ipAddress: '127.0.0.1',
      newValues: { موثق: true, عدد_الخلافات: 0 },
    },
  ]);

  return (
    <div className="text-right">
      <Header title="سجلات الرقابة والتدقيق الإداري (Audit Logs)" />

      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">سجل العمليات الدائم والامتثال الأمني</h2>
          <p className="text-xs text-slate-400">
            توثيق تاريخي لجميع تدخلات المشرفين، تعديلات الأرصدة، تحديثات المنتجات، والعمليات الإدارية الحساسة
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">الوقت والتاريخ</th>
                  <th className="py-3 px-4 font-medium">المشرف المنفذ</th>
                  <th className="py-3 px-4 font-medium">نوع الإجراء</th>
                  <th className="py-3 px-4 font-medium">الكائن المستهدف</th>
                  <th className="py-3 px-4 font-medium">عنوان IP</th>
                  <th className="py-3 px-4 font-medium">تفاصيل البيانات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{log.user?.fullName || 'النظام'}</p>
                      <p className="text-[10px] text-indigo-400 font-mono">{log.user?.role}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-indigo-300 font-medium">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {log.entityName} <span className="text-slate-500 font-mono text-[10px]">({log.entityId})</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{log.ipAddress}</td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                      {JSON.stringify(log.newValues)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
