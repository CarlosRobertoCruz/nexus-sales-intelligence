import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { TOKENS } from "@/garden/tokens";
import { getNameInitials } from "@/garden/utils/name/getNameInitials";

type AvatarVariant = "circle" | "square";
type AvatarSize = "sm" | "md" | "lg";

type GetInitialsFn = (name?: string) => string;

const AVATAR_SIZE_STYLES: Record<
  AvatarSize,
  Pick<CSSProperties, "width" | "height" | "fontSize">
> = {
  sm: {
    width: TOKENS.size[28],
    height: TOKENS.size[28],
    fontSize: TOKENS.typography.size[12],
  },
  md: {
    width: TOKENS.size[36],
    height: TOKENS.size[36],
    fontSize: TOKENS.typography.size[14],
  },
  lg: {
    width: TOKENS.size[48],
    height: TOKENS.size[48],
    fontSize: TOKENS.typography.size[19],
  },
};

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?: string;
  initials?: string;
  getInitialsFn?: GetInitialsFn;
  size?: AvatarSize;
  variant?: AvatarVariant;
  style?: CSSProperties;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      name,
      initials,
      getInitialsFn,
      size = "md",
      variant = "square",
      children,
      style,
      ...props
    },
    ref
  ) => {
    const explicitInitials = initials?.trim();
    const displayName = name?.trim();
    const shouldResolveInitials = Boolean(explicitInitials || displayName);

    const content = shouldResolveInitials
      ? explicitInitials
        || (getInitialsFn ? getInitialsFn(displayName) : getNameInitials(displayName))
      : children;

    const sizeStyle = AVATAR_SIZE_STYLES[size];

    const baseStyle: CSSProperties = {
      width: sizeStyle.width,
      height: sizeStyle.height,
      borderRadius:
        variant === "circle"
          ? TOKENS.radius.full
          : TOKENS.radius[8],
      background: TOKENS.color.brand.primary,
      color: TOKENS.color.content.inverse,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: TOKENS.typography.weight[600],
      ...(shouldResolveInitials && {
        fontSize: sizeStyle.fontSize,
      }),
      userSelect: "none",
    };

    return (
      <div ref={ref} style={{ ...baseStyle, ...style }} {...props}>
        {content}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
