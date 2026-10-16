import { createContext } from "react";

// Dashboard reports the completion of its real initial hydration, including an empty base.
export const SalesStartupContext = createContext<
  ((error: string | null) => void) | null
>(null);
