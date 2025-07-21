/*

This file is used explicitly for testing purposes.

It's not used in the production code.

For information on how to use the drizzle-adapter with unblocked, please refer to the documentation.

*/
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// AI-focused tables for unblocked
export const chat = pgTable('chat', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  userId: text('userId').notNull(),
  visibility: text('visibility').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const message = pgTable('message', {
  id: text('id').primaryKey(),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  parts: text('parts').notNull(), // JSON serialized
  attachments: text('attachments').notNull(), // JSON serialized
  createdAt: timestamp('createdAt').notNull(),
});

export const vote = pgTable('vote', {
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  isUpvoted: boolean('isUpvoted').notNull(),
});

export const document = pgTable('document', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  kind: text('kind').notNull(),
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const suggestion = pgTable('suggestion', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull(),
  documentCreatedAt: timestamp('documentCreatedAt').notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: boolean('isResolved').notNull(),
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export const stream = pgTable('stream', {
  id: text('id').primaryKey(),
  chatId: text('chatId').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});
