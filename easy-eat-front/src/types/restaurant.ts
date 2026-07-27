export interface MenuItem {
  id: string
  name: string
  price: number
  categoryId: string
  enabled: boolean
}

export interface Restaurant {
  id: string
  name: string
  enabled: boolean
  menuItems: MenuItem[]
}

export interface MenuItemInput {
  name: string
  price: number
  categoryId: string
}

export interface RestaurantInput {
  name: string
}

export interface MenuCategory {
  id: string
  name: string
  enabled: boolean
}

export interface MenuCategoryInput {
  name: string
}
