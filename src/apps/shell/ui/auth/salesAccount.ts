import { createContext } from "react";
export type SalesAccount = { name: string; email: string };
export const SalesAccountContext = createContext<SalesAccount | null>(null);
