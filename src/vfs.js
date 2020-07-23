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

/*
 * Parses the range request headers
 */
const parseRangeHeader = (range, size) => {
  const [pstart, pend] = range.replace(/bytes=/, '').split('-');
  const start = parseInt(pstart, 10);
  const end = pend ? parseInt(pend, 10) : undefined;
  return [start, end];
};

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
  const range = req.headers && req.headers.range;
  const session = {...req.session || {}};
  let result = options || {};

  if (typeof options === 'string') {
    try {
      result = JSON.parse(req.fields.options) || {};
    } catch (e) {
      // Allow to fall through
    }
  }

  if (range) {
    result.range = parseRangeHeader(req.headers.range);
  }

  return {
    ...result,
    session
  };
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

  const {attributes} = found.mount;
  const strict = attributes.strictGroups !== false;
  const ranges = (!attributes.adapter || attributes.adapter === 'system') || attributes.ranges === true;
  const vfsMethodWrapper = m => found.adapter[m]
    ? found.adapter[m](found)(...args)
    : Promise.reject(new Error(`Adapter does not support ${m}`));
  const readstat = () => vfsMethodWrapper('stat').catch(() => ({}));
  await checkMountpointPermission(req, res, method, readOnly, strict)(found);

  const result = await vfsMethodWrapper(method);
  if (method === 'readfile') {
    const stat = await readstat();

    if (ranges && options.range) {
      try {
        if (stat.size) {
          const size = stat.size;
          const [start, end] = options.range;
          const realEnd = end ? end : size - 1;
          const chunksize = (realEnd - start) + 1;

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${realEnd}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': stat.mime
          });
        }
      } catch (e) {
        console.warn('Failed to send a ranged response', e);
      }
    } else if (stat.mime) {
      res.append('Content-Type', stat.mime);
    }

    if (options.download) {
      const filename = path.basename(args[0]);
      res.append('Content-Disposition', `attachment; filename="${filename}"`);
    }
  }

  return respond ? respond(result) : result;
};

// Request that has a source and target
const createCrossRequestFactory = findMountpoint => (getter, method, respond) => async (req, res) => {
  const [from, to, options] = [...getter(req, res), createOptions(req)];

  const srcMount = await findMountpoint(from);
  const destMount = await findMountpoint(to);
  const sameAdapter = srcMount.adapter === destMount.adapter;

  const srcStrict = srcMount.mount.attributes.strictGroups !== false;
  const destStrict = destMount.mount.attributes.strictGroups !== false;
  await checkMountpointPermission(req, res, 'readfile', false, srcStrict)(srcMount);
  await checkMountpointPermission(req, res, 'writefile', true, destStrict)(destMount);

  if (sameAdapter) {
    const result = await srcMount
      .adapter[method](srcMount, destMount)(from, to, options);

    return !!result;
  }

  // Simulates a copy/move
  const stream = await srcMount.adapter
    .readfile(srcMount)(from, options);

  const result = await destMount.adapter
    .writefile(destMount)(to, stream, options);

  if (method === 'rename') {
    await srcMount.adapter
      .unlink(srcMount)(from, options);
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
    search: createRequest(requestSearch, 'search', false),
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
  const logEnabled = core.config('development');

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

    if (logEnabled) {
      console.error(error);
    }

    res.status(code)
      .json({
        error: error.toString(),
        stack: logEnabled ? error.stack : undefined
      });
  });

  return {router, methods};
};
