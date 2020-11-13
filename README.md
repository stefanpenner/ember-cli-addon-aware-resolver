# ember-cli-addon-aware-resolver

Resolve paths within dependent packages, with additional awareness of:

  - ember apps
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


// for an ember app at /some/absolute/path
resolveCliAware('my-ember-app-name/foo', {
  basedir: '/some/absolute/path'
}) // => /some/absolute/path/app/foo



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
  // from basedir
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

## Limitations

- Non-ember npm dependencies are not supported.  It is assumed all resolutions one of:
   - classic ember apps
   - classic ember addons
   - v2 ember addons

- No support for app namespace merging: so files in an addon's `app` directory will not be resolved.  Similarly, `${my-addon}/test-support` will not be resolved as being merged to `${my-app}/tests`.

- No support for path conflict resolution.  This is unlikely to affect anybody, but if you have an Ember app with `my-app/app/tests/foo`, `my-app/tests/foo` will not resolve to this file, but instead only look for `my-app/tests/foo`

- No support for customized `this.treePaths` in addons.

- "main" imports are not supported (i.e. imports without paths)
