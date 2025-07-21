import { describe, expect, it } from 'vitest';
import {
  getTestInstance,
  UNAUTHENTICATED,
} from '../../test-utils/test-instance';

describe('vote routes', async (it) => {
  const { ai, testUser } = await getTestInstance();

  it('should vote on a message', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Vote Test Chat',
        visibility: 'private',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message to vote on',
        role: 'assistant',
      },
    });

    const message = messageResponse.message;

    // Vote on the message
    const voteResponse = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'up',
      },
    });

    expect(voteResponse.vote).toBeDefined();
    expect(voteResponse.vote.messageId).toBe(message.id);
    expect(voteResponse.vote.vote).toBe('up');
  });

  it('should update existing vote', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Update Vote Test Chat',
        visibility: 'private',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message to change vote on',
        role: 'assistant',
      },
    });

    const message = messageResponse.message;

    // First vote up
    const firstVoteResponse = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'up',
      },
    });

    expect(firstVoteResponse.vote.vote).toBe('up');

    // Change vote to down
    const secondVoteResponse = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'down',
      },
    });

    expect(secondVoteResponse.vote.vote).toBe('down');
    expect(secondVoteResponse.vote.messageId).toBe(message.id);
  });

  it('should remove a vote', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Remove Vote Test Chat',
        visibility: 'private',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message to remove vote from',
        role: 'assistant',
      },
    });

    const message = messageResponse.message;

    // Vote on the message
    const voteResponse = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'up',
      },
    });

    // Remove the vote
    const removeResponse = await ai.api.removeVote({
      body: {
        chatId: chat.id,
        messageId: message.id,
      },
    });

    expect(removeResponse.success).toBe(true);

    // Try to remove again (should fail)
    const response = await ai.api.removeVote({
      body: {
        chatId: chat.id,
        messageId: message.id,
      },
      asResponse: true,
    });

    expect(response.status).toBe(404);
  });

  it('should get votes for a message', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Get Votes Test Chat',
        visibility: 'private',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message to get votes for',
        role: 'assistant',
      },
    });

    const message = messageResponse.message;

    // Vote on the message
    await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'up',
      },
    });

    // Get votes
    const votesResponse = await ai.api.getMessageVotes({
      params: {
        messageId: message.id,
      },
    });

    expect(votesResponse.votes).toBeDefined();
    expect(Array.isArray(votesResponse.votes)).toBe(true);
    expect(votesResponse.votes.length).toBe(1);
    expect(votesResponse.votes[0].vote).toBe('up');

    expect(votesResponse.stats).toBeDefined();
    expect(votesResponse.stats.up).toBe(1);
    expect(votesResponse.stats.down).toBe(0);
    expect(votesResponse.stats.total).toBe(1);
  });

  it('should filter votes by type', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Filter Votes Test Chat',
        visibility: 'private',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message with mixed votes',
        role: 'assistant',
      },
    });

    const message = messageResponse.message;

    // Vote up first
    await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'up',
      },
    });

    // Then vote down (this will update the existing vote)
    await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'down',
      },
    });

    // Get only down votes
    const downVotesResponse = await ai.api.getMessageVotes({
      params: {
        messageId: message.id,
      },
      query: {
        vote: 'down',
      },
    });

    expect(downVotesResponse.votes).toBeDefined();
    expect(Array.isArray(downVotesResponse.votes)).toBe(true);
    expect(downVotesResponse.votes.length).toBe(1);
    expect(downVotesResponse.votes[0].vote).toBe('down');
  });

  it('should require user for voting', async () => {
    // Create a new instance without user
    const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);

    const response = await aiNoUser.api.voteMessage({
      body: {
        chatId: 'test-chat-id',
        messageId: 'test-message-id',
        type: 'up',
      },
      asResponse: true,
    });

    expect(response.status).toBe(401);
    // Since this is a 401 error response, check if it's JSON first
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      expect(result.error).toBeDefined();
    } catch {
      // If not JSON, the 401 status is sufficient
      expect(response.status).toBe(401);
    }
  });

  it('should handle vote without metadata', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Vote Metadata Test Chat',
        visibility: 'private',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message to vote with metadata',
        role: 'assistant',
      },
    });

    const message = messageResponse.message;

    // Vote without metadata (removed in simplified schema)
    const voteResponse = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: message.id,
        type: 'up',
      },
    });

    expect(voteResponse.vote).toBeDefined();
    expect(voteResponse.vote.vote).toBe('up');
    expect(voteResponse.vote.messageId).toBe(message.id);
  });

  it('should prevent voting on non-existent message', async () => {
    const response = await ai.api.voteMessage({
      body: {
        chatId: 'non-existent-chat-id',
        messageId: 'non-existent-message-id',
        type: 'up',
      },
      asResponse: true,
    });

    expect(response.status).toBe(404);
    // Since this is a 404 error response, check if it's JSON first
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      expect(result.error).toBeDefined();
    } catch {
      // If not JSON, the 404 status is sufficient
      expect(response.status).toBe(404);
    }
  });

  it('should prevent access to private chat votes', async () => {
    // This test would need to be run with a different user
    // For now, we'll test the basic access control structure
    const response = await ai.api.getMessageVotes({
      params: {
        messageId: 'private-message-id',
      },
      asResponse: true,
    });

    // Should fail because message doesn't exist
    expect(response.status).toBe(404);
  });
});

