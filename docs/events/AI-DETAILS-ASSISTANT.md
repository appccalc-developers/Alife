# Event details assistant contract v1

The creation wizard uses `/api/events/details-session/{id}/message`, `/state` and `/close`. These use the existing Event Durable Object binding with a `details-v1:` object-name prefix and separate `event-details-v1` storage. Legacy event planning/editing, enrollment and review routes retain their response contracts. All four scenarios use shared assistant policy `1.0.0`; each supplies its own scenario definition and Gemini response schema.

## Input and output

Each message supplies `message` (up to 8,000 characters) and `appContext.knownFacts.snapshot`: `{ version: 1, revision, form, sources, isSeries, archetypeCode, activityTypeCode }`. The latest form is authoritative for draft editing, including manual changes. The server supplies the reference instant. Model context includes at most eight recent messages and no full member profiles, contact information, RAM or approval data.

`form` contains bilingual `{ zh, en }` title, description and locationName; nullable startLocal/endLocal (`YYYY-MM-DDTHH:mm`) and IANA timeZone; nullable visibility (`groupVisible`, `churchVisible`, `public`) and registrationMode (`none`, `required`); nullable integer maxCapacity and intervalWeeks (1–52). Classification/template selection remains outside the AI allow-list.

Gemini returns this complete form, `fieldAssessments` (field, status, exact supporting evidence, bilingual explanation), `assessment` (0–100 sufficiencyScore and bilingual summary), `issues` (field, kind, bilingual question), and bilingual `assistantReply`. Field statuses are explicit/inferred/missing/ambiguous/conflicting; issue kinds are missing/confirmationNeeded/ambiguous/conflicting/unsupported. Assessments/issues are bounded to ten and explanations/replies to 400 characters per language. Guidance asks at most two priority questions. Unknown business data is a successful partial draft, not a validation error.

After validation and conservative merging, the API returns `{ responseMode: "result", sessionId, result }`. The result adds `version: 1`, the input `revision`, adoptedFields, sources and deterministic `completion: { completed, total, percent, pending }`. Only supported, evidence-backed explicit fields can replace the latest draft; invalid values and ambiguous/conflicting changes do not. Explicit clears remain incomplete. The UI rejects responses for an older input signature/revision and retains user input on failure.

## Completion and authority

Each applicable field has equal weight. Bilingual fields count once and require both languages; capacity applies only when registration is required, and interval only for a series. Valid human/explicit sources count; defaults, unresolved fields and invalid values do not. Users may edit, clarify in conversation or confirm displayed defaults. The percentage measures draft completeness, not factual truth or business confirmation; AI sufficiency is separately labelled and cannot change completion, permissions, validation or approval.

Sources and revision metadata supplied by the client are presentation claims, never authorization credentials. AI output does not change module facts, template choices, approvals or persistence. Creation still requires the existing deterministic validation, server recomposition and explicit human acceptance. A 100% score neither approves nor publishes an event.

## Details-step presentation

The assistant's existing explanation now labels the input instead of the generic material prompt: **Explicit details fill the draft; uncertain details prompt a follow-up. Review before creating.** 简体：**明确提供的资料会填入草稿；不确定之处会继续询问。请在创建前审阅。** 繁體：**明確提供的資料會填入草稿；不確定之處會繼續詢問。請在建立前審閱。** The voice control stays beside this label.

The Details step displays the selected template above the form and beside the **AI details assistant** heading, without an “optional” suffix. The conversation is above the message input, in chronological order from top to bottom: each user message is followed by its assistant reply. The input and send actions follow it so the reply guides the next message. Each new exchange automatically scrolls the conversation to the bottom so the newest reply is visible. The chat uses left-aligned white assistant bubbles and right-aligned soft-green user bubbles on a warm patterned background, with speaker labels and a bilingual empty state. Field completion, pending fields and default confirmation sit below **Send and organise details**. **Back to event details form** sits at the bottom of that completion panel (wrapping on narrow screens); it scrolls to and focuses the form region without clearing the draft or conversation, and respects reduced-motion preferences. Template labels and controls follow the current UI language without restarting the session.

简体中文：活动资料表单上方和 **AI 资料助手** 标题旁均显示已选模板，标题不再标注「可选」。会话记录位于输入框上方；按时间从上到下排列，每条用户消息之后是对应的助手回复，方便根据回答继续输入；每次新增对话后自动滚动到底部。聊天采用左侧白色助手气泡、右侧浅绿色用户气泡，搭配暖色纹理背景、发言者标注和双语空状态提示。字段完成度、待补字段和默认值确认位于「发送并整理资料」下方；核对区底部提供「回到活动资料表单」，窄屏可换行；点击后滚动并聚焦到表单，保留草稿和对话，并遵循减少动态效果的设置。切换界面语言会更新模板名称和操作文字，不会重启会话。

