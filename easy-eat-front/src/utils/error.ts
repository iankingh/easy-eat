export function getErrorMessage(error: unknown, fallback = '發生未知錯誤，請稍後再試'): string {
  return error instanceof Error ? error.message : fallback
}
