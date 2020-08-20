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

const fs = require('fs-extra');
const fg = require('fast-glob');
const path = require('path');
const Package = require('./package.js');
const consola = require('consola');
const logger = consola.withTag('Packages');

const relative = filename => filename.replace(process.cwd(), '');

const readOrDefault = filename => fs.existsSync(filename)
  ? fs.readJsonSync(filename)
  : [];

/**
 * Package Service Options
 * @typedef {Object} PackagesOptions
 * @property {string} [manifestFile] Manifest filename
 * @property {string} [discoveredFile] Discovery output file
 */

/**
 * OS.js Package Management
 */
class Packages {

  /**
   * Create new instance
   * @param {Core} core Core reference
   * @param {PackagesOptions} [options] Instance options
   */
  constructor(core, options = {}) {
    /**
     * @type {Core}
     */
    this.core = core;

    /**
     * @type {Package[]}
     */
    this.packages = [];

    this.hotReloading = {};

    /**
     * @type {PackagesOptions}
     */
    this.options = {
      manifestFile: null,
      discoveredFile: null,
      ...options
    };
  }

  /**
   * Initializes packages
   */
  init() {
    this.core.on('osjs/application:socket:message', (ws, ...params) => {
      this.handleMessage(ws, params);
    });

    return this.load();
  }

  /**
   * Loads package manager
   * @return {Promise<boolean>}
   */
  load() {
    return this.createLoader()
      .then(packages => {
        this.packages = this.packages.concat(packages);

        return true;
      });
  }

  /**
   * Loads all packages
   * @return {Promise<Package[]>}
   */
  createLoader() {
    let result = [];
    const {discoveredFile, manifestFile} = this.options;
    const discovered = readOrDefault(discoveredFile);
    const manifest = readOrDefault(manifestFile);
    const sources = discovered.map(d => path.join(d, 'metadata.json'));

    logger.info('Using package discovery file', relative(discoveredFile));
    logger.info('Using package manifest file', relative(manifestFile));

    const stream = fg.stream(sources, {
      extension: false,
      brace: false,
      deep: 1,
      case: false
    });

    stream.on('error', error => logger.error(error));
    stream.on('data', filename => {
      result.push(this.loadPackage(filename, manifest));
    });

    return new Promise((resolve, reject) => {
      stream.once('end', () => {
        Promise.all(result)
          .then(result => result.filter(iter => !!iter.handler))
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * When a package dist has changed
   * @param {Package} pkg Package instance
   */
  onPackageChanged(pkg) {
    clearTimeout(this.hotReloading[pkg.metadata.name]);

    this.hotReloading[pkg.metadata.name] = setTimeout(() => {
      logger.debug('Sending reload signal for', pkg.metadata.name);
      this.core.broadcast('osjs/packages:package:changed', [pkg.metadata.name]);
    }, 500);
  }

  /**
   * Loads package data
   * @param {string} filename Filename
   * @param {PackageMetadata} manifest Manifest
   * @return {Promise<Package>}
   */
  loadPackage(filename, manifest) {
    const done = (pkg, error) => {
      if (error) {
        logger.warn(error);
      }

      return Promise.resolve(pkg);
    };

    return fs.readJson(filename)
      .then(metadata => {
        const pkg = new Package(this.core, {
          filename,
          metadata
        });

        return this.initializePackage(pkg, manifest, done);
      });
  }

  /**
   * Initializes a package
   * @return {Promise<Package>}
   */
  initializePackage(pkg, manifest, done) {
    if (pkg.validate(manifest)) {
      logger.info(`Loading ${relative(pkg.script)}`);

      try {
        if (this.core.configuration.development) {
          pkg.watch(() => {
            this.onPackageChanged(pkg);
          });
        }

        return pkg.init()
          .then(() => done(pkg))
          .catch(e => done(pkg, e));
      } catch (e) {
        return done(pkg, e);
      }
    }

    return done(pkg);
  }

  /**
   * Starts packages
   */
  start() {
    this.packages.forEach(pkg => pkg.start());
  }

  /**
   * Destroys packages
   * @return {Promise<undefined>}
   */
  async destroy() {
    await Promise.all(this.packages.map(pkg => pkg.destroy()));

    this.packages = [];
  }

  /**
   * Handles an incoming message and signals an application
   *
   * This will call the 'onmessage' event in your application server script
   *
   * @param {WebSocket} ws Websocket Connection client
   * @param {Array} params A list of incoming parameters
   */
  handleMessage(ws, params) {
    const {pid, name, args} = params[0];
    const found = this.packages.findIndex(({metadata}) => metadata.name === name);

    if (found !== -1) {
      const {handler} = this.packages[found];
      if (handler && typeof handler.onmessage === 'function') {
        const respond = (...respondParams) => ws.send(JSON.stringify({
          name: 'osjs/application:socket:message',
          params: [{
            pid,
            args: respondParams
          }]
        }));

        handler.onmessage(ws, respond, args);
      }
    }
  }
}

module.exports = Packages;
