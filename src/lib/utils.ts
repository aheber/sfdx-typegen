import * as path from "path";

export function getComponentName(file: string): string {
  let dirPath = path.parse(file);
  let folders = dirPath.dir.split("/");
  return folders[folders.length - 1];
}
