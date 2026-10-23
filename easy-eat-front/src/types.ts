export type MenuItem = {
  id: number
  name: string
  description: string
  price: number
  available: number
}
export type Round = {
  id: number
  title: string
  restaurantId: number | null
  orderDate: string
  closesAt: string
  status: 'open' | 'closed'
}
export type RoundSummary = Round & {
  orderCount: number
  personCount: number
  mealCount: number
  orderTotal: number
}
export type Restaurant = { id: number; name: string; menuCount: number }
export type Order = {
  id: string
  name: string
  account: string
  note: string
  status: 'new' | 'received'
  items: { name: string; quantity: number; price: number }[]
  total: number
}
export type Snapshot = {
  round: Round
  menu: MenuItem[]
  orders: Order[]
  personCount: number
  mealCount: number
  orderCount: number
  orderTotal: number
  rounds: RoundSummary[]
  restaurants: Restaurant[]
}
export type Catalog = {
  restaurants: Restaurant[]
  restaurant: Restaurant | null
  menu: Omit<MenuItem, 'available'>[]
}
export type Receipt = {
  orderId: string
  roundId: number
  name: string
  account: string
  note: string
  items: { menuItemId: number; quantity: number }[]
}
