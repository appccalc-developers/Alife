# Changelog

All notable changes to Alife are documented in this file.

The format follows Keep a Changelog and the repository uses four-part versions.

## [0.1.1.1] - 2026-08-31

### Changed

- Passkey browser requests now stop after two minutes or when the identity view closes, and bilingual recovery messages no longer describe every browser failure as an explicit cancellation.
- Passkey verification errors now include a safe trace reference that administrators can correlate with server diagnostics.

### Fixed

- Restored actionable distinction between inactive ALIFE credentials, backend verification failures, and browser or authenticator attempts that do not complete.

### Security

- Failed Passkey assertions log only a controlled completion stage, exception type, Fido2 verification category, and sanitized trace reference; raw WebAuthn material and exception messages remain excluded.

## [0.1.1.0] - 2026-08-31

### Added

- Alpha-only tester Stephen can use a separately issued high-entropy setup code to establish the first Passkey during a five-minute recent-authentication window.

### Changed

- Production deployments now pin the `ccalc.live` WebAuthn RP ID and origin and require the Stephen-specific bootstrap secret before updating Azure application settings.
- Internal Alpha and Profile guidance now explains the bilingual first-Passkey path while preserving ordinary Alpha login when the setup-code field is blank.

### Security

- Ordinary Alpha sessions and generic onboarding flows cannot authorize Passkey registration; bootstrap ceremonies recheck the no-credential invariant inside the final serializable transaction.
- Revoked, expired, or concurrently changed activation invitations cannot persist a staged Passkey when final activation validation fails.
- Invalid bootstrap attempts use a generic response and anonymous audit actor without recording setup-code or account metadata.

## [0.1.0.0] - 2026-08-31

### Added

- Group leaders can submit an isolated copy of a public page for church review while continuing to edit their working page.
- Page administrators can review, revise, approve, or return the submitted copy without changing the group-owned working page.
- Local developers can start the images API with the standard Alife stack while reusing the existing persisted media store.

### Changed

- Public group pages now remain available from the last approved snapshot while a newer copy is pending or returned.
- Public and member page reads now use separate routes and cache entries so each audience receives the correct version.
- Page sections and publication snapshots now keep portable `/images/...` references instead of machine-specific local origins.

### Fixed

- Prevented small edits and review submissions from temporarily removing an already published group from the public website.
- Public page reads now fail closed for invalid publication snapshots instead of exposing unpublished working content.
- Restored persisted images on local small-group home pages by routing frontend and speed-layer image requests through the local images API.
