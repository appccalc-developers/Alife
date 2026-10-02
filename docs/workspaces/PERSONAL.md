# Personal workspace

Personal Center serves the signed-in member's current tasks, active matters, notifications, account and preferences. Profile manages current-member information and Passkeys. Event work is an actor-filtered projection of real assignments and stages, not a new generic workflow engine.

Source: `PersonalCenterView`, `TasksView`, `ProfileView`, `useCurrentTasks`, `personalCenterRoutes`, auth provider and actor-filtered backend queries. Use Event duties contracts for delegated/review work.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| PC-01 | Personal data belongs to the current actor | Cross-user and signed-out reads denied; viewer switch clears/isolates previous state |
| PC-02 | Tasks reflect current authorized assignments | Completed, revoked, delegated or unavailable work is not falsely actionable |
| PC-03 | Profile/credential actions remain explicit | Confirmation and failure states; recovery is not silent session revocation |
| PC-04 | Language preference is local presentation state | Switching en/zh preserves entity identity and avoids unnecessary refetch |
| PC-05 | Home focuses on bounded current work | Individual cards and full-view links; stable phone/desktop navigation |

Do not claim theme/font/cross-device preferences exist without source evidence. Identity and personal-task API families bypass shared response caches. Notification delivery, read state and human response are separate facts.
