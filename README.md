# ember-cli-addon-aware-resolver

Resolve paths within dependent packages, with additional awareness of:

  - ember in-repo addons
  - the pre-embroider (v1) ember addon format


## Installation

```sh
yard add ember-cli-addon-aware-resolver
```

## Usage

```js
const resolveCliAware = require('ember-cli-addon-aware-resolver');

resolveCliAware('../foo', {
  basedir: '/some/absolute/path'
}) // => /some/absolute/foo



// with a v1 ember-addon configured as follows
{
  "ember-addon": {
    paths: ["./lib/my-in-repo-addon"]
  }
}

resolveCliAware('my-in-repo-addon/some/path/in/addon', {
  basedir: '/some/absolute/path'
}) // => /some/absolute/path/lib/my-in-repo-addon/addon/some/path/in/addon


resolveCliAware('my-dependency/some/path', {
  basedir: '/path/to/project/some/nested/path',

  // you can optionally pass pkg and pkgRoot for resolving package dependencies
  // if these are absent, package.json will be found by walking up the tree
  from basedir
  pkg: myAlreadyReadPackageJson,
  pkgRoot: '/path/to/project'
}) // => /some/absolute/foo

try {
  resolveCliAware('non-existant-package', {
    basedir: '/some/absolute/path'
  });
} catch (e) {
  e.code // => "MODULE_NOT_FOUND"
}

```

