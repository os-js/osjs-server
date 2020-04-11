const osjs = require('osjs');
const path = require('path');
const Packages = require('../src/packages.js');

describe('Packages', () => {
  let core;
  let packages;

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('#constructor', () => {
    const discoveredFile = path.resolve(core.configuration.root, 'packages.json');
    const manifestFile = path.resolve(core.configuration.public, 'metadata.json');

    packages = new Packages(core, {
      discoveredFile,
      manifestFile
    });
  });

  test('#init', () => {
    return expect(packages.init())
      .resolves
      .toBe(true);
  });

  test('#handleMessage', () => {
    const params = [{
      pid: 1,
      name: 'JestTest',
      args: {}
    }];

    const ws = {
      send: jest.fn()
    };

    packages.handleMessage(ws, params);

    expect(ws.send).toBeCalledWith(JSON.stringify({
      name: 'osjs/application:socket:message',
      params: [{
        pid: 1,
        args: ['Pong']
      }]
    }));
  });

  test('#destroy', async () => {
    await packages.destroy();
    packages = undefined;
  });
});
