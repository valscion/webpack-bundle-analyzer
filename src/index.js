const { startServer } = require('../reporter-treemap');

module.exports = {
  // Deprecated
  start: startServer,
  BundleAnalyzerPlugin: require('./BundleAnalyzerPlugin')
};
