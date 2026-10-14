CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`channel` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`post_id` text,
	`post_url` text,
	`container_id` text,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`approved_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`recorded_at` text NOT NULL
);
