import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export { parsePayloadName, resolvePayloadDisplay } from './payloadDisplay.js'

export const isPS5 = /PlayStation/i.test(navigator.userAgent);
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const isSystemPayload = (filename) => {
  if (!filename) return false;
  const name = filename.split('/').pop().toLowerCase();
  return name.startsWith('pldmgr') || name.includes('payload-manager');
};
