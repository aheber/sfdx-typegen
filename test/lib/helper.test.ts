import Helper from "../../src/lib/helper";
import * as assert from "assert";

const helperPosixFilename =
  "/dir1/dir2/dir3/force-app/main/default/aura/TestComponent/TestComponentHelper.ts";
const cmpWithoutBase = `<aura:component>
    {!v.body}
</aura:component>
`;
const cmpWithBase = `<aura:component extends="c:TestBaseComp">
    {!v.body}
</aura:component>
`;

describe("typegen:aura:helper", () => {
  let h = new Helper();
  describe("typed helper method", () => {
    const typedHelper = `({
    method1: function(
      this: Helper.c.TestComponent,
      cmp: Cmp.c.TestComponent,
      event: Aura.Event
    ) {
  });
`;

    it("without base component", done => {
      let output = h.buildDTS(helperPosixFilename, typedHelper, cmpWithoutBase);
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    method1(cmp: Cmp.c.TestComponent, event: Aura.Event): any;
  }
}`
      );
      done();
    });
    it("with base component", done => {
      let output = h.buildDTS(helperPosixFilename, typedHelper, cmpWithBase);
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent extends Helper.c.TestBaseComp {
    method1(cmp: Cmp.c.TestComponent, event: Aura.Event): any;
  }
}`
      );
      done();
    });
  });
  /////////////////////////////////////////////
  describe("untyped helper method", () => {
    const untypedHelper = `({
  method1: function(
    cmp,
    event
  ) {
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
    method1(cmp, event): any;
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
    method1(cmp, event): any;
  }
}`
      );
      done();
    });

    // Test typeParameters
    describe("method type parameters", () => {
      it("processes helper with type parameters", done => {
        let output = h.buildDTS(
          helperPosixFilename,
          `({
  method1: function<T,R>(cmp) {
});`,
          cmpWithoutBase
        );
        assert.equal(
          output,
          `declare namespace Helper.c {
  interface TestComponent  {
    method1<T,R>(cmp): any;
  }
}`
        );
        done();
      });
    });
  });

  // Test return type
  describe("method return type", () => {
    it("processes helper with return type", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
  method1: function(cmp):     string {
});`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    method1(cmp): string;
  }
}`
      );
      done();
    });
  });

  // Test typing
  describe("literal attributes", () => {
    it("identifier is a string literal", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
        val: "hello world");`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    val:string;
  }
}`
      );
      done();
    });

    it("identifier is a boolean literal", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
  val: false);`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    val:boolean;
  }
}`
      );
      done();
    });

    it("identifier is a boolean literal", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
val: true);`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    val:boolean;
  }
}`
      );
      done();
    });

    it("identifier is a array literal", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
val: []);`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    val: [];
  }
}`
      );
      done();
    });

    it("identifier is an object literal", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
val: {subval1: 12345, subval2: "hello world"});`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    val:any;
  }
}`
      );
      done();
    });

    it("identifier is an null literal", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
val: null);`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    val:any;
  }
}`
      );
      done();
    });
  });

  describe("comments should be carried forward", () => {
    it("single line comment", done => {
      let output = h.buildDTS(
        helperPosixFilename,
        `({
    // this is a comment
    val: "hello world");`,
        cmpWithoutBase
      );
      assert.equal(
        output,
        `declare namespace Helper.c {
  interface TestComponent  {
    // this is a comment
    val:string;
  }
}`
      );
      done();
    });
  });
});
