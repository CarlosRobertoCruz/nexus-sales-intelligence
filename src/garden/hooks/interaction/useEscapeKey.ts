/** Camada core/hooks/interaction — escuta ESC global e dispara callback opcional; nao guarda estado de qual UI fechar. */
import { useEffect } from "react";

export function useEscapeKey(callback: (() => void) | undefined) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        callback?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [callback]);
}