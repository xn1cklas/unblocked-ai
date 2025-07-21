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
  }

  const adapter = prismaAdapter(db, {
    provider: 'sqlite',
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  return { adapter, clearDb };
}
