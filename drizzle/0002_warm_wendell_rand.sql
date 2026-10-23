CREATE TABLE `restaurant_menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_restaurant_menu_items_restaurant_id` ON `restaurant_menu_items` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_name_unique` ON `restaurants` (`name`);--> statement-breakpoint
INSERT OR IGNORE INTO `restaurants` (`name`)
SELECT DISTINCT `title` FROM `order_rounds`
WHERE `title` != '尚未設定今日團購';--> statement-breakpoint
CREATE TABLE `round_menu_availability` (
	`round_id` integer NOT NULL,
	`menu_item_id` integer NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`round_id`, `menu_item_id`),
	FOREIGN KEY (`round_id`) REFERENCES `order_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `restaurant_menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `item_name` text;--> statement-breakpoint
ALTER TABLE `order_rounds` ADD `restaurant_id` integer REFERENCES restaurants(id);--> statement-breakpoint
UPDATE `order_rounds`
SET `restaurant_id` = (SELECT `id` FROM `restaurants` WHERE `name` = `order_rounds`.`title`)
WHERE `title` != '尚未設定今日團購';--> statement-breakpoint
UPDATE `order_items`
SET `item_name` = (SELECT `name` FROM `menu_items` WHERE `menu_items`.`id` = `order_items`.`menu_item_id`)
WHERE `item_name` IS NULL;--> statement-breakpoint
INSERT INTO `restaurant_menu_items` (`restaurant_id`, `name`, `description`, `price`, `active`)
SELECT source.`restaurant_id`, menu.`name`, menu.`description`, menu.`price`, 1
FROM `order_rounds` AS source
JOIN `menu_items` AS menu ON menu.`round_id` = source.`id`
WHERE source.`restaurant_id` IS NOT NULL
  AND source.`id` = (
    SELECT latest.`id`
    FROM `order_rounds` AS latest
    JOIN `menu_items` AS latest_menu ON latest_menu.`round_id` = latest.`id`
    WHERE latest.`restaurant_id` = source.`restaurant_id`
    ORDER BY latest.`order_date` DESC, latest.`id` DESC
    LIMIT 1
  );
