/** Barrel publico dos tokens — expoe o `core` domain-blind. */

import { core } from "./core"

export const TOKENS = {
  ...core
}
