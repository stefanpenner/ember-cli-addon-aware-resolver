'use strict';

const { expect } = require('chai');
const Project = require('fixturify-project');
const _resolve = require('../index');
const path = require('path');
const fs = require('fs');

function resolve() {
  let result = _resolve(...arguments);
  // normalize path for windows
  return path.normalize(result);
}

const parseIdentifier = require('../parse-identifier');
describe('ember-cli-addon-resolver', function () {
  const project = new Project('my-project', '0.0.1');
  const theInRepoAddon = new Project('the-in-repo-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];
    addon.files['addon'] = {
      '_person.graphql': `
fragment Apple on Person {
  other
  person
  fragment
}`,
    };
  });
  const theV2InRepoAddon = new Project('the-v2-in-repo-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];
    addon.pkg['ember-addon'] = { version: 2 };
    addon.files = {
      '_person.graphql': `
        fragment Apple on Person {
          other
          person
          fragment
        }`,
    };
  });

  const myAddon = project.addDependency('my-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];

    addon.files['addon'] = {
      '_person.graphql': `
        fragment Apple on Person {
          id
          name
        }`,
    };

    addon.addDependency('nested-dep', '0.0.1', nested => {
      nested.pkg.keywords = ['ember-addon'];
      nested.files['addon'] = {
        '_person.graphql': `
          fragment AppleApple on Person {
            likesApples
          }`,
      };
    });

    addon.addDevDependency('nested-dev-dep', '0.0.1', nested => {
      nested.pkg.keywords = ['ember-addon'];
      nested.files['addon'] = {
        '_person.graphql': `
          fragment AppleApple on Person {
            likesApples
          }`,
      };
    });
  });

  const myV2Addon = project.addDependency('my-v2-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];
    addon.pkg['ember-addon'] = { version: 2 };

    addon.files['_person.graphql'] = `
      fragment Apple on Person {
        id
        name
      }`;
  });

  // test to ensure in-repo > dep
  project.addDependency('the-in-repo-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];
    addon.files['addon'] = {
      '_person.graphql': `
fragment Apple on Person {
other
person
fragment
}`,
    };
  });

  beforeEach(function () {
    project.writeSync();
    theInRepoAddon.writeSync(`${project.baseDir}/in-repo-addons/`);
    theV2InRepoAddon.writeSync(`${project.baseDir}/in-repo-addons/`);
  });

  it('can parse identifiers', function () {
    expect(() => parseIdentifier('')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier(' ')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@a')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@asd/@asdf')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@asd/ asdf')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@asd /asdf')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('package/./foo')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('package/../foo')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@scoped/./bar')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@scoped/../bar')).to.throw(/invalid identifier/);

    expect(parseIdentifier('../foo/_bar')).to.eql({
      package: null,
      path: '../foo/_bar',
    });
    expect(parseIdentifier('./foo/_bar')).to.eql({
      package: null,
      path: './foo/_bar',
    });

    expect(parseIdentifier('@a/a')).to.eql({
      package: '@a/a',
      path: null,
    });
    expect(parseIdentifier('@a/a/a')).to.eql({
      package: '@a/a',
      path: 'a',
    });
    expect(parseIdentifier('rsvp')).to.eql({
      package: 'rsvp',
      path: null,
    });

    expect(parseIdentifier('@rsvp/all')).to.eql({
      package: '@rsvp/all',
      path: null,
    });

    expect(parseIdentifier('rsvp/index')).to.eql({
      package: 'rsvp',
      path: 'index',
    });

    expect(parseIdentifier('rsvp/utils/index')).to.eql({
      package: 'rsvp',
      path: 'utils/index',
    });

    expect(parseIdentifier('@rsvp/all/index')).to.eql({
      package: '@rsvp/all',
      path: 'index',
    });
    expect(parseIdentifier('@rsvp/all/utils/index')).to.eql({
      package: '@rsvp/all',
      path: 'utils/index',
    });
  });

  it('throws an exception if the identifier is malformed', function () {
    expect(() => resolve('my addon/_person.graphql', { basedir: project.baseDir })).to.throw(
      /invalid identifier: 'my addon\/_person.graphql'/,
    );
  });

  it('throws if not given a basedir', function () {
    expect(() =>
      resolve('the-in-repo-addon/_person.graphql', {
        pkg: JSON.parse(fs.readFileSync(`${project.baseDir}/package.json`)),
        pkgRoot: project.baseDir,
      }),
    ).to.throw(/basedir is required/);
  });

  it('throws if given pkg without packageRoot, or packageRoot without pkg', function () {
    expect(() =>
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: '/tmp/some/broccoli/path',
        pkg: JSON.parse(fs.readFileSync(`${project.baseDir}/package.json`)),
      }),
    ).to.throw(/options.pkg.*options.pkgRoot/);

    expect(() =>
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: '/tmp/some/broccoli/path',
        pkgRoot: project.baseDir,
      }),
    ).to.throw(/options.pkg.*options.pkgRoot/);
  });

  it('resolves relative paths', function () {
    expect(
      resolve('./in-repo-addons/the-in-repo-addon/addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'));

    expect(
      resolve('../../in-repo-addons/the-in-repo-addon/addon/_person.graphql', {
        basedir: path.join(project.baseDir, '/foo/bar'),
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'));
  });

  it('supports basic v1 addon resolving from a basedir', function () {
    expect(
      resolve('my-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/addon/_person.graphql'));
  });

  it('supports basic v1 addon resolving from a specified pkg, pkgRoot pair', function () {
    expect(
      resolve('my-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/addon/_person.graphql'));
  });

  it('supports basic v2 addon resolving', function () {
    expect(
      resolve('my-v2-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(myV2Addon.baseDir, '/_person.graphql'));
  });

  it('throws MODULE_NOT_FOUND if no such package exists but the syntax is valid', function () {
    try {
      resolve('not-a-real-addon/_person.graphql', {
        basedir: project.baseDir,
      });
      expect.fail('expected an exception');
    } catch (e) {
      expect(e.code).to.equal('MODULE_NOT_FOUND');
      expect(e.message).to.match(/ENOENT.*not-a-real-addon\/_person.graphql/);
    }
  });

  it('resolves in-repo v1 addons from the root', function () {
    expect(
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'));
  });

  it('resolves in-repo v1 addons from a nested path', function () {
    expect(
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: `${project.baseDir}/app/routes`,
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'));
  });

  it('resolves in-repo v1 addons from a pkg, packageRoot pair', function () {
    expect(
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: '/tmp/some/broccoli/path',
        pkg: JSON.parse(fs.readFileSync(`${project.baseDir}/package.json`)),
        pkgRoot: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'));
  });

  it('resolves in-repo v2 addons', function () {
    expect(
      resolve('the-v2-in-repo-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-v2-in-repo-addon/_person.graphql'));
  });

  it('resolves in-repo addons over dependencies', function () {
    // we have a dep installed in node_modules
    expect(
      resolve('./node_modules/the-in-repo-addon/addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/node_modules/the-in-repo-addon/addon/_person.graphql'));

    // but we resolve the in-repo addon
    expect(
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'));
  });

  it('resolves nested dependencies', function () {
    expect(
      resolve('nested-dep/_person.graphql', {
        basedir: myAddon.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/node_modules/nested-dep/addon/_person.graphql'));
  });

  it('does not resolve nested dev dependencies', function () {
    // nested dev dep exists
    expect(
      resolve('./node_modules/nested-dev-dep/addon/_person.graphql', {
        basedir: myAddon.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/node_modules/nested-dev-dep/addon/_person.graphql'));

    // but won't resolve
    expect(() =>
      resolve('nested-dev-dep/_person.graphql', {
        basedir: myAddon.baseDir,
      }),
    ).to.throw(/ENOENT:.*nested-dev-dep/);
  });
});
