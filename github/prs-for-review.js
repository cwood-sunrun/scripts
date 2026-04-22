#!/usr/bin/env node

// Pull open PRs awaiting review across multiple repositories.
// Reads repositories (owner/repo) from a newline-delimited text file.
//
// Usage: node prs-for-review.js repos.txt

const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

const PRStatus = Object.freeze({
  DRAFT: "DRAFT",
  REVIEW_PENDING: "REVIEW PENDING",
});

function fetchOpenPRs(repo) {
  const output = execSync(
    `gh pr list --repo ${repo} --state open --json number,title,url,reviewDecision,labels,isDraft`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );
  return JSON.parse(output);
}

function getStatus(pr) {
  if (pr.isDraft) return PRStatus.DRAFT;
  if (!pr.reviewDecision) return PRStatus.REVIEW_PENDING;
  return pr.reviewDecision;
}

function formatLabels(labels) {
  if (!labels || labels.length === 0) return "—";
  return labels.map((l) => l.name).join(", ");
}

const reposFile = process.argv[2];

if (!reposFile) {
  console.error("Usage: node prs-for-review.js <repos-file>");
  console.error("  <repos-file>  Newline-delimited file of owner/repo entries");
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

let total = 0;
for (const repo of repos) {
  let prs;
  try {
    prs = fetchOpenPRs(repo);
  } catch (err) {
    console.error(`Error fetching PRs: ${err.message}`);
    continue;
  }

  if (prs.length === 0) {
    continue;
  }

  for (const pr of prs) {
    const number = `#${pr.number}`;
    const status = getStatus(pr);
    const labels = formatLabels(pr.labels);

    // Ignore dependabot
    if (labels.includes("dependencies")) {
      continue;
    }

    // Skip drafts
    if (status === PRStatus.DRAFT) {
      continue;
    }

    total++;
    console.log(
      `${repo} ${number} ${status}  "${pr.title}"  [${labels}] ${pr.url}`,
    );
  }
}

console.log("Total: ", total);
