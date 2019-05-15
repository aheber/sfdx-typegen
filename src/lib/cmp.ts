import * as xml2js from "xml2js";
import * as utils from "./utils";

export default class Component {
  buildDTS(
    fileName: string,
    body: string,
    apexTypeIndex?: Map<string, boolean>
  ): string {
    utils.setApexIndex(apexTypeIndex);
    let dts;
    let componentName = utils.getComponentName(fileName);
    new xml2js.Parser().parseString(body, (err, result) => {
      if (err) {
        console.error(err);
      }

      dts = this.buildTypeFile(
        componentName,
        result["aura:component"] // TODO: make this application compatible
      );
    });
    return dts;
  }

  private buildTypeFile(filename: string, component: any): string {
    let base = utils.getBaseComponent(component);
    let controller = utils.getController(component);
    let attributeString = this.buildAttributeStrings(component);
    let methodString = this.buildMethodStrings(component);
    let eventString = this.buildEventStrings(component);

    // build aura:id find values
    let idData = this.countAuraIds(["aura:component"], component);
    let findComponentString = this.buildFindStrings(idData);

    let generatedtypeFile = `declare namespace Cmp.c {
  interface _${filename} extends Aura.Component {
${attributeString}${methodString}${findComponentString}${eventString}  }

  type ${filename} = _${filename}${base}${controller};
}
`;
    return generatedtypeFile;
  }

  private buildEventStrings(component): string {
    let eventString = "";
    if (component["aura:registerEvent"] != undefined) {
      component["aura:registerEvent"].forEach(event => {
        eventString += `    getEvent(name: "${event.$.name}"): Aura.Event;\n`;
      });
    }
    return eventString;
  }

  private buildAttributeStrings(component): string {
    // Build attributes
    let attributeString = `    get(key: "v.body"): Aura.Component[];\n`;
    attributeString += `    set(key: "v.body", value: Aura.Component[]): void;\n`;
    if (component["aura:attribute"] != undefined) {
      let attributes = [];
      component["aura:attribute"].forEach(attribute => {
        // Check for apex types
        attribute.$.type = utils.translateType(attribute.$.type);
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
    return attributeString;
  }

  private buildMethodStrings(component): string {
    let methodString = "";
    if (component["aura:method"] != undefined) {
      component["aura:method"].forEach(method => {
        let attribString = "";
        if (method["aura:attribute"] != undefined) {
          let methodAttribStrings = [];
          method["aura:attribute"].forEach(attrib => {
            attrib.$.type = utils.translateType(attrib.$.type);
            let required = "?";
            if (attrib.$.required == "true") {
              required = "";
            }
            methodAttribStrings.push(
              `${attrib.$.name}${required}: ${attrib.$.type}`
            );
          });
          attribString = methodAttribStrings.join(", ");
        }
        methodString += `    ${method.$.name}(${attribString});\n`; // TODO: see if we can figure out the return type
      });
    }
    return methodString;
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
}
type IdData = {
  [auraid: string]: [{ lineage: string[]; tag: string }];
};
