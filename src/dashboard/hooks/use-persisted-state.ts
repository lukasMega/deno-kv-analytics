import { useState } from "preact/hooks";

export function usePersistedState(
  key: string,
  initial: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState(() =>
    localStorage.getItem(key) ?? initial
  );
  const set = (next: string) => {
    localStorage.setItem(key, next);
    setValue(next);
  };
  return [value, set];
}
