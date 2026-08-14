import type { ReactNode } from "react";
import { useFileUpload } from "@/garden/hooks/upload/useFileUpload";
import { UploadContext } from "./uploadContext";

interface UploadProviderProps {
  children: ReactNode;
  uploadUrl?: string;
  headers?: Record<string, string>;
}

export function UploadProvider({ children, uploadUrl, headers }: UploadProviderProps) {
  const upload = useFileUpload({ uploadUrl, headers });

  return (
    <UploadContext.Provider
      value={{
        upload,
        isDragging: upload.isDragging,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}
