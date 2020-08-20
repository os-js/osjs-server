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

const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const path = require('path');
const morgan = require('morgan');
const express = require('express');
const minimist = require('minimist');
const deepmerge = require('deepmerge');
const consola = require('consola');
const {CoreBase} = require('@osjs/common');
const {argvToConfig, createSession, createWebsocket, parseJson} = require('./utils/core.js');
const {defaultConfiguration} = require('./config.js');
const logger = consola.withTag('Core');

let _instance;

/**
 * OS.js Server Core
 */
class Core extends CoreBase {

  /**
   * Creates a new instance
   * @param {Object} cfg Configuration tree
   * @param {Object} [options] Options
   */
  constructor(cfg, options = {}) {
    options = {
      argv: process.argv.splice(2),
      root: process.cwd(),
      ...options
    };

    const argv = minimist(options.argv);
    const val = k => argvToConfig[k](parseJson(argv[k]));
    const keys = Object.keys(argvToConfig).filter(k => Object.prototype.hasOwnProperty.call(argv, k));
    const argvConfig = keys.reduce((o, k) => {
      logger.info(`CLI argument '--${k}' overrides`, val(k));
      return {...o, ...deepmerge(o, val(k))};
    }, {});

    super(defaultConfiguration, deepmerge(cfg, argvConfig), options);

    this.logger = consola.withTag('Internal');

    /**
     * @type {Express}
     */
    this.app = express();

    if (!this.configuration.public) {
      throw new Error('The public option is required');
    }

    /**
     * @type {http.Server|https.Server}
     */
    this.httpServer = this.config('https.enabled')
      ? https.createServer(this.config('https.options'), this.app)
      : http.createServer(this.app);

    /**
     * @type {object}
     */
    this.session = createSession(this.app, this.configuration);

    /**
     * @type {object}
     */
    this.ws = createWebsocket(this.app, this.configuration, this.session, this.httpServer);

    /**
     * @type {object}
     */
    this.wss = this.ws.getWss();

    _instance = this;
  }

  /**
   * Destroys the instance
   * @param {Function} [done] Callback when done
   * @return {Promise<undefined>}
   */
  async destroy(done = () => {}) {
    if (this.destroyed) {
      return;
    }

    this.emit('osjs/core:destroy');

    logger.info('Shutting down...');

    if (this.wss) {
      this.wss.close();
    }

    const finish = (error) => {
      if (error) {
        logger.error(error);
      }

      if (this.httpServer) {
        this.httpServer.close(done);
      } else {
        done();
      }
    };

    try {
      await super.destroy();
      finish();
    } catch (e) {
      finish(e);
    }
  }

  /**
   * Starts the server
   * @return {Promise<boolean>}
   */
  async start() {
    if (!this.started) {
      logger.info('Starting services...');

      await super.start();

      logger.success('Initialized!');

      this.listen();
    }

    return true;
  }

  /**
   * Initializes the server
   * @return {Promise<boolean>}
   */
  async boot() {
    if (this.booted) {
      return true;
    }

    this.emit('osjs/core:start');

    if (this.configuration.logging) {
      this.wss.on('connection', (c) => {
        logger.log('WebSocket connection opened');
        c.on('close', () => logger.log('WebSocket connection closed'));
      });

      if (this.configuration.morgan) {
        this.app.use(morgan(this.configuration.morgan));
      }
    }


    logger.info('Initializing services...');

    await super.boot();
    this.emit('init');
    await this.start();
    this.emit('osjs/core:started');

    return true;
  }

  /**
   * Opens HTTP server
   */
  listen() {
    const httpPort = this.config('port');
    const wsPort = this.config('ws.port') || httpPort;
    const pub = this.config('public');
    const session = path.basename(path.dirname(this.config('session.store.module')));
    const dist = pub.replace(process.cwd(), '');
    const secure = this.config('https.enabled', false);
    const proto = prefix => `${prefix}${secure ? 's' : ''}://`;
    const host = port => `${this.config('hostname')}:${port}`;

    logger.info('Opening server connection');

    const checkFile = path.join(pub, this.configuration.index);
    if (!fs.existsSync(checkFile)) {
      logger.warn('Missing files in "dist/" directory. Did you forget to run "npm run build" ?');
    }

    this.httpServer.listen(httpPort, () => {
      logger.success(`Using '${session}' sessions`);
      logger.success(`Serving '${dist}'`);
      logger.success(`WebSocket listening on ${proto('ws')}${host(wsPort)}`);
      logger.success(`Server listening on ${proto('http')}${host(httpPort)}`);
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
