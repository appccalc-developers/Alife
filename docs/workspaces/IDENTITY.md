# Identity design and acceptance

[identity-access](../identity-access.md) owns detailed application, invitation, activation, delivery and recovery rules; [backend architecture](../backend_architecture.md) owns authentication integration. This booklet supplies orientation and requirement coverage without duplicating token/API values.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| ID-01 | Existing-member sign-in, first application, activation and recovery are distinct intentions | Cancellation/failure never silently creates an application or downgrades authentication |
| ID-02 | Passkey is primary; LINE is explicit compatibility; Alpha is configuration-restricted | Origin/challenge/ownership verification, unavailable/expired/replay and restricted Alpha cases |
| ID-03 | Anonymous application does not create membership authority | Explicit authorized identity verification and approval precede linked/new membership |
| ID-04 | One-time secrets are protected and minimally disclosed | No raw activation/recovery secrets in lists, logs or shared caches; consume/replay behavior |
| ID-05 | Recovery preserves identity and rechecks issuer/target authority | Own-group ordinary member case allowed, elevated/out-of-scope/self case denied as contract specifies |
| ID-06 | Credential recovery is not JWT session revocation | Successful replacement revokes old credentials, existing sessions retain documented expiry |
| ID-07 | User-facing failures remain safe and recoverable | Bilingual unsupported/cancellation/network/expiry states; safe trace reference without secret details |

Inspect identity controllers/handlers, `CurrentMemberAccessor`, auth provider and locale helpers. Identity endpoints bypass shared response caching. Device classification helps interaction; it is not identity or authenticator security proof. Do not broaden recovery by copying a group-management permission check.
