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

function fetchFirstReview(repo, prNumber) {
  const output = execSync(
    `gh api repos/${repo}/pulls/${prNumber}/reviews --jq '[.[] | select(.state != "PENDING")] | sort_by(.submitted_at) | .[0]'`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
  return output ? JSON.parse(output) : null;
}

function findMasterMerge(mergedAt, masterMerges) {
  return masterMerges.find((mm) => new Date(mm.mergedAt) >= mergedAt);
}

const DAY_MS = 86_400_000;

/** Count full calendar days between start and end (inclusive) that fall on Sat/Sun. */
function countWeekendDays(start, end) {
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  let count = 0;
  for (; day <= endDay; day.setDate(day.getDate() + 1)) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6) count++;
  }
  return count;
}

/** Elapsed ms between two dates, minus any full weekend days in the interval. */
function businessMs(start, end) {
  const raw = end - start;
  const weekendMs = countWeekendDays(start, end) * DAY_MS;
  return Math.max(0, raw - weekendMs);
}

function seconds(ms) {
  return ms === null ? "" : Math.floor(ms / 1_000);
}

const reposFile = process.argv[2];
const sinceDate = process.argv[3];

if (!reposFile || !sinceDate) {
  console.error(
    "Usage: node review_and_release.js <repos-file> <since-date>",
  );
  console.error(
    "  <repos-file>   Newline-delimited file of owner/repo entries",
  );
  console.error("  <since-date>   Date in YYYY-MM-DD format");
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
  console.error(
    `Error: invalid date format "${sinceDate}", expected YYYY-MM-DD`,
  );
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
    const createdAt = new Date(pr.createdAt);
    const mergedAt = new Date(pr.mergedAt);

    let firstReview;
    try {
      firstReview = fetchFirstReview(repo, pr.number);
    } catch (err) {
      console.error(
        `Error fetching reviews for ${repo}#${pr.number}: ${err.message}`,
      );
      continue;
    }

    const reviewWait = firstReview
      ? businessMs(createdAt, new Date(firstReview.submitted_at))
      : null;

    const masterMerge = findMasterMerge(mergedAt, masterMerges);
    const releaseLeadTime = masterMerge
      ? businessMs(createdAt, new Date(masterMerge.mergedAt))
      : null;

    results.push({
      repo,
      number: pr.number,
      createdAt,
      reviewWait,
      releaseLeadTime,
      masterPR: masterMerge?.number ?? null,
    });
  }
}

results.sort((a, b) => a.createdAt - b.createdAt);

console.log(
  "repo, pr, created_at, time_until_first_review_seconds, time_until_master_seconds, master_pr",
);
for (const r of results) {
  console.log(
    `${r.repo}, ${r.number}, ${r.createdAt.toISOString()}, ${seconds(r.reviewWait)}, ${seconds(r.releaseLeadTime)}, ${r.masterPR ?? ""}`,
  );
}
