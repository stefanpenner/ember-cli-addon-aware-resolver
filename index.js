'use strict';
const resolvePackagePath = require('resolve-package-path');
const { findUpPackagePath } = resolvePackagePath;
const fs = require('fs');
const path = require('path');

const parseIdentifier = require('./parse-identifier');

const AppsCheckedForPathConflict = new Set();

function isAddon(pkg) {
  return pkg.keywords && pkg.keywords.includes('ember-addon');
}

function isEmberApp(pkg) {
  // We make a hard assumption that we're in an Ember app context in which
  // we're only resolving ember-addon dependencies or the app that's being
  // built (for self-references)
  //
  // We could add back support for non-ember {app,addon} dependencies, but it
  // would require either:
  //  1. Updating the API so users pass in additional context; or
  //  2. Implementing a mechanism for identifying an ember app from its
  //      package.json
  return !isAddon(pkg);
}

function isV1Addon(pkg) {
  if (!isAddon(pkg)) {
    return false;
  }

  if (!pkg['ember-addon'] || !pkg['ember-addon'].version) {
    // v1 addons typically don't specify a version
    return true;
  }

  let version = pkg['ember-addon'].version;

  if (typeof version !== 'number' || version < 2) {
    return true;
  }

  return false;
}

function classicAppPath(pkgRoot, importPath, options) {
  if (importPath.startsWith('config/') || importPath.startsWith('tests/')) {
    if (importPath.startsWith('tests/') && !AppsCheckedForPathConflict.has(pkgRoot)) {
      AppsCheckedForPathConflict.add(pkgRoot);
      if (fs.existsSync(`${pkgRoot}/app/tests`)) {
        const console = (options && options.console) || global.console;
        console.warn(
          `The Ember app at "${pkgRoot}" has app/tests; this will not be resolved - import paths beginning with tests/ are assumed to be test modules and not app modules (stefanpenner/ember-cli-addon-resolver#9)`,
        );
      }
    }

    return `${pkgRoot}/${importPath}`;
  }

  return `${pkgRoot}/app/${importPath}`;
}

function classicAddonPath(pkgRoot, importPath) {
  const computedImportPath = importPath ?? 'index.js';
  if (computedImportPath.startsWith('config/')) {
    return `${pkgRoot}/${computedImportPath}`;
  } else if (computedImportPath.startsWith('test-support/')) {
    return `${pkgRoot}/addon-test-support/${computedImportPath.substring(13)}`;
  }
  return `${pkgRoot}/addon/${computedImportPath}`;
}

function resolvePackage(parsed, options) {
  let { pkg: currentPkg, pkgRoot } = options;
  if (currentPkg === undefined) {
    const pkgPath = findUpPackagePath(options.basedir);
    currentPkg = require(pkgPath);
    pkgRoot = path.dirname(pkgPath);
  }

  // check for self-references
  if (currentPkg.name === parsed.package) {
    if (isV1Addon(currentPkg)) {
      return classicAddonPath(pkgRoot, parsed.path);
    } else if (isEmberApp(currentPkg)) {
      return classicAppPath(pkgRoot, parsed.path, options);
    } else {
      // v2 addon, treat as a regular npm module
      return `${pkgRoot}/${parsed.path}`;
    }
  } else if (parsed.package === 'dummy') {
    return classicAppPath(`${pkgRoot}/tests/dummy`, parsed.path, options);
  }

  // check for in-repo addons
  if (currentPkg['ember-addon'] && currentPkg['ember-addon'].paths) {
    for (const addonPath of currentPkg['ember-addon'].paths) {
      const addonRoot = path.resolve(pkgRoot, addonPath);
      const pkg = require(`${addonRoot}/package.json`);
      if (pkg.name === parsed.package) {
        if (isV1Addon(pkg)) {
          return classicAddonPath(addonRoot, parsed.path);
        } else {
          // v2 addon, treat as a regular npm module
          return `${addonRoot}/${parsed.path}`;
        }
      }
    }
  }

  // check for dependencies
  const currentIsAddon = isAddon(currentPkg);

  if (
    !(
      // either the current package depends on ${parsed.package}
      (
        (currentPkg.dependencies && currentPkg.dependencies[parsed.package]) ||
        // or the current package is not an addon and has a dev dep on ${parsed.package}
        (!currentIsAddon &&
          currentPkg.devDependencies &&
          currentPkg.devDependencies[parsed.package])
      )
    )
  ) {
    // no dependency on ${parsed.package}
    return;
  }

  const pkgPath = resolvePackagePath(parsed.package, pkgRoot);
  if (typeof pkgPath !== 'string') {
    // no such package found
    return null;
  }
  const pkg = require(pkgPath);
  const root = path.dirname(pkgPath);

  if (isV1Addon(pkg)) {
    return classicAddonPath(root, parsed.path);
  } else {
    // v2 dependency, treat as a normal npm module
    return `${root}/${parsed.path}`;
  }
}

