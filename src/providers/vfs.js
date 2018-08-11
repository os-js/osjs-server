/**
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

const {ServiceProvider} = require('@osjs/common');
const Filesystem = require('../filesystem');

/**
 * OS.js Virtual Filesystem Service Provider
 *
 * @desc Provides methods to interact with filesystems
 */
class VFSServiceProvider extends ServiceProvider {

  constructor(core, options = {}) {
    super(core, options);

    this.filesystem = new Filesystem(core, options);
  }

  async init() {
    const {routeAuthenticated} = this.core.make('osjs/express');

    // HTTP routes
    routeAuthenticated('get', '/vfs/exists', this.filesystem.route('exists'));
    routeAuthenticated('get', '/vfs/stat', this.filesystem.route('stat'));
    routeAuthenticated('get', '/vfs/readdir', this.filesystem.route('readdir'));
    routeAuthenticated('get', '/vfs/readfile', this.filesystem.route('readfile'));
    routeAuthenticated('post', '/vfs/writefile', this.filesystem.route('writefile', true));
    routeAuthenticated('get', '/vfs/mkdir', this.filesystem.route('mkdir', true));
    routeAuthenticated('get', '/vfs/rename', this.filesystem.route('rename', true));
    routeAuthenticated('get', '/vfs/copy', this.filesystem.route('copy', fields => fields.to));
    routeAuthenticated('get', '/vfs/unlink', this.filesystem.route('unlink', true));
    routeAuthenticated('get', '/vfs/search', this.filesystem.route('search'));

    // Expose VFS as service
    this.core.singleton('osjs/vfs', () => ({
      request: (...args) => this.filesystem._request(...args)
    }));
  }

  start() {
    this.filesystem.init();
  }
}

module.exports = VFSServiceProvider;
