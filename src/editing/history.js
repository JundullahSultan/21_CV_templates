import { useCallback, useRef, useState } from "react";
export function useDataHistory(initial) {
  const [value, rawSet] = useState(initial),
    current = useRef(initial),
    past = useRef([]),
    future = useRef([]),
    [, refresh] = useState(0);
  const set = useCallback((update) => {
    const next =
      typeof update === "function" ? update(current.current) : update;
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (current.current !== null)
      past.current.push(structuredClone(current.current));
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    current.current = next;
    rawSet(next);
    refresh((v) => v + 1);
  }, []);
  const travel = useCallback((redo = false) => {
    const source = redo ? future.current : past.current;
    if (!source.length) return;
    (redo ? past.current : future.current).push(
      structuredClone(current.current),
    );
    current.current = source.pop();
    rawSet(current.current);
    refresh((v) => v + 1);
  }, []);
  return [
    value,
    set,
    {
      undo: () => travel(),
      redo: () => travel(true),
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
    },
  ];
}
