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

const path = require('path');
const morgan = require('morgan');
const express = require('express');
const minimist = require('minimist');
const deepmerge = require('deepmerge');
const signale = require('signale').scope('core');
const {CoreBase} = require('@osjs/common');
const {argvToConfig, createSession, createWebsocket, parseJson} = require('./utils/core.js');
const {defaultConfiguration} = require('./config.js');

let _instance;

/**
 * Server Core
 *
 * @desc Provides the OS.js Server Core
 */
class Core extends CoreBase {

  /**
   * Creates a new instance
   * @param {Object} cfg Configuration tree
   * @param {Object} [options] Options
   */
  constructor(cfg, options = {}) {
    options = Object.assign({}, {
      kill: true,
      argv: process.argv.splice(2),
      root: process.cwd()
    }, options);

    const argv = minimist(options.argv);
    const val = k => argvToConfig[k](parseJson(argv[k]));
    const keys = Object.keys(argvToConfig).filter(k => argv.hasOwnProperty(k));
    const argvConfig = keys.reduce((o, k) => {
      signale.fav(`CLI argument '--${k}' overrides`, val(k));

      return Object.assign(o, deepmerge(o, val(k)));
    }, {});

    super(defaultConfiguration, deepmerge(cfg, argvConfig), options);

    this.httpServer = null;
    this.logger = signale;
    this.app = express();
    this.session = createSession(this.app, this.configuration);
    this.ws = createWebsocket(this.app, this.configuration, this.session);
    this.wss = this.ws.getWss();

    if (!this.configuration.public) {
      throw new Error('The public option is required');
    }

    _instance = this;
  }

  /**
   * Destroys the instance
   */
  destroy() {
    if (this.destroyed) {
      return;
    }

    const done = this.options.kill
      ? () => process.exit(0)
      : () => {};

    this.emit('osjs/core:destroy');

    signale.pause('Shutting down server');

    if (this.wss) {
      this.wss.close();
    }

    super.destroy();

    if (this.httpServer) {
      this.httpServer.close(done);
    } else {
      done();
    }
  }

  /**
   * Starts the server
   */
  async start() {
    if (!this.started) {
      signale.start('Starting server');

      await super.start();

      try {
        this.listen();
      } catch (e) {
        console.error(e);

        if (this.options.kill) {
          process.exit(1);
        }

        return false;
      }
    }

    return true;
  }

  /**
   * Initializes the server
   */
  async boot() {
    if (this.booted) {
      return true;
    }

    signale.await('Initializing core');

    this.emit('osjs/core:start');

    if (this.configuration.logging) {
      this.wss.on('connection', (c) => {
        signale.start('WS Connection opened');

        c.on('close', () => signale.pause('WS Connection closed'));
      });

      if (this.configuration.morgan) {
        this.app.use(morgan(this.configuration.morgan));
      }
    }

    signale.await('Initializing providers');

    await super.boot();
    this.emit('init');
    await this.start();
    this.emit('osjs/core:started');

    signale.success('Initialized');

    return true;
  }

  /**
   * Opens HTTP server
   */
  listen() {
    this.httpServer = this.app.listen(this.configuration.port, () => {
      const wsp = this.configuration.ws.port ? this.configuration.ws.port : this.configuration.port;
      const sess = path.basename(path.dirname(this.configuration.session.store.module));
      signale.success('Using session store', sess);
      signale.success('Using directory', this.configuration.public.replace(process.cwd(), ''));
      signale.watch(`WebSocket Listening at ${this.configuration.hostname}:${wsp}`);
      signale.watch(`HTTP Listening at ${this.configuration.hostname}:${this.configuration.port}`);
    });
  }

  /**
   * Broadcast given event to client
   * @param {string} name Event name
   * @param {Array} params A list of parameters to send to client
   * @param {Function} [filter] A function to filter clients
   */
  broadcast(name, params, filter) {
    filter = filter || (() => true);

    if (this.ws) {
      this.wss.clients // This is a Set
        .forEach(client => {
          if (!client._osjs_client) {
            return;
          }

          if (filter(client)) {
            client.send(JSON.stringify({
              params,
              name
            }));
          }
        });
    }
  }

  /**
   * Broadcast given event to all clients
   * @param {string} name Event name
   * @param {Array} ...params A list of parameters to send to client
   */
  broadcastAll(name, ...params) {
    return this.broadcast(name, params);
  }

  /**
   * Broadcast given event to client filtered by username
   * @param {String} username Username to send to
   * @param {string} name Event name
   * @param {Array} ...params A list of parameters to send to client
   */
  broadcastUser(username, name, ...params) {
    return this.broadcast(name, params, client => {
      return client._osjs_client.username === username;
    });
  }

  /**
   * Gets the server instance
   * @return {Core}
   */
  static getInstance() {
    return _instance;
  }
}

module.exports = Core;
