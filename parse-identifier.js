'use strict';

const IdentifierRegexp = /^(?:(?<scope>@[^/\s~)('!*]+)\/)?(?<name>[^@/_.\s~)('!*][^@/\s~)('!*]*)?(?:\/?(?<path>[^@\s]+))?$/;

module.exports = function parseIdentifier(identifier) {
  if (identifier === '') {
    throw new Error(`[ember-cli-addon-resolver] invalid identifier: '${identifier}'`);
  }

  const matched = identifier.match(IdentifierRegexp);

  if (!matched) {
    throw new Error(`[ember-cli-addon-resolver] invalid identifier: '${identifier}'`);
  }
  const { scope, name, path } = matched.groups;

  let pathIsRelative = path !== undefined && path.charAt(0) === '.';
  let packageIsPresent = scope !== undefined || name !== undefined;
  if (pathIsRelative && packageIsPresent) {
    throw new Error(`[ember-cli-addon-resolver] invalid identifier: '${identifier}'`);
  }

  const packageParts = [scope, name].filter(Boolean);
  const pkg = packageParts.length > 0 ? packageParts.join('/') : null;

  return {
    package: pkg,
    path: path !== undefined ? path : null,
  };
};

// exported for testing
module.exports._IdentifierRegexp = IdentifierRegexp;