繁體中文：活動資料表單上方和 **AI 資料助手** 標題旁均顯示已選範本，標題不再標註「可選」。對話記錄位於輸入框上方；按時間從上到下排列，每則使用者訊息之後是對應的助手回覆，方便根據回答繼續輸入；每次新增對話後自動捲動到底部。聊天採用左側白色助手氣泡、右側淺綠色使用者氣泡，搭配暖色紋理背景、發言者標註和雙語空狀態提示。欄位完成度、待補欄位和預設值確認位於「傳送並整理資料」下方；核對區底部提供「回到活動資料表單」，窄螢幕可換行；點擊後捲動並聚焦到表單，保留草稿和對話，並遵循減少動態效果的設定。切換介面語言會更新範本名稱和操作文字，不會重新啟動對話。

## Voice dictation

The input label includes an explicit **Voice input / Stop voice input** control backed by the browser's `SpeechRecognition` or `webkitSpeechRecognition`, in a secure context. It follows the UI language (`zh-CN` / `en-NZ`). Final results append once to the current editable message; interim results are a separate preview. Stopping waits for the final result/end event, with a three-second cleanup fallback. Sending remains disabled until recognition ends; transcription never sends a message or changes Event fields automatically. The existing 8,000-character limit applies, with a visible warning when excess dictated text is omitted.

Leaving the Details step, collapsing the assistant, switching language, hiding/leaving the browser page or unmounting closes recognition and ignores late results. Already appended text remains. Microphone/service permission denial, unavailable audio capture, no speech, unsupported language, network/start failures and unsupported browsers offer readable guidance while preserving typing. There is no automatic restart or microphone request on load. Alife does not upload or persist audio; the browser may use an online recognition service, as disclosed beside the input. Only user-reviewed text enters the existing details-session request, still using `inputMode: text`. See [SpeechRecognition browser behavior](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

简体中文：输入标签旁提供「语音输入／停止语音输入」，按界面语言识别中文或英文。最终识别文字追加到现有输入，临时结果单独预览；停止后等最后一段识别完成，再由用户核对并发送。达到 8,000 字符会停止并提示超出部分未填入。离开资料步骤、收起助手、切换语言、隐藏或离开页面时关闭识别，保留已填入的文字。浏览器不支持或权限、设备、网络等出现问题时仍可打字。麦克风仅由用户点击启动；浏览器可能使用在线语音服务，Alife 不上传或保存音频。

繁體中文：輸入標籤旁提供「語音輸入／停止語音輸入」，按介面語言辨識中文或英文。最終辨識文字追加到現有輸入，暫時結果單獨預覽；停止後等最後一段辨識完成，再由使用者核對並傳送。達到 8,000 字元會停止並提示超出部分未填入。離開資料步驟、收合助手、切換語言、隱藏或離開頁面時關閉辨識，保留已填入的文字。瀏覽器不支援或權限、裝置、網路等出現問題時仍可打字。麥克風僅由使用者點擊啟動；瀏覽器可能使用線上語音服務，Alife 不上傳或儲存音訊。

## Dates, recurrence and continuity

All creation dates are interpreted in the visible event time zone, including one-off events. The form explicitly labels this time basis and marks unconfirmed prefilled times. The server recognizes a bounded explicit calendar-date/clock-range statement (Chinese numeric/numeral dates or ISO dates, with an unambiguous period or 24-hour clock) in messages up to 400 characters. It uses the selected IANA zone and the current year there if omitted, preserves local wall-clock values, and supersedes stale/default or UTC-shaped model time values. Both fields receive the original supporting statement, rather than requiring the model's hour-only quote to repeat the date. Negated/conditional statements, multiple dates, missing AM/PM and DST gaps/folds do not take this deterministic path and retain the clarification flow. For example, “9月19日下午1点到下午4点” in Pacific/Auckland displays 2026-09-19 13:00–16:00, with UTC conversion only at Event submission (01:00–04:00Z for this date). Local-to-UTC conversion rejects invalid dates and DST gaps/folds. Relative phrases such as “next Saturday” require confirmation of a concrete date; conflicting weekly/fortnightly instructions are surfaced. Weekly intervals from 1–52 map to the existing `FREQ=WEEKLY;INTERVAL=N;BYDAY=...` contract and rolling 12-week materialization window. Monthly and multiple-weekday rules are not introduced.

Local draft envelopes use version 3 under the existing viewer/group-scoped storage key. Version 2 drafts retain text and settings, get interval 1 and unconfirmed sources. New assistant conversations are isolated from legacy conversations. Moving between wizard steps preserves the mounted conversation; closing the creation flow closes its ephemeral session. Local draft fields remain recoverable separately.

## Failure and privacy

Session ownership and authentication remain server-enforced; session responses use no-store and vary by Cookie/Authorization. Unknown fields and malformed inputs are rejected before invoking Gemini. MAX_TOKENS and malformed responses do not adopt partial results. No automatic retry or output-budget increase is introduced. Diagnostic output records model, finish reason and provider token counts without prompts, response bodies or profiles.

Test coverage includes incomplete output, latest snapshots, explicit corrections/clears, defaults and conditional completion, ALIFE date/recurrence ambiguity, DST, cross-member and legacy namespace isolation, invalid evidence, truncation recovery, and fortnightly backend materialization across NZ DST. Mocked tests are not evidence of live Gemini semantic accuracy.
