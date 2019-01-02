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

/**
 * Read a directory
 * @return {Promise<Error, Object[]>} A list of files
 */
module.exports.readdir = (req, res, fields, files) => (core, adapter, mount) => adapter
  .readdir(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Reads a file
 * @return {Promise<Error, Stream>}
 */
module.exports.readfile = (req, res, fields, files) => (core, adapter, mount) => adapter
  .readfile(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Writes a file
 * @return {Promise<Error, Number>} File size
 */
module.exports.writefile = (req, res, fields, files) => (core, adapter, mount) => {
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
module.exports.copy = (req, res, fields, files) => (core, adapter, mount) => adapter
  .copy(({req, res, mount}))(fields.from, fields.to, fields.options, mount)
  .then(result => typeof result === 'boolean' ? result : !!result);

/**
 * Renames a file or directory (move)
 * @return {Promise<Error, Boolean>}
 */
module.exports.rename = (req, res, fields, files) => (core, adapter, mount) => adapter
  .rename(({req, res, mount}))(fields.from, fields.to, fields.options, mount)
  .then(result => typeof result === 'boolean' ? result : !!result);

/**
 * Creates a directory
 * @return {Promise<Error, Boolean>}
 */
module.exports.mkdir = (req, res, fields, files) => (core, adapter, mount) => {
  const options = fields.options || {};

  return adapter
    .mkdir(({req, res, mount}))(fields.path, options, mount)
    .then(result => typeof result === 'boolean' ? result : !!result)
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
module.exports.unlink = (req, res, fields, files) => (core, adapter, mount) => adapter
  .unlink(({req, res, mount}))(fields.path, fields.options, mount)
  .then(result => typeof result === 'boolean' ? result : !!result);

/**
 * Checks if path exists
 * @return {Promise<Error, Boolean>}
 */
module.exports.exists = (req, res, fields, files) => (core, adapter, mount) => adapter
  .exists(({req, res, mount}))(fields.path, fields.options, mount)
  .then(result => typeof result === 'boolean' ? result : !!result);

/**
 * Gets the stats of the file or directory
 * @return {Promise<Error, Object>}
 */
module.exports.stat = (req, res, fields, files) => (core, adapter, mount) => adapter
  .stat(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Searches for files and folders
 * @return {Promise<Error, Object[]>}
 */
module.exports.search = (req, res, fields, files) => (core, adapter, mount) => {
  if (mount.attributes && mount.attributes.searchable === false) {
    return Promise.resolve([]);
  }

  return adapter
    .search(({req, res, mount}))(fields.root, fields.pattern, fields.options, mount);
};

/**
 * Touches a file
 * @return {Promise<Error, Object[]>}
 */
module.exports.touch = (req, res, fields, files) => (core, adapter, mount) => adapter
  .touch(({req, res, mount}))(fields.path, fields.options, mount);
