CREATE TABLE `bookmark_tags` (
	`bookmark_id` text NOT NULL,
	`tag_id` text NOT NULL,
	CONSTRAINT `bookmark_tags_pk` PRIMARY KEY(`bookmark_id`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`parent_id` text DEFAULT '' NOT NULL,
	CONSTRAINT `tags_sibling_name` UNIQUE(`parent_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `proj_x` real;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `proj_y` real;