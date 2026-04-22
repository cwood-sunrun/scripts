#!/usr/bin/env node
const { readFileSync } = require("fs");
const { spawnSync, spawn } = require("child_process");

function getRepoFileContents(owner, repo, relativeFilePath) {
  const r = spawnSync(
    "gh",
    ["api", `/repos/${owner}/${repo}/contents/${relativeFilePath}`],
    {
      encoding: "utf8",
    },
  );

  if (r.status !== 0) {
    return null;
  }

  // TDOO error handle / missing file
  const response = JSON.parse(r.stdout);
  const decodecContent = Buffer.from(response.content, "base64").toString(
    "utf-8",
  );

  return decodecContent.trim();
}

const [, , filePath] = process.argv;
if (!filePath) {
  console.error("usage: lint-node-versions.js <file>");
  process.exit(1);
}

const parseRepoUrl = (repo) => {
  return repo.trim().split("/");
};

// TODO update to accept redirect
const repos = readFileSync(filePath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const nvmRCPath = ".nvmrc";
const packageJSONPath = "package.json";
console.log(`repo, .nvmrc, package.json`);

for (const repo of repos) {
  const [owner, repoSlug] = parseRepoUrl(repo);
  const nvmRc = getRepoFileContents(owner, repoSlug, nvmRCPath);
  const packageJsonRaw = getRepoFileContents(owner, repoSlug, packageJSONPath);
  const packageJson = packageJsonRaw ? JSON.parse(packageJsonRaw) : {};
  console.log(`${repo}, ${nvmRc}, ${packageJson?.engines?.node}`);
}
