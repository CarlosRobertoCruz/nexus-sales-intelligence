/** Escuta paste de imagens na window e despeja em `useFileUpload`; toggle por flag `enabled`. */
import { useEffect } from "react";
import type { UseFileUploadReturn } from "@/garden/hooks/upload/useFileUpload";

export function usePasteUpload(
  upload: UseFileUploadReturn,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const { addFiles } = upload;

  useEffect(() => {
    if (!enabled) return;

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        addFiles(files);
      }
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [addFiles, enabled]);
}
