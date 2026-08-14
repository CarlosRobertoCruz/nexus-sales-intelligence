/**
 * Foundation — `<img>` tipado com defaults sensatos: `alt=""` (decorativo se omitido)
 * e `decoding="async"` para nao bloquear o paint inicial. Forwarda ref.
 */

import { forwardRef } from "react";
import type { ImgHTMLAttributes } from "react";

const Image = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function Image({ alt = "", decoding = "async", ...props }, ref) {
    return <img ref={ref} alt={alt} decoding={decoding} {...props} />;
  }
);

export default Image;
