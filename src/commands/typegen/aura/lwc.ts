import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs";
import * as glob from "glob";
import * as mkdirp from "mkdirp";
import * as path from "path";
import Lwc from "../../../lib/lwc";
import * as utils from "../../../lib/utils";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegenauralwc");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx typegen:aura:lwc`,
    `$ sfdx typegen:aura:lwc --file force-app/**/lwc/**/*.js`,
    `$ sfdx typegen:aura:lwc --file force-app/main/default/lwc/testComponent/testComponent.js`
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/lwc/**/*.js"
    }),
    output: flags.string({
      char: "o",
      description: messages.getMessage("outputFlagDescription"),
      required: false,
      default: ".sfdx/typings/aura/lwc"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    const lwc = new Lwc();
    const output = this.flags.output;

    // Ensure the output directory exists
    mkdirp(output, err => {
      if (err) console.error(err);
    });
    // Parse a file
    glob(this.flags.file, (err, files) => {
      files.forEach(file => {
        const fileContents = fs.readFileSync(file).toString();
        const dirPath = path.parse(file);
        const dts = lwc.buildDTS(file, fileContents);

        utils.writeFile(output + "/" + dirPath.name + ".d.ts", dts);
      });
    });
    return null;
  }
}
