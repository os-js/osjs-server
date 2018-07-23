/*
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

const fs = require('fs-extra');
const url = require('url');
const formidable = require('formidable');
const sanitizeFilename = require('sanitize-filename');
const vfsMethods = require('../vfs/methods');
const signale = require('signale').scope('vfs');

class VFSError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const errorCodes = {
  ENOENT: 404,
  EACCES: 401
};

// Sanitizes a file path
const sanitize = filename => {
  const [name, str] = (filename.replace(/\/+/g, '/').match(/^(\w+):(.*)/) || []).slice(1);
  const sane = str.split('/').map(s => sanitizeFilename(s)).join('/').replace(/\/+/g, '/');
  return name + ':' + sane;
};

// Validates a mountpoint groups to the user groups
const validateGroups = (userGroups, method, mountpoint) => {
  const all = (arr, compare) => arr.every(g => compare.indexOf(g) !== -1);

  const groups = mountpoint.attributes.groups || [];
  if (groups.length) {
    const namedGroups = groups
      .filter(g => typeof g === 'string');

    const methodGroups = groups
      .find(g => typeof g === 'string' ? false : (method in g));

    const namedValid = namedGroups.length
      ? all(namedGroups, userGroups)
      : true;

    const methodValid = methodGroups
      ? all(methodGroups[method], userGroups)
      : true;

    return namedValid && methodValid;
  }

  return true;
};

// Gets the prefix of vfs path
const getPrefix = str => String(str).split(':')[0];

// Checks if destination is readOnly
const checkReadOnly = (ro, mountpoint, fields) => {
  if (mountpoint.attributes.readOnly) {

    return typeof ro === 'function'
      ? getPrefix(ro(fields)) === mountpoint.name
      : ro;
  }

  return false;
};

// Parses request fields
const parseFields = req => new Promise((resolve, reject) => {
  if (req.method.toLowerCase() === 'get') {
    const {query} = url.parse(req.url, true);

    resolve({fields: query, files: {}});
  } else {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({fields, files});
      }
    });
  }
});

const resolveMountpoint = (provider, fields, files) => (endpoint, ro) => (req, res) => {
  const known = ['path', 'from', 'root'];
  const field = Object.keys(fields).find(key => known.indexOf(key) !== -1);
  const prefix = getPrefix(fields[field]);
  const mountpoint = prefix ? provider.mountpoints.find(m => m.name === prefix) : null;
  const userGroups = req.session.user.groups;

  if (!mountpoint) {
    throw new VFSError(`Mountpoint not found for '${prefix}'`, 403);
  }

  if (checkReadOnly(ro, mountpoint, fields)) {
    throw new VFSError(`Mountpoint '${prefix} is read-only'`, 403);
  }

  if (!validateGroups(userGroups, endpoint, mountpoint)) {
    throw new VFSError(`Permission was denied for '${endpoint}' in '${prefix}'`, 403);
  }

  if (typeof vfsMethods[endpoint] === 'undefined' ||  typeof mountpoint._adapter[endpoint] === 'undefined') {
    throw new VFSError(`VFS Endpoint '${endpoint} was not valid for this mountpoint.'`, 401);
  }

  return mountpoint;
};

// Performs a vfs request
module.exports.request = provider => (endpoint, ro) => (req, res) => {
  const respondError = error => {
    const code = typeof error.code === 'number'
      ? error.code
      : (errorCodes[error.code] || 400);

    res.status(code).json({error: error.toString()});
  };

  const request = (method, fields, files, mountpoint) =>
    vfsMethods[method](req, res, fields, files)(provider.core, mountpoint._adapter, mountpoint);

  return parseFields(req)
    .then(({fields, files}) => {
      ['path', 'from', 'to', 'root'].forEach(key => {
        if (typeof fields[key] !== 'undefined') {
          fields[key] = sanitize(fields[key]);
        }
      });

      let promise;

      try {
        if (['rename', 'copy'].indexOf(endpoint) !== -1) {
          const srcMount = resolveMountpoint(provider, {path: fields.from})('readfile', false)(req, res);
          const dstMount = resolveMountpoint(provider, {path: fields.to})('writefile', true)(req, res);
          const sameAdapter = srcMount.adapter === dstMount.adapter;

          if (!sameAdapter) {
            promise = request('readfile', {path: fields.from}, {}, srcMount)
              .then(ab => request('writefile', {path: fields.to}, {upload: ab}, dstMount))
              .then(result => {
                return endpoint === 'rename'
                  ? request('unlink', {path: fields.from}, {}, srcMount).then(() => result)
                  : result;
              });
          }
        }

        if (!promise) {
          const mountpoint = resolveMountpoint(provider, fields, files)(endpoint, ro)(req, res);
          promise = request(endpoint, fields, files, mountpoint);
        }
      } catch (e) {
        promise = Promise.reject(new Error(e));
      }

      return promise
        .then(result => {
          if (endpoint === 'writefile') {
            for (let fieldname in files) {
              fs.unlink(files[fieldname].path, () => ({/* noop */}));
            }
          }

          if (endpoint === 'readfile') {
            return result.pipe(res);
          }

          return res.json(result);
        })
        .catch(error => {
          signale.fatal(error);
          respondError(error);
        });
    });
};
