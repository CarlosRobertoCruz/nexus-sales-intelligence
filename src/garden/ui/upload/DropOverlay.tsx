/** Camada core/ui/upload — overlay visual sobre area-alvo durante drag global; visivel quando flag externo `visible=true`. */
import { ReactNode } from "react";
import { Stack, Surface } from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";

function DropOverlay({ visible, children }: { visible: boolean; children?: ReactNode }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: TOKENS.zIndex[999],
        pointerEvents: "none",
      }}
    >
      <Surface
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: TOKENS.radius[18],
          border: `2px dashed ${TOKENS.color.brand.primary}`,
          background: TOKENS.color.brand.soft,
          boxSizing: "border-box",
        }}
      >
        <Stack align="center" justify="center" style={{ height: "100%" }}>
          {children}
        </Stack>
      </Surface>
    </div>
  );
}

export default DropOverlay;
