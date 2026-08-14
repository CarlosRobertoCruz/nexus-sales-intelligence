/**
 * Foundation - thumbnail de upload com overlay de preview.
 *
 * Render-only: recebe o estado do arquivo e dispara `onRemove`.
 */

import { useState } from "react";
import { TOKENS } from "@/garden/tokens";
import Overlay from "../overlay/Overlay";
import Pressable from "../interaction/Pressable";
import { isUploadImageFile } from "@/garden/utils/upload/isUploadImageFile";

export interface FilePreviewItem {
  id: string;
  file?: { type?: string; name?: string };
  progress?: number;
  status?: "pending" | "uploading" | "success" | "error" | "cancelled";
  previewUrl?: string;
  uploadedUrl?: string | null;
}

interface FilePreviewProps {
  fileItem: FilePreviewItem;
  onRemove?: (id: string) => void;
}

function FilePreview({ fileItem, onRemove }: FilePreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isImage = isUploadImageFile(fileItem.file?.type, fileItem.file?.name);
  const progress = fileItem.progress ?? 0;
  const status = fileItem.status ?? "pending";
  const uploadedPath =
    typeof fileItem.uploadedUrl === "string" ? fileItem.uploadedUrl : null;
  const previewSrc = String(fileItem.previewUrl ?? uploadedPath ?? "").trim() || null;
  const canPreview = isImage && Boolean(previewSrc);

  return (
    <>
      <div
        onClick={() => {
          if (canPreview) setIsPreviewOpen(true);
        }}
        style={{
          position: "relative",
          width: TOKENS.size[72],
          height: TOKENS.size[72],
          borderRadius: TOKENS.radius[12],
          overflow: "hidden",
          background: TOKENS.color.surface.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: canPreview ? "pointer" : "default",
        }}
      >
        {isImage && previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div style={{ fontSize: TOKENS.typography.size[12] }}>File</div>
        )}

        {status === "uploading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: TOKENS.color.surface.overlay,
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            bottom: TOKENS.spacing[4],
            left: TOKENS.spacing[4],
            right: TOKENS.spacing[4],
            height: TOKENS.spacing[4],
            borderRadius: TOKENS.radius.full,
            width: `calc(${progress}% - 8px)`,
            background:
              status === "success"
                ? TOKENS.color.brand.primary
                : TOKENS.color.brand.soft,
            transition: `width ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.standard}, background ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.standard}`,
          }}
        />

        <Pressable
          as="button"
          appearance="bare"
          aria-label="Remover arquivo"
          onPress={(e) => {
            e.stopPropagation();
            onRemove?.(fileItem.id);
          }}
          style={{
            position: "absolute",
            top: TOKENS.spacing[4],
            right: TOKENS.spacing[4],
            width: TOKENS.size[18],
            height: TOKENS.size[18],
            borderRadius: TOKENS.radius.full,
            background: TOKENS.color.surface.overlay,
            color: TOKENS.color.content.inverse,
            fontSize: TOKENS.typography.size[12],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          x
        </Pressable>
      </div>

      {isPreviewOpen && previewSrc && (
        <Overlay onBackdropPress={() => setIsPreviewOpen(false)}>
          <Pressable
            as="button"
            appearance="bare"
            aria-label="Fechar preview"
            onPress={(e) => {
              e.stopPropagation();
              setIsPreviewOpen(false);
            }}
            style={{
              position: "absolute",
              top: TOKENS.spacing[16],
              right: TOKENS.spacing[16],
              width: TOKENS.size[32],
              height: TOKENS.size[32],
              borderRadius: TOKENS.radius.full,
              background: TOKENS.color.surface.overlay,
              color: TOKENS.color.content.inverse,
              fontSize: TOKENS.typography.size[16],
              fontWeight: TOKENS.typography.weight[700],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: TOKENS.zIndex[9999],
            }}
          >
            x
          </Pressable>

          <img
            src={previewSrc}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: TOKENS.radius[12],
            }}
          />
        </Overlay>
      )}
    </>
  );
}

export default FilePreview;
