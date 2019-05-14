import * as fs from "fs";

export function writeFile(destFilename: string, dts: string): void {
  // console.log(destFilename);
  fs.writeFile(destFilename, dts, err => {
    // throws an error, you could also catch it here
    if (err) throw err;
  });
}
