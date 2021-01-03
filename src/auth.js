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
const consola = require('consola');
const logger = consola.withTag('Auth');
const nullAdapter = require('./adapters/auth/null.js');

/**
 * TODO: typedef
 * @typedef {Object} AuthAdapter
 */

/**
 * Authentication User Profile
 * @typedef {Object} AuthUserProfile
 * @property {number} id
 * @property {string} username
 * @property {string} name
 * @property {string[]} groups
 */

/**
 * Authentication Service Options
 * @typedef {Object} AuthOptions
 * @property {AuthAdapter} [adapter]
 * @property {string[]} [requiredGroups]
 * @property {string[]} [denyUsers]
 */

/**
 * Authentication Handler
 */
class Auth {

  /**
   * Creates a new instance
   * @param {Core} core Core instance reference
   * @param {AuthOptions} [options={}] Service Provider arguments
   */
  constructor(core, options = {}) {
    const {requiredGroups, denyUsers} = core.configuration.auth;

    /**
     * @type {Core}
     */
    this.core = core;

    /**
     * @type {AuthOptions}
     */
    this.options = {
      adapter: nullAdapter,
      requiredGroups,
      denyUsers,
      ...options
    };

    /**
     * @type {AuthAdapter}
     */
    this.adapter = nullAdapter(core, this.options.config);

    try {
      this.adapter = this.options.adapter(core, this.options.config);
    } catch (e) {
      this.core.logger.warn(e);
    }
  }

  /**
   * Destroys instance
   */
  destroy() {
    if (this.adapter.destroy) {
      this.adapter.destroy();
    }
  }

  /**
   * Initializes adapter
   * @return {Promise<boolean>}
   */
  async init() {
    if (this.adapter.init) {
      return this.adapter.init();
    }

    return true;
  }

  /**
   * Performs a login request
   * @param {Request} req HTTP request
   * @param {Response} res HTTP response
   * @return {Promise<undefined>}
   */
  async login(req, res) {
    const result = await this.adapter.login(req, res);

    if (result) {
      const profile = this.createUserProfile(req.body, result);

      if (profile && this.checkLoginPermissions(profile)) {
        await this.createHomeDirectory(profile, req, res);
        req.session.user = profile;
        req.session.save(() => {
          this.core.emit('osjs/core:logged-in', Object.freeze({
            ...req.session
          }));

          res.status(200).json(profile);
        });
        return;
      }
    }

    res.status(403)
      .json({error: 'Invalid login or permission denied'});
  }

  /**
   * Performs a logout request
   * @param {Request} req HTTP request
   * @param {Response} res HTTP response
   * @return {Promise<undefined>}
   */
  async logout(req, res) {
    this.core.emit('osjs/core:logging-out', Object.freeze({
      ...req.session
    }));

    await this.adapter.logout(req, res);

    try {
      req.session.destroy();
    } catch (e) {
      logger.warn(e);
    }

    res.json({});
  }

  /**
   * Performs a register request
   * @param {Request} req HTTP request
   * @param {Response} res HTTP response
   * @return {Promise<undefined>}
   */
  async register(req, res) {
    if (this.adapter.register) {
      const result = await this.adapter.register(req, res);

      return res.json(result);
    }

    return res.status(403)
      .json({error: 'Registration unavailable'});
  }

  /**
   * Checks if login is allowed for this user
   * @param {AuthUserProfile} profile User profile
   * @return {boolean}
   */
  checkLoginPermissions(profile) {
    const {requiredGroups, denyUsers} = this.options;

    if (denyUsers.indexOf(profile.username) !== -1) {
      return false;
    }

    if (requiredGroups.length > 0) {
      const passes = requiredGroups.every(name => {
        return profile.groups.indexOf(name) !== -1;
      });

      return passes;
    }

    return true;
  }

  /**
   * Creates user profile object
   * @param {object} fields Input fields
   * @param {object} result Login result
   * @return {AuthUserProfile|boolean}
   */
  createUserProfile(fields, result) {
    const ignores = ['password'];
    const required = ['username', 'id'];
    const template = {
      id: 0,
      username: fields.username,
      name: fields.username,
      groups: this.core.config('auth.defaultGroups', [])
    };

    const missing = required
      .filter(k => typeof result[k] === 'undefined');

    if (missing.length) {
      logger.warn('Missing user attributes', missing);
    } else {
      const values = Object.keys(result)
        .filter(k => ignores.indexOf(k) === -1)
        .reduce((o, k) => ({...o, [k]: result[k]}), {});

      return {...template, ...values};
    }

    return false;
  }

  /**
   * Tries to create home directory for a user
   * @param {AuthUserProfile} profile User profile
   * @return {Promise<undefined>}
   */
  async createHomeDirectory(profile) {
    try {
      const homeDir = await this
        .core
        .make('osjs/vfs')
        .realpath('home:/', profile);

      await fs.ensureDir(homeDir);
    } catch (e) {
      console.warn('Failed trying to make home directory for', profile.username);
    }
  }
}

module.exports = Auth;
