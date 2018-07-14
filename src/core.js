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

const path = require('path');
const morgan = require('morgan');
const express = require('express');
const express_session = require('express-session');
const express_ws = require('express-ws');
const signale = require('signale').scope('core');

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
    options = Object.assign({}, {
      root: process.cwd()
    }, options);

    super(defaultConfiguration, cfg, options);

    this.httpServer = null;
    this.app = express();
    this.session = createSession(this.app, this.configuration);
    this.ws = createWebsocket(this.app, this.configuration, this.session);
    this.logger = signale;

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

    signale.pause('Shutting down server');

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

    signale.start('Starting server');

    await super.start();

    try {
      this.httpServer = this.app.listen(this.configuration.port, () => {
        const wsp = this.configuration.ws.port ? this.configuration.ws.port : this.configuration.port;
        const sess = path.basename(path.dirname(this.configuration.session.store.module));
        signale.success('Using session store', sess);
        signale.success('Using directory', this.configuration.public.replace(process.cwd(), ''));
        signale.watch(`WebSocket Listening at ${this.configuration.hostname}:${wsp}`);
        signale.watch(`HTTP Listening at ${this.configuration.hostname}:${this.configuration.port}`);
      });
    } catch (e) {
      signale.fatal(new Error(e));
      process.exit(1);
    }
  }

  /**
   * Initializes the server
   */
  async boot() {
    signale.await('Initializing core');

    this.emit('osjs/core:start');

    if (this.configuration.logging) {
      const wss = this.ws.getWss();

      wss.on('connection', (c) => {
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
