create table "Chat" ("id" text not null primary key, "createdAt" date not null, "title" text not null, "userId" text not null, "visibility" text not null);

create table "Message" ("id" text not null primary key, "chatId" text not null references "Chat" ("id"), "role" text not null, "parts" text not null, "attachments" text not null, "createdAt" date not null);

create table "Vote" ("id" text not null primary key, "chatId" text not null references "Chat" ("id"), "messageId" text not null references "Message" ("id"), "isUpvoted" integer not null);

create table "Document" ("id" text not null primary key, "createdAt" date not null, "title" text not null, "content" text, "kind" text not null, "userId" text not null);

create table "Suggestion" ("id" text not null primary key, "documentId" text not null, "documentCreatedAt" date not null, "originalText" text not null, "suggestedText" text not null, "description" text, "isResolved" integer not null, "userId" text not null, "createdAt" date not null);

create table "Stream" ("id" text not null primary key, "chatId" text not null references "Chat" ("id"), "createdAt" date not null);