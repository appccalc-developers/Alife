# Historical article cover generation

The generated covers in
`cloudflare/alife-app/public/article-covers/generated/` fill the public archive's
missing `coverImageUrl` values without changing the historical ContentPost API
contract or overwriting the legacy artwork that still exists.

The completed review scope is currently the `testimony` category: all 12 public
testimony posts that lacked a remote cover have a local generated cover. Other
categories are intentionally incomplete and remain outside this review batch.

## Generation source and style

- Mode: Codex built-in ImageGen, one generation per missing public testimony
  article.
- Meaning source: the article's Chinese title and normalized Chinese summary,
  with English used only as a fallback.
- Style anchor: the approved `2022-nursery-beatitudes-course` cover, developed
  from several legacy testimony illustrations as broad visual references.
- Output: original monochrome pen-and-ink editorial cartoons on white paper.
- Privacy: prompts exclude contact details and ask for non-identifiable people.
- Human control: generated files are local review candidates; this workflow does
  not deploy them or mutate production ContentPost records.

The shared prompt set is:

```text
Use case: illustration-story
Asset type: wide article card cover for the Alife church history archive
Input image: approved new-series style anchor, used only for the monochrome
pen-and-ink visual language.
Primary request: create an original cover derived from the meaning of the
historical article's localized title and summary.
Editorial direction: use the category to emphasize a concrete community action,
teaching contrast, human journey, learning metaphor, or general event.
Scene direction: select the most meaningful supported action, relationship,
object, setting, or visual metaphor; avoid a generic Bible-study scene unless
the source is specifically about one.
Composition: one clear idea, landscape 3:2 with safe margins for a 16:10 crop,
readable at card-thumbnail size.
Constraints: no text, letters, numbers, logos, watermark, signature, seal, or
photorealism; do not copy reference compositions; do not depict God or the Holy
Spirit as a human figure; do not invent identities, safety facts, contact
details, or authoritative claims.
```

Each generated PNG is center-cropped and resized with ffmpeg to a 960 x 600 WebP
at quality 72. The original ImageGen output remains in Codex's generated-images
directory; only the optimized WebP belongs to this repository.

## Frontend behavior

For a post whose `coverImageUrl` is empty and whose slug is present in the
generated-cover manifest, the archive requests:

```text
/article-covers/generated/<normalized-slug>.webp
```

If that local file cannot load, the card returns to the existing document-icon
placeholder. Existing historical `coverImageUrl` values always take precedence.
Posts that are not in the manifest use the placeholder without making a missing
image request. The manifest is covered by a test that compares it with the
current WebP filenames.
The generated directory is excluded from the PWA install-time precache and is
handled by the existing lazy image runtime cache.

## Verification

Run from the repository root after generation:

```powershell
.\tools\content-post-covers\verify-generated-covers.ps1 -Category testimony
```

The script compares the local filenames with the current public testimony
missing-cover set and verifies that every generated testimony file is a 960 x
600 WebP. It is read-only. Omit `-Category testimony` only after every public
category is intentionally complete.
