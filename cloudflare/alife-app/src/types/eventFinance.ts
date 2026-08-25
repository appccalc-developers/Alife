export type EventFinanceOption = { id: string; name: { en: string; zh: string }; extraFee: number }
export type EventPaymentEvidenceSummary = {
  enrollmentId: string
  applicantName: string
  fileCount: number
  updatedUtc: string
}
export type EventFinanceEntryType = 'Income' | 'Expense'
export type EventFinanceEntry = {
  id: string
  type: EventFinanceEntryType
  category: string
  description: { en: string; zh: string }
  amount: number
  occurredUtc: string
  updatedUtc: string
}
export type EventFinanceReconciliation = {
  notes: { en: string; zh: string }
  leaderConfirmed: boolean
  confirmedByMemberId?: string | null
  confirmedByMemberName?: string | null
  confirmedUtc?: string | null
  updatedUtc?: string | null
}
export type EventFinanceWorkspace = {
  eventId: string
  groupId: string
  titleEn: string
  titleZh: string
  status: 'NotConfigured' | 'Configuring' | 'Ready' | 'Blocked' | 'Completed'
  currency: string
  adultFee?: number | null
  childFee?: number | null
  paymentInstructions: { en: string; zh: string }
  refundPolicy: { en: string; zh: string }
  paymentEvidenceRequired: boolean
  leaderConfirmed: boolean
  options: EventFinanceOption[]
  evidenceSubmissionCount: number
  evidenceFileCount: number
  evidenceSummaries: EventPaymentEvidenceSummary[]
  eventEnded: boolean
  actualIncome: number
  actualExpense: number
  actualBalance: number
  actualEntries: EventFinanceEntry[]
  reconciliation: EventFinanceReconciliation
}
export type SaveEventFinanceEntry = {
  type: EventFinanceEntryType
  category: string
  descriptionEn: string
  descriptionZh: string
  amount: number
  occurredUtc: string
}
export type ReconcileEventFinance = { notesEn: string; notesZh: string; leaderConfirmed: boolean }
export type UpdateEventFinanceSettings = {
  enabled: boolean
  currency: string
  adultFee?: number | null
  childFee?: number | null
  paymentInstructionsEn: string
  paymentInstructionsZh: string
  refundPolicyEn: string
  refundPolicyZh: string
  paymentEvidenceRequired: boolean
  leaderConfirmed: boolean
  options: Array<{ id?: string | null; nameEn: string; nameZh: string; extraFee: number }>
}
