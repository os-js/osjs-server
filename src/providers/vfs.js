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

const vfs = require('../vfs/system');
const fs = require('fs');
const path = require('path');
const url = require('url');
const formidable = require('formidable');
const ServiceProvider = require('../service-provider.js');

const vfsRequestWrapper = async (req, res, k, m, args) => {
  try {
    const result = await vfs[k](...args);

    if (k === 'readfile') {
      if (result) { // stream
        result.pipe(res);
      } else {
        res.status(500)
          .send('Failed to create stream');
      }
    } else {
      res.json(result);
    }
  } catch (e) {
    console.warn(e);

    // FIXME
    res.status(404)
      .json({error: e});
  }
};

const parseFormAsync = req => new Promise((resolve, reject) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields, files) => {
    if (err) {
      reject(err);
    } else {
      resolve({fields, files});
    }
  });
});

const parseRequestWrapper = async (req, res, k, m) => {
  if (m === 'post') {
    const form = new formidable.IncomingForm();
    return parseFormAsync(req);
  }

  const {query} = url.parse(req.url, true);
  return {fields: query, files: {}};
};

/**
 * OS.js Virtual Filesystem Service Provider
 *
 * @desc Provides methods to interact with filesystems
 */
class VFSServiceProvider extends ServiceProvider {

  async init() {
    const methods = {
      'exists': ['path'],
      'stat': ['path'],
      'readdir': ['path'],
      'readfile': ['path'],
      'writefile': [
        (fields, files) => fields.path,
        (fields, files) => fs.createReadStream(files.upload.path)
      ],
      'mkdir': ['path'],
      'rename': ['from', 'to'],
      'unlink': ['path']
    };

    Object.keys(methods).forEach(k => {
      const m = k === 'writefile' ? 'post' : 'get';

      this.core.app[m]('/vfs/' + k, async (req, res) => {
        try {
          const {fields, files} = await parseRequestWrapper(req, res, k, m);

          const args = methods[k].reduce((result, item) => {
            const param = typeof item === 'function'
              ? item(fields, files)
              : fields[item];

            return result.concat([param]);
          }, []);

          await vfsRequestWrapper(req, res, k, m, args);
        } catch (error) {
          res.status(500).json({error});
        }
      });
    });
  }

}

module.exports = VFSServiceProvider;
