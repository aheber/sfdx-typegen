import * as ts from "typescript";
// import * as utils from "./utils";

export default class Helper {
  public buildDTS(fileName: string, body: string): string {
    const sourceFile = ts.createSourceFile(
      fileName,
      body,
      ts.ScriptTarget.ES2015,
      /*setParentNodes */ false
    );
    // const componentName = utils.getComponentName(fileName);

    const apiEnabledProperties = {} as { [key: string]: ts.Node };
    const apiEnabledMethods = {} as { [key: string]: ts.Node };
    // For each property
    sourceFile.statements.forEach(s => {
      //   console.log("Kind:", ts.SyntaxKind[s.kind]);
      if (s.kind === ts.SyntaxKind.ClassDeclaration) {
        const c = s as ts.ClassDeclaration;
        c.members.forEach(m => {
          //   console.log("Member Kinds:", ts.SyntaxKind[m.kind]);
          if (m.decorators !== undefined && m.decorators.length > 0) {
            m.decorators.forEach(d => {
              let i = d.expression as ts.Identifier;
              //   console.log(i.text);
              let n = m.name as ts.Identifier;
              //   console.log(n.text);
              if (i.text === "api") {
                if (ts.isPropertyDeclaration(m)) {
                  apiEnabledProperties[n.text] = m;
                } else if (ts.isMethodDeclaration(m)) {
                  apiEnabledMethods[n.text] = m;
                }
              }
            });
          }
        });
      }
    });
    throw Error(JSON.stringify(apiEnabledMethods));
  }
}
