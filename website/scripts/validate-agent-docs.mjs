import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(websiteDir, '.vitepress', 'dist');
const origin = 'https://gql-tada.0no.co';

const readOutput = (file) => fs.readFile(path.join(distDir, file), 'utf8');
const exists = async (file) => {
  try {
    await fs.access(path.join(distDir, file));
    return true;
  } catch {
    return false;
  }
};

const llms = await readOutput('llms.txt');
const llmsFull = await readOutput('llms-full.txt');

assert.ok(llms.length > 1_000, 'llms.txt is unexpectedly small');
assert.ok(llmsFull.length > 50_000, 'llms-full.txt is unexpectedly small');
assert.ok(llms.startsWith('# gql.tada'), 'llms.txt must identify gql.tada');
assert.ok(
  !llms.includes('{toc}') && !llms.includes('{description}'),
  'llms.txt has unresolved template variables'
);

const markdownUrls = new Set();
for (const match of llms.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/g)) {
  const url = new URL(match[1], origin);
  if (url.origin === origin) markdownUrls.add(url.pathname);
}

assert.ok(markdownUrls.size >= 13, 'llms.txt must link all core documentation pages');

assert.match(
  llms,
  /Schema-aware TypedDocumentNode result and variable inference/,
  'llms.txt must include the agent-oriented project description'
);

for (const pathname of markdownUrls) {
  assert.equal(path.extname(pathname), '.md', `${pathname} must be a Markdown route`);
  const markdownFile = pathname.slice(1);
  assert.ok(await exists(markdownFile), `Missing generated Markdown file: ${pathname}`);

  const htmlFile = markdownFile.endsWith('/index.md')
    ? markdownFile.replace(/\/index\.md$/, '/index.html')
    : markdownFile.includes('/')
      ? markdownFile.replace(/\.md$/, '.html')
      : markdownFile.replace(/\.md$/, '/index.html');
  assert.ok(await exists(htmlFile), `Missing HTML counterpart for ${pathname}: ${htmlFile}`);

  const html = await readOutput(htmlFile);
  assert.match(
    html,
    /<link rel="describedby" href="\/llms\.txt">/,
    `Missing llms.txt discovery link in ${htmlFile}`
  );
  assert.ok(
    html.includes(`<link rel="alternate" type="text/markdown" href="${pathname}">`),
    `Missing Markdown alternate link for ${pathname} in ${htmlFile}`
  );
}

const homepage = await readOutput('index.html');
assert.match(homepage, /<script type="application\/ld\+json">[^<]+"@type":"SoftwareSourceCode"/);
assert.match(homepage, /<link rel="describedby" href="\/llms\.txt">/);

const robots = await readOutput('robots.txt');
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Allow: \/$/m);
assert.match(robots, /^Sitemap: https:\/\/gql-tada\.0no\.co\/sitemap\.xml$/m);
assert.ok(await exists('sitemap.xml'), 'Missing generated sitemap.xml');

console.log(`Validated ${markdownUrls.size} agent-friendly documentation routes.`);
