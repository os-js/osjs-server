const osjs = require('osjs');
const Packages = require('../src/settings.js');

describe('Packages', () => {
  let core;
  let packages;

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('#constructor', () => {
    packages = new Packages(core);
  });

  test('#init', () => {
    return expect(packages.init())
      .resolves
      .toBe(true);
  });

  test('#destroy', () => {
    packages = packages.destroy();
  });
});
