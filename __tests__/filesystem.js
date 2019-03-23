const osjs = require('osjs');
const path = require('path');
const Filesystem = require('../src/filesystem.js');
const {Response} = require('jest-express/lib/response');
const {Request} = require('jest-express/lib/request');

describe('Filesystem', () => {
  let core;
  let filesystem;
  let mountpoint;

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('#constructor', () => {
    filesystem = new Filesystem(core);
  });

  test('#init', () => {
    return expect(filesystem.init())
      .resolves
      .toBe(true);
  });

  test('#mime', () => {
    expect(filesystem.mime('text file.txt'))
      .toBe('text/plain');

    expect(filesystem.mime('hypertext file.html'))
      .toBe('text/html');

    expect(filesystem.mime('image file.png'))
      .toBe('image/png');

    expect(filesystem.mime('unknown file.666'))
      .toBe('application/octet-stream');

    expect(filesystem.mime('defined file'))
      .toBe('test/jest');
  });

  test('#mount', () => {
    mountpoint = filesystem.mount({
      name: 'jest',
      attributes: {
        watch: true,
        root: '/tmp'
      }
    });

    expect(mountpoint).toMatchObject({
      root: 'jest:/',
      attributes: {
        watch: true,
        root: '/tmp'
      }
    });
  });

  test('#realpath', () => {
    const realPath = path.join(core.configuration.tempPath, 'jest/test');

    return expect(filesystem.realpath('home:/test', {
      username: 'jest'
    }))
      .resolves
      .toBe(realPath);
  });

  test('#request', async () => {
    const response = new Response();
    const request = new Request();

    request.session = {
      user: {
        username: 'jest'
      }
    };

    request.fields = {
      path: 'home:/test'
    };

    const result = await filesystem.request('exists', request, response)

    expect(result).toBe(false);
  });

  test('#unmount', () => {
    expect(filesystem.unmount(mountpoint))
      .toBe(true);
  });

  test('#unmount - test fail', () => {
    expect(filesystem.unmount({}))
      .toBe(false);
  });

  test('#destroy', () => {
    filesystem = filesystem.destroy();
  });
});
