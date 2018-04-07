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
const fs = require('fs');
const globby = require('globby');
const {promisify} = require('util');
const symbols = require('log-symbols');
const ServiceProvider = require('../service-provider.js');

/*
 * Creates a helper passed on to application methods
 */
const proc = metadata => ({
  metadata,
  resource: (path) => {
    if (path.substr(0, 1) !== '/') {
      path = '/' + path;
    }
    return `/apps/${metadata._path}${path}`;
  }
});

/**
 * OS.js Package Service Provider
 *
 * @desc Provides package services
 */
class PackageServiceProvider extends ServiceProvider {
  constructor(core) {
    super(core);
    this.packages = [];
  }

  async init() {
    const {app, session, configuration} = this.core;
    const readJson = async (f) => JSON.parse(await promisify(fs.readFile)(f, {encoding: 'utf8'}));

    const files = await globby(path.join(configuration.root, 'src/packages/*/metadata.json'));
    const manifest = await readJson(path.join(configuration.public, 'metadata.json'));

    for (let i = 0; i < files.length; i++) {
      const file = await readJson(files[i]);
      const metadata = manifest.find(m => m.name == file.name);
      if (!metadata || !metadata.server) {
        continue;
      }

      const serverFile = path.join(path.dirname(files[i]), metadata.server);
      if (!fs.existsSync(serverFile)) {
        continue;
      }

      console.log(symbols.info, `Using ${metadata._path}/${metadata.server}`);
      const script = require(serverFile);

      try {
        await script.init(this.core, proc(metadata));

        this.packages.push({
          metadata,
          script
        });
      } catch (e) {
        console.warn(e);
      }
    }
  }

  start() {
    this.packages.forEach(({script, metadata}) => script.start(this.core, proc(metadata)));
  }

  destroy() {
    this.packages.forEach(({script, metadata}) => script.destroy(this.core, proc(metadata)));
    this.packages =[];
  }
}

module.exports = PackageServiceProvider;
