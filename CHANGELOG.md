# Changelog

All notable changes to Alife are documented in this file.

The format follows Keep a Changelog and the repository uses four-part versions.

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
