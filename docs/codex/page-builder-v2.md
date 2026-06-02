We are refactoring Alife Page/Section Builder.

Goal:
Simplify the Section Builder into a small, consistent, reusable CMS-style system suitable for church admins and group leaders.

Core principles:
- Keep it simple.
- Do not create many content-specific section types.
- Classify sections by display pattern, not by business content type.
- Use controlled presets instead of free-form CSS values.
- Support bilingual text using the existing { en, zh } LocalizedText format.
- Preserve existing behavior where possible.

Tasks:

1. Add unified SectionHeader model

Create or update the shared section schema/type to support:

interface SectionHeader {
  icon?: SectionIconKey;
  title?: LocalizedText;
  subtitle?: LocalizedText;
  align?: "left" | "center";
  scale?: "compact" | "normal" | "feature";
  tone?: "default" | "primary" | "warm" | "fresh" | "rose";
}

Every section type should optionally support:

header?: SectionHeader;

Hero should also use this same header model, but render it centered over the background image.

2. Add controlled icon library

Use lucide-react for icons.

Install if needed:

npm install lucide-react

Create a controlled icon map, for example:

church
cross
calendar
bible
people
heart
music
map
image
video
mic
book
handshake

Only store icon keys in section JSON. Do not store SVG, arbitrary component names, or CSS classes.

Lucide React supports importing individual icon components, which keeps the icon system clean and tree-shakable. Lucide icons use currentColor, so Tailwind text color classes can control icon color naturally.

3. Create SectionHeader component

Create a reusable component:

<SectionHeader header={section.header} variant="normal" />

Support variants:

normal
hero

Normal section header:
- icon above title
- centered by default
- title and subtitle below
- max width around max-w-2xl or max-w-3xl
- margin-bottom controlled internally

Hero section header:
- rendered inside hero overlay
- larger icon/title/subtitle sizes
- centered vertically and horizontally over background image
- supports CTA/actions separately if existing Hero has them

Use Tailwind preset mappings only.

Example scale mapping:

normal compact:
icon: w-8 h-8
title: text-2xl md:text-3xl
subtitle: text-sm md:text-base

normal:
icon: w-10 h-10
title: text-3xl md:text-4xl
subtitle: text-base md:text-lg

feature:
icon: w-12 h-12
title: text-4xl md:text-5xl
subtitle: text-lg md:text-xl

Hero sizes should be larger.

Use Tailwind utilities for font size, line height and color rather than inline CSS.

4. Add controlled tone presets

Do not allow arbitrary color values.

Create tone class mappings:

default
primary
warm
fresh
rose

For normal sections, tone should affect icon/title/subtitle text classes.

For Hero, use separate hero-safe tone handling if necessary, because Hero text contrast depends on background image and overlay.

Suggested rule:
- normal sections: tone controls icon accent color and text palette
- hero sections: default to white text over dark overlay unless explicitly configured later

5. Add section spacing presets

Do not expose raw margin/padding numbers.

Add:

spacing?: "compact" | "normal" | "large";

Use mapping:

compact: py-8
normal: py-12 md:py-16
large: py-16 md:py-24

Section internal padding should use this preset.

Page-level section gap should stay consistent and should not be manually controlled per section unless the current architecture already requires it.

6. Consolidate Section Types

Move toward these core section types:

Hero
RichText
Spotlight
ListView

PostFeed is not part of the core MVP yet. Keep it only if existing pages already depend on it, but do not promote it in the editor.

Target meaning:

Hero:
- page opening section
- background image
- unified header
- CTA/actions if already supported

RichText:
- long-form content
- mission statement
- history
- about us
- statement of faith
- should support Markdown or existing rich text content
- should use constrained readable width, e.g. max-w-3xl mx-auto prose

Spotlight:
- replaces Media Spotlight and Sermon Spotlight conceptually
- supports image or YouTube/video as media
- layout: media left/text right or text left/media right
- useful for featured event, featured sermon, ministry highlight, pastor message, etc.

ListView:
- generic list renderer
- supports different sources:
  events
  sermons
  groups
  media/gallery
  posts if already existing

7. Refactor Media Spotlight and Sermon Spotlight

