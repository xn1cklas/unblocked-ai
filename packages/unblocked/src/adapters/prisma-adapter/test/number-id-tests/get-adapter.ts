import { PrismaClient } from '@prisma/client';
import { prismaAdapter } from '../..';

export function getAdapter() {
  const db = new PrismaClient();

  async function clearDb() {
    // Clear in correct order to handle foreign key constraints
    await db.vote.deleteMany();
    await db.suggestion.deleteMany();
    await db.stream.deleteMany();
    await db.message.deleteMany();
    await db.document.deleteMany();
    await db.chat.deleteMany();
    await db.user.deleteMany();

    // Reset auto-increment sequences for number ID tests
    try {
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'User'`;
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'Chat'`;
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'Message'`;
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'Document'`;
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'Suggestion'`;
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'Stream'`;
    } catch {}
  }

  const adapter = prismaAdapter(db, {
    provider: 'sqlite',
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  return { adapter, clearDb };
}
