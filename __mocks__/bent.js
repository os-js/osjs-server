const fs = require('fs-extra');
const tar = require('tar');
const path = require('path');

module.exports = () => async () => {
  const root = path.resolve(__dirname, 'user-installable-package');
  const files = await fs.readdir(root);

  return tar.c({
    gzip: true,
    cwd: root
  }, files);
};
