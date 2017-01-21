const fs = require('fs');
const path = require('path');
const mkdir = require('mkdirp');
const { bold } = require('chalk');

const getChartData = require('./chartData');
const Logger = require('./Logger');
// TODO: Inject this module somehow
const viewer = require('../reporter-treemap');

class BundleAnalyzerPlugin {

  constructor(opts) {
    this.opts = {
      analyzerMode: 'server',
      analyzerPort: 8888,
      reportFilename: 'report.html',
      openAnalyzer: true,
      generateStatsFile: false,
      statsFilename: 'stats.json',
      statsOptions: null,
      logLevel: 'info',
      // deprecated
      startAnalyzer: true,
      ...opts
    };

    this.logger = new Logger(this.opts.logLevel);
  }

  apply(compiler) {
    this.compiler = compiler;

    compiler.plugin('done', stats => {
      stats = stats.toJson(this.opts.statsOptions);

      const actions = [];

      if (this.opts.generateStatsFile) {
        actions.push(() => this.generateStatsFile(stats));
      }

      // Handling deprecated `startAnalyzer` flag
      if (this.opts.analyzerMode === 'server' && !this.opts.startAnalyzer) {
        this.opts.analyzerMode = 'disabled';
      }

      if (this.opts.analyzerMode === 'server') {
        actions.push(() => this.startAnalyzerServer(stats));
      } else if (this.opts.analyzerMode === 'static') {
        actions.push(() => this.generateStaticReport(stats));
      }

      if (actions.length) {
        // Making analyzer logs to be after all webpack logs in the console
        setImmediate(() => {
          actions.forEach(action => action());
        });
      }
    });
  }

  generateStatsFile(stats) {
    let statsFilepath = this.opts.statsFilename;

    if (!path.isAbsolute(statsFilepath)) {
      statsFilepath = path.resolve(this.compiler.outputPath, statsFilepath);
    }

    mkdir.sync(path.dirname(statsFilepath));

    fs.writeFileSync(
      statsFilepath,
      JSON.stringify(stats, null, 2)
    );

    this.logger.info(
      `${bold('Webpack Bundle Analyzer')} saved stats file to ${bold(statsFilepath)}`
    );
  }

  startAnalyzerServer(stats) {
    const bundleDir = this.compiler.outputPath;
    const logger = this.logger;
    const chartData = getChartData({ logger, bundleStats: stats, bundleDir });

    if (!chartData) return;

    viewer.startServer(chartData, {
      openBrowser: this.opts.openAnalyzer,
      port: this.opts.analyzerPort,
      bundleDir,
      logger
    });
  }

  generateStaticReport(stats) {
    const bundleDir = this.compiler.outputPath;
    const logger = this.logger;
    const chartData = getChartData({ logger, bundleStats: stats, bundleDir });

    if (!chartData) return;

    viewer.generateReport(chartData, {
      openBrowser: this.opts.openAnalyzer,
      reportFilename: this.opts.reportFilename,
      bundleDir,
      logger
    });
  }

}

module.exports = BundleAnalyzerPlugin;
