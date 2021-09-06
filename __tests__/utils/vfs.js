const {Readable, Stream} = require('stream');
const temp = require('temp');
const utils = require('../../src/utils/vfs.js');

const checkMountpointGroupPermission = (
  userGroups = [],
  mountpointGroups = [],
  strict
) => {
  const check = utils.checkMountpointPermission({
    session: {
      user: {
        groups: userGroups
      }
    }
  }, {}, 'readdir', false, strict);

  const mount = {
    name: 'osjs',
    root: 'osjs:/',
    attributes: {
      readOnly: true,
      groups: mountpointGroups
    }
  };

  return check({mount});
};

describe('VFS Utils', () => {
  afterAll(() => {
    temp.cleanupSync();
  });

  test('getPrefix', () => {
    expect(utils.getPrefix('home:/'))
      .toBe('home');

    expect(utils.getPrefix('home-dir:/'))
      .toBe('home-dir');

    expect(utils.getPrefix('home-dir::/'))
      .toBe('home-dir');
  });

  test('sanitize', () => {
    expect(utils.sanitize('home:/(/)¤HF)¤"NF)(FN)(Fn98....)"'))
      .toBe('home:/(/)¤HF)¤NF)(FN)(Fn98....)');

    expect(utils.sanitize('home-dir:/fooo'))
      .toBe('home-dir:/fooo');
  });

  test('streamFromRequest', () => {
    const stream = new Stream();
    expect(utils.streamFromRequest({
      files: {
        upload: stream
      }
    })).toBe(stream);

    expect(utils.streamFromRequest({
      files: {
        upload: temp.openSync('osjs-jest-file-upload')
      }
    })).toBeInstanceOf(Readable);
  });

  test('validateGroups - flat groups', () => {
    expect(utils.validateGroups([
      'successful',
      'failure'
    ], '', {
      attributes: {
        groups: [
          'successful'
        ]
      }
    })).toBe(true);

    expect(utils.validateGroups([
      'failure'
    ], '', {
      attributes: {
        groups: [
          'successful'
        ]
      }
    })).toBe(false);

    expect(utils.validateGroups([
      'successful'
    ], '', {
      attributes: {
        groups: [
          'successful',
          'successful2'
        ]
      }
    }, false)).toBe(true);
  });

  test('validateGroups - method maps', () => {
    const mount = {
      attributes: {
        groups: [{
          readdir: ['successful']
        }]
      }
    };

    expect(utils.validateGroups([
      'successful'
    ], 'readdir', mount)).toBe(true);

    expect(utils.validateGroups([
      'failure'
    ], 'readdir', mount)).toBe(false);
  });

  test('checkMountpointPermission - readOnly', () => {
    const check = utils.checkMountpointPermission({
      session: {
        user: {
          groups: []
        }
      }
    }, {}, 'writefile', true);

    const mount = {
      name: 'osjs',
      root: 'osjs:/',
      attributes: {
        readOnly: true
      }
    };

    return expect(check({mount}))
      .rejects
      .toThrowError('Mountpoint \'osjs\' is read-only');
  });

  test('checkMountpointPermission - groups', async () => {
    await expect(checkMountpointGroupPermission(
      [],
      ['required']
    ))
      .rejects
      .toThrowError('Permission was denied for \'readdir\' in \'osjs\'');

    await expect(checkMountpointGroupPermission(
      ['missing'],
      ['required']
    ))
      .rejects
      .toThrowError('Permission was denied for \'readdir\' in \'osjs\'');

    await expect(checkMountpointGroupPermission(
      ['required'],
      ['required', 'some-other']
    ))
      .rejects
      .toThrowError('Permission was denied for \'readdir\' in \'osjs\'');

    await expect(checkMountpointGroupPermission(
      ['required'],
      ['required']
    )).resolves.toBe(true);

    await expect(checkMountpointGroupPermission(
      ['required', 'some-other'],
      ['required']
    )).resolves.toBe(true);

    await expect(checkMountpointGroupPermission(
      ['required'],
      ['required', 'some-other'],
      false
    )).resolves.toBe(true);
  });

  test('checkMountpointPermission', () => {
    const check = utils.checkMountpointPermission({
      session: {
        user: {
          groups: []
        }
      }
    }, {}, 'writefile', false);

    const mount = {
      name: 'osjs',
      root: 'osjs:/',
      attributes: {}
    };

    return expect(check({mount}))
      .resolves
      .toBe(true);
  });

  test('parseFields - GET', () => {
    const parser = utils.parseFields();

    return expect(parser({
      url: '/foo/?bar.s=baz&jazz.s=bass',
      method: 'get'
    }))
      .resolves
      .toEqual({
        files: {},
        fields: {
          bar: 'baz',
          jazz: 'bass'
        }
      });
  });

  test('parseFields - POST w/JSON', () => {
    const parser = utils.parseFields();

    return expect(parser({
      url: '/foo/?bar=baz&jazz=bass',
      method: 'post',
      body: {
        bar: 'baz',
        jazz: 'bass'
      },
      headers: {
        'content-type': 'application/json'
      }
    }))
      .resolves
      .toEqual({
        files: {},
        fields: {
          bar: 'baz',
          jazz: 'bass'
        }
      });
  });

  test('parseFields - POST w/Form', () => {
    // TODO
  });

  test('assembleQueryData', () => {
    const result1 = utils.assembleQueryData({
      'a.s': 'b',
      'b.a.s': 'foo',
      'b.b.a.s': 'foo',
      'b.b.b.s': 'foo',
      'b.b.c.s': 'foo',
      'b.b.d.s': 'foo',
      'b.b.e.s': 'foo',
      'c.n': 'null',
      'd.b': 'true',
      'e.i': '1',
      'f.u': 'undefined'
    });

    const result2 = utils.assembleQueryData({
      'a.0.s': 'foo',
      'a.1.s': 'foo',
      'b.0.s': 'foo',
      'b.1.s': 'foo',
      'b.a.s': 'foo',
      'c.a.s': 'foo',
      'c.b.0.s': 'foo',
      'c.b.1.s': 'foo',
      'c.c.0.s': 'foo',
      'c.c.1.s': 'foo',
      'c.c.a.s': 'foo',
    });

    expect(result1).toEqual({
      a: 'b',
      b: {
        a: 'foo',
        b: {
          a: 'foo',
          b: 'foo',
          c: 'foo',
          d: 'foo',
          e: 'foo'
        }
      },
      c: null,
      d: true,
      e: 1,
      f: undefined
    });

    expect(result2).toEqual({
      a: ['foo', 'foo'],
      b:{
        '0': 'foo',
        '1': 'foo',
        'a': 'foo',
      },
      c: {
        a: 'foo',
        b: ['foo', 'foo'],
        c: {
          '0': 'foo',
          '1': 'foo',
          'a': 'foo'
        }
      }
    });
  });
});
