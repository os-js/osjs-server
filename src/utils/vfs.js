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

const url = require('url');
const formidable = require('formidable');
const sanitizeFilename = require('sanitize-filename');
const vfsMethods = require('../vfs/methods');
const signale = require('signale').scope('vfs');

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

// Performs a vfs request
module.exports.request = provider => (endpoint, ro) => (req, res) => parseFields(req)
  .then(({fields, files}) => {
    const known = ['path', 'from', 'root'];
    const field = Object.keys(fields).find(key => known.indexOf(key) !== -1);
    const prefix = getPrefix(fields[field]);
    const mountpoint = prefix ? provider.mountpoints.find(m => m.name === prefix) : null;
    const respondError = (msg, code) => res.status(code).json({error: msg});
    const userGroups = req.session.user.groups;

    if (!mountpoint) {
      return respondError(`Mountpoint not found for '${prefix}'`, 403);
    }

    if (checkReadOnly(ro, mountpoint, fields)) {
      return respondError(`Mountpoint '${prefix} is read-only'`, 403);
    }

    if (!validateGroups(userGroups, endpoint, mountpoint)) {
      return respondError(`Permission was denied for '${endpoint}' in '${prefix}'`, 403);
    }

    if (typeof vfsMethods[endpoint] === 'undefined' ||  typeof mountpoint._adapter[endpoint] === 'undefined') {
      return respondError(`VFS Endpoint '${endpoint} was not valid for this mountpoint.'`, 401);
    }

    ['path', 'from', 'to', 'root'].forEach(key => {
      if (typeof fields[key] !== 'undefined') {
        fields[key] = sanitize(fields[key]);
      }
    });

    return vfsMethods[endpoint](req, res, fields, files)(provider.core, mountpoint._adapter, mountpoint)
      .catch(error => {
        signale.fatal(new Error(error));

        if (error.code) {
          const code = errorCodes[error.code] || 400;
          res.status(code).json({error: error.code});
        } else {
          respondError(error, 500); // FIXME
        }
      });
  });
