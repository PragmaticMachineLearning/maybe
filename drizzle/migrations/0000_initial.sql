CREATE TABLE `workspaces` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL
);

CREATE TABLE `workbooks` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `title` text NOT NULL,
  `serialized_content` text NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
