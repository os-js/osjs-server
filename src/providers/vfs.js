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
    this.adapters = Object.assign({
      system: systemAdapter
    }, options.adapters);
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

    // Mountpoints
    this.core.config('vfs.mountpoints')
      .forEach(mount => this.mount(mount));
  }

  mount(mount) {
    const adapter = mount.adapter
      ? this.adapters[mount.adapter]
      : systemAdapter;

    signale.success('Mounted', mount.name, mount.attributes);

    const mountpoint = Object.assign({
      _watch: null,
      _adapter: adapter(this.core)
    }, mount);

    this.mountpoints.push(mountpoint);

    this.watch(mountpoint);
  }

  unmount(name) {
    const index = this.mountpoints.findIndex(m => m.name === name);
    if (index !== -1) {
      const mountpoint = this.mountpoints[index];

      if (mountpoint._watch) {
        mountpoint._watch.close();
      }

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


    if (typeof mountpoint._adapter.watch === 'function') {
      const watch = mountpoint._adapter.watch(mountpoint, (args, dir) => {
        const target = mountpoint.name + ':/' + dir;
        const keys = Object.keys(args);
        const filter = keys.length === 0
          ? () => true
          : ws => keys.every(k => ws._osjs_client[k] === args[k]);

        this.core.broadcast('osjs/vfs:watch:change', [{
          path: target
        }, args], filter);
      });

      mountpoint._watch = watch;

      signale.watch('Watching mountpoint', mountpoint.name);
    }
  }
}

module.exports = VFSServiceProvider;
