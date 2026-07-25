export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
}

export interface Restaurant {
  id: string
  name: string
  menuItems: MenuItem[]
}

export interface MenuItemInput {
  name: string
  price: number
  category: string
}

export interface RestaurantInput {
  name: string
}
