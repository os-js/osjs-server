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

const fs = require('fs-extra');
const signale = require('signale').scope('pkg');
const loader = require('./utils/packageloader');

const readOrDefault = filename => fs.existsSync(filename)
  ? fs.readJsonSync(filename)
  : [];

/**
 * OS.js Package Management
 */
class Packages {

  constructor(core, options = {}) {
    this.core = core;
    this.packages = [];
    this.watches = [];
    this.hotReloading = {};
    this.options = Object.assign({
      manifestFile: null,
      discoveredFile: null
    }, options);
  }

  /**
   * Initializes packages
   */
  init() {
    this.core.on('osjs/application:socket:message', (ws, ...params) => {
      this.handleMessage(ws, params);
    });

    return this.load();
  }

  /**
   * Loads packages
   */
  load() {
    const {manifestFile, discoveredFile} = this.options;
    const manifest = readOrDefault(manifestFile);
    const discovered = readOrDefault(discoveredFile);
    const load = loader(this.core, manifest, discovered);

    return load(metadata => {
      clearTimeout(this.hotReloading[metadata.name]);
      this.hotReloading[metadata.name] = setTimeout(() => {
        signale.info('Reloading', metadata.name);
        this.core.broadcast('osjs/packages:package:changed', [metadata.name]);
      }, 500);
    }).then(({result, watches}) => {
      this.watches = watches;
      this.packages = this.packages.concat(result);
    });
  }

  /**
   * Starts packages
   */
  start() {
    this._packageAction('start');
  }

  /**
   * Destroys packages
   */
  destroy() {
    this._packageAction('destroy');
    this.watches.forEach(watch => watch.close());

    this.packages = [];
    this.watches = [];
  }

  /**
   * Runs an action on all registered packages
   * @param {string} action Method name
   */
  _packageAction(action) {
    this.packages.forEach(({script}) => {
      try {
        if (typeof script[action] === 'function') {
          script[action]();
        }
      } catch (e) {
        signale.fatal(e);
      }
    });
  }

  /**
   * Handles an incoming message and signals an application
   * @desc This will call the 'onmessage' event in your application server script
   * @param {Object} ws Websocket Connection client
   * @param {Array} params A list of incoming parameters
   */
  handleMessage(ws, params) {
    const {pid, name, args} = params[0];
    const found = this.packages.findIndex(({metadata}) => metadata.name === name);

    if (found !== -1) {
      const {script} = this.packages[found];
      if (script && typeof script.onmessage === 'function') {
        const respond = (...respondParams) => ws.send(JSON.stringify({
          name: 'osjs/application:socket:message',
          params: [{
            pid,
            args: respondParams
          }]
        }));

        script.onmessage(ws, respond, args);
      }
    }
  }
}

module.exports = Packages;
