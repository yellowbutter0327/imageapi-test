'use client';
import { useSyncExternalStore } from 'react';

const storageKey = 'image-search:retry-at';
let localDeadline = 0;
function deadline() {
  try {
    return Math.max(
      localDeadline,
      Number(localStorage.getItem(storageKey)) || 0,
    );
  } catch {
    return localDeadline;
  }
}
export function remainingCooldown() {
  return Math.max(0, Math.ceil((deadline() - Date.now()) / 1000));
}
export function startCooldown(seconds: number) {
  localDeadline = Math.max(deadline(), Date.now() + seconds * 1000);
  try {
    localStorage.setItem(storageKey, String(localDeadline));
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  window.dispatchEvent(new Event('image-search:cooldown'));
}
function subscribe(notify: () => void) {
  let timer: number | undefined;
  function tick() {
    window.clearTimeout(timer);
    notify();
    const remaining = deadline() - Date.now();
    if (remaining > 0)
      timer = window.setTimeout(tick, Math.min(1000, remaining));
  }
  tick();
  window.addEventListener('storage', tick);
  window.addEventListener('image-search:cooldown', tick);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('storage', tick);
    window.removeEventListener('image-search:cooldown', tick);
  };
}
export function useSearchCooldown() {
  return useSyncExternalStore(subscribe, remainingCooldown, () => 0);
}
