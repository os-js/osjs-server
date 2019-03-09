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
const fg = require('fast-glob');
const chokidar = require('chokidar');
const signale = require('signale').scope('pkg');
const path = require('path');

module.exports = (core, manifest, discovered) => {
  const {configuration} = core;
  const sources = discovered.map(d => path.join(d, 'metadata.json'));
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
            try {
              return script.init()
                .then(() => done())
                .catch(done);
            } catch (e) {
              return done(e);
            }
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
        .then(result => result.filter(iter => !!iter.script))
        .then(result => ({result, watches}))
        .then(resolve)
        .catch(reject);
    });
  });
};

