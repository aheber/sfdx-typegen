import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs";
import * as xml2js from "xml2js";
import * as path from "path";
import * as glob from "glob";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegencmp");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx typegen:cmp --file force-app/**/aura/*.cmp`,
    `$ sfdx typegen:cmp --file force-app/**/aura/*.cmp --apextypespath types/apex`,
    `$ sfdx typegen:cmp --file force-app/main/default/aura/TestComponent/TestComponent.cmp`
  ];

  private apexTypeIndex = {};

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/aura/*.cmp"
    }),
    apextypespath: flags.string({
      char: "a",
      description: messages.getMessage("apextypespathFlagDescription"),
      required: false,
      default: "types/apex"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
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
      console.log("Apex Path:", that.flags.apextypespath + "/*.d.ts");
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

    let attributeString = "";
    if (component["aura:attribute"] != undefined) {
      component["aura:attribute"].forEach(attribute => {
        // TODO: Map Aura types to ts types
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

    let findComponentString = "";

    let auraIdCount = this.countAuraIds("aura:component", component);
    // console.log(auraIdCount);
    Object.keys(auraIdCount).forEach(auraId => {
      findComponentString += `    find(name: "${auraId}"): Aura.Component | Aura.Component[] | undefined;\n`;
    });

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
${attributeString}${methodString}${findComponentString}${eventString}}

  type ${filename} = _${filename}${base}${controller};
}
`;
    // console.log(generatedtypeFile);
    // return;
    let destFilename = folders + "/Cmp.d.ts";
    fs.writeFile(destFilename, generatedtypeFile, err => {
      // throws an error, you could also catch it here
      if (err) throw err;
    });
  }

  private countAuraIds(cmpType: string, component: any) {
    let that = this;
    let auraIdCount: { [s: string]: { [s: string]: number } } = {};
    if (component == undefined || component == null) {
      return auraIdCount;
    }
    // console.log("Component:", component);
    // console.log("Keys:", Object.keys(component));
    Object.keys(component).forEach(key => {
      // console.log("CMP:", key);
      if (key.toLowerCase() == "aura:id") {
        // console.log("Aura Id:", component[key]);
        let auraId = component[key];
        that.logAuraId(auraIdCount, cmpType, auraId);
        // console.log(Array.isArray(component[key]));
      }
      if (Array.isArray(component[key])) {
        component[key].forEach(aKey => {
          // console.log("In Array:", aKey);
          let newIdCounts = that.countAuraIds(key, aKey);
          Object.keys(newIdCounts).forEach(auraId => {
            that.logAuraId(auraIdCount, key, auraId);
          });
        });
      } else if (typeof component[key] == "object") {
        // console.log("Running on non-array:", component[key]);
        // console.log("Its keys:", Object.keys(component[key]));
        let newIdCounts = that.countAuraIds(key, component[key]);
        Object.keys(newIdCounts).forEach(auraId => {
          that.logAuraId(auraIdCount, cmpType, auraId);
        });
      }
    });
    // console.log(auraIdCount);
    return auraIdCount;
  }

  private logAuraId(
    auraIdCount: { [s: string]: { [s: string]: number } },
    comp: string,
    key: string
  ) {
    if (auraIdCount[key] == undefined) {
      auraIdCount[key] = {};
    }
    if (auraIdCount[key][comp] == undefined) {
      auraIdCount[key][comp] = 0;
    }
    auraIdCount[key][comp]++;
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
    // console.log("Type:", type, "--isArray", isArray);
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
