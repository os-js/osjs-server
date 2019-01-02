/**
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

const {ServiceProvider} = require('@osjs/common');
const Filesystem = require('../filesystem');
const mime = require('mime');
const path = require('path');

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
    const {filenames, define} = this.core.config('mime', {define: {}, filenames: {}});
    mime.define(define, {force: true});

    const {routeAuthenticated} = this.core.make('osjs/express');

    const methods = {
      exists: {method: 'get'},
      stat: {method: 'get'},
      readdir: {method: 'get'},
      readfile: {method: 'get'},
      writefile: {method: 'post', ro: true},
      mkdir: {method: 'post', ro: true},
      rename: {method: 'post', ro: true},
      copy: {method: 'post', ro: fields => fields.to},
      unlink: {method: 'post', ro: true},
      search: {method: 'post'},
      touch: {method: 'post'}
    };


    // HTTP routes
    Object.keys(methods)
      .forEach(name => {
        const {method, ro} = methods[name];

        routeAuthenticated(method, `/vfs/${name}`, this.filesystem.route(name, ro));
      });

    // Expose VFS as service
    const expose = Object.keys(methods)
      .reduce((result, name) => {
        const {method, ro} = methods[name];

        return Object.assign(result, {
          [name]: (fields, files, session) => {
            const req = {method, fields, files, session};
            const res = {};

            return this.filesystem.routeInternal(name, ro)(req, res, true);
          }
        });
      }, {});

    this.core.singleton('osjs/vfs', () => Object.assign({
      mime: filename => {
        return filenames[path.basename(filename)]
          ? filenames[path.basename(filename)]
          : mime.getType(filename) || 'application/octet-stream';
      },

      request: (name, req, res) => {
        const ro = methods[name].ro;

        return this.filesystem.routeInternal(name, ro)(req, res);
      }
    }, expose));
  }

  start() {
    this.filesystem.init();
  }
}

module.exports = VFSServiceProvider;
