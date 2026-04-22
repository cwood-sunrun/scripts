#!/usr/bin/env node
const { readFileSync } = require('fs');
const { spawnSync } = require('child_process');

const [, , topic, filePath] = process.argv;
if (!topic || !filePath) {
  console.error('usage: add-topic-to-repos.js <topic> <file>');
  process.exit(1);
}

const repos = readFileSync(filePath, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

for (const repo of repos) {
  const r = spawnSync('gh', ['repo', 'edit', repo, '--add-topic', topic], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(
      `error: gh repo edit ${repo} --add-topic ${topic}:`,
      r.stderr?.trim() || r.error?.message || `exit ${r.status}`,
    );
  }
}
