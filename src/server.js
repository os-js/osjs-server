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
const symbols = require('log-symbols');

const createConfiguration = cfg => Object.assign({}, {
  index: 'index.html',
  hostname: 'localhost',
  port: 8000,
  public: null,
  morgan: 'tiny'
}, cfg);

const server = (cfg) => {
  const app = express();
  const providers = [];
  const configuration = createConfiguration(cfg);
  const indexFile = path.join(configuration.public, configuration.index);
  const args = {app, express, configuration};
  let stopping;

  if (!configuration.public) {
    throw new Error('The public option is required');
  }

  const start = () => {
    console.log(symbols.info, 'Starting server...');

    providers.forEach((provider) => provider.start(args))

    try {
      app.listen(configuration.port, () => {
        console.log(symbols.info, 'Using directory', configuration.public.replace(process.cwd(), ''));
        console.log(symbols.info, `Listening at ${configuration.hostname}:${configuration.port}`);
        console.log(symbols.success, 'Running...');
      });
    } catch (e) {
      console.error(symbols.error, e);
      process.exit(1);
    }
  };

  const init = async () => {
    console.log(symbols.info, 'Initializing server...');

    if (configuration.morgan) {
      app.use(morgan(configuration.morgan));
    }

    app.get('/', (req, res) => res.sendFile(indexFile));
    app.use('/', express.static(configuration.public));

    for (let i = 0; i < providers.length; i++) {
      try {
        await providers[i].init(args);
      } catch (e) {
        console.warn(symbols.warning, e);
      }
    }

    start();
  };

  const register = (provider) => {
    providers.push(provider);
  };

  const destroy = () => {
    if (stopping) {
      return;
    }
    stopping = true;

    console.log(symbols.warning, 'Stopping server...');

    try {
      providers.forEach((provider) => provider.destroy(args))
    } catch (e) {
      console.warn(symbols.error, e);
    }

    process.exit(0);
  };

  return {
    app,
    init,
    express,
    destroy,
    register,
  };
};

module.exports = server;
