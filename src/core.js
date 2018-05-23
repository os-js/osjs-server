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

const morgan = require('morgan');
const express = require('express');
const express_session = require('express-session');
const express_ws = require('express-ws');
const symbols = require('log-symbols');
const session_file_store = require('session-file-store');

const {CoreBase} = require('@osjs/common');
const {defaultConfiguration} = require('./config.js');

/*
 * Create session parser
 */
const createSession = (app, configuration) => {
  const Store = require(configuration.session.store.module)(express_session);
  const store = new Store(configuration.session.store.options);

  return express_session(Object.assign({
    store
  }, configuration.session.options));
};

/*
 * Create WebSocket server
 */
const createWebsocket = (app, configuration, session) => express_ws(app, null, {
  wsOptions: Object.assign({}, configuration.ws, {
    verifyClient: (info, done) => {
      session(info.req, {}, () => {
        done(true);
      });
    }
  })
});

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
    const createDefaultSession = (ref) => {
      const classRef = session_file_store(ref);
      return new classRef({});
    };

    options = Object.assign({}, {
      root: process.cwd()
    }, options);

    super(defaultConfiguration, cfg, options);

    this.app = express();
    this.session = createSession(this.app, this.configuration);
    this.ws = createWebsocket(this.app, this.configuration, this.session);

    if (!this.configuration.public) {
      throw new Error('The public option is required');
    }
  }

  /**
   * Destroys the instance
   */
  destroy() {
    if (this.destroying) {
      return;
    }

    console.log(symbols.warning, 'Stopping server...');

    super.destroy();

    process.exit(0);
  }

  /**
   * Starts the server
   */
  async start() {
    if (this.started) {
      return;
    }

    console.log(symbols.info, 'Starting server...');

    await super.start();

    try {
      this.app.listen(this.configuration.port, () => {
        const wsp = this.configuration.ws.port ? this.configuration.ws.port : this.configuration.port;
        console.log(symbols.info, 'Using directory', this.configuration.public.replace(process.cwd(), ''));
        console.log(symbols.success, `WebSocket Listening at ${this.configuration.hostname}:${wsp}`);
        console.log(symbols.success, `HTTP Listening at ${this.configuration.hostname}:${this.configuration.port}`);
        console.log(symbols.success, 'Running...');
      });
    } catch (e) {
      console.error(symbols.error, e);
      process.exit(1);
    }
  }

  /**
   * Initializes the server
   */
  async boot() {
    console.log(symbols.info, 'Initializing server...');

    this.emit('osjs/core:start');

    if (this.configuration.logging) {
      const wss = this.ws.getWss();

      wss.on('connection', (c) => {
        console.log('WS Connection opened');
        c.on('close', () => console.log('WS Connection closed'));
      });

      if (this.configuration.morgan) {
        this.app.use(morgan(this.configuration.morgan));
      }
    }

    console.log(symbols.info, 'Initializing providers...');

    await super.boot();

    this.emit('init');

    await this.start();

    this.emit('osjs/core:started');
  }

  /**
   * Broadcast given event to client
   * @param {string} name Event name
   * @param {Object} params Message
   * @param {Function} [filter] A function to filter clients
   */
  broadcast(name, params, filter) {
    filter = filter || (() => true);

    if (this.ws) {
      this.ws.getWss('/').clients // This is a Set
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
}

module.exports = Core;
