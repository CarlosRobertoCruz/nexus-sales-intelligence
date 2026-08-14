/**
 * Foundation — overlay full-screen para ampliar uma imagem.
 *
 * `src=null` desmonta sem render (controle pelo consumer). Backdrop dispara `onClose`;
 * clique na imagem nao propaga (`stopPropagation`) para evitar fechar acidentalmente.
 */

import Overlay from "./Overlay";
import { TOKENS } from "@/garden/tokens";

function ImagePreviewOverlay({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;

  return (
    <Overlay onBackdropPress={onClose}>
      <img
        src={src}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90%",
          maxHeight: "90%",
          borderRadius: TOKENS.radius[12],
        }}
      />
    </Overlay>
  );
}

export default ImagePreviewOverlay;
