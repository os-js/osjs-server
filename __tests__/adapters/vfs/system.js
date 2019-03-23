const osjs = require('osjs');
const path = require('path');
const stream = require('stream');
const systemAdapter = require('../../../src/adapters/vfs/system.js');

describe('VFS System adapter', () => {
  let core;
  let adapter;

  beforeAll(() => osjs().then(c => {
    core = c;
    adapter = systemAdapter(core);
  }));

  afterAll(() => core.destroy());

  const vfs = {
    req: {
      session: {
        user: {
          username: 'jest'
        }
      }
    },
    res: {

    },
    mount: {
      name: 'home',
      root: 'home:/',
      attributes: {
        root: '{vfs}/{username}'
      }
    }
  };

  const request = (name, ...args) => adapter[name](vfs)(...args);

  test('#touch', () => {
    return expect(request('touch', 'home:/test'))
      .resolves
      .toBe(true);
  });

  test('#stat', () => {
    const realPath = path.join(core.configuration.tempPath, 'jest/test');

    return expect(request('stat', 'home:/test'))
      .resolves
      .toMatchObject({
        filename: 'test',
        path: realPath,
        size: 0,
        isFile: true,
        isDirectory: false,
        mime: 'application/octet-stream'
      });
  });

  test('#copy', () => {
    return expect(request('copy', 'home:/test', 'home:/test-copy'))
      .resolves
      .toBe(true);
  });

  test('#rename', () => {
    return expect(request('rename', 'home:/test-copy', 'home:/test-rename'))
      .resolves
      .toBe(true);
  });

  test('#mkdir', () => {
    return expect(request('mkdir', 'home:/test-directory'))
      .resolves
      .toBe(true);
  });

  test('#mkdir - existing directory', () => {
    return expect(request('mkdir', 'home:/test-directory'))
      .rejects
      .toThrowError();
  });

  test('#mkdir - ensure', () => {
    return expect(request('mkdir', 'home:/test-directory', {ensure: true}))
      .resolves
      .toBe(true);
  });

  test('#readfile', () => {
    return expect(request('readfile', 'home:/test'))
      .resolves
      .toBeInstanceOf(stream.Readable);
  });

  test('#writefile', () => {
    const s = new stream.Readable();
    s._read = () => {};
    s.push('jest');
    s.push(null);

    return expect(request('writefile', 'home:/test', s))
      .resolves
      .toBe(true);
  });

  test('#exists - existing file', () => {
    return expect(request('exists', 'home:/test-rename'))
      .resolves
      .toBe(true);
  });

  test('#exists - existing directory', () => {
    return expect(request('exists', 'home:/test-directory'))
      .resolves
      .toBe(true);
  });

  test('#exists - non existing file', () => {
    return expect(request('exists', 'home:/test-copy'))
      .resolves
      .toBe(false);
  });

  test('#search', () => {
    return expect(request('search', 'home:/', '*'))
      .resolves
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'test',
            isFile: true
          }),
          expect.objectContaining({
            filename: 'test-rename',
            isFile: true
          })
        ])
      );
  });

  test('#readdir', () => {
    return expect(request('readdir', 'home:/'))
      .resolves
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'test-directory',
            isDirectory: true
          }),
          expect.objectContaining({
            filename: 'test',
            isFile: true
          }),
          expect.objectContaining({
            filename: 'test-rename',
            isFile: true
          })
        ])
      );
  });

  test('#unlink', () => {
    const files = ['home:/test', 'home:/test-directory', 'home:/test-rename'];

    return Promise.all(files.map(f => {
      return expect(request('unlink', f))
        .resolves
        .toBe(true);
    }));
  });

  test('#unlink', () => {
    return expect(request('unlink', 'home:/test-directory'))
      .resolves
      .toBe(true);
  });

  test('#realpath', () => {
    const realPath = path.join(core.configuration.tempPath, 'jest/test');

    return expect(request('realpath', 'home:/test'))
      .resolves
      .toBe(realPath);
  });
});
