const { readFileSync } = require('fs');

const [nodePath, scriptPath, filePath, count] = process.argv;

const data = JSON.parse(readFileSync(filePath, 'utf-8'));

const results = data.testResults
  .map(result => {

    // Sum of durations for a given test file
    const sumDurations = result.assertionResults.reduce((acc, assertion) => {
      if (assertion.duration) {
        return acc + assertion.duration;
      } 
      return acc;
    }, 0)


    // Any time not spent running tests is runtime overhead
    const jestOverhead =(result.endTime - result.startTime) - sumDurations;

    return result.assertionResults.map(assertion => {
      return {
        jestOverhead,
        duration: assertion.duration,
        name: assertion.fullName,
        file: result.name,
      };
    });
  })
  .flat();

results.sort((a, b) => a.duration - b.duration);

console.log(results.reverse().slice(0, count));