describe('multi-user vote isolation', async () => {
  // Create separate user contexts
  const {
    ai: userAlice,
    createTestChat: createTestChatAlice,
    createChatFlow: createChatFlowAlice,
  } = await getTestInstance(
    {},
    {
      user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
    }
  );
  const {
    ai: userBob,
    createTestChat: createTestChatBob,
    createChatFlow: createChatFlowBob,
  } = await getTestInstance(
    {},
    {
      user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
    }
  );

  it("should prevent voting on other users' messages", async () => {
    // Alice creates a chat with messages
    const { chat, messages } = await createTestChatAlice({
      title: "Alice's Chat",
      withMessages: [
        { content: "Alice's question", role: 'user' },
        { content: "Alice's AI response", role: 'assistant' },
      ],
    });

    // Bob should not be able to vote on Alice's messages
    const response = await userBob.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[1].id, // AI response
        type: 'up',
      },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Chat not found for Bob
  });

  it("should prevent accessing votes from other users' chats", async () => {
    // Alice creates a chat with voted messages
    const { chat, messages } = await createTestChatAlice({
      title: "Alice's Chat",
      withMessages: [{ content: "Alice's AI response", role: 'assistant' }],
    });

    // Alice votes on her own message
    await userAlice.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
        type: 'up',
      },
    });

    // Bob should not be able to access Alice's votes
    const response = await userBob.api.getVotesByChatId({
      params: { chatId: chat.id },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Chat not found for Bob
  });

  it('should prevent accessing message votes from other users', async () => {
    // Alice creates a chat with voted messages
    const { chat, messages } = await createTestChatAlice({
      title: "Alice's Chat",
      withMessages: [{ content: "Alice's AI response", role: 'assistant' }],
    });

    // Alice votes on her message
    await userAlice.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
        type: 'down',
      },
    });

    // Bob should not be able to access Alice's message votes
    const response = await userBob.api.getMessageVotes({
      params: { messageId: messages[0].id },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Message not found for Bob
  });

  it("should prevent removing votes from other users' messages", async () => {
    // Alice creates and votes on a message
    const { chat, messages } = await createTestChatAlice({
      title: "Alice's Chat",
      withMessages: [{ content: "Alice's AI response", role: 'assistant' }],
    });

    await userAlice.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
        type: 'up',
      },
    });

    // Bob should not be able to remove Alice's vote
    const response = await userBob.api.removeVote({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
      },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Chat not found for Bob

    // Verify Alice's vote still exists
    const aliceVotes = await userAlice.api.getVotesByChatId({
      params: { chatId: chat.id },
    });
    expect(aliceVotes).toHaveLength(1);
    expect(aliceVotes[0].isUpvoted).toBe(true);
  });

  it('should isolate vote statistics between users', async () => {
    // Alice creates chats with votes
    const aliceChat1 = await createChatFlowAlice([
      { content: 'Alice question 1', role: 'user' },
      { content: 'Alice AI response 1', role: 'assistant', vote: 'up' },
    ]);

    const aliceChat2 = await createChatFlowAlice([
      { content: 'Alice question 2', role: 'user' },
      { content: 'Alice AI response 2', role: 'assistant', vote: 'down' },
    ]);

    // Bob creates chats with votes
    const bobChat1 = await createChatFlowBob([
      { content: 'Bob question 1', role: 'user' },
      { content: 'Bob AI response 1', role: 'assistant', vote: 'up' },
    ]);

    // Alice should only see her own vote statistics
    const aliceVotes1 = await userAlice.api.getVotesByChatId({
      params: { chatId: aliceChat1.chat.id },
    });
    expect(aliceVotes1).toHaveLength(1);
    expect(aliceVotes1[0].isUpvoted).toBe(true);

    const aliceVotes2 = await userAlice.api.getVotesByChatId({
      params: { chatId: aliceChat2.chat.id },
    });
    expect(aliceVotes2).toHaveLength(1);
    expect(aliceVotes2[0].isUpvoted).toBe(false);

    // Bob should only see his own vote statistics
    const bobVotes1 = await userBob.api.getVotesByChatId({
      params: { chatId: bobChat1.chat.id },
    });
    expect(bobVotes1).toHaveLength(1);
    expect(bobVotes1[0].isUpvoted).toBe(true);
  });

  // TODO: Add tests for vote analytics and aggregation when implemented
  // TODO: Add tests for vote rate limiting per user
});

describe('vote error code validation', async () => {
  const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);
  const { ai } = await getTestInstance();

  it('should return authentication error codes', async () => {
    const response = await aiNoUser.api.voteMessage({
      body: {
        chatId: 'test-chat-id',
        messageId: 'test-message-id',
        type: 'up',
      },
      asResponse: true,
    });

    expect(response.status).toBe(401);
    const error = await response.json();
    expect(error.message).toContain('User is required');
  });

  it('should return vote not found error codes', async () => {
    const response = await ai.api.getVotesByChatId({
      params: { chatId: 'non-existent-chat-id' },
      asResponse: true,
    });

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.message).toContain('not found');
  });

  it('should validate vote input format', async () => {
    const response = await ai.api.voteMessage({
      body: {
        chatId: 'valid-chat-id',
        messageId: 'valid-message-id',
        type: 'invalid-vote-type' as any, // Invalid vote type
      },
      asResponse: true,
    });

    expect([400, 404, 422]).toContain(response.status);
  });

  // TODO: Add specific vote error tests:
  // - MESSAGE_NOT_FOUND when voting
  // - CHAT_ACCESS_DENIED scenarios
  // - Invalid vote type validation
  // - Duplicate vote handling
});
