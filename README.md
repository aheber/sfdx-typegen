# sfdx-typegen

Type generation from SFDX project

[![Version](https://img.shields.io/npm/v/sfdx-typegen.svg)](https://npmjs.org/package/sfdx-typegen)
[![CircleCI](https://circleci.com/gh/aheber/sfdx-typegen/tree/master.svg?style=shield)](https://circleci.com/gh/aheber/sfdx-typegen/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/aheber/sfdx-typegen?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfdx-typegen/branch/master)
[![Codecov](https://codecov.io/gh/aheber/sfdx-typegen/branch/master/graph/badge.svg)](https://codecov.io/gh/aheber/sfdx-typegen)
[![Greenkeeper](https://badges.greenkeeper.io/aheber/sfdx-typegen.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/aheber/sfdx-typegen/badge.svg)](https://snyk.io/test/github/aheber/sfdx-typegen)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-typegen.svg)](https://npmjs.org/package/sfdx-typegen)
[![License](https://img.shields.io/npm/l/sfdx-typegen.svg)](https://github.com/aheber/sfdx-typegen/blob/master/package.json)

<!-- toc -->
* [sfdx-typegen](#sfdx-typegen)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g sfdx-typegen
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
sfdx-typegen/0.3.0 win32-x64 node-v8.11.1
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx <%= command.id %> [-f <string>] [-a <string>] [-o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfdx--commandid---f-string--a-string--o-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfdx <%= command.id %> [-f <string>] [-o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfdx--commandid---f-string--o-string---json---loglevel-tracedebuginfowarnerrorfatal)

## `sfdx <%= command.id %> [-f <string>] [-a <string>] [-o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Generate component types that can be used in your controller and helper files to improve auto-complete and correctness

```
USAGE
  $ sfdx typegen:aura:cmp [-f <string>] [-a <string>] [-o <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal]

OPTIONS
  -a, --apextypespath=apextypespath               [default: types/apex] Path to typing directory that holds compatible
                                                  types for AuraEnabled properties in Apex controllers and classes

  -f, --file=file                                 [default: force-app/**/aura/**/*.cmp] Glob pattern for cmp files

  -o, --output=output                             [default: .sfdx/typings/aura/] Path to typing output directory,
                                                  typically embedded in the project '.sfdx' directory

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx typegen:cmp --file force-app/**/aura/**/*.cmp
  $ sfdx typegen:cmp --file force-app/**/aura/**/*.cmp --apextypespath types/apex
  $ sfdx typegen:cmp --file force-app/main/default/aura/TestComponent/TestComponent.cmp
```

_See code: [lib\commands\typegen\aura\cmp.js](https://github.com/aheber/sfdx-typegen/blob/v0.3.0/lib\commands\typegen\aura\cmp.js)_

## `sfdx <%= command.id %> [-f <string>] [-o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Export types from existing Helper.ts files, should preserve typing information from the functions and properties and export to usable declarations

```
USAGE
  $ sfdx typegen:aura:helper [-f <string>] [-o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -f, --file=file                                 [default: force-app/**/aura/**/*Helper.ts] Glob pattern for helper
                                                  typescript files, [force-app/**/aura/**/*Helper.ts]

  -o, --output=output                             [default: .sfdx/typings/aura] Path to an output destination for
                                                  generated d.ts files

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx typegen:helper
  $ sfdx typegen:helper --file force-app/**/aura/**/*Helper.ts
  $ sfdx typegen:helper --file force-app/main/default/aura/TestComponent/TestComponentHelper.cmp
```

_See code: [lib\commands\typegen\aura\helper.js](https://github.com/aheber/sfdx-typegen/blob/v0.3.0/lib\commands\typegen\aura\helper.js)_
<!-- commandsstop -->
