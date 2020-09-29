'use strict';
const resolvePackagePath = require('resolve-package-path');
const fs = require('fs');
const path = require('path');

const parseIdentifier = require('./parse-identifier');
/*
 * resolution precedence TODO: test precedence thoroughly
 *
 * 1. in-repo config
 * 2. dependencies
 * 3. devDependencies
 */
// TODO: all the FS iteration in this function can be improved perf wise
module.exports = function resolve(identifier, options = {}) {
  const { basedir } = options;
  const parsed = parseIdentifier(identifier);
  const current = resolvePackagePath(basedir);

  const currentPkg = JSON.parse(fs.readFileSync(current, 'UTF8'));
  // check if in-repo addon config exists

  if (currentPkg['ember-addon'] && currentPkg['ember-addon'].paths) {
    for (const addonPath of currentPkg['ember-addon'].paths) {
      const addonRoot = path.resolve(path.dirname(current), addonPath);
      // we may need to gracefully fail if this errors since we are just linting
      const pkg = JSON.parse(fs.readFileSync(`${addonRoot}/package.json`, 'utf8'));
      if (pkg.name === parsed.package) {
        // do we bother checking if it is an ember-addon ?
        return `${addonRoot}/addon/${parsed.path}`;
      }
    }
  }

  // test
  if (!currentPkg.dependencies[parsed.package] && !currentPkg.devDependencies[parsed.package]) {
    // no such package possible
    return null;
  }

  const pkgPath = resolvePackagePath(parsed.package, basedir);
  if (typeof pkgPath !== 'string') {
    // no such package found
    return null;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'UTF8'));
  const root = path.dirname(pkgPath);

  // TODO: embroider aware (v2 addon check etc)
  if (pkg.keywords.includes('ember-addon')) {
    return `${root}/addon/${parsed.path}`;
  } else {
    return `${root}/${parsed.path}`;
  }
};
