'use client';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * SSR-safe responsive breakpoint hook shared across all portals
 * (admin / staff / resident). Returns true when the viewport is at or below
 * `breakpoint` px.
 *
 * Implemented with useSyncExternalStore (not useState + effect) so it:
 *   - renders `false` on the server and hydrates without a flash,
 *   - subscribes to matchMedia changes natively,
 *   - avoids the synchronous-setState-in-effect pattern flagged by lint.
 *
 * Default 1024 matches the existing inline `window.innerWidth < 1024` checks
 * the dashboards already used, so swapping them in is behavior-preserving.
 */
export function useIsMobile(breakpoint = 1024) {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback((onChange) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default useIsMobile;
