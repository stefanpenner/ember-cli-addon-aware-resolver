'use strict';
const resolvePackagePath = require('resolve-package-path');
const { findUpPackagePath } = resolvePackagePath;
const fs = require('fs');
const path = require('path');

const parseIdentifier = require('./parse-identifier');

function isV1Addon(pkg) {
  if (!pkg.keywords || !pkg.keywords.includes('ember-addon')) {
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

function resolvePackage(parsed, options) {
  let { pkg: currentPkg, pkgRoot } = options;
  if (currentPkg === undefined) {
    const pkgPath = findUpPackagePath(options.basedir);
    currentPkg = require(pkgPath);
    pkgRoot = path.dirname(pkgPath);
  }

  if (currentPkg['ember-addon'] && currentPkg['ember-addon'].paths) {
    for (const addonPath of currentPkg['ember-addon'].paths) {
      const addonRoot = path.resolve(pkgRoot, addonPath);
      const pkg = require(`${addonRoot}/package.json`);
      if (pkg.name === parsed.package) {
        if (isV1Addon(pkg)) {
          return `${addonRoot}/addon/${parsed.path}`;
        } else {
          return `${addonRoot}/${parsed.path}`;
        }
      }
    }
  }

  const currentIsAddon = currentPkg.keywords && currentPkg.keywords.includes('ember-addon');

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
    return `${root}/addon/${parsed.path}`;
  } else {
    return `${root}/${parsed.path}`;
  }
}

function resolveIdentifier(identifier, options = {}) {
  const { basedir } = options;
  const parsed = parseIdentifier(identifier);
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
 *  @param {string} [options.pkg] - The package.json to use for determining what identifiers are valid dependencies.  If prsent, `options.pkgRoot` must also be specified.  If absent, `package.json` will be discovered by searching `options.basedir` by walking up the directory tree.
 *  @param {string} [options.pkgRoot] - The directory that contains the `package.json` file whose contents were passed in as `options.pkg`.  Used as the search location for package dependencies (e.g. the location from which relative entries in `ember-addon.paths` will be resolved).  If present, `options.pkg` must also be specified.  If absent, it will default to the dirname in which `package.json` was discovered when determining the default value for `options.pkg`.
 */
module.exports = function resolve(identifier, options = {}) {
  const { basedir, pkg, pkgRoot } = options;
  if (typeof basedir !== 'string') {
    throw new Error('ember-cli-addon-resolver: options.basedir is required');
  }

  if ((typeof pkg !== 'object' || pkg === null) ^ (typeof pkgRoot !== 'string')) {
    throw new Error(
      'ember-cli-addon-resolver: options.pkg and options.pkgRoot must either both be absent or both be present',
    );
  }

  let result = resolveIdentifier(identifier, options);
  if (result === null || !fs.existsSync(result)) {
    let err = new Error(`ENOENT: Unable to resolve import ${identifier} from ${options.basedir}`);
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }

  return result;
};
