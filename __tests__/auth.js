const osjs = require('osjs')
const Auth = require('../src/auth.js')
const { Response } = require('jest-express/lib/response');
const { Request } = require('jest-express/lib/request');

describe('Authentication', () => {
  let core;
  let auth;
  let request;
  let response;

  const profile = {
    id: 0,
    username: 'jest',
    name: 'jest',
    groups: []
  };

  beforeEach(() => {
    request = new Request();
    request.session = {
      save: jest.fn(cb => cb()),
      destroy: jest.fn(cb => cb())
    };

    response = new Response();
  });

  afterEach(() => {
    request.resetMocked();
    response.resetMocked();
  });

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('#constructor', () => {
    auth = new Auth(core);
  });

  test('#init', () => {
    return expect(auth.init())
      .resolves
      .toBe(true);
  });

  test('#login - fail on error', async () => {
    await auth.login(request, response)

    expect(response.status).toBeCalledWith(403);
    expect(response.json).toBeCalledWith({
      error: 'Invalid login'
    });
  });

  test('#login - success', async () => {
    request.setBody({username: 'jest', password: 'jest'})

    await auth.login(request, response)

    expect(request.session.user).toEqual(profile);
    expect(request.session.save).toBeCalled();
    expect(response.json).toBeCalledWith(profile);
  });

  test('#logout', async () => {
    await auth.logout(request, response)

    expect(request.session.destroy).toBeCalled();
    expect(response.json).toBeCalledWith({});
  });

  test('#destroy', () => {
    auth = auth.destroy();
  });
});
