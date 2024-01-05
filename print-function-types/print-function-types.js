const ts = require('typescript');

function printFunctions(fileNames, options) {
  let program = ts.createProgram(fileNames, options);
  let checker = program.getTypeChecker();
  let output = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      ts.forEachChild(sourceFile, visit);
    }
  }

  // Roughly a csv for pushing into sheets
  output.forEach((record) => {
    console.log(`${record.name}, ${record.type}`);
  });

  function visit(node) {
    if (ts.isFunctionLike(node)) {
      // If the arrow function style (variable bound to a function value) 
      if (node?.parent?.kind === ts.SyntaxKind.VariableDeclaration) {
        const type = checker.getTypeAtLocation(node);
        output.push(serializeType(node?.parent?.symbol?.escapedName, type, checker));
      }

      if (node.name) {
        let symbol = checker.getSymbolAtLocation(node.name);
        output.push(serializeSymbol(symbol, checker));
      }
    }

    if (ts.isClassDeclaration(node) && node.name) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        output.push(serializeClass(symbol, checker));
      }
    }

    ts.forEachChild(node, visit);
  }
}

function serializeType(identifier, type, checker) {
  return {
    name: identifier,
    documentation: undefined,
    type: checker.typeToString(type),
  };
}

function serializeSymbol(symbol, checker) {
  return {
    name: symbol.getName(),
    documentation: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
    type: checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)),
  };
}

function serializeClass(symbol, checker) {
  let details = serializeSymbol(symbol);

  // Get the construct signatures
  let constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
  details.constructors = constructorType.getConstructSignatures().map(serializeSignature);
  return details;
}

function serializeSignature(signature, checker) {
  return {
    parameters: signature.parameters.map(serializeSymbol),
    returnType: checker.typeToString(signature.getReturnType()),
    documentation: ts.displayPartsToString(signature.getDocumentationComment(checker)),
  };
}

// Convenience function when debugging SyntaxKind enum at runtime
function syntaxKindToName(kind) {
  return ts.SyntaxKind[kind];
}

printFunctions(process.argv.slice(2), {
  target: ts.ScriptTarget.ES6,
  module: ts.ModuleKind.CommonJS,
  allowJs: true,
});
