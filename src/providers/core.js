/**
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

const path = require('path');
const express = require('express');
const chokidar = require('chokidar');
const bodyParser = require('body-parser');
const proxy = require('express-http-proxy');
const nocache = require('nocache');
const {ServiceProvider} = require('@osjs/common');
const {isAuthenticated, closeWatches} = require('../utils/core.js');

/**
 * OS.js Core Service Provider
 */
class CoreServiceProvider extends ServiceProvider {

  constructor(core, options) {
    super(core, options);

    this.watches = [];
  }

  async destroy() {
    await closeWatches(this.watches);
    super.destroy();
  }

  async init() {
    this.initService();
    this.initExtensions();
    this.initResourceRoutes();
    this.initSocketRoutes();
    this.initProxies();
  }

  start() {
    if (this.core.configuration.development) {
      this.initDeveloperTools();
    }
  }

  provides() {
    return [
      'osjs/express'
    ];
  }

  /**
   * Initializes the service APIs
   */
  initService() {
    const {app} = this.core;
    const {requireAllGroups} = this.core.configuration.auth;

    const middleware = {
      route: [],
      routeAuthenticated: []
    };

    this.core.singleton('osjs/express', () => ({
      isAuthenticated,

      call: (method, ...args) => app[method](...args),

      websocket: (p, cb) => app.ws(p, cb),

      middleware: (authentication, cb) => {
        middleware[authentication ? 'routeAuthenticated' : 'route'].push(cb);
      },

      route: (method, uri, cb) => app[method.toLowerCase()](uri, [
        ...middleware.route
      ], cb),

      routeAuthenticated: (method, uri, cb, groups = [], strict = requireAllGroups) =>
        app[method.toLowerCase()](uri, [
          ...middleware.routeAuthenticated,
          isAuthenticated(groups, strict)
        ], cb)
    }));
  }

  /**
   * Initializes Express extensions
   */
  initExtensions() {
    const {app, session, configuration} = this.core;

    if (configuration.development) {
      app.use(nocache());
    } else {
      app.disable('x-powered-by');
    }

    // Handle sessions
    app.use(session);

    // Handle bodies
    app.use(bodyParser.urlencoded({
      extended: false
    }));

    app.use(bodyParser.json());
  }

  /**
   * Initializes Express base routes, etc
   */
  initResourceRoutes() {
    const {app, configuration} = this.core;
    const indexFile = path.join(configuration.public, configuration.index);

    app.get('/', (req, res) => res.sendFile(indexFile));
    app.use('/', express.static(configuration.public));

    // Internal ping
    app.get('/ping', (req, res) => {
      this.core.emit('osjs/core:ping', req);

      try {
        req.session.touch();
      } catch (e) {
        this.core.logger.warn(e);
      }

      res.status(200).send('ok');
    });
  }

  /**
   * Initializes Socket routes
   */
  initSocketRoutes() {
    const {app} = this.core;

    app.ws('/', (ws, req) => {
      ws.upgradeReq = ws.upgradeReq || req;
      ws._osjs_client = {...req.session.user};

      const interval = this.core.config('ws.ping', 0);

      const pingInterval = interval ? setInterval(() => {
        ws.send(JSON.stringify({
          name: 'osjs/core:ping'
        }));
      }, interval) : undefined;

      ws.on('close', () => {
        clearInterval(pingInterval);
      });

      ws.on('message', msg => {
        try {
          const {name, params} = JSON.parse(msg);

          if (typeof name === 'string' && params instanceof Array) {
            // We don't wanna allow any internal signals from the outside!
            if (name.match(/^osjs/) && name !== 'osjs/application:socket:message') {
              return;
            }

            this.core.emit(name, ws, ...params);
          }
        } catch (e) {
          this.core.logger.warn(e);
        }
      });

      ws.send(JSON.stringify({
        name: 'osjs/core:connected',
        params: [{
          cookie: {
            maxAge: this.core.config('session.options.cookie.maxAge')
          }
        }]
      }));
    });
  }

  /**
   * Initializes Express proxies
   */
  initProxies() {
    const {app, configuration} = this.core;
    const proxies = (configuration.proxy || []).map(item => ({
      source: null,
      destination: null,
      options: {},
      ...item
    })).filter(item => item.source && item.destination);

    proxies.forEach(item => {
      this.core.logger.info(`Proxying ${item.source} -> ${item.destination}`);
      app.use(item.source, proxy(item.destination, item.options));
    });
  }

  /**
   * Initializes some developer features
   */
  initDeveloperTools() {
    try {
      const watchdir = path.resolve(this.core.configuration.public);
      const watcher = chokidar.watch(watchdir);

      watcher.on('change', filename => {
        // NOTE: 'ignored' does not work as expected with callback
        // ignored: str => str.match(/\.(js|css)$/) === null
        // for unknown reasons
        if (!filename.match(/\.(js|css)$/)) {
          return;
        }

        const relative = filename.replace(watchdir, '');
        this.core.broadcast('osjs/dist:changed', [relative]);
      });

      this.watches.push(watcher);
    } catch (e) {
      this.core.logger.warn(e);
    }
  }
}

module.exports = CoreServiceProvider;
