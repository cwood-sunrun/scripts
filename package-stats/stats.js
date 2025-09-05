const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

function getPeriodStarts(utcDateString, periodType, count) {
  if (
    typeof utcDateString !== "string" ||
    (periodType !== "weekly" && periodType !== "monthly") ||
    typeof count !== "number"
  ) {
    throw new Error("Invalid arguments");
  }

  const dates = [];
  let date = new Date(utcDateString);

  for (let i = 0; i < count; i++) {
    let periodStart;
    if (periodType === "weekly") {
      const day = date.getUTCDay();
      const diff = (day + 6) % 7;
      periodStart = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate() - diff,
        ),
      );
      date = new Date(periodStart);
      date.setUTCDate(date.getUTCDate() - 7);
    } else if (periodType === "monthly") {
      periodStart = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
      );
      date = new Date(periodStart);
      date.setUTCMonth(date.getUTCMonth() - 1);
    }
    dates.unshift(periodStart.toISOString());
  }

  return dates;
}

async function collectStats(dateStr, branch) {
  await exec(
    `git checkout \`git rev-list -n 1 --first-parent --before="${dateStr}" ${branch}\``,
  );

  const auditOutput = await exec(
    "npm audit --json --omit=dev --audit-level=none",
  );
  const auditJSON = JSON.parse(auditOutput.stdout);

  return {
    prodDependencies: auditJSON.metadata.dependencies.prod,
    vulnerabilities: auditJSON.metadata.vulnerabilities.total,
  };
}

const getStats = async () => {
  const [_nodePath, _scriptPath, branch, startDate, interval, count] =
    process.argv;
  if (!branch || !startDate || !count || !interval) {
    console.error("Must provide branch, start date, interval, count");
    process.exit(1);
  }

  // TODO: if no period, use today
  const startDates = getPeriodStarts(startDate, interval, Number(count));

  const results = [];
  for (const date of startDates) {
    const periodResults = await collectStats(date, branch);
    results.push([date, periodResults]);
  }

  return results;
};

const main = async () => {
  const results = await getStats();
  for (const [date, data] of results) {
    console.log(`${date}, ${data.prodDependencies}, ${data.vulnerabilities}`);
  }
};

main()
  .then(() => {})
  .catch((e) => console.error(e));
