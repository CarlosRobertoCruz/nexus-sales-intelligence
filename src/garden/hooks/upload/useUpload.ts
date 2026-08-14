/** Consumo do UploadContext; falha cedo se chamado fora de UploadProvider. */
import { useContext } from "react";
import { UploadContext, type UploadContextValue } from "@/garden/providers/upload/uploadContext";

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload precisa estar dentro do UploadProvider");
  return ctx;
}
