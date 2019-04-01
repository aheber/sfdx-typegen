import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as xml2js from "xml2js";
import * as glob from "glob";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegenhelper");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx typegen:helper`,
    `$ sfdx typegen:helper --file force-app/**/aura/*Helper.ts`,
    `$ sfdx typegen:helper --file force-app/main/default/aura/TestComponent/TestComponentHelper.cmp`
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/aura/*Helper.ts"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    let that = this;

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
          that.writeFile(dirPath.dir, dts);
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

  private writeFile(directory: string, dts: string): void {
    let destFilename = directory + "/Helper.d.ts";
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
      .filter(prop => prop.kind == ts.SyntaxKind.PropertyAssignment)
      .forEach(prop => {
        let name = prop.name;
        let propName;
        // Collect property name
        switch (name.kind) {
          case ts.SyntaxKind.Identifier:
            propName = (name as ts.Identifier).getText();
            break;
          case ts.SyntaxKind.StringLiteral:
            propName = (name as ts.StringLiteral).text;
            break;
        }
        // console.log("Property Name:" + propName);
        let propertyHandled: boolean;
        let types: string[] = [];
        // TODO: collect comments preceeding the property
        prop.getChildren().forEach(val => {
          propertyHandled = true;
          types.push(ts.SyntaxKind[val.kind]);
          // Add typing for the various types of properties
          switch (val.kind) {
            case ts.SyntaxKind.FunctionExpression:
              propStrings.push(
                buildFunctionString(propName, <ts.FunctionExpression>val)
              );
              break;
            case ts.SyntaxKind.TypeAssertionExpression:
              propStrings.push(
                buildPropertyString(propName, <ts.TypeAssertion>val)
              );
              break;
            // TODO: maybe type this better later
            case ts.SyntaxKind.ObjectLiteralExpression: // objects {identifier: {something: "value", ...}}, {identifier: {}}
            case ts.SyntaxKind.NullKeyword: // Don't know what this will be {identifier: null}
            case ts.SyntaxKind.UndefinedKeyword: // Don't know what this will be {identifier: undefined}
              propStrings.push(`${propName}:any;`);
              break;
            case ts.SyntaxKind.FirstLiteralToken: // literal numbers {identifier: 100}
              propStrings.push(`${propName}:number;`);
              break;
            case ts.SyntaxKind.FalseKeyword: // raw `false` {identifier: false}
            case ts.SyntaxKind.TrueKeyword: // raw `true` {identifier: true}
              propStrings.push(`${propName}:boolean;`);
              break;
            case ts.SyntaxKind.StringLiteral: // enclosed text `"hello world"` {identifier: "hello world"}
              propStrings.push(`${propName}:string;`);
              break;
            case ts.SyntaxKind.ArrayLiteralExpression:
              propStrings.push(
                buildArrayString(propName, <ts.ArrayLiteralExpression>val)
              );
              break;
            default:
              propertyHandled = false;
          }
        });
        if (propertyHandled === false) {
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
    function buildPropertyString(methodName: string, node: ts.TypeAssertion) {
      let typeName = node.type.getText();
      let signature = `${methodName}: ${typeName};`;
      return signature;
    }

    async function getBaseComponent(filename: string): Promise<string> {
      return new Promise((resolve, reject) => {
        var parser = new xml2js.Parser();
        let baseCmp = "";
        // read cmp file
        let cmpFilename = filename.replace(/[Hh]elper.ts/, ".cmp");
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

    // TODO: try and assertain if this returns, and if so what is the return type
    function buildFunctionString(
      methodName: string,
      node: ts.FunctionExpression
    ): string {
      let params: string[] = [];
      node.parameters.forEach(param => {
        if (node.parameters[0] === param && param.name.getText() === "this") {
          // "this" first argument is a convenience definition only useful inside the function, not needed for the definition
          return;
        }
        params.push(param.getText());
      });

      let paramString = params.join(", ");
      let signature = `${methodName}(${paramString});`;
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
