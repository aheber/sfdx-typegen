import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs";
import * as glob from "glob";
import * as mkdirp from "mkdirp";
import Cmp from "../../../lib/cmp";
import * as utils from "../../../lib/utils";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfdx-typegen", "typegencmp");

export default class Generate extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    "$ sfdx typegen:cmp --file force-app/**/aura/**/*.cmp",
    "$ sfdx typegen:cmp --file force-app/**/aura/**/*.cmp --apextypespath types/apex",
    "$ sfdx typegen:cmp --file force-app/main/default/aura/TestComponent/TestComponent.cmp"
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    file: flags.string({
      char: "f",
      description: messages.getMessage("fileFlagDescription"),
      required: false,
      default: "force-app/**/aura/**/*.cmp"
    }),
    apextypespath: flags.string({
      char: "a",
      description: messages.getMessage("apextypespathFlagDescription"),
      required: false,
      default: "types/apex"
    }),
    output: flags.string({
      char: "o",
      description: messages.getMessage("outputFlagDescription"),
      required: false,
      default: ".sfdx/typings/aura/"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    const c = new Cmp();
    const flags = this.flags;
    // Ensure the output directory exists
    mkdirp(this.flags.output, function(err) {
      if (err) console.error(err);
    });
    const apexTypeIndex = utils.getApexIndex(this.flags.apextypespath);
    // read and parse XML file
    glob(this.flags.file, function(err, files) {
      if (err) {
        console.error(err);
        return;
      }
      files.forEach(file => {
        const generatedtypeFile = c.buildDTS(
          file,
          fs.readFileSync(file).toString(),
          apexTypeIndex
        );
        const componentName = utils.getComponentName(file);
        const destFilename = flags.output + "/" + componentName + ".d.ts";
        utils.writeFile(destFilename, generatedtypeFile);
      });
    });

    return null;
  }
}
