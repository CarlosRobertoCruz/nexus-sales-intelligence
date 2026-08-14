/** Camada core/hooks/interaction — segura mudancas em `value` por `delay` ms; util para inputs de busca/filtro. */
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
