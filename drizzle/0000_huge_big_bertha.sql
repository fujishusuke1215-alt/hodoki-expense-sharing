CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`members` text NOT NULL,
	`shares` text NOT NULL,
	`expenses` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
