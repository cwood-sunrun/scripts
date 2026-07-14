const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const { readFileSync } = require("fs");

const ABSOLUTE_PATH_PREFIX = "";

async function main() {
  const [_nodePath, _scriptPath, coverageSummaryPath] = process.argv;

  if (!coverageSummaryPath) {
    throw new Error("Must provide coverage summary file path");
  }

  const churnResult = await exec(
    `git log --all -M -C --name-only --format='format:' "$@" | sort | grep -v '^$' | uniq -c | sort -n`,
  );

  const changes = churnResult.stdout
    .split("\n")
    .map((line) => line.trim().split(" "))
    .map(([count, file]) => [Number(count), file]);

  // The coverage summary report file paths are absolute while git churn is relative
  const makePathRelative = (path) => {
    return path.replace(ABSOLUTE_PATH_PREFIX, "");
  };

  const getChangeCount = (filePath) => {
    return changes.find(([_, path]) => path === filePath);
  };

  const coverage = JSON.parse(readFileSync(coverageSummaryPath, "utf8"));
  const files = Object.keys(coverage);

  for (const file of files) {
    const changeTuple = getChangeCount(makePathRelative(file));
    if (changeTuple) {
      const [changeCount] = changeTuple;
      const { branches, statements } = coverage[file];
      console.log(file, changeCount, branches.pct, statements.pct);
    }
  }
}

main().then().catch(console.error);
