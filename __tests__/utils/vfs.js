const {Readable, Stream} = require('stream');
const temp = require('temp');
const utils = require('../../src/utils/vfs.js');

describe('VFS Utils', () => {
  afterAll(() => {
    temp.cleanupSync();
  });

  test('getPrefix', () => {
    expect(utils.getPrefix('home:/'))
      .toBe('home');
  });

  test('sanitize', () => {
    expect(utils.sanitize('home:/(/)¤HF)¤"NF)(FN)(Fn98....)"'))
      .toBe('home:/(/)¤HF)¤NF)(FN)(Fn98....)');
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
    const mount = {
      attributes: {
        groups: [
          'successful'
        ]
      }
    };
    expect(utils.validateGroups([
      'successful',
      'failure'
    ], '', mount)).toBe(true);

    expect(utils.validateGroups([
      'failure'
    ], '', mount)).toBe(false);
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

  test('checkMountpointPermission - groups', () => {
    const check = utils.checkMountpointPermission({
      session: {
        user: {
          groups: []
        }
      }
    }, {}, 'readdir', false);

    const mount = {
      name: 'osjs',
      root: 'osjs:/',
      attributes: {
        readOnly: true,
        groups: ['required']
      }
    };

    return expect(check({mount}))
      .rejects
      .toThrowError('Permission was denied for \'readdir\' in \'osjs\'');
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
      url: '/foo/?bar=baz&jazz=bass',
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
});
