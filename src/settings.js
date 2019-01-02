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
const path = require('path');
const {Readable} = require('stream');

const nullAdapter = (core, options) => ({
  save: (req, res) => Promise.resolve(true),
  load: (req, res) => Promise.resolve({})
});

const fsAdapter = (core, options) => {
  const fsOptions = Object.assign({
    system: false,
    path: 'home:/.osjs',
    filename: 'settings.json'
  }, options || {});

  const request = (method, req, res, fields = {}, files = {}) => core
    .make('osjs/vfs').request(method, {req, res, fields, files});

  const createStream = json => {
    const s = new Readable();
    s.push(json);
    s.push(null);
    return s;
  };

  const dest = fsOptions.system
    ? path.join(fsOptions.path, fsOptions.filename)
    : `${fsOptions.path}/${fsOptions.filename}`;

  const mkdir = (req, res) => fsOptions.system
    ? fs.ensureDir(fsOptions.path)
    : request('mkdir', req, res, {
      path: fsOptions.path,
      options: {}
    }).catch(() => true);

  const write = (req, res) => fsOptions.system
    ? fs.writeJson(dest, req.body)
    : request('writefile', req, res, {
      path: dest,
      options: {}
    },  {
      upload: createStream(JSON.stringify(req.body))
    });

  const read = (req, res) => fsOptions.system
    ? fs.readJson(dest)
    : request('readfile', req, res, {
      path: dest,
      options: {}
    }).then(stream => new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', buf => chunks.push(buf));
      stream.on('error', err => reject(err));
      stream.on('end', () => {
        resolve(JSON.parse(chunks.join('')));
      });
    }));

  const save = (req, res) => mkdir(req, res)
    .then(() => write(req, res));

  const load = (req, res) => mkdir(req, res)
    .then(() => read(req, res));

  return {save, load};
};

/**
 * OS.js Settings Manager
 */
class Settings {

  constructor(core, options) {
    this.core = core;
    this.options = Object.assign({
      adapter: nullAdapter
    }, options);

    if (this.options.adapter === 'fs') {
      this.options.adapter = fsAdapter;
    }

    try {
      this.adapter = this.options.adapter(core, this.options.config);
    } catch (e) {
      console.warn(e);
      this.adapter = nullAdapter(core, this.options.config);
    }
  }

  destroy() {
    if (this.adapter.destroy) {
      this.adapter.destroy();
    }
  }

  /**
   * Initializes adapter
   */
  async init() {
    if (this.adapter.init) {
      await this.adapter.init();
    }
  }

  /**
   * Sends save request to adapter
   */
  async save(req, res) {
    const result = await this.adapter.save(req, res);
    res.json(result);
  }

  /**
   * Sends load request to adapter
   */
  async load(req, res) {
    const result = await this.adapter.load(req, res);
    res.json(result);
  }
}


module.exports = Settings;
