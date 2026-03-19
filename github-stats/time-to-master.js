#!/usr/bin/env node

const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

const DEVELOP = "develop";
const MASTER = "master";

function gh(cmd) {
  return JSON.parse(
    execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }),
  );
}

function fetchFeaturePRs(repo, sinceDate) {
  return gh(
    `gh pr list --repo ${repo} --base ${DEVELOP} --state merged --search "merged:>=${sinceDate}" --json number,title,createdAt,mergedAt,author,url --limit 200`,
  );
}

function fetchMasterMerges(repo, sinceDate) {
  return gh(
    `gh pr list --repo ${repo} --base ${MASTER} --state merged --search "merged:>=${sinceDate}" --json number,mergedAt,headRefName --limit 200`,
  )
    .filter((pr) => pr.headRefName === DEVELOP)
    .sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
}

function findMasterMerge(featureMergedAt, masterMerges) {
  return masterMerges.find((mm) => new Date(mm.mergedAt) >= featureMergedAt);
}

function min(vals) {
  return Math.min(...vals);
}

function max(vals) {
  return Math.max(...vals);
}

function average(vals) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function median(vals) {
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStats(timesMs) {
  if (!timesMs.length) return null;
  const secs = timesMs.map((ms) => Math.floor(ms / 1_000));
  return {
    count: secs.length,
    min: min(secs),
    max: max(secs),
    avg: Math.floor(average(secs)),
    median: Math.floor(median(secs)),
  };
}

function intervalKey(date, interval) {
  const d = new Date(date);
  if (interval === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function groupByInterval(results, interval) {
  const buckets = {};
  for (const r of results) {
    const key = intervalKey(r.createdAt, interval);
    (buckets[key] ??= []).push(r);
  }
  return buckets;
}

function statsRow(label, stats) {
  if (!stats) return `${label}, 0, , , ,`;
  return `${label}, ${stats.count}, ${stats.min}, ${stats.max}, ${stats.avg}, ${stats.median}`;
}

const reposFile = process.argv[2];
const sinceDate = process.argv[3];
const interval = process.argv[4];

if (!reposFile || !sinceDate) {
  console.error(
    "Usage: node time-to-master.js <repos-file> <since-date> [week|month]",
  );
  console.error(
    "  <repos-file>   Newline-delimited file of owner/repo entries",
  );
  console.error("  <since-date>   Date in YYYY-MM-DD format");
  console.error("  [week|month]   Optional interval for aggregated stats");
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
  console.error(
    `Error: invalid date format "${sinceDate}", expected YYYY-MM-DD`,
  );
  process.exit(1);
}

if (interval && interval !== "week" && interval !== "month") {
  console.error(`Error: interval must be "week" or "month", got "${interval}"`);
  process.exit(1);
}

const resolvedPath = path.resolve(reposFile);
if (!existsSync(resolvedPath)) {
  console.error(`Error: file not found: ${resolvedPath}`);
  process.exit(1);
}

const repos = readFileSync(resolvedPath, "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const results = [];

for (const repo of repos) {
  let featurePRs, masterMerges;
  try {
    featurePRs = fetchFeaturePRs(repo, sinceDate);
    masterMerges = fetchMasterMerges(repo, sinceDate);
  } catch (err) {
    console.error(`Error fetching PRs for ${repo}: ${err.message}`);
    continue;
  }

  for (const pr of featurePRs) {
    const mergedAt = new Date(pr.mergedAt);
    const masterMerge = findMasterMerge(mergedAt, masterMerges);
    if (!masterMerge) continue;

    const createdAt = new Date(pr.createdAt);
    const landedAt = new Date(masterMerge.mergedAt);

    results.push({
      repo,
      number: pr.number,
      author: pr.author?.login ?? "unknown",
      createdAt,
      landedAt,
      leadTime: landedAt - createdAt,
      masterPR: masterMerge.number,
    });
  }
}

results.sort((a, b) => a.createdAt - b.createdAt);

console.log("repo, pr, master_pr, lead_time_seconds");
for (const r of results) {
  console.log(
    `${r.repo}, ${r.number}, ${r.masterPR}, ${Math.floor(r.leadTime / 1_000)}`,
  );
}

if (interval) {
  console.log(
    "\ninterval, count, min_seconds, max_seconds, avg_seconds, median_seconds",
  );
  const buckets = groupByInterval(results, interval);
  for (const key of Object.keys(buckets).sort()) {
    console.log(
      statsRow(key, computeStats(buckets[key].map((r) => r.leadTime))),
    );
  }
  console.log(
    statsRow("overall", computeStats(results.map((r) => r.leadTime))),
  );
}
