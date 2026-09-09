export type ChurchApplicationForm = {
  displayName: string; sex: string; phoneE164: string; email: string; declaration: string;
  replyPreference: 'email' | 'sms'; privacyConsent: boolean; notificationConsent: boolean; honeypot: string;
}

export const validateChurchApplication = (form: ChurchApplicationForm): 'required' | 'phone' | null => {
  if (form.displayName.trim().length < 2 || form.displayName.trim().length > 150 ||
    !['Male', 'Female', 'Unknown'].includes(form.sex) ||
    !/^[^\s@]+@[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 320 ||
    form.declaration.trim().length < 2 || form.declaration.trim().length > 2000 ||
    !form.privacyConsent || !form.notificationConsent) return 'required'
  const digits = form.phoneE164.replace(/\D/g, '')
  if ((form.phoneE164.trim() || form.replyPreference === 'sms') && (digits.length < 8 || digits.length > 15)) return 'phone'
  return null
}
