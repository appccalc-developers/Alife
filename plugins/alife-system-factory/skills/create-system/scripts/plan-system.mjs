import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

// Planning only: no source copying, project writes, credentials or cloud mutations.
const profiles = {
  'azure-cloudflare': {
    frontend: 'React/TypeScript/Vite PWA',
    delivery: 'Cloudflare Worker',
    application: '.NET Azure Functions with application/domain layers',
    persistence: 'EF Core + SQL Server/Azure SQL',
    media: 'R2 with authorized media routes',
    aiSessions: 'Temporary Durable Objects',
    runtimeTemplate: 'not-bundled',
  },
  'cloudflare-only': {
    frontend: 'React/TypeScript/Vite PWA',
    delivery: 'Cloudflare Worker',
    application: 'TypeScript Worker API with separate application/domain/persistence modules',
    persistence: 'D1 with explicit repositories, constraints and atomic mutations',
    media: 'R2 with authorized media routes',
    aiSessions: 'Temporary Durable Objects',
    runtimeTemplate: 'not-bundled',
  },
};

function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' }, slug: { type: 'string' }, profile: { type: 'string' },
      'azure-functions': { type: 'string', default: 'unknown' },
      'azure-sql': { type: 'string', default: 'unknown' },
      cloudflare: { type: 'string', default: 'unknown' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write('Usage: node plan-system.mjs --name "System Name" --slug system-name --profile azure-cloudflare|cloudflare-only [--azure-functions present|absent|unknown] [--azure-sql present|absent|unknown] [--cloudflare present|absent|unknown]\nPlanning JSON only; no application source or resources are generated.\n');
    return;
  }
  const name = values.name?.trim();
  if (!name || name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new Error('Provide a display name of 1–100 characters without control characters.');
  }
  const slug = values.slug;
  if (!slug || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48 ||
      /^(alife|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(slug)) {
    throw new Error('Provide an independent safe slug (lowercase letters/digits/hyphens, starting with a letter, max 48); Alife and reserved device names are excluded.');
  }
  if (!Object.hasOwn(profiles, values.profile ?? '')) {
    throw new Error('Choose an explicit profile: azure-cloudflare or cloudflare-only.');
  }
  const resources = {
    azureFunctions: values['azure-functions'],
    azureSql: values['azure-sql'],
    cloudflare: values.cloudflare,
  };
  if (Object.values(resources).some(value => !['present', 'absent', 'unknown'].includes(value))) {
    throw new Error('Resource availability must be present, absent or unknown; do not supply credentials.');
  }
  const baseline = JSON.parse(readFileSync(new URL('../references/baseline.json', import.meta.url), 'utf8'));
  const azure = values.profile === 'azure-cloudflare';
  const requiredResources = azure ? ['azureFunctions', 'azureSql', 'cloudflare'] : ['cloudflare'];
  const outstanding = requiredResources.filter(key => resources[key] !== 'present');
  const task = (id, title, dependsOn, acceptance) => ({
    id, title, dependsOn, status: dependsOn.length ? 'planned' : 'ready',
    implementation: 'unimplemented', verification: 'unverified', acceptance, evidence: [], blockers: [],
  });
  const firstJourney = azure
    ? 'Extract reviewed source/configuration and verify independent-name identity/group persistence'
    : 'Implement and verify Workers/D1 identity/group persistence, atomic one-time use and current authorization';
  const workRegister = [
    task('SCOPE', 'Resolve source, rights, destination and requirement parity', [], [
      'Available authorized source pinned to the selected revision; drift recorded',
      'New destination inspected; reuse inventory excludes tenant data and secrets',
      'Source behavior vs target gaps and scenario-level requirements reviewed',
    ]),
    task('FOUNDATION', firstJourney, ['SCOPE'], [
      'Independent configuration and authentication secrets; no shared Alife resources',
      'Persistent login/group journey with allowed and denied actors, expiry/revocation and concurrency',
    ]),
    ...baseline.families.map(family => task(`PARITY-${family.id}`, family.title, ['FOUNDATION'], family.acceptance)),
    task('ACCEPTANCE', 'Complete integrated parity, operations and handover', baseline.families.map(family => `PARITY-${family.id}`), [
      'Every scoped scenario has current evidence or explicit user-accepted deferral',
      'Bilingual rendered journeys, isolation/invalidation and saved payload compatibility verified',
      'Authorized target environment, providers and recovery verified; user product acceptance recorded',
    ]),
  ];
  const output = {
    schemaVersion: 1,
    artifactKind: 'implementation-plan',
    generatorVersion: '0.1.0',
    system: { name, slug, profile: values.profile, bilingualShape: { en: 'string', zh: 'string' } },
    resources: { observedAvailability: resources, requiredForDeployment: requiredResources, outstanding },
    architecture: profiles[values.profile],
    source: { revision: baseline.sourceRevision, location: null, required: true, available: 'unknown' },
    readiness: {
      planGenerated: true, applicationGenerated: false, runtimeVerified: false,
      deploymentReady: false, externalOperationsAuthorized: false,
    },
    nextQuestions: [
      'Where is the authorized Alife source checkout and the new project destination?',
      'Use the pinned source behavior, or also implement its documented target-only gaps?',
      ...outstanding.map(key => `${key} is ${resources[key]}; which independent development/deployment resource will be used?`),
      'Which domains, RP IDs/origins, organization/timezone and optional providers are required?',
    ],
    parityRegister: baseline.families.map(family => ({
      requirement: family.id, title: family.title, sourceAuthorities: family.authorities,
      sourceStatus: family.baselineStatus, sourceGaps: family.sourceGaps ?? [],
      scenarioExpansionRequired: true, implementation: 'unimplemented', verification: 'unverified', evidence: [],
    })),
    workRegister,
    limitations: [
      'Planning resources and workflows only; complete runtime templates are not bundled.',
      'Family-level routing is not exhaustive scenario-level equivalence.',
      'Source partial/target capabilities are not verified completed features.',
      'Cloudflare infrastructure can still depend on explicitly configured external content/auth/mail/AI providers.',
      'No credentials, production data, resource creation, migration, Git mutation or deployment occurs.',
    ],
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
