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
const fs = require('fs-extra');
const fg = require('fast-glob');
const signale = require('signale').scope('pkg');
const chokidar = require('chokidar');
const {ServiceProvider} = require('@osjs/common');

/*
 * Loads all packages as a stream
 */
const loader = (core, manifest) => {
  const {configuration} = core;
  const sources = path.join(configuration.root, 'src/packages/*/metadata.json');
  const metadataInManifest = metadata => !!manifest.find(iter => iter.name === metadata.name);
  const validateMetadata = metadata => !!metadata.server && metadataInManifest(metadata);
  const validateScript = script => script && typeof script.init === 'function';

  const createWatch = (metadata, cb) => {
    const dist = path.join(configuration.public, 'apps', metadata.name);
    const watcher = chokidar.watch(dist);
    watcher.on('change', () => cb(metadata));
    signale.watch(dist);
    return watcher;
  };

  const createInstance = (filename, metadata) => {
    try {
      const server = path.resolve(path.dirname(filename), metadata.server);
      signale.await(`Loading ${server}`);

      return require(server)(core, {
        filename,
        metadata,
        resource: (path) => {
          if (path.substr(0, 1) !== '/') {
            path = '/' + path;
          }
          return `/apps/${metadata.name}${path}`;
        }
      });
    } catch (e) {
      signale.warn(e);
    }

    return null;
  };

  return cb => new Promise((resolve, reject) => {
    const stream = fg.stream(sources, {
      extension: false,
      brace: false,
      deep: 1,
      case: false
    });

    let result = [];
    let watches = [];

    stream.on('data', filename => {
      const promise = fs.readJson(filename)
        .then(metadata => {
          let script;

          const done = error => {
            if (error) {
              signale.warn(error);
            }

            return Promise.resolve({filename, metadata, script});
          };

          if (configuration.development) {
            watches.push(createWatch(metadata, cb));
          }

          if (validateMetadata(metadata)) {
            script = createInstance(filename, metadata);
          }

          if (validateScript(script)) {
            return script.init()
              .then(() => done())
              .catch(done);
          }

          return done();
        });

      result.push(promise);
    });

    stream.on('error', error => {
      signale.warn(error);
    });

    stream.once('end', () => {
      Promise.all(result)
        .then(result => ({result, watches}))
        .then(resolve)
        .catch(reject);
    });
  });
};

/**
 * OS.js Package Service Provider
 *
 * @desc Provides package services
 */
class PackageServiceProvider extends ServiceProvider {
  constructor(core) {
    super(core);

    this.packages = [];
    this.watches = [];
    this.hotReloading = {};
  }

  init() {
    const {configuration} = this.core;
    const distDir = path.join(configuration.public, 'metadata.json');
    const manifestFile = path.join(configuration.public, 'metadata.json');

    if (this.core.config('development')) {
      const watcher = chokidar.watch(distDir);
      watcher.on('change', () => {
        this.core.broadcast('osjs/packages:metadata:changed');
      });
      this.watches.push(watcher);
    }

    return fs.readJson(manifestFile)
      .then(manifest => {
        const load = loader(this.core, manifest);

        return load(metadata => {
          clearTimeout(this.hotReloading[metadata.name]);
          this.hotReloading[metadata.name] = setTimeout(() => {
            signale.info('Reloading', metadata.name);
            this.core.broadcast('osjs/packages:package:changed', metadata.name);
          }, 500);
        }).then(({result, watches}) => {
          this.watches = watches;
          this.packages = this.packages.concat(result);
        });
      });
  }

  start() {
    this.packages.forEach(({script, metadata}) => {
      if (typeof script.start === 'function') {
        script.start();
      }
    });
  }

  destroy() {
    this.packages.forEach(({script, metadata}) => {
      if (typeof script.destroy === 'function') {
        script.destroy();
      }
    });

    this.watches.forEach(watch => watch.close());

    this.packages = [];
    this.watches = [];
  }
}

module.exports = PackageServiceProvider;
