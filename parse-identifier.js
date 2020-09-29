'use strict';

module.exports = function parseIdentifier(identifier) {
  const matched = identifier.match(
    /^(:?(?<scope>@[a-zA-Z0-9_-]+)\/)?(?<name>[a-zA-Z0-9_-]+)(:?\/(?<path>.*))?$/,
  );

  if (!matched) {
    throw new Error(`[ember-cli-addon-resolver] invalid identifier: '${identifier}'`);
  }
  return {
    package: [matched.groups.scope, matched.groups.name].filter(Boolean).join('/'),
    path: matched.groups.path || null,
  };
};
