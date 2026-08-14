export type UploadStatus = "pending" | "uploading" | "success" | "error" | "cancelled";

export interface FileItem {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: UploadStatus;
  uploadedUrl?: string | null;
}
