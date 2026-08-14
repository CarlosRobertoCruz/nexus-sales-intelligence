import type { UseFileUploadReturn } from "@/garden/hooks/upload/useFileUpload";

interface UploadInputProps {
  upload: UseFileUploadReturn;
  accept?: string;
}

function UploadInput({ upload, accept }: UploadInputProps) {
  return <input {...upload.getInputProps()} accept={accept} />;
}

export default UploadInput;
