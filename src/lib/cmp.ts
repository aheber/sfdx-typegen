// import * as xml2js from "xml2js";
import * as xmljs from "xml-js";
import * as utils from "./utils";
export default class Component {
  public buildDTS(
    fileName: string,
    body: string,
    apexTypeIndex?: Map<string, boolean>
  ): string {
    utils.setApexIndex(apexTypeIndex);
    let dts;
    const componentName = utils.getComponentName(fileName);

    const xml = xmljs.xml2js(body, { compact: false }) as XmlElement;

    // Give comment elements to the next non-comment element
    // Being used to allow comments to provide rich type information
    this.compressComments(xml);

    dts = this.buildTypeFile(componentName, xml["elements"][0]);
    return dts;
  }

  private buildTypeFile(filename: string, component: any): string {
    const base = utils.getBaseComponent(component);
    const controller = utils.getController(component);
    const attributeString = this.buildAttributeStrings(component);
    const methodString = this.buildMethodStrings(component);
    const eventString = this.buildEventStrings(component);

    // build aura:id find values
    const idData = this.countAuraIds([component.name], component);
    const findComponentString = this.buildFindStrings(idData);

    const generatedtypeFile = `declare namespace Cmp.c {
  interface _${filename} extends Aura.Component {
${attributeString}${methodString}${findComponentString}${eventString}  }

  type ${filename} = _${filename}${base}${controller};
}
`;
    return generatedtypeFile;
  }

  private buildEventStrings(component): string {
    let eventString = "";
    if (component.elements !== undefined) {
      component.elements.forEach(event => {
        if (event.name !== "aura:registerEvent") {
          return;
        }
        eventString += `    getEvent(name: "${
          event.attributes.name
        }"): Aura.Event;\n`;
      });
    }
    return eventString;
  }

  private buildAttributeStrings(component): string {
    // Build attributes
    let attributeString = `    get(key: "v.body"): Aura.Component[];\n`;
    attributeString += `    set(key: "v.body", value: Aura.Component[]): void;\n`;
    const attributes = [];
    if (component.elements === undefined) {
      return attributeString;
    }
    component.elements.forEach(attribute => {
      if (attribute.name !== "aura:attribute") {
        return;
      }
      // Check for apex types
      attribute.attributes.type = utils.translateType(
        attribute.attributes.type
      );
      attributes.push(attribute.attributes);
    });

    attributes.forEach(attribute => {
      attributeString += `    get(key: "v.${attribute.name}"): ${
        attribute.type
      };\n`;
      attributeString += `    set(key: "v.${attribute.name}", value: ${
        attribute.type
      }): void;\n`;
    });
    return attributeString;
  }

  private buildMethodStrings(component): string {
    let methodString = "";
    if (component.elements === undefined) {
      return methodString;
    }
    component.elements.forEach(method => {
      if (method.name !== "aura:method") {
        return;
      }
      const methodTypeOverrides = this.parseTypes(method.comments);
      // throw Error(JSON.stringify(method.comments));
      let typeParams = "";
      if (methodTypeOverrides.type !== undefined) {
        typeParams = "<" + methodTypeOverrides.type + ">";
      }
      if (methodTypeOverrides.returns === undefined) {
        methodTypeOverrides.returns = "any";
      }
      let attribString = "";
      if (method.elements !== undefined) {
        const methodAttribStrings = [];
        method.elements.forEach(attrib => {
          if (attrib.name !== "aura:attribute") {
            return;
          }
          const attributeTypeOverrides = this.parseTypes(attrib.comments);
          if (attributeTypeOverrides.type !== undefined) {
            attrib.attributes.type = attributeTypeOverrides.type;
          } else {
            attrib.attributes.type = utils.translateType(
              attrib.attributes.type
            );
          }
          let required = "?";
          if (attrib.attributes.required === "true") {
            required = "";
          }
          methodAttribStrings.push(
            `${attrib.attributes.name}${required}: ${attrib.attributes.type}`
          );
        });
        attribString = methodAttribStrings.join(", ");
      }
      methodString += `    ${
        method.attributes.name
      }${typeParams}(${attribString}): ${methodTypeOverrides.returns};\n`; // TODO: see if we can figure out the return type
    });
    return methodString;
  }

