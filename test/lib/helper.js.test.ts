import Helper from "../../src/lib/helper";
import * as assert from "assert";

const helperPosixFilename =
  "/dir1/dir2/dir3/force-app/main/default/aura/TestComponent/TestComponentHelper.js";
const cmpWithoutBase = `<aura:component>
    {!v.body}
</aura:component>
`;
const cmpWithBase = `<aura:component extends="c:TestBaseComp">
    {!v.body}
</aura:component>
`;

describe("typegen:aura:helper javascript", () => {
  let h = new Helper();
  /////////////////////////////////////////////
  describe("helper method", () => {
    const untypedHelper = `({
    /**
     * @param {Cmp.c.TestComponent} cmp
     * @param {Aura.Event} event
     */
    method1: function(cmp,event) {
});
`;
    it("without base component", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        untypedHelper,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    /**
     * @param {Cmp.c.TestComponent} cmp
     * @param {Aura.Event} event
     */
    method1(cmp: Cmp.c.TestComponent, event: Aura.Event): any;
  }
}`
      );
      done();
    });
    it("with base component", done => {
      let output = h.buildDTS(helperPosixFilename, untypedHelper, cmpWithBase);
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent extends Helper.c.TestBaseComp {
    /**
     * @param {Cmp.c.TestComponent} cmp
     * @param {Aura.Event} event
     */
    method1(cmp: Cmp.c.TestComponent, event: Aura.Event): any;
  }
}`
      );
      done();
    });
  });
});
