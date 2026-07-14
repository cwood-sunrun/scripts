## Analyze code coverage versus change counts

This script parses output of git churn and a json code coverage summary file from Jest. 

The output merges both sources and outputs the change count, as well as branch and statement coverage percentages.


## Git Churn 

This command generates sorted change counts by file in a repository.

```
git log --all -M -C --name-only --format='format:' "$@" | sort | grep -v '^$' | uniq -c | sort -n
```
