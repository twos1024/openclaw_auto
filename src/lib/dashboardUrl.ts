export function normalizeDashboardSrc(src: string): string {
  try {
    return new URL(src).toString();
  } catch {
    return src;
  }
}
