import type { ChatGatewayRequest } from '../application/chat-gateway'

interface OpenAiMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export const toOpenAiMessages = (request: ChatGatewayRequest): OpenAiMessage[] => {
  const trimmedPrompt = request.systemPrompt?.trim() ?? ''
  const systemMessage =
    trimmedPrompt.length > 0
      ? ([{ role: 'system', content: trimmedPrompt }] satisfies OpenAiMessage[])
      : []

  return [
    ...systemMessage,
    ...request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}

export const toAnthropicMessages = (request: ChatGatewayRequest) =>
  request.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))

export const toGeminiContents = (request: ChatGatewayRequest) =>
  request.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))
