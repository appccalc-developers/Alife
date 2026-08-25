export type EventModuleSuggestionKey = 'registration' | 'finance' | 'venue' | 'roster' | 'programme'
export type EventModuleSuggestionBasis = 'currentEvent' | 'confirmedHistory' | 'inference'

export type EventModuleSuggestionItem = {
  key: string
  label: { en: string; zh: string }
  value: string
  rationale: { en: string; zh: string }
  basis: EventModuleSuggestionBasis
}

export type EventModuleSuggestionResponse = {
  module: EventModuleSuggestionKey
  suggestions: EventModuleSuggestionItem[]
  warnings: Array<{ en: string; zh: string }>
  model: string
  requiresHumanReview: true
  persisted: false
}
