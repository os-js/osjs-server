const osjs = require('osjs');
const Settings = require('../src/settings.js');
const {Response} = require('jest-express/lib/response');
const {Request} = require('jest-express/lib/request');

describe('Settings', () => {
  let core;
  let settings;
  let request;
  let response;

  beforeEach(() => {
    request = new Request();
    response = new Response();
  });

  afterEach(() => {
    request.resetMocked();
    response.resetMocked();
  });

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('#constructor', () => {
    settings = new Settings(core);
  });

  test('#constructor - should fall back to null adapter', () => {
    settings = new Settings(core, {
      adapter: () => {
        throw new Error('Simulated failure');
      }
    });

    expect(settings.adapter)
      .not
      .toBe(null);
  });

  test('#init', () => {
    return expect(settings.init())
      .resolves
      .toBe(true);
  });

  test('#save', async () => {
    await settings.save(request, response);

    expect(response.json).toBeCalledWith(true);
  });

  test('#load', async () => {
    await settings.load(request, response);

    expect(response.json).toBeCalledWith({});
  });

  test('#destroy', async () => {
    await settings.destroy();
    settings = undefined;
  });
});
