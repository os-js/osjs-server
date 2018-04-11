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

const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const {promisify} = require('util');
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const renameAsync = promisify(fs.rename);
const unlinkAsync = promisify(fs.rename);

/*
 * Resolves "real path"
 */
const createRealPath = file => path.join('/', process.cwd(), file || '/'); // FIXME

/*
 * Creates an object readable by client
 */
const createFileIter = async (realRoot, file) => {
  const filename = path.basename(file);
  const realPath = path.join(realRoot, filename);
  const stat = await statAsync(realPath);

  return {
    isDirectory: stat.isDirectory(),
    isFile: stat.isFile(),
    mime: stat.isFile()
      ? mime.lookup(realPath) || 'application/octet-stream'
      : null,
    size: stat.size,
    path: file,
    filename,
    stat
  };
};

/**
 * Checks if file exists
 * @param {String} file The file path from client
 * @return {Promise<boolean, Error>}
 */
const exists = (file) => new Promise((resolve, reject) => {
  fs.access(file, fs.F_OK, err => resolve(!err));
});

/**
 * Get file statistics
 * @param {String} file The file path from client
 * @return {Object}
 */
const stat = async (file) => {
  const realPath = createRealPath(file);
  const stat = await statAsync(realPath);
  return createFileIter(realPath, file)
};

/**
 * Reads directory
 * @param {String} root The file path from client
 * @return {Object[]}
 */
const readdir = async (root) => {
  const realPath = createRealPath(root);
  const files = await readdirAsync(realPath);
  const result = [];

  for (let i = 0; i < files.length; i++) {
    const file = path.join(root, files[i]);
    const iter = await createFileIter(realPath, file);
    result.push(iter);
  }

  return result;
};

/**
 * Reads file stream
 * @param {String} file The file path from client
 * @return {stream.Readable}
 */
const readfile = async (file) => {
  const realPath = createRealPath(file);
  const stat = await statAsync(realPath);

  if (stat.isFile()) {
    return fs.createReadStream(realPath, {
      flags: 'r'
    });
  }

  return false;
};

/**
 * Creates directory
 * @param {String} file The file path from client
 * @return {boolean}
 */
const mkdir = async (file) => {
  const realPath = createRealPath(file);

  await mkdirAsync(realPath);

  return true;
};

/**
 * Writes file stream
 * @param {String} file The file path from client
 * @param {stream.Writable} data The stream
 * @return {boolean}
 */
const writefile = async (file, data) => {
  throw new Error('Not implemented'); // TODO
};

/**
 * Renames given file or directory
 * @param {String} src The source file path from client
 * @param {String} dest The destination file path from client
 * @return {boolean}
 */
const rename = async (src, dest) => {
  const realSource = createRealPath(src);
  const realDest = createRealPath(dest);

  await renameAsync(realSource, realDest);

  return true;
};

/**
 * Removes given file or directory
 * @param {String} file The file path from client
 * @return {boolean}
 */
const unlink = async (file) => {
  // TODO: Recursively remove directories
  const realPath = createRealPath(file);

  await unlinkAsync(realPath);

  return true;
};

module.exports = {
  stat,
  exists,
  readdir,
  readfile,
  writefile,
  mkdir,
  rename,
  unlink
};
