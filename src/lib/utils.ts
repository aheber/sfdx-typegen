import * as fs from "fs";
import * as glob from "glob";
import * as path from "path";

export function writeFile(destFilename: string, dts: string): void {
  // console.log(destFilename);
  fs.writeFile(destFilename, dts, err => {
    // throws an error, you could also catch it here
    if (err) throw err;
  });
}

export function getComponentName(file: string): string {
  const dirPath = path.parse(file);
  const folders = dirPath.dir.split("/");
  return folders[folders.length - 1];
}

let apexTypeIndex;
export function setApexIndex(newApexTypeIndex: Map<string, boolean>) {
  if (newApexTypeIndex === undefined) {
    newApexTypeIndex = new Map();
  } else {
    apexTypeIndex = newApexTypeIndex;
  }
}
export function getApexIndex(apexTypesPath: string): Map<string, boolean> {
  if (apexTypeIndex !== undefined) {
    return apexTypeIndex;
  }
  apexTypeIndex = new Map();
  const p = new Promise(function(resolve, reject) {
    glob(apexTypesPath + "/*.d.ts", function(err, files) {
      if (err) {
        reject(err);
      }
      files.forEach(file => {
        const fileparts = path.parse(file);
        apexTypeIndex.set(fileparts.name.split(".")[0], true);
      });
      resolve();
    });
  });
  p.then(() => {
    return apexTypeIndex;
  });
}

export function getBaseComponent(component): string {
  let base = "";
  if (
    component.attributes !== undefined &&
    component.attributes.extends !== undefined
  ) {
    const baseParts = component.attributes.extends.split(":");
    base = " & Cmp." + baseParts[0].toLowerCase() + "." + baseParts[1];
  }
  return base;
}

export function getController(component): string {
  let controller = "";
  // get controller
  if (
    component.attributes !== undefined &&
    component.attributes.controller !== undefined
  ) {
    controller = " & Apex." + component.attributes.controller;
  }
  return controller;
}

// Used to map Java type info to typescript types
// Because Aura is not case sensitive the comparison is always done in lower case
const auraTypeMap = {
  boolean: "boolean",
  date: "string",
  datetime: "number",
  decimal: "number",
  double: "number",
  integer: "number",
  long: "number",
  string: "string",
  list: "Array<any>",
  object: "{[key: string]: any}",
  set: "Set<any>",
  map: "{[key: string]: any}",
  id: "string"
};
export function translateType(type: string): string {
  const isArray = type.indexOf("[]") >= 0;
  type = type.replace("[]", "");
  if (auraTypeMap[type.toLowerCase()] !== undefined) {
    type = auraTypeMap[type.toLowerCase()];
  }
  if (apexTypeIndex !== undefined && apexTypeIndex.has(type)) {
    type = "Apex." + type;
  }
  if (isArray) {
    type += "[]";
  }
  return type;
}
