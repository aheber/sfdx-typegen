import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import * as mkdirp from "mkdirp";
import Helper from "../../../lib/helper";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegenhelper");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx typegen:helper`,
    `$ sfdx typegen:helper --file force-app/**/aura/**/*Helper.ts`,
    `$ sfdx typegen:helper --file force-app/main/default/aura/TestComponent/TestComponentHelper.cmp`
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/aura/**/*Helper.ts"
    }),
    output: flags.string({
      char: "o",
      description: messages.getMessage("outputFlagDescription"),
      required: false,
      default: ".sfdx/typings/aura"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    let h = new Helper();
    let output = this.flags.output;

    // Ensure the output directory exists
    mkdirp(output, function(err) {
      if (err) console.error(err);
    });
    // Parse a file
    glob(this.flags.file, function(err, files) {
      files.forEach(file => {
        let cmpFilename = file.replace(/[Hh]elper.[tj]s/, ".cmp");
        try {
          fs.accessSync(cmpFilename, fs.constants.R_OK);
        } catch (err) {
          // No cmp file means we have an Appplication component
          cmpFilename = file.replace(/[Hh]elper.[tj]s/, ".app");
        }
        const fileContents = fs.readFileSync(file).toString();
        const cmpContents = fs.readFileSync(cmpFilename).toString();
        let dirPath = path.parse(file);
        const dts = h.buildDTS(file, fileContents, cmpContents);

        utils.writeFile(output + "/" + dirPath.name + ".d.ts", dts);
      });
    });
    return null;
  }
}
