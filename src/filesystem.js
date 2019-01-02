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

const systemAdapter = require('./vfs/system');
const signale = require('signale').scope('vfs');
const {request, parseFields} = require('./utils/vfs');
const uuid = require('uuid/v1');
const fs = require('fs-extra');
const sanitizeFilename = require('sanitize-filename');

// FS error code map
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

/**
 * OS.js Virtual Filesystem
 */
class Filesystem {
  constructor(core, options) {
    this.core = core;
    this.mountpoints = [];
    this.adapters = [];
    this.watches = [];
    this.options = Object.assign({
      adapters: {}
    }, options);
  }

  /**
   * Initializes Filesystem
   */
  async init() {
    const adapters = Object.assign({
      system: systemAdapter
    }, this.options.adapters);

    this.adapters = Object.keys(adapters).reduce((result, iter) => {
      return Object.assign({
        [iter]: adapters[iter](this.core)
      }, result);
    }, {});

    // Mountpoints
    this.core.config('vfs.mountpoints')
      .forEach(mount => this.mount(mount));
  }

  /**
   * Creates a HTTP route
   */
  route(method, ro) {
    return (req, res) => parseFields(this.core, req)
      .then(({fields, files}) => {
        try {
          ['path', 'from', 'to', 'root'].forEach(key => {
            if (typeof fields[key] !== 'undefined') {
              fields[key] = sanitize(fields[key]);
            }
          });

          return this.request(method, ro, {req, res, fields, files});
        } catch (e) {
          return Promise.reject(e);
        }
      })
      .catch(error => res.status(500).json({error: error.message}));
  }

  routeInternal(method, ro) {
    return (req, res, dummy = false) => parseFields(this.core, req, dummy)
      .then(({fields, files}) => {
        try {
          ['path', 'from', 'to', 'root'].forEach(key => {
            if (typeof fields[key] !== 'undefined') {
              fields[key] = sanitize(fields[key]);
            }
          });

          return request(this)(method, ro)({req, res, fields, files});
        } catch (e) {
          return Promise.reject(e);
        }
      });
  }

  /**
   * Creates a VFS HTTP request
   */
  request(method, ro, {req, res, fields, files}) {
    return request(this)(method, ro)({req, res, fields, files})
      .then(result => {
        if (method === 'writefile') {
          for (let fieldname in files) {
            fs.unlink(files[fieldname].path, () => ({/* noop */}));
          }
        }

        if (method === 'readfile') {
          return result.pipe(res);
        }

        return res.json(result);
      })
      .catch(error => {
        signale.fatal(error);

        const code = typeof error.code === 'number'
          ? error.code
          : (errorCodes[error.code] || 400);

        res.status(code).json({error: error.toString()});
      });
  }

  /**
   * Mounts given mountpoint
   */
  mount(mount) {
    const mountpoint = Object.assign({
      id: uuid(),
      root: `${mount.name}:/`,
      attributes: {}
    }, mount);

    this.mountpoints.push(mountpoint);

    signale.success('Mounted', mountpoint.name, mountpoint.attributes);

    this.watch(mountpoint);
  }

  /**
   * Unmounts given mountpoint
   */
  unmount(mountpoint) {
    const found = this.watches.find(w => w.id === mountpoint.id);

    if (found) {
      found.watch.close();
    }

    const index = this.mountpoints.indexOf(mountpoint);

    if (index !== -1) {
      this.mountpoints.splice(index, 1);
    }
  }

  /**
   * Set up a watch for given mountpoint
   */
  watch(mountpoint) {
    if (mountpoint.attributes.watch === false) {
      return;
    }

    if (this.core.config('vfs.watch') === false) {
      return;
    }

    if (!mountpoint.attributes.root) {
      return;
    }

    const adapter = mountpoint.adapter
      ? this.adapters[mountpoint.adapter]
      : this.adapters.system;

    if (typeof adapter.watch === 'function') {
      const watch = adapter.watch(mountpoint, (args, dir) => {
        const target = mountpoint.name + ':/' + dir;
        const keys = Object.keys(args);
        const filter = keys.length === 0
          ? () => true
          : ws => keys.every(k => ws._osjs_client[k] === args[k]);

        this.core.broadcast('osjs/vfs:watch:change', [{
          path: target
        }, args], filter);
      });

      this.watches.push({
        id: mountpoint.id,
        watch
      });

      signale.watch('Watching mountpoint', mountpoint.name);
    }
  }
}

module.exports = Filesystem;
