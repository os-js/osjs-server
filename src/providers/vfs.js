/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
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

const vfs = require('../vfs/system');
const fs = require('fs');
const path = require('path');
const url = require('url');
const formidable = require('formidable');
const sanitizeFilename = require('sanitize-filename');
const {ServiceProvider} = require('@osjs/common');

/*
 * Sanitizes a file path
 */
const sanitize = filename => {
  const [name, str] = (filename.replace(/\/+/g, '/').match(/^(\w+):(.*)/) || []).slice(1);
  const sane = str.split('/').map(s => sanitizeFilename(s)).join('/').replace(/\/+/g, '/');
  return name + ':' + sane;
}

/*
 * A wrapper for handling VFS requests
 */
const vfsRequestWrapper = wrapper => async (req, res, k, m, args) => {
  try {
    const result = await vfs[k](wrapper)(...args);

    if (k === 'readfile') {
      if (result) { // stream
        result.pipe(res);
      } else {
        res.status(500)
          .send('Failed to create stream');
      }
    } else {
      res.json(result);
    }
  } catch (e) {
    console.warn(e);

    // FIXME
    res.status(404)
      .json({error: e});
  }
};

/*
 * Asyncronous wrapper for handling form parsing
 */
const parseFormAsync = req => new Promise((resolve, reject) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields, files) => {
    if (err) {
      reject(err);
    } else {
      resolve({fields, files});
    }
  });
});

/*
 * Wrapper for handling incoming messages
 */
const parseRequestWrapper = async (req, res, k, m) => {
  if (m === 'post') {
    const form = new formidable.IncomingForm();
    return parseFormAsync(req);
  }

  const {query} = url.parse(req.url, true);
  return {fields: query, files: {}};
};

/*
 * Segment value map
 */
const segments = {
  root: () => process.cwd(),
  username: req => req.session.username
};

/*
 * Gets a segment value
 */
const getSegment = (req, seg) => segments[seg] ? segments[seg](req) : '';

/*
 * Resolves a string with segments
 */
const resolveSegments = (req, str) => (str.match(/(\{\w+\})/g) || [])
  .reduce((result, current) => result.replace(current, getSegment(req, current.replace(/(\{|\})/g, ''))), str);

/*
 * Resolves a given file path based on a request
 * Will take out segments from the resulting string
 * and replace them with a list of defined variables
 */
const resolve = core => req => file => {
  const mountpoints = core.config('vfs.mountpoints');
  const [name, str] = (file.replace(/\/+/g, '/').match(/^(\w+):(.*)/) || []).slice(1);
  const found = name ? mountpoints.find(m => m.name === name) : false;
  if (!found) {
    throw new Error(`Mountpoint for path '${file}' not found.`);
  }

  const root = resolveSegments(req, found.attributes.root);
  return path.join(root, str);
};


/**
 * OS.js Virtual Filesystem Service Provider
 *
 * @desc Provides methods to interact with filesystems
 */
class VFSServiceProvider extends ServiceProvider {

  async init() {
    const resolver = resolve(this.core);

    this.core.singleton('osjs/vfs', () => ({
      request: (method, mockSession = {}) => (...args) => {
        vfs[method]({
          resolve: resolver({session: mockSession})
        })(...args)
      }
    }));

    this.createRoutes();
  }

  createRoutes() {
    const resolver = resolve(this.core);
    const methods = {
      'exists': ['path'],
      'stat': ['path'],
      'readdir': ['path'],
      'readfile': ['path'],
      'writefile': [
        'path',
        (fields, files) => fs.createReadStream(files.upload.path)
      ],
      'mkdir': ['path'],
      'rename': ['from', 'to'],
      'unlink': ['path']
    };

    Object.keys(methods).forEach(k => {
      const m = k === 'writefile' ? 'post' : 'get';

      this.core.make('osjs/express').routeAuthenticated(m, '/vfs/' + k, async (req, res) => {
        try {
          const {fields, files} = await parseRequestWrapper(req, res, k, m);

          const args = methods[k].reduce((result, item) => {
            const param = typeof item === 'function'
              ? item(fields, files)
              : sanitize(fields[item]);

            return result.concat([param]);
          }, []);

          await vfsRequestWrapper({
            resolve: resolver(req)
          })(req, res, k, m, args);

          // Remove uploads
          for (let fieldname in files) {
            fs.unlink(files[fieldname].path, () => ({/* noop */}));
          }
        } catch (error) {
          res.status(500).json({error});
        }

      });
    });
  }

}

module.exports = VFSServiceProvider;
