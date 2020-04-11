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

const path = require('path');
const maxAge = 60 * 60 * 12;
const mb = m => m * 1024 * 1024;

const defaultConfiguration = {
  development: !(process.env.NODE_ENV || '').match(/^prod/i),
  logging: true,
  index: 'index.html',
  hostname: 'localhost',
  port: 8000,
  public: null,
  morgan: 'tiny',
  express: {
    maxFieldsSize: mb(20),
    maxFileSize: mb(200)
  },
  https: {
    enabled: false,
    options: {
      key: null,
      cert: null
    }
  },
  ws: {
    port: null,
    ping: 30 * 1000
  },
  proxy: [
    /*
    {
      source: 'pattern',
      destination: 'pattern',
      options: {}
    }
    */
  ],
  auth: {
    vfsGroups: [],
    defaultGroups: [],
    requiredGroups: [],
    requireAllGroups: false,
    denyUsers: []
  },
  mime: {
    filenames: {
      // 'filename': 'mime/type'
      'Makefile': 'text/x-makefile',
      '.gitignore': 'text/plain'
    },
    define: {
      // 'mime/type': ['ext']
      'text/x-lilypond': ['ly', 'ily'],
      'text/x-python': ['py'],
      'application/tar+gzip': ['tgz']
    }
  },
  session: {
    store: {
      module: require.resolve('connect-loki'),
      options: {
        autosave: true
        //ttl: maxAge
      }
    },
    options: {
      name: 'osjs.sid',
      secret: 'osjs',
      rolling: true,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        maxAge: 1000 * maxAge
      }
    }
  },
  packages: {
    // Resolves to root by default
    discovery: 'packages.json',

    // Resolves to dist/ by default
    metadata: 'metadata.json'
  },

  vfs: {
    watch: false,
    root: path.join(process.cwd(), 'vfs'),

    mountpoints: [{
      name: 'osjs',
      attributes: {
        root: '{root}/dist',
        readOnly: true
      }
    }, {
      name: 'home',
      attributes: {
        root: '{vfs}/{username}'
      }
    }]
  }
};

module.exports = {
  defaultConfiguration
};

