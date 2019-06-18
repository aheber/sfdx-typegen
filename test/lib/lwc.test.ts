import * as assert from "assert";
import Lwc from "../../src/lib/lwc";

const lwcPosixFilename =
  "/dir1/dir2/dir3/force-app/main/default/lwc/TestComponent/TestComponentHelper.ts";

function buildResponse(attributes: string) {
  if (attributes.length > 0) {
    attributes = "\n    " + attributes;
  }
  return `declare namespace Cmp.c {
          interface testComponent extends Aura.Component {${attributes}
          }
        }
        `;
}
describe("typegen:aura:lwc", () => {
  const l = new Lwc();
  describe("lwc @api attributes", () => {
    const base = `import { LightningElement, api, track } from "lwc";

    export default class testComponent extends LightningElement {
      @api attribute1;
      @api attribute2;

      @track style;
      @track svgs;

      @api transitionSvg(svgIndex) {}
    }
      `;

    it("two attributes, ignoring @track", done => {
      const output = l.buildDTS(lwcPosixFilename, base);
      assert.equal(
        output,
        buildResponse(`set(key: "v.attribute1", value: any): void;
    set(key: "v.attribute2", value: any): void;`)
      );
      done();
    });
  });
});
