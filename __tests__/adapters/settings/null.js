const nullAdapter = require('../../../src/adapters/settings/null.js');
const adapter = nullAdapter();

describe('Settings null adapter', () => {
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

  test('#load', () => {
    return expect(adapter.load())
      .resolves
      .toEqual({});
  });

  test('#save', () => {
    return expect(adapter.save())
      .resolves
      .toBe(true);
  });
});
