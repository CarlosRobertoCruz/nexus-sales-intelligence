/** Estado React do conjunto de uploads em andamento; orquestra runtime/upload/uploadEngine; revoga object URLs no cleanup. */
import { useState, useCallback, useRef, useEffect } from "react";
import { startUpload } from "@/garden/runtime/upload/uploadEngine";
import type { FileItem } from "@/garden/types/upload";

export type { FileItem };

function generateUploadId() {
  return crypto.randomUUID();
}

interface UseFileUploadOptions {
  maxSize?: number;
  accept?: string[];
  multiple?: boolean;
  uploadUrl?: string;
  headers?: Record<string, string>;
}

export function useFileUpload({
  maxSize = 5 * 1024 * 1024,
  accept = [],
  multiple = true,
  uploadUrl,
  headers,
}: UseFileUploadOptions = {}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileItem[]>([]);

  const validateFile = useCallback(
    (file: File): boolean => {
      if (accept.length && !accept.includes(file.type)) return false;
      if (file.size > maxSize) return false;
      return true;
    },
    [accept, maxSize]
  );

  const createFileItem = useCallback((file: File): FileItem => {
    return {
      id: generateUploadId(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      progress: 0,
      uploadedUrl: null,
    };
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList) as File[];

      const created = incoming
        .filter(validateFile)
        .map(createFileItem);

      setFiles((prev) => {
        const next = multiple ? [...prev, ...created] : created;
        filesRef.current = next;
        return next;
      });

      created.forEach((fileItem) => {
        const id = fileItem.id;

        startUpload(fileItem, {
          uploadUrl,
          headers,
          onProgress: (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id ? { ...f, progress } : f
              )
            );
          },
          onComplete: (completed) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id
                  ? { ...f, progress: 100, status: "success", uploadedUrl: completed.uploadedUrl }
                  : f
              )
            );
          },
          onError: () => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id ? { ...f, status: "error" } : f
              )
            );
          },
        });
      });
    },
    [multiple, validateFile, createFileItem, uploadUrl, headers]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);

      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }

      const next = prev.filter((f) => f.id !== id);
      filesRef.current = next;
      return next;
    });
  }, []);

  const clearFiles = useCallback(() => {
    filesRef.current.forEach((f) => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });

    filesRef.current = [];
    setFiles([]);
  }, []);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const getInputProps = () => ({
    ref: inputRef,
    type: "file" as const,
    style: { display: "none" },
    multiple,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
  });

  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
  }, []);

  return {
    files,
    isDragging,
    setIsDragging,
    addFiles,
    removeFile,
    clearFiles,
    openFilePicker,
    getInputProps,
  };
}

export type UseFileUploadReturn = ReturnType<typeof useFileUpload>;
