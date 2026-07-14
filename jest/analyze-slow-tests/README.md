## Analyze jest output for slow tests 

Parse and sort jest output to get top N slowest tests. 

Output adds a derived value of "jest overhead" for each test to measure time spent in test file outside tests.

## Usage

First run jest to output json.

```
jest --output --outputFile=results.json
```

Then analyze that file with two inputs 1) output JSON file and 2) top N slowest tests.

```
node duration.js results.json 5
```

Output looks like this:
```
{
    jestOverhead: 934,
    duration: 387,
    name: 'Icon handles all icon names',
    file: '/Users/design-system/components/Icon/Icon.spec.tsx'
}
```

To sort by the jestOverhead metric, use `overhead.js`.

