import { createContext } from "react";
import type { UseFileUploadReturn } from "@/garden/hooks/upload/useFileUpload";

export interface UploadContextValue {
  upload: UseFileUploadReturn;
  isDragging: boolean;
}

export const UploadContext = createContext<UploadContextValue | null>(null);
