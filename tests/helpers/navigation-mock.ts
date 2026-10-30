/** A tiny stateful stand-in for next/navigation: `router.replace("?a=1")` updates what `useSearchParams` returns. */
export function createNavigationStore(initial = "") {
  let search = initial;
  const listeners = new Set<() => void>();
  return {
    get search() { return search; },
    set(next: string) { search = next.replace(/^\?/u, ""); listeners.forEach((listener) => listener()); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
