// Bar-chart rows, rendered the same on the server (set:html) and in the browser (the speed
// chart redraws on every control change), and the grow-on-scroll animation they share.

export interface Row {
  name: string;
  value: number;
  label: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rows sorted shortest first, each bar's length relative to the longest. */
export function barsHTML(rows: Row[]): string {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const max = Math.max(...sorted.map((r) => r.value));
  return sorted
    .map((r) => {
      const share = r.value / max;
      const w = `${(share * 100).toFixed(2)}%`;
      // One speed for every bar: the longest takes the longest to land.
      const d = `${Math.round(250 + 1250 * share)}ms`;
      return (
        `<li class="bar-row"${r.name === 'jpm' ? ' data-jpm' : ''} style="--w:${w};--d:${d}">` +
        `<span class="bar-name">${esc(r.name)}</span>` +
        `<span class="bar-lane"><span class="bar-track"><span class="bar-clip"><span class="bar-fill"></span></span>` +
        `<span class="bar-value">${esc(r.label)}</span></span></span></li>`
      );
    })
    .join('');
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let observer: IntersectionObserver | undefined;

/** Bars wait at zero until a chart is in view, then grow once. Not under reduced motion. */
export function animateOnView(list: HTMLElement): void {
  if (reduced() || !('IntersectionObserver' in window)) return;
  list.classList.add('js-anim');
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          observer?.unobserve(e.target);
        }
      }
    },
    { threshold: 0.35 },
  );
  observer.observe(list);
}

/** Grow a chart's bars again from zero, after its rows changed. */
export function replay(list: HTMLElement): void {
  if (!list.classList.contains('js-anim') || !list.classList.contains('is-in')) return;
  list.classList.remove('is-in');
  void list.offsetWidth;
  list.classList.add('is-in');
}
