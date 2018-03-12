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
const merge = require('deepmerge');

/*
 * Create configuration tree
 */
const createConfiguration = cfg => merge({
  logging: true,
  index: 'index.html',
  hostname: 'localhost',
  port: 8000,
  public: null,
  morgan: 'tiny',
  ws: {
    port: undefined
  },
  session: {
    secret: 'osjs',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: 'auto'
    }
  }
}, cfg);

/*
 * Create session parser
 */
const createSession = (app, configuration) =>
  express_session(configuration.session);

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
 * OS.js Server Core
 */
class Core {
  /**
   * Creates a new instance
   * @param {Object} cfg Configuration tree
   */
  constructor(cfg) {
    const app = express();

    this.stopping = false;
    this.providers = [];
    this.configuration = createConfiguration(cfg);
    this.app = app;
    this.session = createSession(app, this.configuration);
    this.ws = createWebsocket(app, this.configuration, this.session);

    if (!this.configuration.public) {
      throw new Error('The public option is required');
    }
  }

  /**
   * Destroys the instance
   */
  destroy() {
    if (this.stopping) {
      return;
    }
    this.stopping = true;

    console.log(symbols.warning, 'Stopping server...');

    try {
      this.providers.forEach((provider) => provider.destroy())
    } catch (e) {
      console.warn(symbols.error, e);
    }

    process.exit(0);
  }

  /**
   * Registers a service provider
   * @param {*} provider A provider reference
   */
  register(provider) {
    this.providers.push(new provider(this));
  }

  /**
   * Starts the server
   */
  start() {
    console.log(symbols.info, 'Starting server...');

    this.providers.forEach((provider) => provider.start());

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
  async init() {
    console.log(symbols.info, 'Initializing server...');

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

    for (let i = 0; i < this.providers.length; i++) {
      try {
        await this.providers[i].init();
      } catch (e) {
        console.warn(symbols.warning, e);
      }
    }

    this.start();
  }
}

module.exports = Core;
