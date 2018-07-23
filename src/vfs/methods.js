/*
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

const fs = require('fs-extra');
const {Stream} = require('stream');

/**
 * Read a directory
 *
 * @param {String} path The path to read
 * @param {Object} [options] Options
 * @return {Object[]} A list of files
 */
module.exports.readdir = (req, res, fields, files) => (core, adapter, mount) => adapter
  .readdir(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Reads a file
 *
 * @param {String} path The path to read
 * @param {Object} [options] Options
 * @return {Stream}
 */
module.exports.readfile = (req, res, fields, files) => (core, adapter, mount) => adapter
  .readfile(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Writes a file
 * @param {String} path The path to write
 * @param {ArrayBuffer|Blob|String} data The data
 * @param {Object} [options] Options
 * @return {Number} File size
 */
module.exports.writefile = (req, res, fields, files) => (core, adapter, mount) => {
  const isStream = files.upload instanceof Stream;
  const stream = isStream
    ? files.upload
    : fs.createReadStream(files.upload.path);

  return adapter
    .writefile(({req, res, mount}))(fields.path, stream, fields.options, mount);
};

/**
 * Copies a file or directory (move)
 * @param {String} from The source (from)
 * @param {String} to The destination (to)
 * @param {Object} [options] Options
 * @return {Boolean}
 */
module.exports.copy = (req, res, fields, files) => (core, adapter, mount) => adapter
  .copy(({req, res, mount}))(fields.from, fields.to, fields.options, mount);

/**
 * Renames a file or directory (move)
 * @param {String} from The source (from)
 * @param {String} to The destination (to)
 * @param {Object} [options] Options
 * @return {Boolean}
 */
module.exports.rename = (req, res, fields, files) => (core, adapter, mount) => adapter
  .rename(({req, res, mount}))(fields.from, fields.to, fields.options, mount);

/**
 * Creates a directory
 * @param {String} path The path to new directory
 * @param {Object} [options] Options
 * @return {Boolean}
 */
module.exports.mkdir = (req, res, fields, files) => (core, adapter, mount) => adapter
  .mkdir(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Removes a file or directory
 * @param {String} path The path to remove
 * @param {Object} [options] Options
 * @return {Boolean}
 */
module.exports.unlink = (req, res, fields, files) => (core, adapter, mount) => adapter
  .unlink(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Checks if path exists
 * @param {String} path The path to check
 * @param {Object} [options] Options
 * @return {Boolean}
 */
module.exports.exists = (req, res, fields, files) => (core, adapter, mount) => adapter
  .exists(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Gets the stats of the file or directory
 * @param {String} path The path to check
 * @param {Object} [options] Options
 * @return {Object}
 */
module.exports.stat = (req, res, fields, files) => (core, adapter, mount) => adapter
  .stat(({req, res, mount}))(fields.path, fields.options, mount);

/**
 * Searches for files and folders
 * @param {String} root The root
 * @param {String} pattern Search pattern
 * @param {Object} [options] Options
 * @return {String}
 */
module.exports.search = (req, res, fields, files) => (core, adapter, mount) => adapter
  .search(({req, res, mount}))(fields.root, fields.pattern, fields.options, mount);
