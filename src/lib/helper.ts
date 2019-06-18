import * as ts from "typescript";
import * as xmljs from "xml-js";
import * as utils from "./utils";

export default class Helper {
  public buildDTS(fileName: string, body: string, cmpBody: string): string {
    const sourceFile = ts.createSourceFile(
      fileName,
      body,
      ts.ScriptTarget.ES2015,
      /*setParentNodes */ true
    );
    const componentName = utils.getComponentName(fileName);

    const root = getRoot(sourceFile);
    // For each property

    const propStrings: string[] = [];
    root.properties
      .filter(prop => {
        return prop.kind === ts.SyntaxKind.PropertyAssignment;
      })
      .forEach(prop => {
        const name = prop.name;
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
        let propertyHandled: boolean;
        const types: string[] = [];
        // TODO: collect comments preceeding the property
        prop.getChildren().forEach(val => {
          let localPropertyHandled = true;
          types.push(ts.SyntaxKind[val.kind]);
          // Add typing for the various types of properties
          switch (val.kind) {
            case ts.SyntaxKind.FunctionExpression:
              propStrings.push(
                buildFunctionString(propName, val as ts.FunctionExpression)
              );
              break;
            case ts.SyntaxKind.TypeAssertionExpression:
              propStrings.push(
                buildPropertyString(
                  propName,
                  val,
                  (val as ts.TypeAssertion).type.getText()
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
                buildArrayString(propName, val as ts.ArrayLiteralExpression)
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

    const baseCmp = getBaseComponent(cmpBody);

    return buildTyping(propStrings);

    function buildTyping(props: string[]): string {
      const properties = props.join("\n    ");
      let baseComponent = "";
      if (baseCmp.length > 0) {
        const baseParts = baseCmp.split(":");
        baseComponent = `extends Helper.${baseParts[0].toLowerCase()}.${
          baseParts[1]
        }`;
      }
      return `declare namespace Helper.c {
  interface ${componentName} ${baseComponent} {
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
      const jsDocTags = ts.getJSDocTags(node);
      jsDocTags.forEach(doc => {
        if (doc.tagName.getText() === "type") {
          const dType = doc as ts.JSDocTypeTag;
          returnType = dType.typeExpression.type.getText();
        }
      });
      return `${propName}:${returnType};`;
    }

    function getBaseComponent(cb: string): string {
      let b = "";
      const xml = xmljs.xml2js(cb, { compact: false }) as xmljs.Element;
      let c;
      xml.elements.forEach(ele => {
        if (c === undefined && ele.type !== "comment") {
          c = ele;
        }
      });
      if (
        c !== undefined &&
        c.attributes !== undefined &&
        c.attributes.extends !== undefined
      ) {
        b = c.attributes.extends as string;
      }
      return b;
    }

    function buildFunctionString(
      methodName: string,
      node: ts.FunctionExpression
    ): string {
      const jsDocTags = ts.getJSDocTags(node);
      const tagTypeMap = {};
      let returnType = "any";
      if (jsDocTags != null) {
        jsDocTags.forEach(tag => {
          if (tag.tagName.getText() === "param") {
            const paramTag = tag as ts.JSDocParameterTag;
            if (paramTag.typeExpression) {
              tagTypeMap[
                paramTag.name.getText()
              ] = paramTag.typeExpression.type.getText();
            }
          }
          if (tag.tagName.getText() === "returns") {
            const returnTag = tag as ts.JSDocReturnTag;
            returnType = returnTag.typeExpression.type.getText();
          }
        });
      }
      const params: string[] = [];
      // TODO: throw error if type in JSDoc doesn't match parameter type or if JSDoc lists too many or not enough params
      if (node.type !== undefined) {
        returnType = node.type.getText();
      }

      // Parse the Type Parameters and if needed add them to the output
      let typeParamString = "";
      if (node.typeParameters && node.typeParameters.length > 0) {
        const typeParams = [];
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
          tagTypeMap[param.name.getText()] !== undefined
        ) {
          typeString = `: ${tagTypeMap[param.name.getText()]}`;
        }
        params.push(`${param.getText()}${typeString}`);
      });

      const paramString = params.join(", ");
      const signature = `${methodName}${typeParamString}(${paramString}): ${returnType};`;
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
          return node as ts.ObjectLiteralExpression;
      }

      return ts.forEachChild(node, getRoot);
    }
  }
}
