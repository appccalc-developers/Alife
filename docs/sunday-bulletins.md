# Sunday bulletins

Church Life includes **Sunday Bulletins / 主日周报 / 主日週報** immediately below Sunday Sermons. The member screen `/church/bulletins` lists every Sunday from three calendar months before today through the upcoming Sunday, inclusive. On Sunday, the current day is included without adding the following week. Dates use `Pacific/Auckland` and appear newest first. The list includes dates without an upload, supports status filtering, date sorting and eight rows per page, and expands each date to show View followed by Upload for managers.

简体：主日周报仅教会成员可见，列出最近三个月及来临主日的日期。展开后可查看 PDF；教会管理者可上传，重复上传会替换该日期的文件。

繁體：主日週報僅教會成員可見，列出最近三個月及來臨主日的日期。展開後可查看 PDF；教會管理者可上傳，重複上傳會替換該日期的檔案。

## API and access

- `GET /api/church-life/bulletins` returns `{ canManage, items: [{ date: "yyyy-MM-dd", hasFile }] }`.
- `GET /api/church-life/bulletins/{date}/open` checks access again and redirects to a five-minute signed R2 Worker URL.
- `PUT /api/church-life/bulletins/{date}` accepts multipart field `file`. Only listed Sundays and PDFs up to 20 MiB are accepted; extension and `%PDF-` header are checked. This is format validation, not malware scanning.
- All endpoints require authentication and a registered member. Read requires approved root church membership; upload requires root church leader/co-leader permission. Existing platform administrator overrides in `IGroupAuthorizationService` apply. Membership of a descendant group alone does not grant access.
- List, open redirects, and signed file responses are `private, no-store`. Client query state is viewer-specific, is discarded when unmounted, and refreshes after upload. Language switching does not change the query key.

## Storage and deployment

Existing `FileAssets` rows store `purpose: sundayBulletin` (enum value 10), `visibility: groupVisible`, no public URL, and the fixed object key `private/sunday-bulletins/{churchId}/{yyyy-MM-dd}.pdf`. No schema migration is needed. Upload replaces the R2 object and updates the row only after storage succeeds; old dates are retained in storage when they leave the list. Storage and SQL are not one transaction: a database failure after the R2 write may require retrying the upload to reconcile metadata.

Deploy the images Worker, backend and frontend together. The Worker now handles backend-only `PUT /api/admin/sunday-bulletins/{objectKey}` and signed `GET|HEAD /api/private-files/{objectKey}` for bulletin keys. Public media read, list, upload and deletion routes exclude the reserved bulletin namespace and its `private` parent.

Reuse the existing secret pairs (never put their values in source):

| Backend | Images Worker |
| --- | --- |
| `FileAssets__ImageApiAdminSecret` | `FILE_ADMIN_BACKFILL_SECRET` |
| `FileAssets__PrivateFileSigningSecret` | `FILE_ACCESS_SIGNING_SECRET` |

The active storage provider must have a reachable upload API base URL, private base URL and signed-read support. Private signing lifetimes must be at most five minutes. R2 direct public access (`r2.dev` or a bucket custom domain that bypasses this Worker) must be disabled for the bucket storing these files; a Worker route cannot protect a separate public bucket origin. Verify this setting before production use. Local development uses the existing local storage provider and Worker binding with the same secret pairs.

## Acceptance checks

- Anonymous, unregistered and non-church users cannot read; ordinary church members cannot upload; church managers can upload and replace.
- Missing dates show a disabled View action; successful upload enables View; replacement opens the new PDF.
- Non-PDF and oversized uploads preserve existing content. Unauthorized public aliases and unsigned/expired signed reads fail.
- Verify month-end, leap-year and Sunday date boundaries; English/Chinese layouts at mobile and desktop widths; keyboard expansion and file selection.
- Before release, exercise a real R2 upload, replacement and signed PDF open with member and manager accounts, including a revoked membership.
