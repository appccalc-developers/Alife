import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./plan-system.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const valid = ['--name', '盼望 Hope', '--slug', 'hope-community'];

test('Azure plan retains the chosen topology and exposes absent deployment resources', () => {
  const result = run(...valid, '--profile', 'azure-cloudflare', '--azure-functions', 'absent', '--azure-sql', 'present');
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.system.name, '盼望 Hope');
  assert.match(plan.architecture.application, /Azure Functions/);
  assert.deepEqual(plan.resources.outstanding, ['azureFunctions', 'cloudflare']);
  assert.equal(plan.readiness.applicationGenerated, false);
  assert.equal(plan.readiness.deploymentReady, false);
});

test('Cloudflare choice remains independent of existing Azure availability', () => {
  const result = run(...valid, '--profile', 'cloudflare-only', '--azure-functions', 'present', '--azure-sql', 'present', '--cloudflare', 'present');
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.deepEqual(plan.resources.requiredForDeployment, ['cloudflare']);
  assert.deepEqual(plan.resources.outstanding, []);
  assert.match(plan.architecture.persistence, /^D1/);
  assert.equal(plan.readiness.runtimeVerified, false);
  assert.equal(plan.readiness.deploymentReady, false);
  assert.match(plan.workRegister.find(task => task.id === 'FOUNDATION').title, /atomic one-time use/);
});

test('Neither missing nor arbitrary profiles silently choose a runtime', () => {
  for (const args of [[], ['--profile', 'hybrid'], ['--profile', '__proto__']]) {
    const result = run(...valid, ...args);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

test('Reject unsafe, reserved and Alife destination identifiers', () => {
  for (const slug of ['alife', 'con', 'lpt1', '../other', 'Hope', 'hope/other', 'hope--other', 'a'.repeat(49)]) {
    const result = run('--name', 'Hope', '--slug', slug, '--profile', 'cloudflare-only');
    assert.notEqual(result.status, 0, slug);
    assert.equal(result.stdout, '');
  }
});

test('Reject blank/control names and credential-shaped resource input', () => {
  for (const name of ['', '   ', 'Hope\nOther']) {
    assert.notEqual(run('--name', name, '--slug', 'hope', '--profile', 'cloudflare-only').status, 0);
  }
  const result = run(...valid, '--profile', 'cloudflare-only', '--cloudflare', 'credential-value');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /credential-value/);
});

test('Parity includes unfinished source capabilities and an acyclic executable task order', () => {
  const result = run(...valid, '--profile', 'azure-cloudflare');
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  const event = plan.parityRegister.find(row => row.requirement === 'EVENT');
  assert.ok(event.sourceGaps.some(gap => gap.includes('FESTIVAL.OPERATIONS')));
  assert.ok(event.sourceGaps.some(gap => gap.includes('MONEY.FINANCE')));
  const seen = new Set();
  for (const task of plan.workRegister) {
    assert.ok(!seen.has(task.id));
    for (const dependency of task.dependsOn) assert.ok(seen.has(dependency), dependency);
    seen.add(task.id);
    assert.equal(task.verification, 'unverified');
    assert.deepEqual(task.evidence, []);
  }
});

test('Help accurately describes planning-only behavior', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /no application source or resources/);
});
