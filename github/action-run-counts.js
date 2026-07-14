#!/usr/bin/env node

const { execSync } = require("child_process");

const MAX_BUFFER = 50 * 1024 * 1024;

function showUsage() {
  console.log(`Usage: action-run-counts.js <repo> <workflow> [limit]

Arguments:
  repo      - Repository in owner/repo format (e.g., facebook/react)
  workflow  - Workflow display name (e.g., CI)
  limit     - Maximum number of runs to fetch (default: all)

Output CSV columns:
  start_time, duration_seconds

Example:
  ./action-run-counts.js facebook/react CI 50
`);
  process.exit(1);
}

function gh(cmd) {
  try {
    return JSON.parse(
      execSync(`gh ${cmd}`, { encoding: "utf-8", maxBuffer: MAX_BUFFER }),
    );
  } catch (error) {
    console.error(`Error executing gh command: ${error.message}`);
    process.exit(1);
  }
}

function findWorkflowId(repo, workflowName) {
  const { workflows } = gh(`api repos/${repo}/actions/workflows?per_page=100`);
  const match = workflows.find((w) => w.name === workflowName);
  if (!match) {
    console.error(`Workflow not found: ${workflowName}`);
    process.exit(1);
  }
  return match.id;
}

function getRuns(repo, workflowId, limit) {
  let runs = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const result = gh(
      `api repos/${repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}&page=${page}`,
    );
    const batch = result.workflow_runs || [];
    if (!batch.length) break;
    runs = runs.concat(batch);
    if (limit && runs.length >= limit) {
      runs = runs.slice(0, limit);
      break;
    }
    if (batch.length < perPage) break;
    page++;
  }

  return runs;
}

function durationSeconds(run) {
  const start = new Date(run.run_started_at || run.created_at);
  const end = new Date(run.updated_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return Math.max(0, Math.floor((end - start) / 1000));
}

function main() {
  const [repo, workflow, limitArg] = process.argv.slice(2);
  if (!repo || !workflow) showUsage();

  let limit;
  if (limitArg !== undefined) {
    limit = Number(limitArg);
    if (!Number.isInteger(limit) || limit < 1) {
      console.error(`Invalid limit: ${limitArg}`);
      process.exit(1);
    }
  }

  const workflowId = findWorkflowId(repo, workflow);
  const runs = getRuns(repo, workflowId, limit);

  if (!runs.length) {
    console.warn("No workflow runs found.");
    process.exit(0);
  }

  runs.sort((a, b) => new Date(a.run_started_at || a.created_at) - new Date(b.run_started_at || b.created_at));

  console.log("start_time,duration_seconds");
  for (const run of runs) {
    const start = run.run_started_at || run.created_at;
    console.log(`${start},${durationSeconds(run)}`);
  }
}

main();
