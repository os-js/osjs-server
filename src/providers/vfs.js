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

const systemAdapter = require('../vfs/system');
const fs = require('fs');
const path = require('path');
const url = require('url');
const formidable = require('formidable');
const chokidar = require('chokidar');
const sanitizeFilename = require('sanitize-filename');
const {ServiceProvider} = require('@osjs/common');

const errorCodes = {
  ENOENT: 404,
  EACCES: 401
};

/*
 * Sanitizes a file path
 */
const sanitize = filename => {
  const [name, str] = (filename.replace(/\/+/g, '/').match(/^(\w+):(.*)/) || []).slice(1);
  const sane = str.split('/').map(s => sanitizeFilename(s)).join('/').replace(/\/+/g, '/');
  return name + ':' + sane;
};

/*
 * Asyncronous wrapper for handling form parsing
 */
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

/*
 * Wrapper for handling incoming messages
 */
const parseRequestWrapper = async (req, res, m) => {
  if (m === 'post') {
    return parseFormAsync(req);
  }

  const {query} = url.parse(req.url, true);
  return {fields: query, files: {}};
};

/*
 * Segment value map
 */
const segments = {
  root: {
    dynamic: false,
    fn: () => process.cwd()
  },
  username: {
    dynamic: true,
    fn: req => req.session.user.username
  }
};

/*
 * Gets a segment value
 */
const getSegment = (req, seg) => segments[seg] ? segments[seg].fn(req) : '';

/*
 * Matches a string for segments
 */
const matchSegments = str => (str.match(/(\{\w+\})/g) || []);

/*
 * Resolves a string with segments
 */
const resolveSegments = (req, str) => matchSegments(str)
  .reduce((result, current) => result.replace(current, getSegment(req, current.replace(/(\{|\})/g, ''))), str);

/*
 * Resolves a given file path based on a request
 * Will take out segments from the resulting string
 * and replace them with a list of defined variables
 */
const resolver = (core, req) => file => {
  const mountpoints = core.config('vfs.mountpoints');
  const [name, str] = (file.replace(/\/+/g, '/').match(/^(\w+):(.*)/) || []).slice(1);
  const found = name ? mountpoints.find(m => m.name === name) : false;
  if (!found) {
    throw new Error(`Mountpoint for path '${file}' not found.`);
  }

  const root = resolveSegments(req, found.attributes.root);
  return path.join(root, str);
};

/*
 * Validates a mountpoint groups to the user groups
 */
const validateGroups = (req, method, mountpoint) => {
  const all = (arr, compare) => arr.every(g => compare.indexOf(g) !== -1);

  const groups = mountpoint.attributes.groups || [];
  if (groups.length) {
    const userGroups = req.session.user.groups;

    const namedGroups = groups
      .filter(g => typeof g === 'string');

    const methodGroups = groups
      .find(g => typeof g === 'string' ? false : (method in g));

    const namedValid = namedGroups.length
      ? all(namedGroups, userGroups)
      : true;

    const methodValid = methodGroups
      ? all(methodGroups[method], userGroups)
      : true;

    return namedValid && methodValid;
  }

  return true;
};

/*
 * Gets the prefix of a vfs path
 */
const getPrefix = str => String(str).split(':')[0];

/*
 * Checks if destination is readOnly
 */
const checkReadOnly = (method, mountpoint, fields) => {
  if (mountpoint.attributes.readOnly) {
    const {ro} = method;

    return typeof ro === 'function'
      ? getPrefix(ro(fields)) === mountpoint.name
      : ro;
  }

  return false;
};

/*
 * A list of methods and how to use an incoming request
 */
const methods = [
  {name: 'exists', method: 'get', args: ['path'], ro: false},
  {name: 'stat', method: 'get', args: ['path'], ro: false},
  {name: 'readdir', method: 'get', args: ['path'], ro: false},
  {name: 'readfile', method: 'get', args: ['path'], pipe: true, ro: false},
  {name: 'writefile', method: 'post', args: [
    'path',
    (fields, files) => fs.createReadStream(files.upload.path)
  ], ro: true},
  {name: 'mkdir', method: 'get', args: ['path'], ro: true},
  {name: 'rename', method: 'get', args: ['from', 'to'], ro: true},
  {name: 'copy', method: 'get', args: ['from', 'to'], ro: args => args.to},
  {name: 'unlink', method: 'get', args: ['path'], ro: true}
];

/*
 * Creates the arguments passed on to a VFS method from a request
 */
const createMethodArgs = (fields, files, iter) => 
  iter.args.reduce((result, item) => {
    const param = typeof item === 'function'
      ? item(fields, files)
      : sanitize(fields[item]);

    return result.concat([param]);
  }, []);


/**
 * OS.js Virtual Filesystem Service Provider
 *
 * @desc Provides methods to interact with filesystems
 */
