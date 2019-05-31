import Helper from "../../src/lib/cmp";
import * as assert from "assert";

const posixFilename =
  "/dir1/dir2/dir3/force-app/main/default/aura/TestComponent/TestComponent.cmp";
function buildResponse(attributes: string, extensions?: string) {
  if (extensions == undefined) {
    extensions = "";
  }
  if (attributes.length > 0) {
    attributes = "\n    " + attributes;
  }
  return `declare namespace Cmp.c {
  interface _TestComponent extends Aura.Component {
    get(key: "v.body"): Aura.Component[];
    set(key: "v.body", value: Aura.Component[]): void;${attributes}
  }

  type TestComponent = _TestComponent${extensions};
}
`;
}

describe("typegen:aura:cmp", () => {
  let h = new Helper();
  /////////////////////////////////////////////
  /* Tests TODO
    // TODO: component with complex type overrides for attribute and methods params
    // TODO: Application instead of component
  */
  describe("component top-level attributes", () => {
    it("without controller or base", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component></aura:component>`
      );
      assert.equal(output, buildResponse("", ""));
      done();
    });

    it("with controller", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component controller="Ctrl"></aura:component>`
      );
      assert.equal(output, buildResponse("", " & Apex.Ctrl"));
      done();
    });

    it("with base", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component extends="c:BaseCmp"></aura:component>`
      );
      assert.equal(output, buildResponse("", " & Cmp.c.BaseCmp"));
      done();
    });

    it("with controller and base", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component extends="c:BaseCmp" controller="Ctrl"></aura:component>`
      );
      assert.equal(output, buildResponse("", " & Cmp.c.BaseCmp & Apex.Ctrl"));
      done();
    });
  });

  describe("component attributes", () => {
    it("string", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="string"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): string;
    set(key: "v.attr", value: string): void;`)
      );
      done();
    });

    it("boolean", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Boolean"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): boolean;
    set(key: "v.attr", value: boolean): void;`)
      );
      done();
    });

    it("integer", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Integer"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): number;
    set(key: "v.attr", value: number): void;`)
      );
      done();
    });

    it("decimal", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Decimal"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): number;
    set(key: "v.attr", value: number): void;`)
      );
      done();
    });

    it("double", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Double"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): number;
    set(key: "v.attr", value: number): void;`)
      );
      done();
    });

    it("date", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Date"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): string;
    set(key: "v.attr", value: string): void;`)
      );
      done();
    });

    it("datetime", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Datetime"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): number;
    set(key: "v.attr", value: number): void;`)
      );
      done();
    });

    it("long", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Long"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): number;
    set(key: "v.attr", value: number): void;`)
      );
      done();
    });

    it("list", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="List"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): Array<any>;
    set(key: "v.attr", value: Array<any>): void;`)
      );
      done();
    });

    it("set", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Set"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): Array<any>;
    set(key: "v.attr", value: Array<any>): void;`)
      );
      done();
    });

    it("map", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Map"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): {[key: string]: any};
    set(key: "v.attr", value: {[key: string]: any}): void;`)
      );
      done();
    });

    it("id", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="Id"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): string;
    set(key: "v.attr", value: string): void;`)
      );
      done();
    });

    it("string array", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="String[]"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): string[];
    set(key: "v.attr", value: string[]): void;`)
      );
      done();
    });
  });

  describe("Apex attributes", () => {
    it("Single Apex Attribute", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:attribute name="attr" type="ApexWrapper"/>
</aura:component>`,
        new Map([["ApexWrapper", true]])
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): Apex.ApexWrapper;
    set(key: "v.attr", value: Apex.ApexWrapper): void;`)
      );
      done();
    });

    it("Non-Indexed Apex Attribute", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
      <aura:attribute name="attr" type="ApexWrapper"/>
  </aura:component>`,
        new Map()
      );
      assert.equal(
        output,
        buildResponse(`get(key: "v.attr"): ApexWrapper;
    set(key: "v.attr", value: ApexWrapper): void;`)
      );
      done();
    });
  });

  describe("Events", () => {
    it("Registered Event", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:registerEvent name="CustomEvent" type="c:MyEventType" />
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse('getEvent(name: "CustomEvent"): Aura.Event;')
      );
      done();
    });

    it("Registered Event", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:registerEvent name="CustomEvent" type="c:MyEventType" />
    <aura:registerEvent name="CustomEvent2" type="c:MyEventType2" />
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(`getEvent(name: "CustomEvent"): Aura.Event;
    getEvent(name: "CustomEvent2"): Aura.Event;`)
      );
      done();
    });
  });

  describe("Aura Ids", () => {
    it("Custom Component", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <c:Custom_Component aura:id="testId1"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse('find(name: "testId1"): Cmp.c.Custom_Component;')
      );
      done();
    });

    it("Two Identical Custom Components", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <c:Custom_Component aura:id="testId1"/>
    <c:Custom_Component aura:id="testId1"/>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(
          'find(name: "testId1"): Cmp.c.Custom_Component | Cmp.c.Custom_Component[];'
        )
      );
      done();
    });

    // Two different custom components
    it("Two Different Custom Components", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
      <c:Custom_Component aura:id="testId1"/>
      <c:Custom_Component2 aura:id="testId1"/>
  </aura:component>`
      );
      assert.equal(
        output,
        buildResponse(
          'find(name: "testId1"): Aura.Component[] | Cmp.c.Custom_Component | Cmp.c.Custom_Component2;'
        )
      );
      done();
    });

    // standard HTML element
    it("Standard HTML element", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
      <div aura:id="testId1"/>
  </aura:component>`
      );
      assert.equal(
        output,
        buildResponse('find(name: "testId1"): Aura.Component;')
      );
      done();
    });

    // Platform Component
    it("Components without the 'c' namespace", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
      <force:TestComponent aura:id="testId1"/>
  </aura:component>`
      );
      assert.equal(
        output,
        buildResponse('find(name: "testId1"): Cmp.force.TestComponent;')
      );
      done();
    });

    // Component in aura:if
    it("Conditionally rendered component", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:if>
      <force:TestComponent aura:id="testId1"/>
    </aura:if>
  </aura:component>`
      );
      assert.equal(
        output,
        buildResponse(
          'find(name: "testId1"): undefined | Cmp.force.TestComponent;'
        )
      );
      done();
    });

    // Component in aura:iteration
    it("Possible multiple rendered components with same id", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
    <aura:iteration>
      <force:TestComponent aura:id="testId1"/>
    </aura:iteration>
  </aura:component>`
      );
      assert.equal(
        output,
        buildResponse(
          'find(name: "testId1"): undefined | Cmp.force.TestComponent | Cmp.force.TestComponent[];'
        )
      );
      done();
    });
  });

  describe("Aura Method", () => {
    it("standard attribute types", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
        <aura:method
        access="global"
        name="run"
        action="{!c.callServer}"
        description="Invoke action, generally an Apex controller action."
      >
        <aura:attribute
          name="action"
          type="Map"
          required="true"
          description="An action to run"
        />
        <aura:attribute
          name="params"
          type="Map"
          description="Parameters to be send with the action"
        />
        <aura:attribute
          name="options"
          type="Map"
          description="Map of options, see docs."
        />
      </aura:method>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(
          "run(action: {[key: string]: any}, params?: {[key: string]: any}, options?: {[key: string]: any}): any;"
        )
      );
      done();
    });

    it("override attribute types", done => {
      let output = h.buildDTS(
        posixFilename,
        `<aura:component>
        <!--
          @type {T,R}
          @returns {Promise<R>}
        -->
        <aura:method
        access="global"
        name="run"
        action="{!c.callServer}"
        description="Invoke action, generally an Apex controller action."
      >
        <!-- @type {Aura.Action<T,R>} -->
        <aura:attribute
          name="action"
          type="Map"
          required="true"
          description="An action to run"
        />
        <!-- @type {T} -->
        <aura:attribute
          name="params"
          type="Map"
          description="Parameters to be send with the action"
        />
        <!-- @type {SVC_ServerHelper_Options<R>} -->
        <aura:attribute
          name="options"
          type="Map"
          description="Map of options, see docs."
        />
      </aura:method>
</aura:component>`
      );
      assert.equal(
        output,
        buildResponse(
          "run<T, R>(action: Aura.Action<T, R>, params?: T, options?: SVC_ServerHelper_Options<R>): Promise<R>;"
        )
      );
      done();
    });
  });
});
