import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const restaurants = sqliteTable("restaurants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderRounds = sqliteTable("order_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  restaurantId: integer("restaurant_id").references(() => restaurants.id),
  orderDate: text("order_date").notNull(),
  closesAt: text("closes_at").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const menuItems = sqliteTable("menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roundId: integer("round_id").references(() => orderRounds.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
}, (table) => [index("idx_menu_items_round_id").on(table.roundId)]);

export const restaurantMenuItems = sqliteTable("restaurant_menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [index("idx_restaurant_menu_items_restaurant_id").on(table.restaurantId)]);

export const roundMenuAvailability = sqliteTable("round_menu_availability", {
  roundId: integer("round_id").notNull().references(() => orderRounds.id),
  menuItemId: integer("menu_item_id").notNull().references(() => restaurantMenuItems.id),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
}, (table) => [primaryKey({ columns: [table.roundId, table.menuItemId] })]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  roundId: integer("round_id").notNull().references(() => orderRounds.id),
  employeeName: text("employee_name").notNull(),
  account: text("account").notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["new", "received"] }).notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_orders_round_id").on(table.roundId)]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().references(() => orders.id),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
  itemName: text("item_name"),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
}, (table) => [index("idx_order_items_order_id").on(table.orderId)]);
