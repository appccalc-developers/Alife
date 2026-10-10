import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const registryPath = resolve(root, 'docs/governance/document-register.json');
const reportPath = resolve(root, 'docs/governance/DOCUMENT-USAGE.zh-CN.md');
const archive = 'archive/pending-docs-review/2026-10-10';
const controls = new Set([
  'docs/governance/scripts/audit-document-usage.mjs',
  'docs/governance/document-register.json',
  'docs/governance/DOCUMENT-USAGE.zh-CN.md',
]);
const slash = value => value.replaceAll('\\', '/');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const list = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(dir, entry.name);
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Do not inventory through a link: ${path}`);
  return entry.isDirectory() ? list(path) : [slash(relative(root, path))];
});
const decision = (action, role, alife, churchApp, reason, inspection) => ({ action, role, alife, churchApp, reason, inspection });

function classify(path) {
  const keep = (role, reason, inspection = '文本与当前文档依赖核对', alife = true, churchApp = true) => decision('retain', role, alife, churchApp, reason, inspection);
  const history = (reason, inspection = '文本用途、版本边界和替代来源核对') => decision('pending-history', 'historical', false, false, reason, inspection);
  if (controls.has(path)) return keep('governance', '本次逐文件审计、待确认记录和可重复检查。', '本次新增审计控制文件');
  if (path.startsWith('docs/Communication/')) {
    if (/\.docx$/.test(path)) return history('早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。', 'Word OOXML 正文用途提取；不修改原件');
    if (/\.pdf$/.test(path)) return history('内部试用沟通文案的 PDF；保留原件供确认，不作为功能或上线验收依据。', 'PDF 文本提取；字体编码限制，结合配套试用文案核对用途');
    if (/\.(jpg|png)$/.test(path)) return history('早期沟通资料配套截图；没有现行设计文档采用它们。', '配套材料及当前设计引用核对；未作图片内容/视觉认证');
    return history('早期设计提案、源码讲解或面试展示；现行架构与契约已承担相关指导职责。');
  }
  if (path.startsWith('docs/VibeCoding/')) {
    if (/Setup\/Script [1234]|Setup\/Script 11|MIGRATION_NEXTJS|Step 5/.test(path)) return history('Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。');
    if (/PostgresQL/.test(path)) return history('SQL Server→PostgreSQL 的旧迁移提示；不是已选择的 Azure SQL 或 Workers/D1 新系统路线。');
    if (/\.ps1$|Deployment\/|azure-static/.test(path)) return history('旧 Azure/OIDC/Static Web Apps 设置稿，含旧项目/资源上下文；新实例使用保留的 Azure 配置清单并重新核实。', '用途、命令结构及资源绑定核对；未执行');
    if (/Result\.json|\.sql$/.test(path)) return history('本地诊断响应或临时查询材料；保留原件且保持 Git 忽略，不能作为业务契约或种子数据。', '文件类型与使用上下文核对；未公开内容或执行');
    return history('旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。');
  }
  if (/^docs\/alife-(internal-trial-call|portfolio-case-study|tech-slices)/.test(path)) return history('试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。', /\.docx$/.test(path) ? 'Word OOXML 用途提取；配套技术讲解文本比对' : '正文用途、重复版本及当前入口核对');
  if (path.startsWith('docs/assets/portfolio/')) return history('作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。', '作品集图片引用和当前设计引用核对');
  if (/^docs\/(project-development-timeline|project-retrospective)/.test(path)) return history('有日期的项目时间线、回溯和历史证据；移入待确认区，仍可由明确的历史调查引用，但不作为当前任务或架构指令。');
  if (/^docs\/plan-alife/.test(path)) return history('不同听众的旧规划提示稿，包含旧 frontend 路径/旧阶段口径；当前目标与推进顺序由治理台账承担。');
  if (path === 'docs/design-documentation-plan.zh-CN.md') return history('设计文档建设的原实施方案；已交付结构由 design/README、QA、COVERAGE 管理，遗留来源/覆盖缺口仍在 COVERAGE 中保留。');
  if (path === 'docs/codex/page-builder-v2.md') return history('Page 旧生成提案；现行 PAGE-CONTRACT 与页面入口已明确它不是待执行任务。');
  if (path.startsWith('docs/issues/')) return history('已落地 AI 会话/报名改造的旧 Issue 草稿和已禁用的一次性工作流；follow-up 候选进入 DOCS-RECONCILE 核对，不能自动重建旧任务。');
  if (/^docs\/events\/(IMPLEMENTATION-HISTORY|EVENT-AUTHORIZATION-REVIEW-2026-09-22|EVENT-PACKAGE-APPROVAL-EXECUTION-GOAL.zh-CN|POLICY-EDITOR-VERIFICATION)\.md$/.test(path)) return history('旧实施记录、权限审计、执行方案或某次验证报告；当前业务规则/缺口由 Event 核心、主题、机器契约和状态维护。历史证据仍可按明确链接查阅。');
  if (path.startsWith('docs/design/generated/') || path === 'docs/events/EventManagement-About.html' || path.startsWith('docs/events/generated/')) return keep('generated-explanation', '仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。', '生成器输入/输出与当前入口引用核对');
  if (path.startsWith('docs/design/scripts/') || path.startsWith('docs/events/scripts/')) return keep('tool', '现行文档生成、链接/新鲜度校验或原型检查工具。', '脚本调用和生成依赖核对');
  if (path.startsWith('docs/events/templates/')) return keep('generation-input', '现行 Event HTML 生成器模板输入；删除会破坏生成与校验。', '生成器输入核对');
  if (path.startsWith('docs/events/design/references/')) return keep('adopted-reference', '现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。', '现行视觉规范与试点 manifest/图片引用核对');
  if (path.startsWith('docs/assets/event-duties/')) return keep('adopted-reference', 'Event duties 的当前说明截图依赖；保留文档说明/交接用途。', 'EVENT-DUTIES 图片引用核对');
  if (path.startsWith('docs/design/prototypes/')) return keep('prototype', '当前设计入口与验证脚本使用的限定模拟原型；仅用于解释和体验检查。', '当前设计入口、覆盖说明与脚本依赖核对');
  if (/^docs\/alife-ministry-guide\./.test(path)) return keep('user-guide', '现有使用/内容编制与新 Church App 用户手册的基础；身份说明与当前 Passkey 主路径对齐，细节仍服从领域契约。');
  if (path === 'docs/plan-newAzureSubscriptionSetup.prompt.md') return keep('operational-reference', '新 Church App 的 Azure 路线所需独立资源、OIDC、配置及验收清单；更新旧路径，不据此自动创建资源/迁移/部署。');
  if (path === 'docs/file-asset-design.md') return keep('needs-reconciliation', '包含文件归属/可见性/兼容设计，仍与新系统有关；现状段落早于 FileAsset 实现，已标记为设计参考，须对照当前源码归整，不能当作现状事实。');
  if (path === 'docs/virtual-church-visual-upgrade-plan.zh-CN.md') return keep('current-scope-with-history', '当前首版范围、Definition of Done 和未完成发布事项仍有效；保留整个混合文件，旧 V3 历史已明确非当前任务，不能重新扩大范围。');
  if (path === 'docs/member-private-file-backfill.md') return keep('operational-reference', '现有 Alife 私有文件兼容与修复操作说明仍需保留；空白新实例不默认执行旧对象回填。', '当前 FileAsset/私有访问结构和操作说明核对', true, false);
  if (path.startsWith('docs/governance/')) return keep('governance', '项目目标、工作台账、验收和后续推进的当前治理来源。');
  if (path.startsWith('docs/agent-guides/')) return keep('agent-policy', 'Alife 发布操作规则；新项目可按授权适配，不复制仓库身份或授予权限。');
  return keep('current-contract-or-orientation', '现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。');
}

function initialize() {
  if (existsSync(registryPath)) throw new Error('Inventory exists; review/update it instead of replacing original-path evidence.');
  const docs = [...new Set([...list(resolve(root, 'docs')), ...controls])].sort();
  const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/));
  const ignored = new Set(execFileSync('git', ['-c', 'core.quotepath=false', 'check-ignore', '--stdin'], { cwd: root, input: docs.join('\n') + '\n', encoding: 'utf8' }).trim().split(/\r?\n/));
  const inbound = new Map(docs.map(path => [path, new Set()]));
  const texts = [...tracked, ...docs].filter(path => /\.(md|html|mjs|cjs|json|ya?ml|ps1|tsx?|cs)$/.test(path) && existsSync(resolve(root, path)));
  for (const path of new Set(texts)) {
    const text = readFileSync(resolve(root, path), 'utf8');
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)|(?:href|src)=["']([^"']+)["']/g)) {
      const target = (match[1] || match[2]).split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const key = slash(relative(root, resolve(root, dirname(path), decodeURIComponent(target))));
      if (inbound.has(key) && key !== path) inbound.get(key).add(path);
    }
    for (const key of docs) if (key !== path && text.includes(key)) inbound.get(key).add(path);
  }
  const files = docs.map(path => {
    const result = classify(path);
    return {
      originalPath: path,
      currentPath: result.action === 'pending-history' ? `${archive}/${path}` : path,
      ...result,
      versionControl: controls.has(path) ? 'audit-created' : tracked.has(path) ? 'tracked' : ignored.has(path) ? 'ignored-local' : 'existing-untracked',
      incomingReferences: [...inbound.get(path)].sort(),
      originalSha256: result.action === 'pending-history' ? hash(resolve(root, path)) : null,
    };
  });
  writeFileSync(registryPath, JSON.stringify({
    schemaVersion: 1, reviewedOn: '2026-10-10', archiveRoot: archive,
    scope: 'All actual files under repository docs, including ignored Communication/VibeCoding; dependencies, Git internals and external data directories excluded.',
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    limitations: ['Classification is document purpose/dependency review, not product runtime certification.', 'PDF text extraction has font-encoding limitations; images classified from adopted-reference/paired-document dependencies, not new visual acceptance.', 'Archived bytes and original ignored status are preserved; their relative links retain original path context. Use originalPath/currentPath mapping when investigating history.'],
    files,
  }, null, 2) + '\n');
}

function render() {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const original = registry.files.filter(row => !['audit-created', 'post-review-created'].includes(row.versionControl));
  const retained = original.filter(row => row.action === 'retain');
  const archived = original.filter(row => row.action === 'pending-history');
  const added = registry.files.filter(row => row.versionControl === 'post-review-created');
  const audit = registry.files.filter(row => row.versionControl === 'audit-created');
  const sourceOnly = retained.filter(row => row.sourceReference);
  const lines = [
    '# Docs 文件用途与待确认历史清单', '',
    `审查日期：${registry.reviewedOn}。原有 ${original.length} 个文件，保留 ${retained.length} 个（其中 ${sourceOnly.length} 个仅在指定源版本中），移入待确认区 ${archived.length} 个；另有 ${audit.length} 个新增审计文件和 ${added.length} 个审查后新增文件。`, '',
    '“Alife”列表示继续推进现有项目时仍有作用；“新 Church App”列表示生成、验证或交接新系统时仍有作用。保留可以是规则、运维、用户手册、生成工具或仍采用的参考；不等于每次任务都要读取。历史证据可按需要调查，但不会授予当前需求或开发权威。', '',
    '状态与全部原路径/现路径/引用/原因在 [机器清单](document-register.json) 中；待确认资料位于 [准备历史归档区](../../archive/pending-docs-review/2026-10-10/README.md)。尚未删除任何文件，也未永久确认归档。移动后的历史原件字节保持不变，原有相对链接须结合机器清单中的原路径定位。', '',
    '## 判断依据与注意事项', '',
    '- 以 AGENTS、架构、领域契约和当前依赖为准；没有引用不等于没有用途。',
    '- 现行 Event 视觉规范仍采用的试点图片、说明 HTML、原型、模板及生成/验证工具保留。',
    '- 虚拟教会计划只存在于指定源版本和独立 PR #827，当前 main 没有该文档或对应功能；以固定提交链接保留来源，不复制为 main 的现行契约，不自动恢复旧 V3 任务。',
    '- FileAsset 设计仍保留供归整，其早期现状描述不能覆盖已存在的 FileAsset/私有文件实现。',
    '- Azure 新实例清单保留；Vue/Pinia、Next.js、旧 Static Web Apps 和 PostgreSQL 迁移提示移入待确认区。',
    '- Communication/VibeCoding 原为 Git 忽略的本地材料，移动后仍忽略；清单不公开其正文、凭据或诊断数据。',
    '- 待确认历史原件使用仓库 .gitattributes 的 -text 规则，避免 Git 暂存或签出时转换换行并破坏原始哈希。',
    '- 旧 Issue follow-up、原始业务愿景与当前契约是否有遗漏，由 DOCS-RECONCILE 核对；不将候选自动视为已授权任务。', '',
    '## 原目录汇总', '',
    '| 原目录 | 原有文件 | 保留 | 待确认历史 |', '| --- | ---: | ---: | ---: |',
  ];
  const directories = [...new Set(original.map(row => dirname(row.originalPath)))].sort();
  for (const dir of directories) {
    const rows = original.filter(row => dirname(row.originalPath) === dir);
    lines.push(`| ${dir} | ${rows.length} | ${rows.filter(row => row.action === 'retain').length} | ${rows.filter(row => row.action === 'pending-history').length} |`);
  }
  for (const dir of [...new Set(registry.files.map(row => dirname(row.originalPath)))].sort()) {
    lines.push('', `## ${dir}`, '', '| 文件 | Alife | 新 Church App | 处理 | 依据 |', '| --- | --- | --- | --- | --- |');
    for (const row of registry.files.filter(row => dirname(row.originalPath) === dir)) {
      const label = row.originalPath.slice(dir.length + 1).replaceAll('|', '\\|');
      const link = row.sourceReference?.url ?? slash(relative(dirname(reportPath), resolve(root, row.currentPath))).split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase())).join('/');
      const treatment = row.sourceReference ? '保留源版本引用' : row.action === 'retain' ? '保留' : '待确认历史';
      lines.push(`| [${label}](${link}) | ${row.alife ? '是' : '否'} | ${row.churchApp ? '是' : '否'} | ${treatment} | ${row.reason.replaceAll('|', '\\|')} |`);
    }
  }
  writeFileSync(reportPath, lines.join('\n') + '\n');
  console.log(`Inventory: ${original.length} original files; ${retained.length} retained (${sourceOnly.length} source-only); ${archived.length} pending history; ${audit.length} audit files; ${added.length} post-review files.`);
}

