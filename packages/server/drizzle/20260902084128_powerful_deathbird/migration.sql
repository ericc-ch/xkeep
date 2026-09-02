CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY,
	`author` text NOT NULL,
	`handle` text NOT NULL,
	`avatar` text NOT NULL,
	`text` text NOT NULL,
	`timestamp` text NOT NULL,
	`media_json` text NOT NULL,
	`hashtags_json` text NOT NULL,
	`urls_json` text NOT NULL,
	`quoted_json` text,
	`still_path` text,
	`embedding` blob
);
