/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2019, Anders Evenrud <andersevenrud@gmail.com>
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

const url = require('url');
const formidable = require('formidable');
const vfsMethods = require('../vfs/methods');

// A custom exception
class VFSError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

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

// Get adapter from mountpoint
const getAdapter = (provider, mountpoint) => mountpoint.adapter
  ? provider.adapters[mountpoint.adapter]
  : provider.adapters.system;

// Resolves mountpoint from fields
const resolveMountpoint = provider => (endpoint, fields, userGroups, ro) => {
  const known = ['path', 'from', 'root'];
  const field = Object.keys(fields).find(key => known.indexOf(key) !== -1);
  const prefix = getPrefix(fields[field]);
  const mountpoint = prefix ? provider.mountpoints.find(m => m.name === prefix) : null;

  if (!mountpoint) {
    throw new VFSError(`Mountpoint not found for '${prefix}'`, 403);
  }

  if (checkReadOnly(ro, mountpoint, fields)) {
    throw new VFSError(`Mountpoint '${prefix} is read-only'`, 403);
  }

  if (!validateGroups(userGroups, endpoint, mountpoint)) {
    throw new VFSError(`Permission was denied for '${endpoint}' in '${prefix}'`, 403);
  }

  const adapter = getAdapter(provider, mountpoint);

  if (typeof vfsMethods[endpoint] === 'undefined' ||  typeof adapter[endpoint] === 'undefined') {
    throw new VFSError(`VFS Endpoint '${endpoint} was not valid for this mountpoint.'`, 401);
  }

  return [adapter, mountpoint];
};

// Performs a vfs request
module.exports.request = provider => (endpoint, ro) => {
  const resolve = resolveMountpoint(provider);

  return ({req, res, fields, files}) => {
    const userGroups = req.session.user.groups;

    const request = (method, fields, files) => (adapter, mountpoint) =>
      vfsMethods[method](req, res, fields, files)(provider.core, adapter, mountpoint);

    let promise;

    try {
      if (['rename', 'copy'].indexOf(endpoint) !== -1) {
        const [srcAdapter, srcMount] = resolve('readfile', {path: fields.from}, userGroups, false);
        const [dstAdapter, dstMount] = resolve('writefile', {path: fields.to}, userGroups, true);
        const sameAdapter = srcMount.adapter === dstMount.adapter;

        if (!sameAdapter) {
          promise = request('readfile', {path: fields.from}, {})(srcAdapter, srcMount)
            .then(ab => request('writefile', {path: fields.to}, {upload: ab})(dstAdapter, dstMount))
            .then(result => {
              return endpoint === 'rename'
                ? request('unlink', {path: fields.from}, {})(srcAdapter, srcMount).then(() => true)
                : true;
            });
        }
      }

      if (!promise) {
        const [adapter, mountpoint] = resolve(endpoint, fields, userGroups, ro);
        promise = request(endpoint, fields, files)(adapter, mountpoint);
      }
    } catch (e) {
      promise = Promise.reject(e);
    }

    return promise;
  };
};

// Parses request fields
module.exports.parseFields = (core, req, dummy = false) => new Promise((resolve, reject) => {
  if (dummy) {
    resolve({
      fields: req.fields,
      files: req.files
    });
  } else if (['get', 'head'].indexOf(req.method.toLowerCase()) !== -1) {
    const {query} = url.parse(req.url, true);

    resolve({fields: query, files: {}});
  } else {
    const isJson = req.headers['content-type'] &&
      req.headers['content-type'].indexOf('application/json') !== -1;

    if (isJson) {
      resolve({fields: req.body, files: {}});
    } else {
      const {maxFieldsSize, maxFileSize} = core.config('express');
      const form = new formidable.IncomingForm();
      form.maxFieldsSize = maxFieldsSize;
      form.maxFileSize = maxFileSize;

      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({fields, files});
        }
      });
    }
  }
});
