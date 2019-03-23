const p = new Proxy({}, {
  get: (obj, prop) => prop === 'scope'
    ? () => p
    : () => {}
});

module.exports = p;
