import faceCelebrate from '../assets/assistant/face-celebrate.webp';
import faceHappy from '../assets/assistant/face-happy.webp';
import faceSmile from '../assets/assistant/face-smile.webp';
import faceWaiting from '../assets/assistant/face-waiting.webp';
import robotWave from '../assets/assistant/robot-wave.webp';
import { cx } from '../lib/cx';
import { firstName } from '../lib/format';

/**
 * Asaas robot artwork (exported to WebP).
 * The full robot greets from outside the chat; inside it, only its face shows.
 */
const FACES = {
  smile: faceSmile,
  happy: faceHappy,
  waiting: faceWaiting,
  celebrate: faceCelebrate,
} as const;

export type AssistantMood = keyof typeof FACES;

export function AssistantFace({ mood = 'happy', size = 'md' }: { mood?: AssistantMood; size?: 'sm' | 'md' }) {
  return <img src={FACES[mood]} alt="" className={cx('assistant-face', `assistant-face--${size}`)} draggable={false} />;
}

export function AssistantRobot({ className }: { className?: string }) {
  return <img src={robotWave} alt="" className={cx('assistant-robot', className)} draggable={false} />;
}

/** "صباح الخير" until noon, "مساء الخير" after, with the first name only. */
export function greeting(displayName: string, now = new Date()): string {
  const name = firstName(displayName);
  const salutation = now.getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  return name ? `${salutation} يا ${name}` : salutation;
}
