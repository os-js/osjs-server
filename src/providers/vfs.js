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

const systemAdapter = require('../vfs/system');
const signale = require('signale').scope('vfs');
const {ServiceProvider} = require('@osjs/common');
const {request} = require('../utils/vfs');
const vfsMethods = require('../vfs/methods');
const uuid = require('uuid/v1');

/**
 * OS.js Virtual Filesystem Service Provider
 *
 * @desc Provides methods to interact with filesystems
 */
class VFSServiceProvider extends ServiceProvider {

  constructor(core, options = {}) {
    options = Object.assign({
      adapters: {}
    }, options);

    super(core, options);

    this.mountpoints = [];
    this.adapters = [];
    this.watches = [];
  }

  async init() {
    const {routeAuthenticated} = this.core.make('osjs/express');

    // HTTP routes
    routeAuthenticated('get', '/vfs/exists', request(this)('exists'));
    routeAuthenticated('get', '/vfs/stat', request(this)('stat'));
    routeAuthenticated('get', '/vfs/readdir', request(this)('readdir'));
    routeAuthenticated('get', '/vfs/readfile', request(this)('readfile'));
    routeAuthenticated('post', '/vfs/writefile', request(this)('writefile', true));
    routeAuthenticated('get', '/vfs/mkdir', request(this)('mkdir', true));
    routeAuthenticated('get', '/vfs/rename', request(this)('rename', true));
    routeAuthenticated('get', '/vfs/copy', request(this)('copy', fields => fields.to));
    routeAuthenticated('get', '/vfs/unlink', request(this)('unlink', true));
    routeAuthenticated('get', '/vfs/search', request(this)('search'));

    // Expose VFS as service
    this.core.singleton('osjs/vfs', () => ({
      request: vfsMethods
    }));
  }

  start() {
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

  mount(mount) {
    const mountpoint = Object.assign({
      id: uuid(),
      root: `${mount.name}:/`
    }, mount);

    this.mountpoints.push(mountpoint);

    signale.success('Mounted', mount.name, mount.attributes);

    this.watch(mountpoint);
  }

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

module.exports = VFSServiceProvider;
