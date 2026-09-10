# Governance policy editor verification

## Administrator flow

- **简体中文：** 在系统管理的活动方案治理政策页面选择版本。无有效政策时点击“初始化试运行政策”，核对规则与过渡期限，再预览影响并明确确认发布。恢复历史版本会创建新版本；旧审批不会自动恢复。试运行仍需有效政策，原有安全检查继续生效。
- **繁體中文：** 在系統管理的活動方案治理政策頁面選擇版本。沒有有效政策時點選「初始化試運行政策」，核對規則與過渡期限，再預覽影響並明確確認發佈。恢復歷史版本會建立新版本；舊審批不會自動恢復。試運行仍需有效政策，原有安全檢查繼續生效。
- **English:** Select a version in System Management → Event Package governance policies. If no policy is effective, initialize a dry-run draft, review its rules and transition deadline, preview its impact, and explicitly confirm publication. Restoring history creates a new version and never reactivates old approvals. Dry run still needs an effective policy; existing safety checks remain active.

## Checks on 2026-09-10

From `cloudflare/alife-app`:

```powershell
npm run test:event-composition
npm run typecheck
npm run build
# Use an already available Playwright installation; no package installation required.
$env:ALIFE_PLAYWRIGHT_MODULE = '<absolute path to available playwright package>'
node --experimental-strip-types tests/eventPackagePolicy.browser.cjs
```

From the repository root:

```powershell
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Release --filter "FullyQualifiedName~EventPackagePolicyAdminTests|FullyQualifiedName~EventPackageFoundationTests" --no-restore
node docs/events/scripts/generate-event-docs.mjs
```

The browser scenario intercepts every API call and uses a synthetic administrator. Its publication/retry assertions cannot modify actual policies. Screenshots are written to the OS temporary directory. It checks both languages at 320/768/1280px after reloading for the existing device classification, plus loading, failures, confirmation focus, historical restoration and unsaved changes. Existing application-wide behavior when resizing between device classes without reloading is outside this page change.

Backend tests use EF InMemory. They verify stale initialization/current-version and impact rejection, permissions, semantic validation, idempotency, history retention, invalidation and group override isolation. They do not exercise actual SQL range locks across independent connections. Serializable transaction protection is implemented using the repository's existing database abstraction; a live multi-connection database test remains unverified.

Local verification did not modify shared databases, publish policies, apply migrations, call providers or deploy. Code publication is tracked in [Issue #730](https://github.com/appccalc-developers/Alife/issues/730). Reload/restart the local API to load the new endpoints before testing the real administrator flow. Policy publication is still a human action; opening the page does not fix missing-policy data automatically.

The final publication checks passed all 50 frontend tests and 73 backend tests (the policy suites above plus `EventCompositionArchitectureTests`), the production build including TypeScript compilation, and the mocked browser scenario.


## Approval tab regression

The browser scenario additionally checks enhanced/standard/light order in both languages, a single shared active panel, independent trigger selections across tabs, fallback without trigger options, retained fallback approver/validity fields, arrow/Home/End keyboard activation, visibility of the selected mobile tab, and read-only historical tab navigation. No policy publication or server-tier evaluation semantics change is involved.
