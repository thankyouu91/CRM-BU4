// "Something was saved": the live feed (bell, inbox count, weekly report dot) listens
// and refreshes once per burst of writes, so counts follow what people just did
// without reloading the page. Browser-only; no React.

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** How long a burst of writes may last before the one refresh (a bulk edit sends several). */
export const SETTLE_MS = 400;

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function signalDataChanged(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    for (const listener of [...listeners]) listener();
  }, SETTLE_MS);
}
