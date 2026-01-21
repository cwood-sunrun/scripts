## Transitive Dependency Counter

Given a package-lock.json file, output a csv with top-level dependencies (prod and dev) and count (recursive) of each dependency's dependencies. 

```
tdeps package-lock.json
```

Output is `package, transitive dependency count`

### Compile

Requires [go](https://go.dev/). 

```
go build main.go -o tdeps
```

