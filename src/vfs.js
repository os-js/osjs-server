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
const {Stream} = require('stream');

/*
 * Performs an action to adapter VFS method
 */
const action = (method, cb) => ({req, res, fields, files, adapter, mount}) =>
  adapter[method](({req, res, mount}))(...cb(fields, files), fields.options, mount);

/*
 * Action for VFS actions using 'path' argument
 */
const defaultAction = method => action(method, (fields) => ([fields.path]));

/*
 * Action for different source/target
 */
const divergedAction = method => action(method, (fields) => ([fields.from, fields.to]));

/*
 * Returns a boolean from VFS result
 */
const wrapBoolean = cb => args => cb(args)
  .then(result => typeof result === 'boolean' ? result : !!result);


/**
 * Read a directory
 * @return {Promise<Error, Object[]>} A list of files
 */
module.exports.readdir = defaultAction('readdir');

/**
 * Reads a file
 * @return {Promise<Error, Stream>}
 */
module.exports.readfile = defaultAction('readfile');

/**
 * Writes a file
 * @return {Promise<Error, Number>} File size
 */
module.exports.writefile = ({req, res, fields, files, adapter, mount}) => {
  const isStream = files.upload instanceof Stream;
  const stream = isStream
    ? files.upload
    : fs.createReadStream(files.upload.path);

  return adapter
    .writefile(({req, res, mount}))(fields.path, stream, fields.options, mount)
    .then(result => typeof result === 'number' ? result : -1);
};

/**
 * Copies a file or directory (move)
 * @return {Promise<Error, Boolean>}
 */
module.exports.copy = wrapBoolean(divergedAction('copy'));

/**
 * Renames a file or directory (move)
 * @return {Promise<Error, Boolean>}
 */
module.exports.rename = wrapBoolean(divergedAction('rename'));

/**
 * Creates a directory
 * @return {Promise<Error, Boolean>}
 */
module.exports.mkdir = args => {
  const options = args.fields.options || {};

  return wrapBoolean(defaultAction('mkdir'))(args)
    .catch(error => {
      if (options.ensure && error.code === 'EEXIST') {
        return true;
      }

      return Promise.reject(error);
    });
};

/**
 * Removes a file or directory
 * @return {Promise<Error, Boolean>}
 */
module.exports.unlink = wrapBoolean(defaultAction('unlink'));

/**
 * Checks if path exists
 * @return {Promise<Error, Boolean>}
 */
module.exports.exists = wrapBoolean(defaultAction('exists'));

/**
 * Gets the stats of the file or directory
 * @return {Promise<Error, Object>}
 */
module.exports.stat = defaultAction('stat');

/**
 * Searches for files and folders
 * @return {Promise<Error, Object[]>}
 */
module.exports.search = args => {
  if (args.mount.attributes && args.mount.attributes.searchable === false) {
    return Promise.resolve([]);
  }

  return action('search', fields => ([fields.root, fields.pattern]))(args);
};

/**
 * Touches a file
 * @return {Promise<Error, Object[]>}
 */
module.exports.touch = defaultAction('touch');

/**
 * Gets the real filesystem path if available (internal only)
 * @return {Promise<Error, string>}
 */
module.exports.realpath = defaultAction('realpath');
