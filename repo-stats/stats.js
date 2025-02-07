const { readFileSync } = require('fs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const getStats = async () => {
  const clocOutput = await exec('cloc --vcs=git --json');
  const clocJson = JSON.parse(clocOutput.stdout);

  const totalLinesInVcs = clocJson.header.n_lines;
  const totalTypeScriptLines = clocJson.TypeScript.code;

  await exec('./node_modules/.bin/jest --coverage');

  const rawCoverage = readFileSync('./coverage/coverage-summary.json');
  const coverageJson = JSON.parse(rawCoverage);

  // NPM run jest coverage
  return {
    totalLinesInVcs,
    totalTypeScriptLines,
    branchCoveragePercent: coverageJson.total.branches.pct,
  };
};

const main = async () => {
  const results = await getStats();
  console.log(results);
};

main()
  .then(() => {})
  .catch((e) => console.error(e));
