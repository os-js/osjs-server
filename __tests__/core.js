const consola = require('consola');
consola.pauseLogs();

const Core = require('../src/core.js');

describe('Core', () => {
  let core;
  const testEvent = JSON.stringify({
    params: [1, 2, 3],
    name: 'test/jest'
  });

  beforeEach(() => {
    if (!core) {
      return;
    }

    const clients = [{
      terminate: () => {},
      send: jest.fn(),
      _osjs_client: {
        username: 'jest'
      }
    }, {
      terminate: () => {},
      send: jest.fn(),
      _osjs_client: {
        username: 'julenissen'
      }
    }, {
      terminate: () => {},
      send: jest.fn()
    }];

    core.wss.clients = clients;
  });

  test('#constructor', () => {
    core = new Core({
      public: '/tmp',
      development: false,
      port: 0
    }, {
      kill: false,
      argv: ['node', 'jest', '--secret', 'kittens']
    });
  });

  test('#constructor - requires options', () => {
    expect(() => new Core())
      .toThrowError('The public option is required');
  });

  test('.getInstance', () => {
    expect(Core.getInstance())
      .toBeInstanceOf(Core);
  });

  test('#boot', async () => {
    const cb = jest.fn();
    core.on('init', cb);

    await core.boot();
    await core.boot();

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('#broadcast', () => {
    core.broadcast('test/jest', [1, 2, 3]);

    expect(core.wss.clients[0].send).toBeCalledWith(testEvent);
    expect(core.wss.clients[1].send).toBeCalledWith(testEvent);
    expect(core.wss.clients[2].send).not.toBeCalled();
  });

  test('#broadcastAll', () => {
    core.broadcastAll('test/jest', 1, 2, 3);

    expect(core.wss.clients[0].send).toBeCalledWith(testEvent);
    expect(core.wss.clients[1].send).toBeCalledWith(testEvent);
    expect(core.wss.clients[2].send).not.toBeCalled();
  });

  test('#broadcastUser', () => {
    core.broadcastUser('jest', 'test/jest', 1, 2, 3);

    expect(core.wss.clients[0].send).toBeCalledWith(testEvent);
    expect(core.wss.clients[1].send).not.toBeCalled();
    expect(core.wss.clients[2].send).not.toBeCalled();
  });

  test('#destroy', async () => {
    const cb = jest.fn();
    core.on('osjs/core:destroy', cb);
    await core.destroy();
    await core.destroy();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
