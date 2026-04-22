#!/usr/bin/env node

const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

function fetchPRsSince(repo, sinceDate) {
  const output = execSync(
    `gh pr list --repo ${repo} --state all --search "created:>=${sinceDate}" --json number,title,url,createdAt,author,isDraft --limit 200`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );
  return JSON.parse(output);
}

function fetchFirstReview(repo, prNumber) {
  const output = execSync(
    `gh api repos/${repo}/pulls/${prNumber}/reviews --jq '[.[] | select(.state != "PENDING")] | sort_by(.submitted_at) | .[0]'`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );
  const trimmed = output.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
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

function computeStats(waitTimesMs) {
  if (!waitTimesMs.length) return null;
  const secs = waitTimesMs.map((ms) => Math.floor(ms / 1_000));
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
  // ISO week: Monday-based
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
const interval = process.argv[4]; // optional: 'week' | 'month'

if (!reposFile || !sinceDate) {
  console.error(
    "Usage: node time-until-first-review.js <repos-file> <since-date> [week|month]",
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
  .map((line) => line.trim())
  .filter(Boolean);

const results = [];

for (const repo of repos) {
  let prs;
  try {
    prs = fetchPRsSince(repo, sinceDate);
  } catch (err) {
    console.error(`Error fetching PRs for ${repo}: ${err.message}`);
    continue;
  }

  for (const pr of prs) {
    if (pr.isDraft) continue;

    let firstReview;
    try {
      firstReview = fetchFirstReview(repo, pr.number);
    } catch (err) {
      console.error(
        `Error fetching reviews for ${repo}#${pr.number}: ${err.message}`,
      );
      continue;
    }

    const createdAt = new Date(pr.createdAt);
    const author = pr.author?.login ?? "unknown";
    let waitTime = null;
    let reviewedAt = null;

    if (firstReview) {
      reviewedAt = new Date(firstReview.submitted_at);
      waitTime = reviewedAt - createdAt;
    }

    results.push({
      repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      author,
      createdAt,
      reviewedAt,
      waitTime,
    });
  }
}

results.sort((a, b) => a.createdAt - b.createdAt);

const reviewed = results.filter((r) => r.waitTime !== null);

if (!interval) {
  console.log("repo, prNum, wait_seconds");
  for (const pr of reviewed) {
    console.log(`${pr.repo}, ${pr.number}, ${Math.floor(pr.waitTime / 1_000)}`);
  }
}

if (interval) {
  console.log(
    `\ninterval, count, min_seconds, max_seconds, avg_seconds, median_seconds`,
  );
  const buckets = groupByInterval(reviewed, interval);
  for (const key of Object.keys(buckets).sort()) {
    console.log(
      statsRow(key, computeStats(buckets[key].map((r) => r.waitTime))),
    );
  }
}
