/** Camada core/hooks/interaction — dispara callback quando mousedown ocorre fora do ref; nao decide o que fechar. */
import { useEffect, RefObject } from "react";

export function useClickOutside(ref: RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-anchor-flyout]")) return;
      if (ref.current && !ref.current.contains(target)) {
        callback();
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [ref, callback]);
}