function check() {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const originals = new Set(), current = new Set();
  let sourceOnly = 0, sourceHashes = 0, archivedHashes = 0, omittedIgnored = 0;
  for (const row of registry.files) {
    if (originals.has(row.originalPath) || current.has(row.currentPath)) throw new Error(`Duplicate: ${row.originalPath}`);
    originals.add(row.originalPath); current.add(row.currentPath);
    const path = resolve(root, row.currentPath);
    if (!path.startsWith(root + '/') && !path.startsWith(root + '\\')) throw new Error('Path outside repository');
    if (row.sourceReference) {
      const ref = row.sourceReference;
      if (row.action !== 'retain' || !/^[a-f0-9]{40}$/.test(ref.revision) || !/^[a-f0-9]{64}$/.test(ref.sha256) ||
          ref.revision !== registry.sourceRevision || ref.url !== `https://github.com/appccalc-developers/Alife/blob/${ref.revision}/${row.originalPath}`) {
        throw new Error(`Invalid pinned-source reference: ${row.originalPath}`);
      }
      if (existsSync(path)) throw new Error(`Source-only document now exists locally; reconcile its classification: ${row.currentPath}`);
      sourceOnly++;
      let available = true;
      try { execFileSync('git', ['cat-file', '-e', ref.revision], { cwd: root, stdio: 'ignore' }); }
      catch { available = false; }
      if (available) {
        const bytes = execFileSync('git', ['show', `${ref.revision}:${row.originalPath}`], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
        if (createHash('sha256').update(bytes).digest('hex') !== ref.sha256) throw new Error(`Pinned-source bytes changed: ${row.originalPath}`);
        sourceHashes++;
      }
      continue;
    }
    if (!existsSync(path)) {
      if (row.versionControl === 'ignored-local') { omittedIgnored++; continue; }
      throw new Error(`Missing: ${row.currentPath}`);
    }
    if (row.action === 'pending-history') {
      if (existsSync(resolve(root, row.originalPath))) throw new Error(`Old active path still exists: ${row.originalPath}`);
      if (hash(path) !== row.originalSha256) throw new Error(`Historical bytes changed: ${row.currentPath}`);
      archivedHashes++;
    }
  }
  for (const path of list(resolve(root, 'docs'))) if (!current.has(path)) throw new Error(`Unclassified active Docs file: ${path}`);
  const archived = registry.files.filter(row => row.action === 'pending-history');
  if (archived.length) {
    const attributes = execFileSync('git', ['check-attr', '--stdin', '-z', 'text'], { cwd: root, input: archived.map(row => row.currentPath).join('\0') + '\0', encoding: 'utf8' }).split('\0');
    for (let i = 0; i + 2 < attributes.length; i += 3) {
      if (attributes[i + 2] !== 'unset') throw new Error(`Historical bytes are subject to Git text conversion: ${attributes[i]}`);
    }
  }
  const ignored = registry.files.filter(row => row.versionControl === 'ignored-local');
  if (ignored.length) {
    const actual = new Set(execFileSync('git', ['-c', 'core.quotepath=false', 'check-ignore', '--stdin'], { cwd: root, input: ignored.map(row => row.currentPath).join('\n') + '\n', encoding: 'utf8' }).trim().split(/\r?\n/));
    for (const row of ignored) if (!actual.has(row.currentPath)) throw new Error(`Lost ignored status: ${row.currentPath}`);
  }
  console.log(`All ${registry.files.length} records accounted for; ${archivedHashes} archived hashes verified; ${ignored.length} originally ignored paths protected (${omittedIgnored} local-only files absent); ${sourceOnly} pinned-source references checked (${sourceHashes} local source hashes verified).`);
}

if (process.argv.includes('--init')) initialize();
if (process.argv.includes('--report') || process.argv.includes('--init')) render();
if (process.argv.includes('--check')) check();
if (!process.argv.slice(2).length) console.log('Use --init once before moving files, --report after reviewed classification updates, and --check after moves. No files are moved or deleted by this script.');
