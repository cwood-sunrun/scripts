## Print Function Types

Uses the typescript compiler to parse a given JavaScript file path and print the function types contained therein. Works across TS and JS files. The TS AST supports JSDoc comments as type information.

```
node print-function-types.js ./my-file.js
```

This is adapted from TS compiler API [examples](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)