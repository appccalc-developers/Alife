# Sermon metadata and existing records

Sunday Sermons uses the video title to derive a concise topic, named speaker, and sermon calendar date. The persistent `Sermon.Title`, `SpeakerName`, and `PreachedAtUtc` fields contain the normalized values, so database pagination, detail pages, public website cards, forum sermon embeds, and bulletins use the same metadata.

- A valid leading date takes precedence. Supported separators include spaces, hyphens, slashes, dots, underscores and Chinese year/month/day markers. Invalid calendar dates do not become sermon dates.
- If there is no valid leading date, use the Sunday strictly before the publication calendar date in `Pacific/Auckland`. A Sunday publication uses the previous week's Sunday. If publication is also unknown, the sermon date stays absent.
- Take the speaker after `讲员`, `講員`, `讲者`, `講者`, or `Speaker`, with optional colon. Do not use the YouTube channel as the speaker. An absent speaker stays empty and the member UI says “讲员未注明 / Speaker not specified”.
- Remove the leading date, service label such as 主日证道/主日慶典/Sunday Sermon, a leading livestream label, and the speaker suffix. Preserve the remaining topic, including bilingual topic text. If no topic remains, use a generic Sunday Sermon label in the source language.
- Store the calendar date at midnight UTC and format it as a date without local timezone shifts. The bulletin date is this same date, including a non-Sunday date explicitly supplied in a title.

简体：所有视频实体按标题提取简洁主题、讲员和讲道日期。标题无有效日期时，采用新西兰发布日期之前最近的星期日；周日发布则采用前一周日。没有讲员时不使用频道名称。原始标题和原日期保留备查；处理版本避免重复整理时再次改变日期。周报与整理后的日期对应，没有三个月限制。

繁體：所有影片實體按標題提取簡潔主題、講員和講道日期。標題無有效日期時，採用紐西蘭發布日期之前最近的星期日；週日發布則採用前一週日。沒有講員時不使用頻道名稱。原始標題和原日期保留備查；處理版本避免重複整理時再次改變日期。週報與整理後的日期對應，沒有三個月限制。

## Source and synchronization

YouTube synchronization parses the original title on every fetch. It requests `contentDetails.videoPublishedAt` for the video's publication date; `snippet.publishedAt` represents playlist insertion time and is retained only as a fallback for legacy/provider responses lacking video publication metadata. See the [YouTube playlist item reference](https://developers.google.com/youtube/v3/docs/playlistItems).

`SourceTitle`, `PublishedAtUtc`, and `MetadataVersion` preserve inputs and prevent repeated backfills. The one-time backfill captures the old title and stored date before normalization, including archived rows, without changing IDs, video links, archive state, or forum relationships. Older rows do not have a separate original publication field; when the title has no date, their previously stored date is the available publication fallback. A later YouTube sync replaces that source timestamp with video publication metadata.

`SermonDto` adds `metadataVersion` while preserving existing fields. The frontend only parses version-zero/legacy cached records; normalized records are never interpreted as raw YouTube titles again. Language is not a data cache key. Changes call the existing sermon cache invalidation service for backend, KV and speed-layer caches; private bulletin caches remain separate.

## Migration and backfill

1. Apply `20260909100229_NormalizeSermonMetadata`, which adds only the three source/version columns to `sermons`. Shared/production migration still requires explicit approval.
2. Run the existing DbMigrator; it normalizes old sermons after migrations. To normalize only, without applying migrations or running seeders, run `dotnet run --project backend/src/Alife.DbMigrator -- --Sermons:NormalizeOnly=true` against the already migrated database.
3. The existing scheduled/admin YouTube sync also backfills every unprocessed row before fetching the playlist, including when YouTube credentials are absent. Its existing playlist size/visibility policy is unchanged.
4. Verify all rows have the current metadata version, the visible/archived counts and IDs are unchanged, topic/speaker/date examples match, and a second backfill reports zero changes.

The schema migration's Down removes the new columns; it does not restore old presentation fields. Preserve the source columns or a database backup before rollback. Deploy backend and frontend together after migration/backfill; this work does not automatically publish a deployment or migrate a shared database.
