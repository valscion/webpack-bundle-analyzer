#! /usr/bin/env node

const fs = require('fs');
const { resolve, dirname } = require('path');

const _ = require('lodash');
const commander = require('commander');
const { magenta } = require('chalk');

const getChartData = require('../chartData');
const Logger = require('../Logger');

const program = commander
  .version(require('../../package.json').version)
  .usage(
`<bundleStatsFile> [bundleDir] [options]

  Arguments:

    bundleStatsFile  Path to Webpack Stats JSON file.
    bundleDir        Directory containing all generated bundles.
                     You should provided it if you want analyzer to show you the real parsed module sizes.
                     By default a directory of stats file is used.`
  )
  .option(
    '-m, --mode <mode>',
    'Analyzer mode. Should be `server` or `static`.' +
    br('In `server` mode analyzer will start HTTP server to show bundle report.') +
    br('In `static` mode single HTML file with bundle report will be generated.') +
    br('Default is `server`.'),
    'server'
  )
  .option(
    '-p, --port <n>',
    'Port that will be used in `server` mode to start HTTP server.' +
    br('Default is 8888.'),
    Number,
    8888
  )
  .option(
    '-R, --reporter <node package>',
    'Reporter package that will be used to generate the report.' +
    br('Default is the built-in `reporter-treemap`.'),
    require.resolve('../../reporter-treemap')
  )
  .option(
    '-r, --report <file>',
    'Path to bundle report file that will be generated in `static` mode.' +
    br('Default is `report.html`.'),
    'report.html'
  )
  .option(
    '-O, --no-open',
    "Don't open report in default browser automatically."
  )
  .parse(process.argv);

let {
  mode,
  port,
  report: reportFilename,
  reporter: reporterModulePath,
  open: openBrowser,
  args: [bundleStatsFile, bundleDir]
} = program;

if (!bundleStatsFile) showHelp('Provide path to Webpack Stats file as first argument');
if (mode !== 'server' && mode !== 'static') showHelp('Invalid mode. Should be either `server` or `static`.');
if (mode === 'server' && isNaN(port)) showHelp('Invalid port number');

bundleStatsFile = resolve(bundleStatsFile);

if (!bundleDir) bundleDir = dirname(bundleStatsFile);

let bundleStats;
try {
  bundleStats = readStatsFromFile(bundleStatsFile);
} catch (err) {
  console.error(`Could't read webpack bundle stats from "${bundleStatsFile}":\n${err}`);
  process.exit(1);
}

let viewer;
try {
  viewer = require(reporterModulePath);
} catch (err) {
  console.error(`Couldn't resolve reporter for path "${reporterModulePath}".`);
  console.error('Reporters should either be installed in node_modules or provided as an absolute path.');
  process.exit(1);
}

const logger = new Logger();
const chartData = getChartData({ logger, bundleStats, bundleDir });

if (!chartData) {
  // TODO: Exit with an error code as the only reason `chartData` is falsy
  // at this point is if `getChartData` had an error
  process.exit(0);
}

if (mode === 'server') {
  if (typeof viewer.startServer !== 'function') {
    console.error(`The given reporter "${reporterModulePath}" does not expose .startServer() ` +
                  'function and so can\'t be used for server mode reporting.');
    process.exit(1);
  }
  viewer.startServer(chartData, {
    openBrowser,
    port,
    bundleDir,
    logger
  });
} else {
  if (typeof viewer.generateReport !== 'function') {
    console.error(`The given reporter "${reporterModulePath}" does not expose .generateReport() ` +
                  'function and so can\'t be used for static mode reporting.');
    process.exit(1);
  }
  viewer.generateReport(chartData, {
    openBrowser,
    reportFilename: resolve(reportFilename),
    bundleDir,
    logger
  });
}

function showHelp(error) {
  if (error) console.log(`\n  ${magenta(error)}`);
  program.outputHelp();
  process.exit(1);
}

function br(str) {
  return `\n${_.repeat(' ', 21)}${str}`;
}

function readStatsFromFile(filename) {
  return JSON.parse(
    fs.readFileSync(filename, 'utf8')
  );
}
