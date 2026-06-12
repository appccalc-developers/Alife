export type AiSessionChatMessage = {
  role: 'user' | 'model'
  text: string
}

export type AiSessionLanguage = 'zh' | 'en' | 'bilingual'

export type AiSessionProfile = {
  id?: string
  displayName?: string
  name?: string
  role?: string
  language?: string
  [key: string]: unknown
}

export type AiSessionAppContext = {
  language?: AiSessionLanguage | string
  userId?: string
  userProfile?: AiSessionProfile | null
  memberId?: string
  memberProfile?: AiSessionProfile | null
  groupId?: string
  groupProfile?: Record<string, unknown> | null
  groupProfiles?: AiSessionProfile[]
  eventId?: string
  eventData?: Record<string, unknown> | null
  missionStatements?: Record<string, unknown>[]
  eventContext?: Record<string, unknown> | null
  knownFacts?: Record<string, unknown>
}

export type AiSessionAttachment = {
  name: string
  contentType: string
  size: number
  source: 'inline' | 'url' | 'uploaded'
  url?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

export type AiSessionState<TDraft, TContext = unknown> = {
  sessionId: string
  draft: TDraft | null
  context: TContext | null
  appContext?: AiSessionAppContext
  attachments?: AiSessionAttachment[]
  chatHistory: AiSessionChatMessage[]
  updatedAt: string
}

export type AiSessionMessageOptions = {
  inputMode?: 'text' | 'voice'
  appContext?: AiSessionAppContext
  attachments?: AiSessionAttachment[]
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
