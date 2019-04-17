import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs";
import * as xml2js from "xml2js";
import * as path from "path";
import * as glob from "glob";
import * as mkdirp from "mkdirp";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegencmp");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx typegen:cmp --file force-app/**/aura/**/*.cmp`,
    `$ sfdx typegen:cmp --file force-app/**/aura/**/*.cmp --apextypespath types/apex`,
    `$ sfdx typegen:cmp --file force-app/main/default/aura/TestComponent/TestComponent.cmp`
  ];

  private apexTypeIndex = {};

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/aura/**/*.cmp"
    }),
    apextypespath: flags.string({
      char: "a",
      description: messages.getMessage("apextypespathFlagDescription"),
      required: false,
      default: "types/apex"
    }),
    output: flags.string({
      char: "o",
      description: messages.getMessage("outputFlagDescription"),
      required: false,
      default: ".sfdx/typings/aura/"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    // console.log("Running from:", process.cwd());
    // Ensure the output directory exists
    mkdirp(this.flags.output, function(err) {
      if (err) console.error(err);
    });
    await this.indexApexTypes();
    let that = this;
    // read and parse XML file
    glob(this.flags.file, function(err, files) {
      if (err) {
        console.error(err);
        return;
      }

      var parser = new xml2js.Parser();
      var fileNames: string[] = [];
      files.forEach(file => {
        let dirPath = path.parse(file);
        let folders = dirPath.dir.split("/");
        let componentName = folders[folders.length - 1];
        fileNames.push(componentName);
        fs.readFile(file, function(err, data) {
          if (err) {
            console.error(err);
          }
          parser.parseString(data, (err, result) => {
            if (err) {
              console.error(err);
            }

            let dirPath = path.parse(file);
            let folders = dirPath.dir.split("/");
            let componentName = folders[folders.length - 1];
            fileNames.push(componentName);

            that.buildTypeFile(
              dirPath.dir,
              componentName,
              result["aura:component"]
            );
          });
        });
      });
    });
    return null;
  }

  private async indexApexTypes() {
    let that = this;
    return new Promise(function(resolve, reject) {
      // console.log("Apex Path:", that.flags.apextypespath + "/*.d.ts");
      glob(that.flags.apextypespath + "/*.d.ts", function(err, files) {
        if (err) {
          reject(err);
        }
        files.forEach(file => {
          let fileparts = path.parse(file);
          that.apexTypeIndex[fileparts.name.split(".")[0]] = true;
        });
        resolve();
      });
    });
  }

  private buildTypeFile(
    folders: string,
    filename: string,
    component: any
  ): void {
    let attributes = [];
    let base = "",
      controller = "";
    if (component.$ != undefined && component.$.extends != undefined) {
      let baseParts = component.$.extends.split(":");
      base = " & Cmp." + baseParts[0].toLowerCase() + "." + baseParts[1];
    }

    if (component.$ != undefined && component.$.controller != undefined) {
      controller = " & Apex." + component.$.controller;
    }

    let attributeString = `    get(key: "v.body"): Aura.Component[];\n`;
    attributeString += `    set(key: "v.body", value: Aura.Component[]): void;\n`;
    if (component["aura:attribute"] != undefined) {
      component["aura:attribute"].forEach(attribute => {
        // Check for apex types
        attribute.$.type = this.translateType(attribute.$.type);
        attributes.push(attribute.$);
      });

      attributes.forEach(attribute => {
        attributeString += `    get(key: "v.${attribute.name}"): ${
          attribute.type
        };\n`;
        attributeString += `    set(key: "v.${attribute.name}", value: ${
          attribute.type
        }): void;\n`;
      });
    }

    let idData = this.countAuraIds(["aura:component"], component);
    let findComponentString = this.buildFindStrings(idData);

    let eventString = "";

    if (component["aura:registerEvent"] != undefined) {
      component["aura:registerEvent"].forEach(event => {
        eventString += `    getEvent(name: "${event.$.name}"): Aura.Event;\n`;
      });
    }

    /*
    <aura:method access="global" name="run" action="{!c.callServer}" description="Invoke action, generally an Apex controller action.">
        <aura:attribute name="action" type="Map" required="true" description="An action to run"/>
        <aura:attribute name="params" type="Map" description="Parameters to be send with the action"/>
        <aura:attribute name="options" type="Boolean" default="false" description="Map of options, see docs."/>
    </aura:method>
    */
    let methodString = "";
    if (component["aura:method"] != undefined) {
      component["aura:method"].forEach(method => {
        let attribString = "";
        if (method["aura:attribute"] != undefined) {
          let methodAttribStrings = [];
          method["aura:attribute"].forEach(attrib => {
            attrib.$.type = this.translateType(attrib.$.type);
            let required = "?";
            if (attrib.$.required == "true") {
              required = "";
            }
            methodAttribStrings.push(
              `${attrib.$.name}${required}: ${attrib.$.type}`
            );
            // console.log(methodAttribStrings);
          });
          attribString = methodAttribStrings.join(", ");
        }
        methodString += `    ${method.$.name}(${attribString});\n`; // TODO: see if we can figure out the return type
      });
    }
    let generatedtypeFile = `declare namespace Cmp.c {
  interface _${filename} extends Aura.Component {
${attributeString}${methodString}${findComponentString}${eventString}  }

  type ${filename} = _${filename}${base}${controller};
}
`;
    // console.log(generatedtypeFile);
    // return;
    let destFilename = this.flags.output + "/" + filename + ".d.ts";
    fs.writeFile(destFilename, generatedtypeFile, err => {
      // throws an error, you could also catch it here
      if (err) throw err;
    });
  }

  private buildFindStrings(idData: IdData): string {
    let findComponentString = "";
    let returnTypes = [];

    Object.keys(idData).forEach(key => {
      returnTypes = [];
      let canReturnUndefined: boolean;
      let keyCounts = {};
      idData[key].forEach(comp => {
        if (keyCounts[comp.tag] == undefined) {
          keyCounts[comp.tag] = 1;
        } else {
          keyCounts[comp.tag]++;
        }
        comp.lineage.forEach(p => {
          let lP = p.toLowerCase();
          if (lP == "aura:iteration") {
            keyCounts[comp.tag]++;
            canReturnUndefined = true;
          }
          if (lP == "aura:if") {
            canReturnUndefined = true;
          }
        });
      });

      // components nested in variable rendering elements might not always be present
      if (canReturnUndefined === true) {
        returnTypes.push("undefined");
      }
      // if there is more than one type of component holding the ID then might return an array of components
      if (Object.keys(keyCounts).length > 1) {
        returnTypes.push("Aura.Component[]");
      }
      Object.keys(keyCounts).forEach(cKey => {
        let cmpName = "";
        let parts = cKey.split(":");
        if (parts.length == 1) {
          cmpName = "Aura.Component";
        } else {
          cmpName = "Cmp." + parts.join(".");
        }
        returnTypes.push(cmpName);
        if (keyCounts[cKey] > 1) {
          returnTypes.push(cmpName + "[]");
        }
      });

      let rTypes = returnTypes.join(" | ");
      findComponentString += `    find(name: "${key}"): ${rTypes};\n`;
    });

    return findComponentString;
  }

  private countAuraIds(parentChain: string[], component: any): IdData {
    let that = this;
    let componentName = parentChain[parentChain.length - 1];
    let idData: IdData = {};
    if (component == undefined || component == null) {
      return idData;
    }
    Object.keys(component).forEach(key => {
      if (key.toLowerCase() == "$") {
        let attributes = component[key];
        Object.keys(attributes).forEach(aKey => {
          if (aKey.toLowerCase() == "aura:id") {
            // add to IdData
            let parents = [...parentChain];
            parents.pop();
            let compObj = { lineage: parents, tag: componentName };
            let aId = attributes[aKey];
            if (idData[aId] == undefined) {
              idData[aId] = [compObj];
            } else {
              idData[aId].push(compObj);
            }
          }
        });
      }
      if (Array.isArray(component[key])) {
        component[key].forEach(cKey => {
          let childIds = that.countAuraIds([...parentChain, key], cKey);
          // Merge IdData together
          Object.keys(childIds).forEach(key => {
            if (idData[key] == undefined) {
              idData[key] = childIds[key];
            } else {
              idData[key].push(...childIds[key]);
            }
          });
        });
      }
    });
    return idData;
  }

  // Used to map Java type info to typescript types
  // Because Aura is not case sensitive the comparison is always done in lower case
  private typeMap = {
    boolean: "boolean",
    date: "string",
    datetime: "number",
    decimal: "number",
    double: "number",
    integer: "number",
    long: "number",
    string: "string",
    list: "Array<any>",
    object: "object",
    set: "Array<any>",
    map: "object",
    id: "string"
  };
  private translateType(type: string): string {
    let isArray = type.indexOf("[]") >= 0;
    type = type.replace("[]", "");
    if (this.typeMap[type.toLowerCase()] != undefined) {
      type = this.typeMap[type.toLowerCase()];
    }
    if (this.apexTypeIndex[type]) {
      type = "Apex." + type;
    }
    if (isArray) {
      type += "[]";
    }
    return type;
  }
}
type IdData = {
  [auraid: string]: [{ lineage: string[]; tag: string }];
};