  private parseTypes(comments: any[]): { [key: string]: string } {
    const typeData = {};
    if (comments === undefined || comments.length === 0) {
      return typeData;
    }
    comments.forEach(element => {
      const typeInfoRaw = element.comment;
      console.log("Comment Body:", typeInfoRaw);
      // read in one character at a time
      let name;
      let type;
      let finishPos;
      for (let i = 0; i < typeInfoRaw.length; i++) {
        switch (typeInfoRaw.charAt(i)) {
          case "@":
            // read until space and capture as type-attribute name
            finishPos = typeInfoRaw.indexOf(" ", i);
            name = typeInfoRaw.substring(i + 1, finishPos);
            i = finishPos - 1; // move the incrementer forward (one shy as it will be increased at the end of the loop)
            break;
          case "{":
            // read until } and map that as the value of the type-attribute
            finishPos = typeInfoRaw.indexOf("}", i);
            type = typeInfoRaw.substring(i + 1, finishPos);
            i = finishPos - 1; // move the incrementer forward (one shy as it will be increased at the end of the loop)
            typeData[name] = type;
            break;
        }
      }
    });

    return typeData;
  }

  private compressComments(element: XmlElement): XmlElement {
    if (element.elements === undefined || element.elements.length === 0) {
      return element;
    }
    let comments = [];
    element.elements.forEach(ele => {
      if (ele.type === "comment") {
        comments.push(ele);
      } else {
        if (comments.length > 0) {
          ele.comments = [...comments];
          comments = [];
        }
        this.compressComments(ele);
      }
    });
    return element;
  }

  private buildFindStrings(idData: IdData): string {
    let findComponentString = "";
    let returnTypes = [];

    Object.keys(idData).forEach(key => {
      returnTypes = [];
      let canReturnUndefined: boolean;
      const keyCounts = {};
      idData[key].forEach(comp => {
        if (keyCounts[comp.tag] === undefined) {
          keyCounts[comp.tag] = 1;
        } else {
          keyCounts[comp.tag]++;
        }
        comp.lineage.forEach(p => {
          const lP = p.toLowerCase();
          if (lP === "aura:iteration") {
            keyCounts[comp.tag]++;
            canReturnUndefined = true;
          }
          if (lP === "aura:if") {
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
        const parts = cKey.split(":");
        if (parts.length === 1) {
          cmpName = "Aura.Component";
        } else {
          cmpName = "Cmp." + parts.join(".");
        }
        returnTypes.push(cmpName);
        if (keyCounts[cKey] > 1) {
          returnTypes.push(cmpName + "[]");
        }
      });

      const rTypes = returnTypes.join(" | ");
      findComponentString += `    find(name: "${key}"): ${rTypes};\n`;
    });

    return findComponentString;
  }

  private countAuraIds(
    parentChain: string[],
    component: xmljs.Element
  ): IdData {
    const that = this;
    const idData: IdData = {};
    if (component === undefined || component == null) {
      return idData;
    }
    const cmpKey = component.name as string;

    // add to IdData
    if (component.attributes !== undefined) {
      Object.keys(component.attributes).forEach(key => {
        if (key.toLowerCase() === "aura:id") {
          const compObj = { lineage: parentChain, tag: cmpKey };
          if (idData[component.attributes[key]] === undefined) {
            idData[component.attributes[key]] = [compObj];
          } else {
            idData[component.attributes[key]].push(compObj);
          }
        }
      });
    }

    if (component.elements === undefined) {
      return idData;
    }
    component.elements.forEach(element => {
      const childIds = that.countAuraIds([...parentChain, cmpKey], element);
      if (childIds === undefined || childIds == null) {
        return;
      }
      // Merge IdData together
      Object.keys(childIds).forEach(k => {
        if (idData[k] === undefined) {
          idData[k] = childIds[k];
        } else {
          idData[k].push(...childIds[k]);
        }
      });
    });
    return idData;
  }
}
type IdData = {
  [auraid: string]: [{ lineage: string[]; tag: string }];
};
interface XmlElement extends xmljs.Element {
  comments: XmlElement[];
  elements: XmlElement[];
}
