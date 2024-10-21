const { readFileSync } = require('fs');

const ABSOLUTE_PATH_PREFIX = ''
const COVERAGE_SUMMARY_FILE = '';
const GIT_CHURN_FILE = '';

const rawChanges = readFileSync(GIT_CHURN_FILE, 'utf8');

const changes = rawChanges
  .split('\n')
  .map(line => line.trim().split(' '))
  .map(([count, file]) => [Number(count), file]);

// The coverage summary report file paths are absolute while git churn is relative
const makePathRelative = path => {
  return path.replace(ABSOLUTE_PATH_PREFIX, '');
};

const getChangeCount = filePath => {
  return changes.find(([_, path]) => path === filePath);
};

const coverage = JSON.parse(readFileSync(COVERAGE_SUMMARY_FILE, 'utf8'));
const files = Object.keys(coverage);

for (const file of files) {
  const changeTuple = getChangeCount(makePathRelative(file));
  if (changeTuple) {
    const [changeCount] = changeTuple;
    const { branches, statements } = coverage[file];
    console.log(file, changeCount, branches.pct, statements.pct);
  }
}
