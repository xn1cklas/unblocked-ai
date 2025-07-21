import {
  boolean,
  datetime,
  mysqlTable,
  text,
  varchar,
} from 'drizzle-orm/mysql-core';

// AI-focused tables for unblocked
export const chat = mysqlTable('chat', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  userId: varchar('userId', { length: 255 }).notNull(),
  visibility: varchar('visibility', { length: 20 }).notNull(),
  createdAt: datetime('createdAt', { mode: 'date' }).notNull(),
  updatedAt: datetime('updatedAt', { mode: 'date' }).notNull(),
});

export const message = mysqlTable('message', {
  id: varchar('id', { length: 255 }).primaryKey(),
  chatId: varchar('chatId', { length: 255 })
    .notNull()
    .references(() => chat.id),
  role: varchar('role', { length: 20 }).notNull(),
  parts: text('parts').notNull(), // JSON serialized
  attachments: text('attachments').notNull(), // JSON serialized
  createdAt: datetime('createdAt', { mode: 'date' }).notNull(),
});

export const vote = mysqlTable('vote', {
  chatId: varchar('chatId', { length: 255 }).notNull(),
  messageId: varchar('messageId', { length: 255 }).notNull(),
  isUpvoted: boolean('isUpvoted').notNull(),
});

export const document = mysqlTable('document', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  kind: varchar('kind', { length: 20 }).notNull(),
  userId: varchar('userId', { length: 255 }).notNull(),
  createdAt: datetime('createdAt', { mode: 'date' }).notNull(),
  updatedAt: datetime('updatedAt', { mode: 'date' }).notNull(),
});

export const suggestion = mysqlTable('suggestion', {
  id: varchar('id', { length: 255 }).primaryKey(),
  documentId: varchar('documentId', { length: 255 }).notNull(),
  documentCreatedAt: datetime('documentCreatedAt', { mode: 'date' }).notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: boolean('isResolved').notNull(),
  userId: varchar('userId', { length: 255 }).notNull(),
  createdAt: datetime('createdAt', { mode: 'date' }).notNull(),
});

export const stream = mysqlTable('stream', {
  id: varchar('id', { length: 255 }).primaryKey(),
  chatId: varchar('chatId', { length: 255 }).notNull(),
  createdAt: datetime('createdAt', { mode: 'date' }).notNull(),
});
