/**
 * Barrel dos tokens core (independentes de feature). Cada modulo expoe um objeto
 * com escala fechada de valores; o `core` agregado e' consumido pelo `TOKENS` raiz.
 */

import { color } from "./color"
import { spacing } from "./spacing"
import { size } from "./size"
import { typography } from "./typography"
import { radius } from "./radius"
import { shadow } from "./shadow"
import { motion } from "./motion"
import { zIndex } from "./zIndex"
import { effects } from "./effects"
import { reportExport } from "./reportExport"

export const core = {
  color,
  spacing,
  size,
  typography,
  radius,
  shadow,
  motion,
  zIndex,
  effects,
  reportExport,
}