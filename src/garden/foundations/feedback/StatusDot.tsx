import { TOKENS } from "@/garden/tokens";

type StatusDotSize = "sm" | "md";

const STATUS_DOT_SIZE_MAP: Record<StatusDotSize, string> = {
  sm: TOKENS.size[6],
  md: TOKENS.size[8],
};

function StatusDot({ color, size = "md" }: { color?: string; size?: StatusDotSize }) {
  const resolvedSize = STATUS_DOT_SIZE_MAP[size];

  return (
    <span
      style={{
        display: "inline-block",
        width: resolvedSize,
        height: resolvedSize,
        borderRadius: TOKENS.radius.full,
        background: color || "currentColor",
        flexShrink: 0,
      }}
    />
  );
}

export default StatusDot;
