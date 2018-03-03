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

const path = require('path');
const fs = require('fs');
const {promisify} = require('util');
const symbols = require('log-symbols');

const packages = [];

const init = async (core) => {
  const {app, session, configuration} = core;
  const manifestFile = path.join(configuration.public, 'metadata.json');
  const manifest = JSON.parse(await promisify(fs.readFile)(manifestFile, {encoding: 'utf8'}));

  for (let i = 0; i < manifest.length; i++) {
    const package = manifest[i];

    if (package.server) {
      console.log(symbols.info, `Using ${package._path}/${package.server}`);

      // FIXME
      const serverFile = path.join(process.cwd(), 'src/packages', package._path, package.server);
      const script = require(serverFile);

      try {
        await script.init(core, package);
        packages.push(script);
      } catch (e) {
        console.warn(e);
      }
    }
  }
};

const start = () => {
  packages.forEach(p => p.start());
};

const destroy = () => {
  packages.forEach(p => p.destroy());
};

module.exports = {
  init,
  start,
  destroy
};
