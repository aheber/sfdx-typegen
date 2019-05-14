import * as ts from "typescript";
import * as xml2js from "xml2js";
import * as utils from "./utils";

export default class Helper {
  buildDTS(fileName: string, body: string, cmpBody: string): string {
    let sourceFile = ts.createSourceFile(
      fileName,
      body,
      ts.ScriptTarget.ES2015,
      /*setParentNodes */ true
    );
    let componentName = utils.getComponentName(fileName);

    let root = getRoot(sourceFile);
    // For each property

    let propStrings: string[] = [];
    root.properties
      .filter(prop => {
        // console.log(ts.SyntaxKind[prop.kind]);
        return prop.kind == ts.SyntaxKind.PropertyAssignment;
      })
      .forEach(prop => {
        let name = prop.name;
        let propName;
        // Collect property name
        switch (name.kind) {
          case ts.SyntaxKind.Identifier:
            propName = (name as ts.Identifier).getFullText().trim();
            break;
          case ts.SyntaxKind.StringLiteral:
            propName = (name as ts.StringLiteral).getFullText().trim();
            break;
        }
        // console.log("Property Name:" + propName);
        let propertyHandled: boolean;
        let types: string[] = [];
        // TODO: collect comments preceeding the property
        prop.getChildren().forEach(val => {
          let localPropertyHandled = true;
          // console.log("Kind:", val.kind);
          types.push(ts.SyntaxKind[val.kind]);
          // console.log(val.getFullText());
          // Add typing for the various types of properties
          switch (val.kind) {
            case ts.SyntaxKind.FunctionExpression:
              propStrings.push(
                buildFunctionString(propName, <ts.FunctionExpression>val)
              );
              break;
            case ts.SyntaxKind.TypeAssertionExpression:
              propStrings.push(
                buildPropertyString(
                  propName,
                  val,
                  (<ts.TypeAssertion>val).type.getText()
                )
              );
              break;
            // TODO: maybe type this better later
            case ts.SyntaxKind.ObjectLiteralExpression: // objects {identifier: {something: "value", ...}}, {identifier: {}}
            case ts.SyntaxKind.NullKeyword: // Don't know what this will be {identifier: null}
              propStrings.push(buildPropertyString(propName, val, "any"));
              break;
            case ts.SyntaxKind.FirstLiteralToken: // literal numbers {identifier: 100}
              propStrings.push(buildPropertyString(propName, val, "number"));
              break;
            case ts.SyntaxKind.FalseKeyword: // raw `false` {identifier: false}
            case ts.SyntaxKind.TrueKeyword: // raw `true` {identifier: true}
              propStrings.push(buildPropertyString(propName, val, "boolean"));
              break;
            case ts.SyntaxKind.StringLiteral: // enclosed text `"hello world"` {identifier: "hello world"}
              propStrings.push(buildPropertyString(propName, val, "string"));
              break;
            case ts.SyntaxKind.ArrayLiteralExpression:
              propStrings.push(
                buildArrayString(propName, <ts.ArrayLiteralExpression>val)
              );
              break;
            default:
              localPropertyHandled = false;
          }
          if (localPropertyHandled === true) {
            propertyHandled = true;
          }
        });
        if (propertyHandled === undefined) {
          throw Error(
            "Unhandled property in " +
              sourceFile.fileName +
              ":" +
              propName +
              " with types " +
              JSON.stringify(types)
          );
        }
      });

    let baseCmp = getBaseComponent(cmpBody);

    return buildTyping(baseCmp, propStrings);

    function buildTyping(baseCmp: string, props: string[]): string {
      let properties = props.join("\n    ");
      if (baseCmp.length > 0) {
        let baseParts = baseCmp.split(":");
        baseCmp = `extends Helper.${baseParts[0].toLowerCase()}.${
          baseParts[1]
        }`;
      }
      return `declare namespace Helper.c {
  interface ${componentName} ${baseCmp} {
    ${properties}
  }
}`;
    }

    function buildPropertyString(
      propName: string,
      node: ts.Node,
      baseReturnType: string
    ): string {
      let returnType = baseReturnType;
      let jsDocTags = ts.getJSDocTags(node);
      jsDocTags.forEach(doc => {
        if (doc.tagName.getText() == "type") {
          let dType = <ts.JSDocTypeTag>doc;
          returnType = dType.typeExpression.type.getText();
        }
      });
      return `${propName}:${returnType};`;
    }

    function getBaseComponent(cmpBody: string): string {
      let baseCmp = "";
      new xml2js.Parser().parseString(cmpBody, (err, result) => {
        // check for 'extends' attribute
        if (
          result["aura:component"] != undefined &&
          result["aura:component"].$ != undefined &&
          result["aura:component"].$.extends != undefined
        ) {
          baseCmp = result["aura:component"].$.extends;
        }
      });
      return baseCmp;
    }

    function buildFunctionString(
      methodName: string,
      node: ts.FunctionExpression
    ): string {
      let jsDocTags = ts.getJSDocTags(node);
      let tagTypeMap = {};
      let returnType = "any";
      if (jsDocTags != null) {
        jsDocTags.forEach(tag => {
          if (tag.tagName.getText() === "param") {
            let paramTag = <ts.JSDocParameterTag>tag;
            if (paramTag.typeExpression) {
              tagTypeMap[
                paramTag.name.getText()
              ] = paramTag.typeExpression.type.getText();
            }
            // console.log("Tag Name:", tag.tagName.getText());
            // tagTypeMap[tag.]
          }
          if (tag.tagName.getText() === "returns") {
            let returnTag = <ts.JSDocReturnTag>tag;
            returnType = returnTag.typeExpression.type.getText();
          }
        });
      }
      let params: string[] = [];
      // TODO: throw error if type in JSDoc doesn't match parameter type or if JSDoc lists too many or not enough params
      if (node.type !== undefined) {
        returnType = node.type.getText();
      }

      // Parse the Type Parameters and if needed add them to the output
      let typeParamString = "";
      if (node.typeParameters && node.typeParameters.length > 0) {
        let typeParams = [];
        node.typeParameters.forEach(tParam => {
          typeParams.push(tParam.getText());
        });
        if (typeParams.length > 0) {
          typeParamString = typeParams.join(",");
          typeParamString = `<${typeParamString}>`;
        }
      }
      // Function parameters with type merging
      node.parameters.forEach(param => {
        if (node.parameters[0] === param && param.name.getText() === "this") {
          // "this" first argument is a convenience definition only useful inside the function, not needed for the definition
          return;
        }
        let typeString = "";
        if (
          param.type == null &&
          tagTypeMap[param.name.getText()] != undefined
        ) {
          typeString = `: ${tagTypeMap[param.name.getText()]}`;
        }
        params.push(`${param.getText()}${typeString}`);
      });

      let paramString = params.join(", ");
      let signature = `${methodName}${typeParamString}(${paramString}): ${returnType};`;
      return signature;
    }

    // TODO: look through the array and see if we can figure out the typing
    function buildArrayString(
      methodName: string,
      node: ts.ArrayLiteralExpression
    ) {
      return `${methodName}: [];`;
    }

    // Dig into the node tree until we're at the first object literal definition
    // Loop through each of its properties and build a type definition
    // For FunctionExpression properties, collect the params and types to create on the d.ts file
    // For
    function getRoot(node: ts.Node): ts.ObjectLiteralExpression {
      switch (node.kind) {
        case ts.SyntaxKind.ObjectLiteralExpression:
          return <ts.ObjectLiteralExpression>node;
      }

      return ts.forEachChild(node, getRoot);
    }
  }
}
