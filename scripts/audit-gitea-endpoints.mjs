import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://git.botinha.dev.br';
const baseUrl = (process.argv[2] || process.env.GITEA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

const giteaFilePath = path.resolve(process.cwd(), 'src/lib/gitea.ts');
const source = fs.readFileSync(giteaFilePath, 'utf8');

const endpointRegex = /this\.request(?:Form|Text)?\(\s*'[^']+'\s*,\s*`([^`]+)`|this\.request(?:Form|Text)?\(\s*'[^']+'\s*,\s*'([^']+)'/g;

const rawEndpoints = new Set();
let match;
while ((match = endpointRegex.exec(source)) !== null) {
  const candidate = (match[1] || match[2] || '').trim();
  if (candidate.startsWith('/')) rawEndpoints.add(candidate);
}

function normalizePathPattern(value) {
  return value
    .replace(/\$\{[^}]+\}/g, '{param}')
    .replace(/\{encodeURIComponent\([^}]+\)\}/g, '{param}')
    .replace(/\{[^}]+\}/g, '{param}')
    .replace(/\/+$/g, '');
}

async function fetchSwaggerSpec() {
  const url = `${baseUrl}/swagger.v1.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function main() {
  const spec = await fetchSwaggerSpec();
  const swaggerPaths = Object.keys(spec.paths || {});
  const normalizedSwagger = new Set(swaggerPaths.map(normalizePathPattern));

  const used = [...rawEndpoints].map((raw) => ({ raw, normalized: normalizePathPattern(raw) }));
  const missing = used.filter((item) => !normalizedSwagger.has(item.normalized));

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Endpoints in gitea.ts: ${used.length}`);
  console.log(`Paths in swagger: ${swaggerPaths.length}`);
  console.log(`Missing from swagger: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nEndpoints not found in swagger:');
    for (const endpoint of missing.sort((a, b) => a.raw.localeCompare(b.raw))) {
      console.log(`- ${endpoint.raw}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAll endpoints used in gitea.ts were found in swagger.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
