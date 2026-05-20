export type AiSessionChatMessage = {
  role: 'user' | 'model'
  text: string
}

export type AiSessionState<TDraft, TContext = unknown> = {
  sessionId: string
  draft: TDraft | null
  context: TContext | null
  chatHistory: AiSessionChatMessage[]
  updatedAt: string
}

export type AiSessionResponse<TDraft, TContext = unknown> = {
  responseMode: 'markdown' | 'result'
  sessionId?: string
  markdown?: string | null
  result?: TDraft | null
  context?: TContext | null
}

export type AiSessionSsePayload<TDraft, TContext = unknown> = {
  type: string
  state: AiSessionState<TDraft, TContext>
}
