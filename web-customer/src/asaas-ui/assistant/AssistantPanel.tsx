import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { AssistantFace, AssistantRobot, greeting } from './AssistantAvatar';

/** What is sent to the site's server: the latest messages of the conversation. */
export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** The server's answer; `attachments` are anything the site renders under it (cards, links…). */
export interface AssistantAnswer {
  reply: string;
  attachments?: unknown[];
}

export interface AssistantConfig {
  /** Calls the site's own endpoint, e.g. `(messages) => http.post('/assistant', { messages })`. */
  ask: (messages: AssistantMessage[]) => Promise<AssistantAnswer>;
  /** The signed-in person: the greeting uses the first name; the chat is kept per id. */
  user: { id: string; displayName: string };
  /** Shown in the header and on the launcher, e.g. "مساعد أساس". */
  title?: string;
  subtitle?: string;
  /** Tappable first questions in the empty chat. */
  suggestions?: string[];
  intro?: string;
  placeholder?: string;
  disclaimer?: string;
  /** Renders a site-specific attachment (e.g. a confirmation card) under the assistant's reply. */
  renderAttachment?: (attachment: unknown, index: number) => ReactNode;
}

interface Entry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: unknown[];
}

/** Only the latest exchanges are sent: long threads make smaller models drift. */
const HISTORY_LIMIT = 8;
const MAX_QUESTION = 1500;
const storageKey = (userId: string) => `asaas-ui:assistant:${userId}`;

function load(key: string): Entry[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '[]') as Entry[];
  } catch {
    return [];
  }
}

function save(key: string, entries: Entry[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private mode): the chat is simply not kept on reload.
  }
}

const newId = () => crypto.randomUUID();

/** The conversation: header, scrolling thread and composer, sized by its container. */
export function AssistantPanel({ config, onClose }: { config: AssistantConfig; onClose: () => void }) {
  const { ask, user, title = 'مساعد أساس', subtitle = 'اسأل وسأجيبك', suggestions = [] } = config;
  const key = storageKey(user.id);
  const [entries, setEntries] = useState<Entry[]>(() => load(key));
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => save(key, entries), [key, entries]);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    // An empty chat stays at the top, where the robot greets the user.
    const thread = threadRef.current;
    if (entries.length > 0) thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
  }, [entries.length, pending]);

  const request = async (history: Entry[]) => {
    setPending(true);
    setError(null);
    try {
      const answer = await ask(history.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content })));
      setEntries((current) => [...current, { id: newId(), role: 'assistant', content: answer.reply, attachments: answer.attachments }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الوصول للمساعد، حاول مرة أخرى');
    } finally {
      setPending(false);
    }
  };

  const send = (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    const next = [...entries, { id: newId(), role: 'user' as const, content: question }];
    setEntries(next);
    setDraft('');
    void request(next);
  };

  const reset = () => {
    setEntries([]);
    setError(null);
    inputRef.current?.focus();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const lastIsUnanswered = entries.at(-1)?.role === 'user';

  return (
    <>
      <header className="assistant-panel__head">
        <AssistantFace mood="smile" />
        <div className="assistant-panel__title">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {entries.length > 0 && <Button variant="ghost" size="sm" icon="plus" label="محادثة جديدة" onClick={reset} disabled={pending} />}
        <Button variant="ghost" size="sm" icon="close" label="إغلاق" onClick={onClose} />
      </header>

      <div ref={threadRef} className="assistant-panel__thread" aria-live="polite">
        {entries.length === 0 && (
          <div className="assistant-welcome">
            <AssistantRobot className="assistant-welcome__robot" />
            <h3>{greeting(user.displayName)}</h3>
            <p className="assistant-welcome__lead">كيف أقدر أساعدك اليوم؟</p>
            {config.intro && <p>{config.intro}</p>}
            {suggestions.length > 0 && (
              <div className="assistant-welcome__suggestions">
                {suggestions.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className={`bubble bubble--${entry.role}`}>
            {entry.role === 'assistant' && <AssistantFace size="sm" mood={entry.attachments?.length ? 'celebrate' : 'happy'} />}
            <div className="bubble__body">
              <div className="bubble__text">{entry.content}</div>
              {config.renderAttachment && entry.attachments?.map((a, i) => <div key={i}>{config.renderAttachment!(a, i)}</div>)}
            </div>
          </div>
        ))}

        {pending && (
          <div className="bubble bubble--assistant">
            <AssistantFace size="sm" mood="waiting" />
            <span className="typing" role="status" aria-label="المساعد يكتب">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}

        {error && lastIsUnanswered && (
          <div className="assistant-error" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
            <Button variant="glass" size="sm" onClick={() => request(entries)}>
              إعادة المحاولة
            </Button>
          </div>
        )}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className="composer__input"
          rows={1}
          value={draft}
          maxLength={MAX_QUESTION}
          placeholder={config.placeholder ?? 'اكتب سؤالك…'}
          aria-label="سؤالك للمساعد"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" variant="primary" icon="send" label="إرسال" className="composer__send" disabled={!draft.trim() || pending} />
      </form>
      <p className="assistant-panel__disclaimer">{config.disclaimer ?? 'يجيب من بيانات الموقع فقط وقد يخطئ.'}</p>
    </>
  );
}
