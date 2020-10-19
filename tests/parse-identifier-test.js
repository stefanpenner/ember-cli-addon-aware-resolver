const { expect } = require('chai');
const { _IdentifierRegexp: IdentifierRegexp } = require('../parse-identifier');

describe('parse-identifier', function () {
  describe('IdentifierRegexp', function () {
    it('matches scoped', function () {
      expect(IdentifierRegexp.test(' ')).to.equal(false);
      expect(IdentifierRegexp.test('@')).to.equal(false);
      expect(IdentifierRegexp.test('@foo')).to.equal(false);
      expect(IdentifierRegexp.test('@foo/@bar')).to.equal(false);
      expect(IdentifierRegexp.test(' @foo/bar')).equal(false);
      expect(IdentifierRegexp.test('@foo/bar ')).to.equal(false);
      expect(IdentifierRegexp.test(' @foo/bar ')).to.equal(false);
      expect(IdentifierRegexp.exec('@foo/bar').groups).to.deep.equal({
        scope: '@foo',
        name: 'bar',
        path: undefined,
      });
      expect(IdentifierRegexp.exec('@foo/bar/baz').groups).to.deep.equal({
        scope: '@foo',
        name: 'bar',
        path: 'baz',
      });
      expect(IdentifierRegexp.exec('@foo/bar.bar/baz/baz/baz').groups).to.deep.equal({
        scope: '@foo',
        name: 'bar.bar',
        path: 'baz/baz/baz',
      });
    });

    it('matches unscoped', function () {
      expect(IdentifierRegexp.test(' ')).to.equal(false);
      expect(IdentifierRegexp.test(' foo')).equal(false);
      expect(IdentifierRegexp.test('foo ')).to.equal(false);
      expect(IdentifierRegexp.test(' foo ')).to.equal(false);
      expect(IdentifierRegexp.test(' foo/bar')).equal(false);
      expect(IdentifierRegexp.test('foo/bar ')).to.equal(false);
      expect(IdentifierRegexp.test(' foo/bar ')).to.equal(false);
      expect(IdentifierRegexp.exec('foo').groups).to.deep.equal({
        scope: undefined,
        name: 'foo',
        path: undefined,
      });
      expect(IdentifierRegexp.exec('foo/bar').groups).to.deep.equal({
        scope: undefined,
        name: 'foo',
        path: 'bar',
      });
      expect(IdentifierRegexp.exec('foo/bar/baz').groups).to.deep.equal({
        scope: undefined,
        name: 'foo',
        path: 'bar/baz',
      });
      expect(IdentifierRegexp.exec('foo.foo/bar.bar/baz/baz/baz').groups).to.deep.equal({
        scope: undefined,
        name: 'foo.foo',
        path: 'bar.bar/baz/baz/baz',
      });
    });

    it('matches some false positives', function () {
      // these will match the regexp and need to be checked in a second pass
      expect(IdentifierRegexp.exec('').groups).to.deep.equal({
        scope: undefined,
        name: undefined,
        path: undefined,
      });
      expect(IdentifierRegexp.exec('@foo/./bar').groups).to.deep.equal({
        scope: '@foo',
        name: undefined,
        path: './bar',
      });
      expect(IdentifierRegexp.exec('@foo/../bar').groups).to.deep.equal({
        scope: '@foo',
        name: undefined,
        path: '../bar',
      });
      expect(IdentifierRegexp.exec('foo/./bar').groups).to.deep.equal({
        scope: undefined,
        name: 'foo',
        path: './bar',
      });
      expect(IdentifierRegexp.exec('foo/../bar').groups).to.deep.equal({
        scope: undefined,
        name: 'foo',
        path: '../bar',
      });
    });

    it('matches relative', function () {
      expect(IdentifierRegexp.exec('../foo').groups).to.deep.equal({
        scope: undefined,
        name: undefined,
        path: '../foo',
      });
      expect(IdentifierRegexp.exec('../foo.bar/_baz').groups).to.deep.equal({
        scope: undefined,
        name: undefined,
        path: '../foo.bar/_baz',
      });
    });
  });
});
