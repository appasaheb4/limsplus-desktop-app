module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // CRA's ModuleScopePlugin rejects Babel's absolute @babel/runtime
      // helper imports (for example objectSpread2.js) even when they live
      // in this project's node_modules.
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.plugins = (
        webpackConfig.resolve.plugins || []
      ).filter(
        (plugin) =>
          !(
            plugin &&
            plugin.constructor &&
            plugin.constructor.name === 'ModuleScopePlugin'
          ),
      );
      return webpackConfig;
    },
  },
};
