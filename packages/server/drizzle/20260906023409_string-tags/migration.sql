PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookmark_tags` (
	`bookmark_id` text NOT NULL,
	`tag` text NOT NULL,
	CONSTRAINT `bookmark_tags_pk` PRIMARY KEY(`bookmark_id`, `tag`)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_bookmark_tags`(`bookmark_id`, `tag`) SELECT `bt`.`bookmark_id`, `t`.`name` FROM `bookmark_tags` AS `bt` JOIN `tags` AS `t` ON `t`.`id` = `bt`.`tag_id`;--> statement-breakpoint
DROP TABLE `bookmark_tags`;--> statement-breakpoint
ALTER TABLE `__new_bookmark_tags` RENAME TO `bookmark_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `tags`;