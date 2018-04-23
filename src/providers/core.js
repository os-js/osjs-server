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
const express = require('express');
const bodyParser = require('body-parser');
const ServiceProvider = require('../service-provider.js');

const isAuthenticated = gropus => (req, res, next) => {
  if (req.session.username) {
    return next();
  }

  return res.status(403).send('Access denied');
};

/**
 * OS.js Core Service Provider
 *
 * @desc Provides base services
 */
class CoreServiceProvider extends ServiceProvider {

  async init() {
    const {app, session, configuration} = this.core;
    const indexFile = path.join(configuration.public, configuration.index);

    // Handle sessions
    app.use(session);

    // Handle bodies
    app.use(bodyParser.json());

    // Handle index file
    app.get('/', (req, res) => res.sendFile(indexFile));

    // Handle static resources
    app.use('/', express.static(configuration.public));

    // Handle Websocket stuff
    app.ws('/', (ws, req) => {
      // NOTE: This is required to keep the connection open
    });

    this.core.singleton('osjs/express', () => ({
      route: (method, uri, cb) => app[method](uri, cb),
      routeAuthenticated: (method, uri, cb, groups = []) =>
        app[method](uri, isAuthenticated(groups), cb)
    }));
  }

}

module.exports = CoreServiceProvider;
