import type { FileItem } from "@/garden/types/upload";

type UploadState = "uploading" | "done" | "cancelled" | "error";

interface UploadHandlers {
  onProgress?: (progress: number) => void;
  onComplete?: (fileItem: FileItem) => void;
  onError?: (error: unknown) => void;
  onStateChange?: (state: UploadState) => void;
  uploadUrl?: string;
  headers?: Record<string, string>;
}

export function startUpload(fileItem: FileItem, handlers: UploadHandlers = {}) {
  const {
    onProgress,
    onComplete,
    onError,
    onStateChange,
    uploadUrl = "/api/upload",
    headers = {},
  } = handlers;

  let cancelled = false;

  function setState(state: UploadState) {
    onStateChange?.(state);
  }

  setState("uploading");
  onProgress?.(10);

  const formData = new FormData();
  formData.append("file", fileItem.file);

  const xhr = new XMLHttpRequest();

  xhr.upload.onprogress = (e) => {
    if (cancelled) return;
    if (e.lengthComputable) {
      onProgress?.(Math.round((e.loaded / e.total) * 90));
    }
  };

  xhr.onload = () => {
    if (cancelled) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText) as { url: string; name: string; mimeType: string; size: number };
      onProgress?.(100);
      setState("done");
      const uploadedPath = data.url.startsWith("/") ? data.url : `/${data.url}`;
      onComplete?.({ ...fileItem, uploadedUrl: uploadedPath, progress: 100, status: "success" });
    } else {
      setState("error");
      onError?.(new Error(`Upload falhou: ${xhr.status}`));
    }
  };

  xhr.onerror = () => {
    if (!cancelled) {
      setState("error");
      onError?.(new Error("Erro de rede no upload"));
    }
  };

  xhr.open("POST", uploadUrl);
  for (const [key, value] of Object.entries(headers)) {
    xhr.setRequestHeader(key, value);
  }
  xhr.send(formData);

  return {
    cancel() {
      cancelled = true;
      xhr.abort();
      setState("cancelled");
    },
    fail(error: unknown) {
      setState("error");
      onError?.(error);
    },
  };
}
