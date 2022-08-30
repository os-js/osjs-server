/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
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
const pathLib = require('path');
const consola = require('consola');
const logger = consola.withTag('Auth');
const jwt = require('jsonwebtoken');
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

/** Keeps track of the active refresh tokens. */
let refreshTokens = [];

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

    /**
     * @type {String}
     * @private
     * @readonly
     */
    this.refreshTokenSecret = core.config('session.options.refreshTokenSecret');

    /**
     * @type {Array}
     * @private
     */
    this.refreshTokens = refreshTokens;

    /**
     * @type {String}
     * @private
     * @readonly
     */
    this.accessTokenSecret = core.config('session.options.accessTokenSecret');
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
   * Creates a refresh token for a user and stores it on the server.
   *
   * @private
   * @param {String} username
   * @param {Array} groups
   * @returns {String}
   */
  createRefreshToken(username, groups) {
    const refreshToken = jwt.sign(
      {username, groups: JSON.stringify(groups)},
      this.refreshTokenSecret
    );

    refreshTokens.push(refreshToken);
    this.refreshTokens.push(refreshToken);
    return refreshToken;
  }

  /**
   * Creates and returns an access token.
   *
   * @private
   * @param {String} username
   * @param {Array} groups
   * @returns {String}
   */
  createAccessToken(username, groups) {
    return jwt.sign(
      {username, groups: JSON.stringify(groups)},
      this.accessTokenSecret,
      {expiresIn: '10m'}
    );
  }

  /**
   * Removes a refresh token from the server.
   *
   * @private
   * @param {String} refreshToken
   */
  removeRefreshToken(refreshToken) {
    refreshTokens = refreshTokens.filter(
      token => token !== refreshToken
    );

    this.refreshTokens = refreshTokens;
  }

  /**
   * Returns the associated user if the access token is valid,
   * otherwise returns false.
   * @param {String} accessToken
   * @returns {Boolean|Object}
   */
  validateAccessToken(accessToken) {
    let returnValue;
    jwt.verify(accessToken, this.accessTokenSecret, (err, user) => {
      returnValue = err ? false : user;
    });

    return returnValue;
  }

  /**
   * Uses a refresh token to create a new access token, then returns the
   * associated user profile along with the new access token.
   *
   * @param {String} refreshToken
   * @returns {Object|Boolean}
   */
  getUserFromRefreshToken(refreshToken) {
    // Need to ensure that the refreshToken hasn't been revoked, hence the
    // second condition checking the array.
    if (!refreshToken || !this.refreshTokens.includes(refreshToken)) {
      return false;
    }

    let returnValue;
    jwt.verify(refreshToken, this.refreshTokenSecret, (err, user) => {
      if (err) {
        this.removeRefreshToken(refreshToken);
        return returnValue = false;
      }

      const accessToken = this.createAccessToken(user.username, user.groups);
      return returnValue = {...user, accessToken};
    });

    return returnValue;
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

    res.status(403).json({error: 'Invalid login or permission denied'});
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

    const {refreshToken} = req.body;
    this.removeRefreshToken(refreshToken);

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
      const passes = requiredGroups.every(name =>
        profile.groups.indexOf(name) !== -1
      );

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
    if (fields.refreshToken) {
      // Decodes the JWT refresh token and returns the user information
      const user = this.getUserFromRefreshToken(fields.refreshToken);
      if (user && user.accessToken) {
        result.username = user.username;
        result.groups = user.groups;
        result.accessToken = user.accessToken;
      } else {
        return false;
      }
    } else {
      result.refreshToken = this.createRefreshToken(fields.username, fields.groups);
      result.accessToken = this.createAccessToken(fields.username, fields.groups);
    }

    const ignores = ['password'];
    const required = ['username'];
    const template = {
      username: fields.username,
      name: fields.username,
      groups: this.core.config('auth.defaultGroups', []),
      refreshToken: fields.refreshToken
    };

    const missing = required.filter(k => typeof result[k] === 'undefined');
    if (missing.length) {
      logger.warn('Missing user attributes', missing);
      return false;
    }

    const values = Object.keys(result)
      .filter(k => ignores.indexOf(k) === -1)
      .reduce((o, k) => ({...o, [k]: result[k]}), {});

    return {...template, ...values};
  }

  /**
   * Tries to create home directory for a user
   * @param {AuthUserProfile} profile User profile
   * @return {Promise<undefined>}
   */
  async createHomeDirectory(profile) {
    const vfs = this.core.make('osjs/vfs');
    const template = this.core.config('vfs.home.template', []);

    if (typeof template === 'string') {
      // If the template is a string, it is a path to a directory
      // that should be copied to the user's home directory
      const root = await vfs.realpath('home:/', profile);

      await fs.copy(template, root, {overwrite: false});
    } else if (Array.isArray(template)) {
      await this.createHomeDirectoryFromArray(template, vfs, profile);
    }
  }

  /**
   * If the template is an array, it is a list of files that should be copied
   * to the user's home directory
   * @param {Object[]} template Array of objects with a specified path,
   * optionally with specified content but defaulting to an empty string
   * @param {VFSServiceProvider} vfs An instance of the virtual file system
   * @param {AuthUserProfile} profile User profile
   */
  async createHomeDirectoryFromArray(template, vfs, profile) {
    for (const file of template) {
      try {
        const {path, contents = ''} = file;
        const shortcutsFile = await vfs.realpath(`home:/${path}`, profile);
        const dir = pathLib.dirname(shortcutsFile);

        if (!await fs.pathExists(shortcutsFile)) {
          await fs.ensureDir(dir);
          await fs.writeFile(shortcutsFile, contents);
        }
      } catch (e) {
        console.warn(`There was a problem writing '${file.path}' to the home directory template`);
        console.error('ERROR:', e);
      }
    }
  }
}

module.exports = Auth;
