# Github API scripting

## commits-per-pr
Requires the [github cli](https://cli.github.com/) to be installed (`gh`).

Calculates mean and max commits per pr against a particular branch since some date. Useful to help estimate time used by CI, etc. 

Example
```
./commits-per-pr.js 2026-01-01 cwood-sunrun/scripts main 
```

Output 
```
prs, commits, mean, max
5, 28, 5.60, 10
```
