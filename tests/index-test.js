'use strict';

const { expect } = require('chai');
const Project = require('fixturify-project');
const _resolve = require('../index');
const AppsCheckedForPathConflict = _resolve._AppsCheckedForPathConflict;
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
  const theInRepoAddon = new Project(
    'the-in-repo-addon',
    '0.0.1',
    addon => {
      addon.pkg.keywords = ['ember-addon'];
      addon.files['addon'] = {
        '_person.graphql': `
        fragment Apple on Person {
          other
          person
          fragment
        }`,
      };

      addon.files['addon-test-support'] = {
        '_pear.graphql': `
        fragment Pear on Fruit {
          id
        }`,
      };
    },
    path.join(project.baseDir, 'in-repo-addons'),
  );

  project.pkg['ember-addon'] = {
    configPath: 'ember-config',
    paths: ['./in-repo-addons/the-in-repo-addon', './in-repo-addons/the-v2-in-repo-addon'],
  };

  project.files['app'] = {
    '_my-fragment.graphql': `
    fragment Hello on Greeting {
      hello
    }`,

    tests: {
      helpers: {
        'beet.js': `module.exports = {}`,
        'cabbage.js': `module.exports = {}`,
      },
    },
  };

  project.files['config'] = {
    'environment.js': `module.exports = {}`,
  };

  project.files['tests'] = {
    helpers: {
      'potato.js': `module.exports = {}`,
      'beet.js': `module.exports = {}`,
      'cabbage.js': `module.exports = {}`,
    },
  };

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

    addon.files['config'] = {
      'environment.js': `module.exports = {};`,
    };

    addon.files['addon-test-support'] = {
      '_apple.graphql': `
        fragment Apple on Fruit {
          id
        }`,
    };

    addon.files['tests'] = {
      dummy: {
        app: {
          components: {
            'foo.js': 'export default function() {}',
          },
        },
      },
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

  project.addDependency('dep-no-import-path', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];
    addon.files['addon'] = {
      'index.js': `
          export default doTheThing {}`,
    };
  });

  const projectWithoutConflicts = new Project('my-conflict-free-project', '0.0.1', project => {
    project.files = {
      tests: {
        helpers: {
          'potato.js': 'module.exports = {};',
        },
      },
    };
  });

  beforeEach(function () {
    project.writeSync();
    theInRepoAddon.writeSync();
    theV2InRepoAddon.writeSync(`${project.baseDir}/in-repo-addons/`);

    projectWithoutConflicts.writeSync();
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

  it('resolves dependencies without an import path', function() {
    expect(
      resolve('dep-no-import-path', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, 'node_modules/dep-no-import-path/addon/index.js'));
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

  it('resolves the project name as an implicit dependency', function () {
    // allow app code, e.g. tests, to import ${appName}/path/to/_fragment.graphql
    expect(
      resolve('my-project/_my-fragment.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/app/_my-fragment.graphql'));
  });

  it('resolves the project name as an implicit dependency for config paths', function () {
    // allow app code, e.g. tests, to import ${appName}/path/to/_fragment.graphql
    expect(
      // also testing that we default to having a file extension of `.js`
      resolve('my-project/config/environment', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/config/environment.js'));
  });

  it('resolves the project name as an implicit dependency for test paths', function () {
    // allow app code, e.g. tests, to import ${appName}/path/to/_fragment.graphql
    expect(
      resolve('my-project/tests/helpers/potato.js', {
        basedir: project.baseDir,
      }),
    ).to.eql(path.join(project.baseDir, '/tests/helpers/potato.js'));
  });

  it('resolves addon names as implicit dependencies', function () {
    // allow addons to import their own fragments absolutely
    // in particular, this is helpful for importing public fragments from tests
    // e.g. import ${myAddonName}/path/to/_fragment.graphql
    expect(
      resolve('my-addon/_person.graphql', {
        basedir: myAddon.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/addon/_person.graphql'));
  });

  it('resolves addon names as implicit dependencies for config paths', function () {
    // addons can have config for engines
    expect(
      resolve('my-addon/config/environment', {
        basedir: myAddon.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/config/environment.js'));
  });

  it('resolves addon names as implicit dependencies for test-support paths', function () {
    // allow addons to import their own fragments absolutely
    // in particular, this is helpful for importing public fragments from tests
    // e.g. import ${myAddonName}/path/to/_fragment.graphql
    expect(
      resolve('my-addon/test-support/_apple.graphql', {
        basedir: myAddon.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, '/addon-test-support/_apple.graphql'));
  });

  it('resolves in-repo addon names as implicit dependencies', function () {
    // allow addons to import their own fragments absolutely
    // in particular, this is helpful for importing public fragments from tests
    // e.g. import ${myAddonName}/path/to/_fragment.graphql
    expect(
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: theInRepoAddon.baseDir,
      }),
    ).to.eql(path.join(theInRepoAddon.baseDir, '/addon/_person.graphql'));
  });

  it('resolves in-repo addon names as implicit dependencies for test-support paths', function () {
    // allow addons to import their own fragments absolutely
    // in particular, this is helpful for importing public fragments from tests
    // e.g. import ${myAddonName}/path/to/_fragment.graphql
    expect(
      resolve('the-in-repo-addon/test-support/_pear.graphql', {
        basedir: theInRepoAddon.baseDir,
      }),
    ).to.eql(path.join(theInRepoAddon.baseDir, '/addon-test-support/_pear.graphql'));
  });

  it('warns at most once when resolving tests paths for classic ember apps that have an app/tests dir', function () {
    AppsCheckedForPathConflict.clear();

    const warnings = [];
    const console = {
      warn(msg) {
        warnings.push(msg);
      },
    };
    expect(
      resolve('my-project/tests/helpers/beet.js', {
        basedir: project.baseDir,
        console,
      }),
    ).to.eql(path.join(project.baseDir, '/tests/helpers/beet.js'));

    expect(warnings).to.deep.equal([
      `The Ember app at "${project.baseDir}" has app/tests; this will not be resolved - import paths beginning with tests/ are assumed to be test modules and not app modules (stefanpenner/ember-cli-addon-resolver#9)`,
    ]);

    expect(
      resolve('my-project/tests/helpers/beet.js', {
        basedir: project.baseDir,
        console,
      }),
    ).to.eql(path.join(project.baseDir, '/tests/helpers/beet.js'));
    expect(
      resolve('my-project/tests/helpers/cabbage.js', {
        basedir: project.baseDir,
        console,
      }),
    ).to.eql(path.join(project.baseDir, '/tests/helpers/cabbage.js'));

    // we still have only 1 warning -- we warn only the first time
    expect(warnings).to.deep.equal([
      `The Ember app at "${project.baseDir}" has app/tests; this will not be resolved - import paths beginning with tests/ are assumed to be test modules and not app modules (stefanpenner/ember-cli-addon-resolver#9)`,
    ]);
  });

  it('does not warn when resolving tests paths for classic ember apps that lack an app/tests dir', function () {
    AppsCheckedForPathConflict.clear();

    const warnings = [];
    const console = {
      warn(msg) {
        warnings.push(msg);
      },
    };
    expect(
      resolve('my-conflict-free-project/tests/helpers/potato.js', {
        basedir: projectWithoutConflicts.baseDir,
        console,
      }),
    ).to.eql(path.join(projectWithoutConflicts.baseDir, '/tests/helpers/potato.js'));

    // no warning since this project has no app/tests
    expect(warnings).to.deep.equal([]);
  });

  it('resolves addon dummy app paths', function () {
    expect(
      resolve('dummy/components/foo.js', {
        basedir: myAddon.baseDir,
      }),
    ).to.eql(path.join(myAddon.baseDir, 'tests/dummy/app/components/foo.js'));
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
