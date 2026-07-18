# NZALC historical ContentPost import

This tool converts the local `nzalc.org` static repository into the request
shape accepted by:

```text
POST /api/groups/{churchGroupId}/posts/import
```

The generated manifest defaults to `dryRun: true`, `publish: false`, and
`updateChanged: false`. Keep those defaults for the first request.

## Build a manifest

From the ALIFE repository root:

```powershell
python .\tools\content-post-import\build_nzalc_manifest.py `
  --source-root C:\Projects\nzalc.org `
  --output .\artifacts\nzalc-content-post-import.json
```

The extractor reads only the known historical article folders:

- church news → `news`
- sermon text/outlines → `sermonOutline`
- testimonies → `testimony`
- learning page entries → `learning`
- five legacy homepage activity articles → `general`

It extracts the Joomla `.item-page` body, keeps relative article links under
`https://nzalc.org/...`, rewrites legacy image/media references to
`https://pages.nzalc.org/...`, uses the first inline image as the cover, and
generates a plain-text summary.

## Review warnings

The manifest contains an `extractionReport` plus per-item `sourceWarnings`.
Warnings include:

- missing historical publication date
- missing local image
- possible phone number or email address
- possible sensitive personal or health information

The API accepts unknown top-level report fields, so the generated JSON can be
posted directly. Direct publication rejects items that still have warnings.
Import warned items as drafts, review them, and clear warnings only after a
human has confirmed the content.

## Import workflow

1. POST the untouched manifest and review the dry-run item dispositions.
2. Resolve `invalid`, `duplicate`, `conflict`, and `changedSkipped` items.
3. Set `dryRun` to `false` to create drafts.
4. Set `updateChanged` to `true` only for source changes that should overwrite
   an earlier import.
5. Set `publish` to `true` only after dates and warnings have been reviewed.

The server derives source identity and checksums. Do not add them to the
manifest manually.