Do not create separate long-term section components for MediaSpotlight and SermonSpotlight.

Create generic Spotlight config:

interface SpotlightSection {
  type: "spotlight";
  header?: SectionHeader;
  spacing?: SectionSpacing;
  media?: {
    type: "image" | "youtube";
    url: string;
    alt?: LocalizedText;
    position?: "left" | "right";
  };
  body?: LocalizedText;
  actions?: SectionAction[];
}

Migrate existing Media Spotlight to Spotlight with media.type = "image".

Migrate existing Sermon Spotlight to Spotlight with media.type = "youtube" or suitable existing sermon/youtube model.

Preserve backward compatibility if existing saved JSON uses old type names.

8. Refactor ListView

Make ListView the generic mechanism for:

- Gallery
- Sermon list
- Event list
- Group list
- Ministry introduction using group cards

Suggested config:

interface ListViewSection {
  type: "listView";
  header?: SectionHeader;
  spacing?: SectionSpacing;
  source: "events" | "sermons" | "groups" | "media" | "posts";
  preset?: string;
  layout?: "grid" | "list" | "cards" | "carousel";
  limit?: number;
}

Add simple presets instead of a complex filter builder.

For events:
- upcoming
- recent
- all

For sermons:
- latest
- all

For groups:
- featured
- all

For media:
- latest
- all

Do not build a SQL-style filter UI yet.

9. Editor UI changes

Update the Section Editor to expose simple fields:

Header:
- icon picker
- title en/ch
- subtitle en/ch
- align: left / center
- scale: compact / normal / feature
- tone: default / primary / warm / fresh / rose

Spacing:
- compact / normal / large

For Spotlight:
- media type: image / YouTube
- media URL
- media position: left / right
- body en/ch
- actions if existing system supports them

For ListView:
- source
- preset
- layout
- limit

Hide raw CSS-like controls from group leaders.

10. Backward compatibility

Before changing saved JSON shape, inspect existing section data.

Add a normalizer/migration layer if needed:

- old MediaSpotlight -> spotlight
- old SermonSpotlight -> spotlight
- old Gallery/Sermon/Event/Group list types -> listView with source
- missing header -> undefined
- missing spacing -> "normal"
- missing tone -> "default"
- missing scale -> "normal"

Do not break existing pages.

11. Rendering rules

All sections should render in this order:

<section className={spacingClass}>
  optional SectionHeader
  section body/content
</section>

Hero is special:

<section className="relative ... background image ...">
  overlay
  centered SectionHeader variant="hero"
  optional CTA/actions
</section>

RichText should keep text readable:
- max-w-3xl
- mx-auto
- prose if available
- bilingual content selected by current language

Spotlight should be responsive:
- mobile: stack vertically
- desktop: two columns
- respect media.position on desktop

ListView should be responsive:
- cards/grid should stack on mobile
- limit should be applied
- preset should map to source-specific query/filter behavior

12. Training-oriented naming

In UI labels, avoid technical names where possible.

Use:

Hero
Rich Text
Spotlight
List View

Avoid exposing:

Sermon Spotlight
Media Spotlight
Event List Section
Group List Section

Instead, List View source determines the content.

13. Acceptance criteria

After implementation:

- A group leader can create a page using only Hero, Rich Text, Spotlight and List View.
- Every section can optionally show icon/title/subtitle through the same SectionHeader component.
- Hero uses the same header model but renders it centered over the background image.
- Users can adjust visual style only through controlled presets: scale, tone, spacing.
- Users cannot enter arbitrary font size, color, margin, padding, SVG or CSS class.
- Existing saved pages still render.
- Media Spotlight and Sermon Spotlight are either migrated or normalized into Spotlight.
- Gallery/Event/Sermon/Group lists are represented by ListView source/preset/layout.
- PostFeed is not emphasized in the editor unless still required for existing compatibility.

Please implement this in small commits:
1. Types and normalizer
2. Icon map and SectionHeader component
3. Hero integration
4. RichText integration
5. Spotlight consolidation
6. ListView consolidation
7. Editor UI updates
8. Backward compatibility verification
9. Final cleanup and tests
