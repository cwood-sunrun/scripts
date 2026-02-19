# Coverage change

### Assumptions:
- Packages are installed
- Jest as test runner
- No package changes between base and source that require install

For all files changed on current (source) branch, print change in code coverage compared with a given base branch.

## Usage
```
./coverage-change.js develop
```

Output is a CSV. Pipe output to `column -t -s ,` for formatting.
