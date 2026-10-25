import { api } from './api'
import type { Receipt, Snapshot } from './types'
type Tool = {
  name: string
  title: string
  description: string
  inputSchema: object
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }
  execute(input: unknown): Promise<unknown>
}
type ModelContext = {
  registerTool(tool: Tool, options: { signal: AbortSignal }): void | Promise<void>
}
export function registerOrderingTools(
  roundId: string,
  submitted: (receipt: Receipt) => Promise<void>,
) {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext
  if (!context) return () => {}
  const controller = new AbortController(),
    query = roundId ? `?roundId=${encodeURIComponent(roundId)}` : ''
  const tools: Tool[] = [
    {
      name: 'read_lunch_menu',
      title: '查看今日午餐菜單',
      description: '讀取目前這團的名稱、截止時間、餐點、價格與供應狀態。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute() {
        const snapshot = await api<Snapshot>(query)
        return { roundId: snapshot.round.id, round: snapshot.round, menu: snapshot.menu }
      },
    },
    {
      name: 'submit_lunch_order',
      title: '送出午餐訂單',
      description: '提供姓名、帳號與餐點，送出後會建立正式訂單。',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          account: { type: 'string', minLength: 1, maxLength: 80 },
          note: { type: 'string', maxLength: 160 },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 30,
            items: {
              type: 'object',
              properties: {
                menuItemId: { type: 'integer' },
                quantity: { type: 'integer', minimum: 1, maximum: 20 },
              },
              required: ['menuItemId', 'quantity'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'account', 'items'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (controller.signal.aborted) throw new Error('點餐頁面已切換，請重新讀取菜單後再送出。')
        const snapshot = await api<Snapshot>(query)
        const payload = input as Pick<Receipt, 'name' | 'account' | 'items'> & { note?: string }
        if (controller.signal.aborted) throw new Error('點餐頁面已切換，請重新讀取菜單後再送出。')
        const result = await api<{ orderId: string }>('', {
          ...payload,
          action: 'place-order',
          roundId: snapshot.round.id,
          requestId: crypto.randomUUID(),
        })
        await submitted({
          orderId: result.orderId,
          roundId: snapshot.round.id,
          name: payload.name.trim(),
          account: payload.account.trim(),
          note: payload.note?.trim() || '',
          items: payload.items.map((item) => ({ ...item })),
        })
        return { status: 'submitted', message: '午餐訂單已送出。' }
      },
    },
  ]
  for (const tool of tools)
    void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch((error) =>
      console.error('點餐工具註冊失敗', error),
    )
  return () => controller.abort()
}
