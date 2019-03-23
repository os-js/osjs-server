const osjs = require('osjs')
const fsAdapter = require('../../../src/adapters/settings/fs.js');

describe('settings fs adapter', () => {
  let core;
  let adapter;

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('should create new instance', () => {
    adapter = fsAdapter(core);
  });

  test('#save', () => {
    return expect(adapter.save({
      body: {},
      session: {
        user: {
          username: 'jest'
        }
      }
    }))
      .resolves
      .toBe(true);
  });

  test('#load', () => {
    return expect(adapter.load({
      session: {
        user: {
          username: 'jest'
        }
      }
    }))
      .resolves
      .toEqual({});
  });
});
