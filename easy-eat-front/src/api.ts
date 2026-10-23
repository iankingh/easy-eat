export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}
export async function api<T>(
  query = '',
  body?: Record<string, unknown>,
  adminCode = '',
): Promise<T> {
  const response = await fetch(`/api/ordering${query}`, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(adminCode ? { 'x-admin-code': adminCode } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let result: T & { error?: string; code?: string }
  try {
    result = await response.json()
  } catch {
    throw new Error(`伺服器回應異常（HTTP ${response.status}），請重新整理後再試。`)
  }
  if (!response.ok)
    throw new ApiError(result.error || '操作未完成，請重新整理並確認是否已儲存。', result.code)
  return result
}
export const money = (amount: number) =>
  new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(amount)
export const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
export const formatTime = (value: string) =>
  new Date(value).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
