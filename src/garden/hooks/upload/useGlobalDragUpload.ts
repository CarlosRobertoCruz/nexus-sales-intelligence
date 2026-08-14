/** Escuta drag/drop na window e despeja arquivos em `useFileUpload`; toggle por flag `enabled`. */
import { useEffect } from "react";
import type { UseFileUploadReturn } from "@/garden/hooks/upload/useFileUpload";

export function useGlobalDragUpload(
  upload: UseFileUploadReturn,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const { setIsDragging, addFiles } = upload;

  useEffect(() => {
    if (!enabled) return;

    let counter = 0;

    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      counter++;
      setIsDragging(true);
    }

    function handleDragLeave(e: DragEvent) {
      e.preventDefault();
      counter--;

      if (counter <= 0) {
        setIsDragging(false);
        counter = 0;
      }
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function handleDrop(e: DragEvent) {
      e.preventDefault();

      counter = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;

      if (files && files.length > 0) {
        addFiles(files);
      }
    }

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [setIsDragging, addFiles, enabled]);
}
