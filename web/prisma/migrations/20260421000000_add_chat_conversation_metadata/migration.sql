-- Add optional metadata for chat message source/session tracing.
ALTER TABLE "chat_messages" ADD COLUMN "source" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "conversationId" TEXT;
