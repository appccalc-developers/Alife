# Changelog

All notable changes to Alife are documented in this file.

The format follows Keep a Changelog and the repository uses four-part versions.

## [0.1.0.0] - 2026-08-30

### Added

- Group leaders can submit an isolated copy of a public page for church review while continuing to edit their working page.
- Page administrators can review, revise, approve, or return the submitted copy without changing the group-owned working page.

### Changed

- Public group pages now remain available from the last approved snapshot while a newer copy is pending or returned.
- Public and member page reads now use separate routes and cache entries so each audience receives the correct version.

### Fixed

- Prevented small edits and review submissions from temporarily removing an already published group from the public website.
- Public page reads now fail closed for invalid publication snapshots instead of exposing unpublished working content.
