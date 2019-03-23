const nullAdapter = require('../../../src/adapters/auth/null.js');
const adapter = nullAdapter();

describe('Auth null adapter', () => {
  test('#init', () => {
    return expect(adapter.init())
      .resolves
      .toBe(true);
  });

  test('#destroy', () => {
    return expect(adapter.destroy())
      .resolves
      .toBe(true);
  });

  test('#login', () => {
    return expect(adapter.login({
      body: {
        username: 'jest'
      }
    }))
      .resolves
      .toEqual({
        id: 0,
        username: 'jest'
      });
  });

  test('#logout', () => {
    return expect(adapter.logout())
      .resolves
      .toBe(true);
  });
});