class VFSServiceProvider extends ServiceProvider {

  constructor(core, options = {}) {
    options = Object.assign({
      adapters: {}
    }, options);

    super(core, options);

    this.mountpoints = [];
    this.adapters = Object.assign({
      system: systemAdapter
    }, options.adapters);
  }

  async init() {
    // Expose VFS as service
    this.core.singleton('osjs/vfs', () => ({
      resolve: (req, file) => resolver(this.core, req)(file),
      request: (adapter, method, mockSession = {}) => (...args) => {
        const adapterInstance = this.adapters[adapter](this.core);

        adapterInstance[method]({
          resolve: resolver(this.core, {session: mockSession})
        })(...args);
      }
    }));

    // HTTP routes
    methods.forEach(iter => {
      const uri = '/vfs/' + iter.name;
      const handler = (req, res) => {
        this.request(iter, req, res)
          .catch(error => {
            console.warn(error);
            res.status(500).json({error});
          });
      };

      this.core.make('osjs/express').routeAuthenticated(iter.method, uri, handler);
    });

    // Mountpoints
    this.core.config('vfs.mountpoints')
      .forEach(mount => this.mount(mount));
  }

  request(iter, req, res) {

    const respondError = (msg, code) => res.status(code).json({error: msg});

    return parseRequestWrapper(req, res, iter.method)
      .then(({files, fields}) => {
        const args = createMethodArgs(fields, files, iter);
        const prefix = getPrefix(args[0]);
        const mountpoint = prefix ? this.mountpoints.find(m => m.name === prefix) : null;
        const cleanup = () => {
          // Remove uploads
          for (let fieldname in files) {
            fs.unlink(files[fieldname].path, () => ({/* noop */}));
          }
        };

        if (!mountpoint) {
          return respondError(`Mountpoint not found for '${prefix}'`, 403);
        }

        const m = methods.find(meth => meth.name === iter.name);
        if (checkReadOnly(m, mountpoint, fields)) {
          return respondError(`Mountpoint '${prefix} is read-only'`, 403);
        }

        if (!validateGroups(req, iter.name, mountpoint)) {
          return respondError(`Permission was denied for '${iter.method}' in '${prefix}'`, 403);
        }

        return mountpoint._adapter[iter.name]({
          resolve: resolver(this.core, req)
        })(...args).then(result => {
          try {
            if (iter.pipe) {
              result.pipe(res);
            } else {
              res.json(result);
            }
          } catch (e) {
            console.warn(e);
            res.status(500).send('Fatal error');
          } finally {
            cleanup();
          }
        }).catch(error => {
          console.warn(error);

          if (error.code) {
            const code = errorCodes[error.code] || 400;
            res.status(code).json({error: error.code});
          } else {
            respondError(error, 500); // FIXME
          }

          cleanup();
        });
      });
  }

  mount(mount) {
    const adapter = mount.adapter
      ? (typeof mount.adapter === 'function' ? mount.adapter : this.adapters[mount.adapter])
      : systemAdapter;

    console.log('Mounted', mount.name, mount.attributes);

    const mountpoint = Object.assign({
      _watch: null,
      _adapter: adapter(this.core)
    }, mount);

    this.mountpoints.push(mountpoint);

    this.watch(mountpoint);
  }

  unmount(name) {
    const index = this.mountpoints.findIndex(m => m.name === name);
    if (index !== -1) {
      const mountpoint = this.mountpoints[index];

      if (mountpoint._watch) {
        mountpoint._watch.close();
      }

      this.mountpoints.splice(index, 1);
    }
  }

  watch(mountpoint) {
    if (mountpoint.attributes.watch === false) {
      return;
    }

    const dest = resolveSegments({
      session: {
        user: {
          username: '**'
        }
      }
    }, mountpoint.attributes.root);

    console.log('Watching', dest);

    const watch = chokidar.watch(dest);
    const restr = dest.replace(/\*\*/g, '([^/]*)');
    const re = new RegExp(restr + '/(.*)');
    const seg =  matchSegments(mountpoint.attributes.root)
      .map(s => s.replace(/\{|\}/g, ''))
      .filter(s => segments[s].dynamic);

    watch.on('change', file => {
      const test = re.exec(file);
      const args = seg.reduce((res, k, i) => {
        return Object.assign({}, {[k]: test[i + 1]});
      }, {});

      if (test.length > 0) {
        const target = mountpoint.name + ':/' + test[test.length - 1];
        const keys = Object.keys(args);
        const filter = keys.length === 0
          ? () => true
          : ws => keys.every(k => ws._osjs_client[k] === args[k]);

        this.core.broadcast('osjs/vfs:watch:change', [{
          path: target
        }, args], filter);
      }
    });

    mountpoint._watch = watch;
  }
}

module.exports = VFSServiceProvider;
