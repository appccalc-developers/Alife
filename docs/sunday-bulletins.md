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
- Missing signing/upload configuration, storage HTTP failures and upstream timeouts return `503` with a safe storage-unavailable message. The UI distinguishes this from a rejected PDF. These failures do not update FileAssets metadata; logs contain only the exception type and upstream status, never credentials, URLs or file names. Caller cancellation still propagates instead of becoming a storage error.

## Storage and deployment

Existing `FileAssets` rows store `purpose: sundayBulletin` (enum value 10), `visibility: groupVisible`, no public URL, and the fixed object key `private/sunday-bulletins/{churchId}/{yyyy-MM-dd}.pdf`. No schema migration is needed. Upload replaces the R2 object and updates the row only after storage succeeds; old dates are retained in storage when they leave the list. Storage and SQL are not one transaction: a database failure after the R2 write may require retrying the upload to reconcile metadata.

Deploy the images Worker, backend and frontend together. The Worker now handles backend-only `PUT /api/admin/sunday-bulletins/{objectKey}` and signed `GET|HEAD /api/private-files/{objectKey}` for bulletin keys. Public media read, list, upload and deletion routes exclude the reserved bulletin namespace and its `private` parent.

Reuse the existing secret pairs (never put their values in source):

| Backend | Images Worker |
| --- | --- |
| `FileAssets__ImageApiAdminSecret` | `FILE_ADMIN_BACKFILL_SECRET` |
| `FileAssets__PrivateFileSigningSecret` | `FILE_ACCESS_SIGNING_SECRET` |

The active storage provider must have a reachable upload API base URL, private base URL and signed-read support. Private signing lifetimes must be at most five minutes. R2 direct public access (`r2.dev` or a bucket custom domain that bypasses this Worker) must be disabled for the bucket storing these files; a Worker route cannot protect a separate public bucket origin. Verify this setting before production use. Local development uses the existing local storage provider and Worker binding with the same secret pairs.

### Production configuration and the September 2026 upload incident

The initial production deployment omitted both file secret pairs and left the seeded default provider as `local-dev` with `http://localhost:8787` URLs. The first signing check therefore threw an unhandled configuration exception before a PDF could be uploaded. The reported Chinese filename and 160,089-byte PDF were within the upload limits.

Configure repository secrets `FILE_ADMIN_BACKFILL_SECRET` and `FILE_ACCESS_SIGNING_SECRET` with separate, random values of at least 32 characters. Both deployment workflows now validate these values. The backend workflow writes the matching Azure settings, selects `cloudflare-r2` / bucket `ccalc`, sets upload and private URLs to `https://images.ccalc.live`, caps signed reads at five minutes, and passes the same nonsecret provider settings to DbMigrator so later seeds do not restore the local default. The images workflow provisions the matching Worker secrets and runs all Worker test files.

For an already deployed installation, environment settings alone do not replace the default provider row. After explicit production approval, apply `scripts/configure-production-file-storage.sql` to select the existing R2 service without a schema migration or changes to historical FileAssets. Provision the matching secret pairs separately without printing or committing their values. Then retry the user's upload through the authorized member UI and verify the signed PDF open, replacement, and denial through the public URL.

For dashboard configuration, select the runtime **Settings > Variables and Secrets** of `alife-cloudflare-api` (the Worker serving `images.ccalc.live`), not build variables or another Worker. Store both values as **Secret**. A saved Worker version is not necessarily deployed: use **Deployments** to promote the intended version to **100%** traffic and verify the active deployment. Inspect active version binding names/types as well as the Secret list: plain-text bindings do not appear in that list. During the incident, both matching values existed as plain-text bindings in a saved version while all production traffic still used the earlier version without either binding. See [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/) and [versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).

When diagnosing pairing, use only non-writing probes: an invalid PDF body at a syntactically valid upload key returns `400` after upload authentication passes, and a correctly signed `HEAD` for a nonexistent bulletin object returns `404` after signature verification. A `403` means the respective check failed. Never print credentials, signed URLs, request headers, or private file contents. Repository secret presence alone does not establish a successful runtime deployment. Re-run both corrected deployment workflows after changing paired credentials; until both finish, requests can fail because of temporary mismatches. Do not re-run an older backend workflow that still seeds local-dev.

简体：初次生产部署漏配存储密钥，且默认存储地址仍指向本机。修复部署配置后，应核对生产存储提供者，并将两个匹配密钥以 Secret 类型保存在正确 Worker 的运行时设置中；保存版本后还须部署到 100% 生产流量。存储暂不可用时返回明确提示，用户取消上传仍正常取消。

繁體：初次正式環境部署漏設儲存密鑰，且預設儲存網址仍指向本機。修正部署設定後，應核對正式環境的儲存提供者，並將兩個相符密鑰以 Secret 類型儲存在正確 Worker 的執行階段設定中；儲存版本後還須部署至 100% 正式流量。儲存暫時無法使用時回傳明確提示，使用者取消上傳仍正常取消。

## Acceptance checks

- Anonymous, unregistered and non-church users cannot read; ordinary church members cannot upload; church managers can upload and replace.
- Missing dates show a disabled View action; successful upload enables View; replacement opens the new PDF.
- Non-PDF and oversized uploads preserve existing content. Unauthorized public aliases and unsigned/expired signed reads fail.
- Verify month-end, leap-year and Sunday date boundaries; English/Chinese layouts at mobile and desktop widths; keyboard expansion and file selection.
- Before release, exercise a real R2 upload, replacement and signed PDF open with member and manager accounts, including a revoked membership.
