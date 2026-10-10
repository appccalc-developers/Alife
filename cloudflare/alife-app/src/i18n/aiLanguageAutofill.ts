// Fixed bilingual copy for components/ai/AiLanguageAutofill.tsx.
export const aiLanguageAutofillText = {
    geminiIsFillingTheMissingLanguage: { en: 'Gemini is filling the missing language…', zh: 'Gemini 正在补全缺少的语言…' } as const,
    translationWasNotAppliedContentOrEditAccessChanged: { en: 'Translation was not applied: content or edit access changed, or the result did not meet field requirements. Review and retry.', zh: '译文未填入：内容或编辑权限已变化，或译文不符合字段要求。请检查后重试。' } as const,
    theOtherLanguageWasFilledAsAnAiDraft: { en: 'The other language was filled as an AI draft. Please review it.', zh: '另一种语言已作为 AI 草稿补全，请人工检查。' } as const,
    aiCouldNotFillTheContent: { en: 'AI could not fill the content.', zh: 'AI 暂时无法补全内容。' } as const,
    firstFillOneLanguageOnlyFieldsThatAlreadyHave: { en: 'First fill one language only; fields that already have both languages are not overwritten.', zh: '请先只填写一种语言；已经有中英文的字段不会被覆盖。' } as const,
    aiTranslating: { en: 'AI translating…', zh: 'AI 翻译中…' } as const,
    aiFillMissingLanguage: { en: 'AI fill missing language', zh: 'AI 补全另一语言' } as const,
    onlyUntranslatedTextAboveIsSentToGeminiPhone: { en: 'Only untranslated text above is sent to Gemini; phone, email, and photos are not sent. Avoid private or sensitive notes and review the draft before saving.', zh: '只会把上方缺少翻译的文字发送给 Gemini；电话、邮箱和照片不会发送。请勿填写私人或敏感备注，并在保存前检查草稿。' } as const,
    onlyEmptyLanguagesAreFilledAndExistingTextIs: { en: 'Only empty languages are filled and existing text is preserved. Text is sent to Gemini; review the draft before saving or publishing.', zh: '只补全空白语言，不会覆盖已有文字；内容会发送给 Gemini，请在保存或发布前检查草稿。' } as const,
};
