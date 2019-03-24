const consola = require('consola');
consola.pauseLogs();

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

module.exports = (options = {}) => {
  const tempPath = temp.mkdirSync('osjs-vfs');

  const osjs = new Core(Object.assign({
    tempPath,
    development: false,
    port: 0,
    root: __dirname,
    public: path.resolve(__dirname, 'dist'),
    vfs: {
      root: tempPath,
      watch: true
    },
    mime: {
      filenames: {
        'defined file': 'test/jest'
      }
    }
  }, config), {
    kill: false
  });

  osjs.configuration.vfs.mountpoints[1].attributes.chokidar = {
    persistent: false
  };
  osjs.configuration.vfs.mountpoints[1].attributes.watch = true;

  osjs.register(CoreServiceProvider, {before: true});
  osjs.register(PackageServiceProvider);
  osjs.register(VFSServiceProvider);
  osjs.register(AuthServiceProvider);
  osjs.register(SettingsServiceProvider);

  return osjs.boot()
    .then(() => osjs);
};

