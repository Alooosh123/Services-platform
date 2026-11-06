import { NextRequest, NextResponse } from 'next/server';
import { BrandIdentity, EmailDraft, TeamMember, TemplateType } from '@/types';
import { localRuleBasedClassifier } from '@/lib/aiClassifier';
import { TEMPLATES } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, teamMembers = [], currentUser, brand, currentDraft } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let geminiResult = null;
    let usedEngine = 'nlp_heuristic';

    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const availableTemplates = Object.values(TEMPLATES).map((t) => ({
          id: t.id,
          title: t.title,
          badge: t.badge,
          description: t.description,
        }));

        const membersInfo = teamMembers.map((m: TeamMember) => ({
          name: m.name,
          email: m.email,
          role: m.role,
          department: m.department,
        }));

        const systemPrompt = `
أنت مساعد ذكاء اصطناعي متخصص في صياغة المراسلات والبريد الإلكتروني الرسمي لفرق العمل والمؤسسات باللغة العربية الفصحى الراقية.
مهمتك:
1. تحليل طلب المستخدم بعناية وفهم نيته (اجتماع، تكليف، طلب اعتماد، تقرير، شكر، تعميم، لفت نظر، معاملة مالية).
2. اختيار أفضل قالب مناسب من القوالب المتاحة حصراً:
${JSON.stringify(availableTemplates, null, 2)}
3. اختيار المستلمين المناسبين من قائمة أعضاء الفريق المسجلين إذا ذكر المستخدم أسماءهم أو أدوارهم:
${JSON.stringify(membersInfo, null, 2)}
4. تحديد مستوى الأهمية: 'urgent' أو 'important' أو 'normal'.
5. توليد محتوى رسمي راقٍ يشمل:
   - subject: عنوان إيميل رسمي احترافي وواضح
   - greeting: تحية رسمية موجهة
   - intro: مقدمة سياقية مهنية
   - mainContent: صلب الموضوع بتفصيل رسمي
   - bulletPoints: مصفوفة من 2-4 نقاط واضحة ومرتبة
   - callToAction: كائن يحتوي على { text: "...", deadline: "...", buttonLabel: "..." }
   - closing: خاتمة رسمية وقورة
   - reasoning: سطرين يشرحان للمستخدم سبب اختيار هذا القالب وكيف تم استيفاء متطلباته.

أرجع النتيجة بصيغة JSON نظيفة فقط بدون أي علامات markdown:
{
  "templateId": "memo" | "task" | "meeting" | "approval" | "warning" | "status_report" | "appreciation" | "financial",
  "subject": "...",
  "urgency": "normal" | "important" | "urgent",
  "to": ["email1@domain.com"],
  "cc": [],
  "greeting": "...",
  "intro": "...",
  "mainContent": "...",
  "bulletPoints": ["...", "..."],
  "callToAction": {
    "text": "...",
    "deadline": "...",
    "buttonLabel": "..."
  },
  "closing": "...",
  "reasoning": "..."
}
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${systemPrompt}\n\nطلب المستخدم: "${prompt}"`,
                    },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            // Strip markdown code fences if present
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.templateId && parsed.subject) {
              geminiResult = parsed;
              usedEngine = 'gemini-flash';
            }
          }
        }
      } catch (geminiErr) {
        // Fallback silently to rule-based engine
      }
    }

    if (!geminiResult) {
      geminiResult = localRuleBasedClassifier(prompt, teamMembers, currentUser, brand);
      usedEngine = 'nlp_semantic_engine';
    }

    return NextResponse.json({
      success: true,
      engine: usedEngine,
      result: geminiResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
