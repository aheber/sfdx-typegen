import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as xml2js from "xml2js";
import * as glob from "glob";
import * as mkdirp from "mkdirp";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegenhelper");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx typegen:helper`,
    `$ sfdx typegen:helper --file force-app/**/aura/**/*Helper.ts`,
    `$ sfdx typegen:helper --file force-app/main/default/aura/TestComponent/TestComponentHelper.cmp`
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/aura/**/*Helper.ts"
    }),
    output: flags.string({
      char: "o",
      description: messages.getMessage("outputFlagDescription"),
      required: false,
      default: ".sfdx/typings/aura"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    // TODO: ensure output path exists
    let that = this;

    // Ensure the output directory exists
    mkdirp(this.flags.output, function(err) {
      if (err) console.error(err);
    });
    // Parse a file
    glob(this.flags.file, function(err, files) {
      files.forEach(file => {
        let sourceFile = ts.createSourceFile(
          file,
          fs.readFileSync(file).toString(),
          ts.ScriptTarget.ES2015,
          /*setParentNodes */ true
        );
        // console.log("File:", file);
        let componentName = that.getFilename(file);
        let dirPath = path.parse(file);
        that.buildDTS(componentName, sourceFile).then(dts => {
          // console.log(dts);
          that.writeFile(dirPath.name, dts);
        });
      });
    });
    return null;
  }

  private getFilename(file: string): string {
    let dirPath = path.parse(file);
    let folders = dirPath.dir.split("/");
    return folders[folders.length - 1];
  }

  private writeFile(filename: string, dts: string): void {
    let destFilename = this.flags.output + "/" + filename + ".d.ts";
    // console.log(destFilename);
    fs.writeFile(destFilename, dts, err => {
      // throws an error, you could also catch it here
      if (err) throw err;
    });
  }
  private async buildDTS(
    componentName: string,
    sourceFile: ts.SourceFile
  ): Promise<string> {
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
            propName = (name as ts.Identifier).getFullText();
            break;
          case ts.SyntaxKind.StringLiteral:
            propName = (name as ts.StringLiteral).getFullText();
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
            case ts.SyntaxKind.UndefinedKeyword: // Don't know what this will be {identifier: undefined}
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

    let baseCmp = await getBaseComponent(sourceFile.fileName);

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
    // function buildPropertyString(methodName: string, node: ts.TypeAssertion) {
    //   let typeName = node.type.getText();
    //   let signature = `${methodName}: ${typeName};`;
    //   return signature;
    // }

    async function getBaseComponent(filename: string): Promise<string> {
      return new Promise((resolve, reject) => {
        var parser = new xml2js.Parser();
        let baseCmp = "";
        // read cmp file
        let cmpFilename = filename.replace(/[Hh]elper.[tj]s/, ".cmp");
        fs.readFile(cmpFilename, function(err, data) {
          if (err) {
            // console.error(err);
            resolve(baseCmp);
            return;
          }

          // parse XML
          parser.parseString(data, (err, result) => {
            if (err) {
              console.log(cmpFilename);
              console.error(err);
              reject(err);
              return;
            }
            // check for 'extends' attribute
            if (
              result["aura:component"] != undefined &&
              result["aura:component"].$ != undefined &&
              result["aura:component"].$.extends != undefined
            ) {
              baseCmp = result["aura:component"].$.extends;
              // console.log("Base Component:", baseCmp);
            }
            resolve(baseCmp);
          });
        });
      });
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
      let signature = `${methodName}(${paramString}): ${returnType};`;
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
