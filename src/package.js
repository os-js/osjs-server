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
const chokidar = require('chokidar');

/**
 * TODO: typedef
 * @typedef {Object} PackageMetadata
 */

/**
 * Package Options
 * @typedef {Object} PackageOptions
 * @property {string} filename
 * @property {PackageMetadata} metadata
 */

/**
 * OS.js Package Abstraction
 */
class Package {

  /**
   * Create new instance
   * @param {Core} core Core reference
   * @param {PackageOptions} [options] Instance options
   */
  constructor(core, options = {}) {
    /**
     * @type {Core}
     */
    this.core = core;

    this.script = options.metadata.server
      ? path.resolve(path.dirname(options.filename), options.metadata.server)
      : null;

    /**
     * @type {string}
     */
    this.filename = options.filename;

    /**
     * @type {PackageMetadata}
     */
    this.metadata = options.metadata;

    this.handler = null;

    this.watcher = null;
  }

  /**
   * Destroys instance
   */
  async destroy() {
    this.action('destroy');

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Run method on package script
   * @param {string} method Method name
   * @param {*} [...args] Pass arguments
   * @return {boolean}
   */
  action(method, ...args) {
    try {
      if (this.handler && typeof this.handler[method] === 'function') {
        this.handler[method](...args);

        return true;
      }
    } catch (e) {
      this.core.logger.warn(e);
    }

    return false;
  }

  /**
   * Validates this package
   * @param {PackageMetadata[]} manifest Global manifest
   * @return {boolean}
   */
  validate(manifest) {
    return this.script &&
      this.metadata &&
      !!manifest.find(iter => iter.name === this.metadata.name);
  }

  /**
   * Initializes this package
   * @return {Promise<undefined>}
   */
  init() {
    const handler = require(this.script);

    this.handler = handler(this.core, this);

    if (typeof this.handler.init === 'function') {
      return this.handler.init();
    }

    return Promise.resolve();
  }

  /**
   * Starts server scripts
   * @return {Promise<undefined>}
   */
  start() {
    return this.action('start');
  }

  /**
   * Creates a watch in package dist
   * @param {Function} cb Callback function on watch changes
   * @return {string} Watched path
   */
  watch(cb) {
    const pub = this.core.config('public');
    const dist = path.join(pub, 'apps', this.metadata.name);

    this.watcher = chokidar.watch(dist);
    this.watcher.on('change', () => cb(this.metadata));

    return dist;
  }

  /**
   * Resolve an URL for resource
   * @param {string} path Input path
   * @return {string}
   */
  resource(path) {
    if (path.substr(0, 1) !== '/') {
      path = '/' + path;
    }

    return `/apps/${this.metadata.name}${path}`;
  }
}

module.exports = Package;
