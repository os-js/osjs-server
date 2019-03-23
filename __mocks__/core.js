const temp = require('temp').track();
const path = require('path');
const config = require('../src/config.js');

const {
  Core,
  CoreServiceProvider,
  PackageServiceProvider,
  VFSServiceProvider,
  AuthServiceProvider,
  SettingsServiceProvider
} = require('../index.js');

module.exports = () => {
  const tempPath = temp.mkdirSync('osjs-vfs');

  const osjs = new Core(Object.assign({
    tempPath,
    development: false,
    port: 0,
    root: path.dirname(__dirname),
    public: '/tmp', //  FIXME
    vfs: {
      root: tempPath,
    },
    mime: {
      filenames: {
        'defined file': 'test/jest'
      }
    }
  }, config), {
    kill: false
  });

  osjs.logger = new Proxy({}, {
    get: () => () => {}
  });

  osjs.register(CoreServiceProvider, {before: true});
  osjs.register(PackageServiceProvider);
  osjs.register(VFSServiceProvider);
  osjs.register(AuthServiceProvider);
  osjs.register(SettingsServiceProvider);

  return osjs.boot()
    .then(() => osjs);
};

