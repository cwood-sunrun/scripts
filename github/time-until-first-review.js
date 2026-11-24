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

// Milliseconds between start and end, excluding Saturdays and Sundays (local time).
function weekdayDurationMs(start, end) {
  if (end <= start) return 0;
  let total = 0;
  let cursor = new Date(start);
  while (cursor < end) {
    const nextMidnight = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    );
    const segmentEnd = nextMidnight < end ? nextMidnight : end;
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return total;
}

const reposFile = process.argv[2];
const sinceDate = process.argv[3];

if (!reposFile || !sinceDate) {
  console.error(
    "Usage: node time-until-first-review.js <repos-file> <since-date>",
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
      waitTime = weekdayDurationMs(createdAt, reviewedAt);
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

console.log("repo, pr_num, pr_author, created_date, wait_seconds");
for (const pr of reviewed) {
  const createdDate = pr.createdAt.toISOString().slice(0, 10);
  console.log(
    `${pr.repo}, ${pr.number}, ${pr.author}, ${createdDate}, ${Math.floor(pr.waitTime / 1_000)}`,
  );
}
