import { useEffect, useRef, useState } from 'react';
import { Glass } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { AssistantRobot } from './AssistantAvatar';
import { type AssistantConfig, AssistantPanel } from './AssistantPanel';

/**
 * The Asaas robot floating at the bottom of every page; it opens the chat in a
 * small window (full screen on phones), so questions never leave the current page.
 * Mount it once in the app shell, after the user is signed in.
 */
export function AssistantWidget(config: AssistantConfig) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const title = config.title ?? 'مساعد أساس';

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="assistant-launcher"
        data-open={open}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={open ? `إغلاق ${title}` : title}
        title={title}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <Icon name="close" /> : <AssistantRobot />}
      </button>

      {open && (
        <Glass as="section" thick id="assistant-panel" className="assistant-panel" role="dialog" aria-label={title}>
          <AssistantPanel config={config} onClose={close} />
        </Glass>
      )}
    </>
  );
}
