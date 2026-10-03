import { useCallback, useEffect, useState } from "react";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

type Store<T> = { term: string; rows: T[] };

/**
 * Debounced live search over attendee profiles. `results` is null until the
 * query is long enough to search, so screens can tell "nothing typed yet"
 * apart from "nothing matched". While a newer term is in flight the previous
 * rows stay on screen and `searching` is true.
 */
export function useAttendeeSearch<T>(
  query: string,
  search: (term: string) => Promise<T[]>
) {
  const [store, setStore] = useState<Store<T> | null>(null);

  const term = query.trim();
  const active = term.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      void search(term).then((rows) => {
        if (!cancelled) setStore({ term, rows });
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, term, search]);

  const results = active && store ? store.rows : null;
  const searching = active && store?.term !== term;

  /** Patch the current rows in place, e.g. after one record was updated. */
  const updateResults = useCallback((update: (rows: T[]) => T[]) => {
    setStore((previous) =>
      previous ? { ...previous, rows: update(previous.rows) } : previous
    );
  }, []);

  return { results, searching, updateResults };
}
