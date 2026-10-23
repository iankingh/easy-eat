ALTER TABLE `menu_items` ADD `round_id` integer REFERENCES order_rounds(id);--> statement-breakpoint
CREATE INDEX `idx_menu_items_round_id` ON `menu_items` (`round_id`);