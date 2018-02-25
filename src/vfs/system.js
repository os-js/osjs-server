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

const readdir = async (root, vfsPath) => {
  const files = await promisify(fs.readdir)(root)
  const result = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const file = path.join(root, filename);
    const stat = await promisify(fs.stat)(file)

    result.push({
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      mime: stat.isFile()
        ? mime.lookup(file) || 'application/octet-stream'
        : null,
      size: stat.size,
      path: path.join(vfsPath, filename),
      filename,
      stat
    });
  }

  return result;
};

const readfile = async (file) => {
  const stat = await promisify(fs.stat)(file);

  if (stat.isFile()) {
    return fs.createReadStream(file, {
      flags: 'r'
    });
  }

  return false;
};

module.exports = {
  readdir,
  readfile
};
