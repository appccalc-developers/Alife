import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eventResetSignaturePayload } from '../../cloudflare/images-api/worker/event-reset-files.js';

const requestPath = process.argv[2];
const secret = process.env.EVENT_RESET_FILE_SIGNING_SECRET;
if (!requestPath || typeof secret !== 'string' || secret.length < 32) {
  process.stderr.write('A request path and a signing secret of at least 32 characters are required.\n');
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(requestPath, 'utf8'));
} catch {
  process.stderr.write('The Event reset file request is not valid JSON.\n');
  process.exit(2);
}

for (const field of [
  'operation',
  'resetRunId',
  'manifestHash',
  'backupReference',
  'approvedFingerprint',
  'resetEpoch',
  'schemaEpoch',
  'targetResource',
]) {
  if (typeof input[field] !== 'string' || input[field].length === 0) {
    process.stderr.write(`The Event reset file request is missing ${field}.\n`);
    process.exit(2);
  }
}

process.stdout.write(createHmac('sha256', secret).update(eventResetSignaturePayload(input)).digest('hex'));
