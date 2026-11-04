import { useEffect, useRef, useState } from 'preact/hooks';

/** Animates a number from its previous value to the new one (respects reduced motion). */
export function Count({ value, format, ms = 700 }: { value: number; format: (v: number) => string; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value === 0 ? 0 : value * 0.6);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(value)) { setShown(value); from.current = value; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <>{format(shown)}</>;
}
