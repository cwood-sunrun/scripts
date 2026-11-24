#!/usr/bin/env node

const { readFileSync, existsSync } = require("fs");
const path = require("path");
const { GhQueue } = require("./lib/gh-queue");

const concurrency = Number.parseInt(process.env.GH_CONCURRENCY ?? "6", 10);
const gh = new GhQueue({
  concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 6,
});

function fetchPRsSince(repo, sinceDate) {
  return gh.json([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--search",
    `created:>=${sinceDate}`,
    "--json",
    "number,title,url,createdAt,author,isDraft",
    "--limit",
    "200",
  ]);
}

// Runs a paginated `gh api` call and returns all array items.
function ghApiPaginated(endpoint) {
  return gh.ndjson(["api", "--paginate", endpoint, "--jq", ".[]"]);
}

// Submitted (non-pending) reviews not authored by the PR author, oldest first.
async function fetchReviews(repo, prNumber, prAuthor) {
  const reviews = await ghApiPaginated(`repos/${repo}/pulls/${prNumber}/reviews`);
  return reviews
    .filter((r) => r.state !== "PENDING" && r.submitted_at)
    .filter((r) => r.user?.login !== prAuthor)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
}

// Inline review comments not authored by the PR author.
async function fetchReviewCommentCount(repo, prNumber, prAuthor) {
  const comments = await ghApiPaginated(`repos/${repo}/pulls/${prNumber}/comments`);
  return comments.filter((c) => c.user?.login !== prAuthor).length;
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

async function processPR(repo, pr) {
  const author = pr.author?.login ?? "unknown";

  const reviews = await fetchReviews(repo, pr.number, author);
  const commentCount = reviews.length
    ? await fetchReviewCommentCount(repo, pr.number, author)
    : 0;

  const createdAt = new Date(pr.createdAt);
  let waitTime = null;
  let reviewedAt = null;

  if (reviews.length) {
    reviewedAt = new Date(reviews[0].submitted_at);
    waitTime = weekdayDurationMs(createdAt, reviewedAt);
  }

  return {
    repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author,
    createdAt,
    reviewedAt,
    waitTime,
    reviewCount: reviews.length,
    changeRequestCount: reviews.filter((r) => r.state === "CHANGES_REQUESTED")
      .length,
    commentCount,
  };
}

async function processRepo(repo) {
  let prs;
  try {
    prs = await fetchPRsSince(repo, sinceDate);
  } catch (err) {
    console.error(`Error fetching PRs for ${repo}: ${err.message}`);
    return [];
  }

  const settled = await Promise.all(
    prs
      .filter((pr) => !pr.isDraft)
      .map(async (pr) => {
        try {
          return await processPR(repo, pr);
        } catch (err) {
          console.error(
            `Error fetching reviews for ${repo}#${pr.number}: ${err.message}`,
          );
          return null;
        }
      }),
  );
  return settled.filter(Boolean);
}

async function main() {
  const results = (await Promise.all(repos.map(processRepo))).flat();
  await gh.onIdle();

  // Completion order is nondeterministic; sort for stable output.
  results.sort((a, b) => a.createdAt - b.createdAt);

  const reviewed = results.filter((r) => r.waitTime !== null);

  console.log(
    "repo, pr_num, pr_author, created_date, time_until_first_review_seconds, review_count, change_request_count, comment_count",
  );
  for (const pr of reviewed) {
    const createdDate = pr.createdAt.toISOString().slice(0, 10);
    console.log(
      `${pr.repo}, ${pr.number}, ${pr.author}, ${createdDate}, ${Math.floor(pr.waitTime / 1_000)}, ${pr.reviewCount}, ${pr.changeRequestCount}, ${pr.commentCount}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
