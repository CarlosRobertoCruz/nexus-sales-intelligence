export type OperationalLogLevel = "error" | "warning" | "info";

export function emitOperationalLog(
  level: OperationalLogLevel,
  operation: string,
  context?: Record<string, unknown>,
): void {
  const payload = { operation, ...context };

  if (level === "error") {
    console.error(`[${operation}]`, payload);
    return;
  }

  if (level === "warning") {
    console.warn(`[${operation}]`, payload);
    return;
  }

  console.info(`[${operation}]`, payload);
}
