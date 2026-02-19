#!/usr/bin/env node

const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

const COVERAGE_SUMMARY = path.join(__dirname, 'coverage', 'coverage-summary.json');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: __dirname });
}

function getCurrentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: __dirname }).toString().trim();
}

function getChangedFiles(baseBranch, sourceBranch) {
  return execSync(`git diff --name-only ${baseBranch}...${sourceBranch} -- src/`, { cwd: __dirname })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
}

function collectCoverage() {
  run('npx jest --coverage --silent --coverageDirectory=coverage src/');
  return JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf-8'));
}

function toAbsolute(file) {
  return path.resolve(__dirname, file);
}

function main() {
  const baseBranch = process.argv[2];
  if (!baseBranch) {
    console.error('Usage: node coverage-change.js <base-branch>');
    process.exit(1);
  }

  const sourceBranch = getCurrentBranch();

  run(`git checkout ${baseBranch}`);
  const baseCoverage = collectCoverage();

  run(`git checkout ${sourceBranch}`);
  const sourceCoverage = collectCoverage();

  const changedFiles = getChangedFiles(baseBranch, sourceBranch);

  if (!changedFiles.length) {
    console.log('No changed files in src/.');
    return;
  }

  console.log('file,branch_base_pct,branch_source_pct,branch_delta');

  for (const file of changedFiles) {
    const key = toAbsolute(file);
    const base = baseCoverage[key];
    const source = sourceCoverage[key];

    if (!base && !source) continue;

    const basePct = base?.branches?.pct ?? 0;
    const sourcePct = source?.branches?.pct ?? 0;
    const delta = sourcePct - basePct;

    console.log(`${file},${basePct},${sourcePct},${delta}`);
  }
}

main();
