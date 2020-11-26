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

const {methodArguments} = require('./utils/vfs');
const systemAdapter = require('./adapters/vfs/system');
const {v1: uuid} = require('uuid');
const mime = require('mime');
const path = require('path');
const vfs = require('./vfs');
const {closeWatches} = require('./utils/core.js');
const consola = require('consola');
const logger = consola.withTag('Filesystem');

/**
 * @typedef {Object} Mountpoint
 * @property {string} [uuid]
 * @property {string} [root]
 * @property {object} [attributes]
 */

/**
 * TODO: typedef
 * @typedef {Object} FilesystemAdapter
 */

/**
 * Filesystem Service Adapter Option Map
 * @typedef {{name: FilesystemAdapter}} FilesystemAdapterMap
 */

/**
 * Filesystem Service Options
 * @typedef {Object} FilesystemOptions
 * @property {FilesystemAdapterMap} [adapters]
 */

/**
 * Filesystem Internal Call Options
 * @typedef {Object} FilesystemCallOptions
 * @property {string} method VFS Method name
 * @property {object} [user] User session data
 */

/**
 * OS.js Virtual Filesystem
 */
class Filesystem {

  /**
   * Create new instance
   * @param {Core} core Core reference
   * @param {FilesystemOptions} [options] Instance options
   */
  constructor(core, options = {}) {
    /**
     * @type {Core}
     */
    this.core = core;

    /**
     * @type {Mountpoint[]}
     */
    this.mountpoints = [];

    /**
     * @type {FilesystemAdapterMap}
     */
    this.adapters = {};

    this.watches = [];

    this.router = null;

    this.methods = {};

    /**
     * @type {FilesystemOptions}
     */
    this.options = {
      adapters: {},
      ...options
    };
  }

  /**
   * Destroys instance
   * @return {Promise<undefined>}
   */
  async destroy() {
    const watches = this.watches.filter(({watch}) => {
      return watch && typeof watch.close === 'function';
    }).map(({watch}) => watch);

    await closeWatches(watches);

    this.watches = [];
  }

  /**
   * Initializes Filesystem
   * @return {Promise<boolean>}
   */
  async init() {
    const adapters = {
      system: systemAdapter,
      ...this.options.adapters
    };

    this.adapters = Object.keys(adapters).reduce((result, iter) => {
      return {
        [iter]: adapters[iter](this.core),
        ...result
      };
    }, {});

    // Routes
    const {router, methods} = vfs(this.core);
    this.router = router;
    this.methods = methods;

    // Mimes
    const {define} = this.core.config('mime', {define: {}, filenames: {}});
    mime.define(define, {force: true});

    // Mountpoints
    await Promise.all(this.core.config('vfs.mountpoints')
      .map(mount => this.mount(mount)));

    return true;
  }

  /**
   * Gets MIME
   * @param {string} filename Input filename or path
   * @return {string}
   */
  mime(filename) {
    const {filenames} = this.core.config('mime', {
      define: {},
      filenames: {}
    });

    return filenames[path.basename(filename)]
      ? filenames[path.basename(filename)]
      : mime.getType(filename) || 'application/octet-stream';
  }

  /**
   * Crates a VFS request
   * @param {Request|object} req HTTP Request object
   * @param {Response|object} [res] HTTP Response object
   * @return {Promise<*>}
   */
  request(name, req, res = {}) {
    return this.methods[name](req, res);
  }

  /**
   * Performs a VFS request with simulated HTTP request
   * @param {FilesystemCallOptions} options Request options
   * @param {*} ...args Arguments to pass to VFS method
   * @return {Promise<*>}
   */
  call(options, ...args) {
    const {method, user} = {
      user: {},
      ...options
    };

    const req = methodArguments[method]
      .reduce(({fields, files}, key, index) => {
        const arg = args[index];
        if (typeof key === 'function') {
          files = Object.assign(key(arg), files);
        } else {
          fields = {
            [key]: arg,
            ...fields
          };
        }

        return {fields, files};
      }, {fields: {}, files: {}});

    req.session = {user};

    return this.request(method, req);
  }

  /**
   * Creates realpath VFS request
   * @param {string} filename The path
   * @param {AuthUserProfile} [user] User session object
   * @return {Promise<string>}
   */
  realpath(filename, user = {}) {
    return this.methods.realpath({
      session: {
        user: {
          groups: [],
          ...user
        }
      },
      fields: {
        path: filename
      }
    });
  }

  /**
   * Mounts given mountpoint
   * @param {Mountpoint} mount Mountpoint
   * @return {Mountpoint} the mountpoint
   */
  async mount(mount) {
    const mountpoint = {
      id: uuid(),
      root: `${mount.name}:/`,
      attributes: {},
      ...mount
    };

    this.mountpoints.push(mountpoint);

    logger.success('Mounted', mountpoint.name);

    await this.watch(mountpoint);

    return mountpoint;
  }

  /**
   * Unmounts given mountpoint
   * @param {Mountpoint} mount Mountpoint
   * @return {Promise<boolean>}
   */
  async unmount(mountpoint) {
    const found = this.watches.find(w => w.id === mountpoint.id);

    if (found && found.watch) {
      await found.watch.close();
    }

    const index = this.mountpoints.indexOf(mountpoint);

    if (index !== -1) {
      this.mountpoints.splice(index, 1);

      return true;
    }

    return false;
  }

  /**
   * Set up a watch for given mountpoint
   * @param {Mountpoint} mountpoint The mountpoint
   * @return {Promise<undefined>}
   */
  async watch(mountpoint) {
    if (
      !mountpoint.attributes.watch ||
      this.core.config('vfs.watch') === false ||
      !mountpoint.attributes.root
    ) {
      return;
    }

    const adapter = await (mountpoint.adapter
      ? this.adapters[mountpoint.adapter]
      : this.adapters.system);

    if (typeof adapter.watch === 'function') {
      await this._watch(mountpoint, adapter);
    }
  }

  /**
   * Internal method for setting up watch for given mountpoint adapter
   * @param {Mountpoint} mountpoint The mountpoint
   * @param {FilesystemAdapter} adapter The adapter
   * @return {Promise<undefined>}
   */
  async _watch(mountpoint, adapter) {
    const watch = await adapter.watch(mountpoint, (args, dir, type) => {
      const target = mountpoint.name + ':/' + dir;
      const keys = Object.keys(args);
      const filter = keys.length === 0
        ? () => true
        : ws => keys.every(k => ws._osjs_client[k] === args[k]);

      this.core.emit('osjs/vfs:watch:change', {
        mountpoint,
        target,
        type
      });

      this.core.broadcast('osjs/vfs:watch:change', [{
        path: target,
        type
      }, args], filter);
    });

    watch.on('error', error => logger.warn('Mountpoint watch error', error));

    this.watches.push({
      id: mountpoint.id,
      watch
    });

    logger.info('Watching mountpoint', mountpoint.name);
  }
}

module.exports = Filesystem;
