'use strict';

const { expect } = require('chai');
const Project = require('fixturify-project');
const resolve = require('../index');
const path = require('path');

const parseIdentifier = require('../parse-identifier');
describe('ember-cli-addon-resolver', function () {
  const project = new Project('my-project', '0.0.1');
  const theInRepoAddon = new Project('the-in-repo-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];
    addon.files['addon'] = {
      '_person.graphql': `
fragment Apple as Person {
  other
  person
  fragment
}`,
    };
  });

  project.pkg['ember-addon'] = {
    configPath: 'ember-config',
    paths: ['./in-repo-addons/the-in-repo-addon'],
  };

  const myAddon = project.addDependency('my-addon', '0.0.1', addon => {
    addon.pkg.keywords = ['ember-addon'];

    addon.files['addon'] = {
      '_person.graphql': `
fragment Apple as Person {
  id
  name
}`,
    };
  });

  beforeEach(function () {
    project.writeSync();
    theInRepoAddon.writeSync(`${project.baseDir}/in-repo-addons/`);
  });

  it('can parse identifiers', function () {
    expect(() => parseIdentifier('')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier(' ')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@a')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@asd/@asdf')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@asd/ asdf')).to.throw(/invalid identifier/);
    expect(() => parseIdentifier('@asd /asdf')).to.throw(/invalid identifier/);

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

  it('supports basic addon resolving', function () {
    const expected = resolve('my-addon/_person.graphql', {
      basedir: project.baseDir,
    });
    expect(expected).to.eql(`${myAddon.baseDir}/addon/_person.graphql`);
  });

  it('returns null if no such package exists but the syntax is valid', function () {
    expect(
      resolve('not-a-real-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    ).to.eql(null);
  });

  it('resolves in-repo addons', function () {
    const expected = path.normalize(
      resolve('the-in-repo-addon/_person.graphql', {
        basedir: project.baseDir,
      }),
    );

    expect(expected).to.eql(
      path.join(project.baseDir, '/in-repo-addons/the-in-repo-addon/addon/_person.graphql'),
    );
  });
  it('resolves in-repo addons over dependencies', function () {});
  it('resolves dependencies over devDependencies', function () {});
});