function resolveIdentifier(identifier, options = {}) {
  const { basedir } = options;
  const parsed = parseIdentifier(identifier);

  if (parsed.path !== null && path.extname(parsed.path) === '') {
    parsed.path = `${parsed.path}.js`;
  }

  if (parsed.package !== null) {
    // #import "@scoped/pacakge"
    // #import "@scoped/package/_path.graphql"
    // #import "package"
    // #import "package/_path.graphql"
    return resolvePackage(parsed, options);
  }

  // #import "../_local.graphql"
  return path.resolve(basedir, parsed.path);
}

/**
 * Determines the full path to an identifier, where identifier is one of
 *  - a package name, e.g. @myorg/foo
 *  - a package name with path e.g. @myorg/foo/bar/baz
 *  - a relative path e.g. ../foo
 *
 *  For packages, resolution is aware of ember-cli-addons and will resolve to
 *  the "addon" path for v1 addons, and not for v2 (i.e. embroider) addons.
 *
 *  In-repo addons have a higher precedence than dependencies.
 *
 *  @param {string} identifier - The name to reoslve
 *  @param {object} options
 *  @param {string} options.basedir - The dirname to resolve relative to: this should be the dirname of the file that is referencing `identifier`
 *  @param {string} [options.pkg] - The package.json to use for determining what identifiers are valid dependencies.  If present, `options.pkgRoot` must also be specified.  If absent, `package.json` will be discovered by searching `options.basedir` by walking up the directory tree.
 *  @param {string} [options.pkgRoot] - The directory that contains the `package.json` file whose contents were passed in as `options.pkg`.  Used as the search location for package dependencies (e.g. the location from which relative entries in `ember-addon.paths` will be resolved).  If present, `options.pkg` must also be specified.  If absent, it will default to the dirname in which `package.json` was discovered when determining the default value for `options.pkg`.
 *  @param {boolean} [options.throwOnMissingFile] - Defaults to true. If false, it returns the computed path even if the file does not exist. 
*/
 module.exports = function resolve(identifier, options = {}) {
  const { basedir, pkg, pkgRoot, throwOnMissingFile = true } = options;
  if (typeof basedir !== 'string') {
    throw new Error('ember-cli-addon-resolver: options.basedir is required');
  }

  if ((typeof pkg !== 'object' || pkg === null) ^ (typeof pkgRoot !== 'string')) {
    throw new Error(
      'ember-cli-addon-resolver: options.pkg and options.pkgRoot must either both be absent or both be present',
    );
  }

  let result = resolveIdentifier(identifier, options);
  if (result === null || (throwOnMissingFile !== false && !fs.existsSync(result))) {
    let err = new Error(`ENOENT: Unable to resolve import ${identifier} from ${options.basedir}`);
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }

  return result;
};

// exported for testing
module.exports._AppsCheckedForPathConflict = AppsCheckedForPathConflict;
