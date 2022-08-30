const Core = require('../../src/core.js');
const utils = require('../../src/utils/core.js');
const {Response} = require('jest-express/lib/response');
const {Request} = require('jest-express/lib/request');

describe('Core Utils', () => {
  let request;
  let response;
  let next;
  let core;

  beforeEach(() => {
    request = new Request();
    response = new Response();
    next = jest.fn();
		core = new Core({public: '/tmp'});
  });

  afterEach(() => {
    request.resetMocked();
    response.resetMocked();
  });

  test('isAuthenticated - success on no groups', () => {
    request.session = {user: {groups: []}};
    utils.isAuthenticated(core, [], false)(request, response, next);
    expect(next).toBeCalled();
  });

  test('isAuthenticated - fail on some required group', () => {
    request.session = {user: {groups: ['other']}};
    utils.isAuthenticated(core, ['required'], false)(request, response, next);
    expect(response.status).toBeCalledWith(403);
  });

  test('isAuthenticated - success on some required group', () => {
    request.session = {user: {groups: ['required', 'other']}};
    utils.isAuthenticated(core, ['required'], false)(request, response, next);
    expect(next).toBeCalled();
  });

  test('isAuthenticated - fail on all required group', () => {
    request.session = {user: {groups: ['required1']}};
    utils.isAuthenticated(core, ['required1', 'required2'], true)(request, response, next);
    expect(response.status).toBeCalledWith(403);
  });

  test('isAuthenticated - success on all required group', () => {
    request.session = {user: {groups: ['required1', 'required2']}};
    utils.isAuthenticated(core, ['required1', 'required2'], true)(request, response, next);
    expect(next).toBeCalled();
  });
});
