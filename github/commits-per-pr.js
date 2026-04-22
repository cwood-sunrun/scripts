#!/usr/bin/env node

const { execSync } = require("child_process");

function showUsage() {
  console.log(`Usage: commits-per-pr.js <date> <repo> [branch]

Arguments:
  date    - Start date in ISO format (e.g., 2024-01-01)
  repo    - Repository in owner/repo format (e.g., facebook/react)
  branch  - Target branch (default: main)

Example:
  ./commits-per-pr.js 2024-01-01 cwood-sunrun/scripts main
`);
  process.exit(1);
}

const MAX_BUFFER = 50 * 1024 * 1024;
function gh(cmd) {
  try {
    const result = execSync(`gh ${cmd}`, {
      encoding: "utf-8",
      maxBuffer: MAX_BUFFER,
    });
    return JSON.parse(result);
  } catch (error) {
    console.error(`Error executing gh command: ${error.message}`);
    process.exit(1);
  }
}

function getPRs(repo, branch, sinceDate) {
  const query = `repo:${repo} is:pr is:merged base:${branch} merged:>=${sinceDate}`;

  let prs = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const searchResult = gh(
      `api search/issues -X GET -f q="${query}" -f per_page=${perPage} -f page=${page}`,
    );

    if (searchResult.items.length === 0) {
      break;
    }

    prs = prs.concat(searchResult.items);

    if (searchResult.items.length < perPage) {
      break;
    }

    page++;

    if (page > 10) {
      console.warn(
        `Warning: Limiting to first ${perPage * 10} PRs to avoid rate limits`,
      );
      break;
    }
  }

  return prs;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    showUsage();
  }

  const [sinceDate, repo, branch = "main"] = args;

  const date = new Date(sinceDate);
  if (isNaN(date.getTime())) {
    console.error(`Invalid date format: ${sinceDate}`);
    process.exit(1);
  }

  const prs = getPRs(repo, branch, sinceDate);

  if (prs.length === 0) {
    console.warn("No merged PRs found matching the criteria.");
    process.exit(0);
  }

  let max = 0;
  let totalCommits = 0;
  let processedCount = 0;

  for (const pr of prs) {
    const prNumber = pr.number;
    const prDetails = gh(`api repos/${repo}/pulls/${prNumber}`);
    const numCommits = prDetails.commits || 0;

    max = Math.max(numCommits, max);
    totalCommits += numCommits;
    processedCount++;
  }

  const mean = (totalCommits / prs.length).toFixed(2);

  console.log("prs, commits, mean, max");
  console.log(`${prs.length}, ${totalCommits}, ${mean}, ${max}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
