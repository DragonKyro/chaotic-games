// Small hooks for game views: unique SVG ids, replaying an animation when a
// value changes, one-shot pulses. Game-agnostic.

import { useCallback, useEffect, useId, useRef, useState } from 'react';

export type SvgIds = ((name: string) => string) & { url: (name: string) => string };

/**
 * Ids for SVG gradients / clip paths that stay unique when the same art is on
 * screen twice (every card in a hand would otherwise share one `url(#g)`).
 */
export function useSvgIds(): SvgIds {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = ((name: string) => `${base}-${name}`) as SvgIds;
  id.url = (name: string) => `url(#${base}-${name})`;
  return id;
}

/** Bumps whenever `value` changes (not on mount): use as a React key to replay an animation. */
export function useChangeKey(value: unknown): number {
  const [key, setKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (!Object.is(prev.current, value)) {
      prev.current = value;
      setKey((k) => k + 1);
    }
  }, [value]);
  return key;
}

/** True for `ms` after `trigger()`; for one-shot classes like a shake. */
export function usePulse(ms = 600): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOn(false);
    // next frame, so retriggering restarts the CSS animation
    requestAnimationFrame(() => setOn(true));
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, trigger];
}
