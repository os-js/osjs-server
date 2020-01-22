/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2020, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const {Stream} = require('stream');
const {
  mountpointResolver,
  checkMountpointPermission,
  streamFromRequest,
  sanitize,
  parseFields,
  errorCodes
} = require('./utils/vfs');

const respondNumber = result => typeof result === 'number' ? result : -1;
const respondBoolean = result => typeof result === 'boolean' ? result : !!result;
const requestPath = req => ([sanitize(req.fields.path)]);
const requestSearch = req => ([sanitize(req.fields.root), req.fields.pattern]);
const requestCross = req => ([sanitize(req.fields.from), sanitize(req.fields.to)]);
const requestFile = req => ([sanitize(req.fields.path), streamFromRequest(req)]);

/**
 * A "finally" for our chain
 */
const onDone = (req, res) => {
  if (req.files) {
    for (let fieldname in req.files) {
      fs.unlink(req.files[fieldname].path, () => ({}));
    }
  }
};

/**
 * Wraps a vfs adapter request
 */
const wrapper = fn => (req, res, next) => fn(req, res)
  .then(result => {
    if (result instanceof Stream) {
      result.pipe(res);
    } else {
      res.json(result);
    }

    onDone(req, res);
  })
  .catch(error => {
    onDone(req, res);

    next(error);
  });

/**
 * Creates the middleware
 */
const createMiddleware = core => {
  const parse = parseFields(core.config('express'));

  return (req, res, next) => parse(req, res)
    .then(({fields, files}) => {
      req.fields = fields;
      req.files = files;

      next();
    })
    .catch(error => {
      core.logger.warn(error);
      req.fields = {};
      req.files = {};

      next(error);
    });
};

const createOptions = req => {
  const options = req.fields.options;
  if (typeof options === 'string') {
    try {
      return JSON.parse(req.fields.options) || {};
    } catch (e) {
      // Allow to fall through
    }
  }

  return options || {};
};

// Standard request with only a target
const createRequestFactory = findMountpoint => (getter, method, readOnly, respond) => async (req, res) => {
  const options = createOptions(req);
  const args = [...getter(req, res), options];

  const found = await findMountpoint(args[0]);
  if (method === 'search') {
    if (found.mount.attributes && found.mount.attributes.searchable === false) {
      return [];
    }
  }

  const strict = found.mount.attributes.strictGroups !== false;
  await checkMountpointPermission(req, res, method, readOnly, strict)(found);

  const result = await found.adapter[method]({req, res, adapter: found.adapter, mount: found.mount})(...args);

  if (method === 'readfile' && options.download) {
    res.attachment(path.basename(path.basename(result.path)));
  }

  return respond ? respond(result) : result;
};

// Request that has a source and target
const createCrossRequestFactory = findMountpoint => (getter, method, respond) => async (req, res) => {
  const [from, to, options] = [...getter(req, res), createOptions(req)];

  const srcMount = await findMountpoint(from);
  const destMount = await findMountpoint(to);
  const sameAdapter = srcMount.adapter === destMount.adapter;
  const createArgs = t => ({req, res, adapter: t.adapter, mount: t.mount});

  const srcStrict = srcMount.mount.attributes.strictGroups !== false;
  const destStrict = destMount.mount.attributes.strictGroups !== false;
  await checkMountpointPermission(req, res, 'readfile', false, srcStrict)(srcMount);
  await checkMountpointPermission(req, res, 'writefile', true, destStrict)(destMount);

  if (sameAdapter) {
    const result = await srcMount
      .adapter[method](createArgs(srcMount), createArgs(destMount))(from, to, options);

    return !!result;
  }

  // Simulates a copy/move
  const stream = await srcMount.adapter
    .readfile(createArgs(srcMount))(from, options);

  const result = await destMount.adapter
    .writefile(createArgs(destMount))(to, stream, options);

  if (method === 'rename') {
    await srcMount.adapter
      .unlink(createArgs(srcMount))(from, options);
  }

  return !!result;
};

/*
 * VFS Methods
 */
const vfs = core => {
  const findMountpoint = mountpointResolver(core);
  const createRequest = createRequestFactory(findMountpoint);
  const createCrossRequest = createCrossRequestFactory(findMountpoint);

  // Wire up all available VFS events
  return {
    realpath: createRequest(requestPath, 'realpath', false),
    exists: createRequest(requestPath, 'exists', false, respondBoolean),
    stat: createRequest(requestPath, 'stat', false),
    readdir: createRequest(requestPath, 'readdir', false),
    readfile: createRequest(requestPath, 'readfile', false),
    writefile: createRequest(requestFile, 'writefile', true, respondNumber),
    mkdir: createRequest(requestPath, 'mkdir', true, respondBoolean),
    unlink: createRequest(requestPath, 'unlink', true, respondBoolean),
    touch: createRequest(requestPath, 'touch', true, respondBoolean),
    search: createRequest(requestSearch, 'search', true),
    copy: createCrossRequest(requestCross, 'copy'),
    rename: createCrossRequest(requestCross, 'rename')
  };
};

/*
 * Creates a new VFS Express router
 */
module.exports = core => {
  const router = express.Router();
  const methods = vfs(core);
  const middleware = createMiddleware(core);
  const {isAuthenticated} = core.make('osjs/express');
  const vfsGroups = core.config('auth.vfsGroups', []);

  // Middleware first
  router.use(isAuthenticated(vfsGroups));
  router.use(middleware);

  // Then all VFS routes (needs implementation above)
  router.get('/exists', wrapper(methods.exists));
  router.get('/stat', wrapper(methods.stat));
  router.get('/readdir', wrapper(methods.readdir));
  router.get('/readfile', wrapper(methods.readfile));
  router.post('/writefile', wrapper(methods.writefile));
  router.post('/rename', wrapper(methods.rename));
  router.post('/copy', wrapper(methods.copy));
  router.post('/mkdir', wrapper(methods.mkdir));
  router.post('/unlink', wrapper(methods.unlink));
  router.post('/touch', wrapper(methods.touch));
  router.post('/search', wrapper(methods.search));

  // Finally catch promise exceptions
  router.use((error, req, res, next) => {
    // TODO: Better error messages
    const code = typeof error.code === 'number'
      ? error.code
      : (errorCodes[error.code] || 400);

    res.status(code)
      .json({error: error.toString()});
  });

  return {router, methods};
};
