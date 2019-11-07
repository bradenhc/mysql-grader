#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs');
const grader = require('../src/index');

const program = new Command();

program
  .version('1.0.0', '-v, --version')
  .arguments('[filename]')
  .option('-d, --debug', 'enable debug mode for verbose output on errors')
  .option('-s, --solution <filename>', 'path to SQL file containing solution queries', 'solution.sql')
  .option('-c, --config <filename>', 'path to the MySQL database configuration file', 'config.json')
  .action(async filename => {
    try {
      //
      // Setup our configuration. The order of precendence is the following (higher is better):
      // 1) Environment Variables
      // 2) Configuration File
      // 3) Command Line Arguments
      //
      const config = await _getConfiguration(program.config);

      config.queryFile = filename || 'input.sql';
      config.solutionFile = program.solution;
      config.debug = program.debug;

      //
      // Start the grader
      //
      await grader.run(config);
    } catch (err) {
      if (program.debug) {
        console.log(err);
      } else {
        console.log(err.message);
      }
    }
  })
  .parse(process.argv);

function _getConfiguration(configFile) {
  // Environment first, then config file
  const config = {
    host: process.env.MYSQL_GRADER_HOST || 'localhost',
    user: process.env.MYSQL_GRADER_USER || 'root',
    password: process.env.MYSQL_GRADER_PASSWORD,
    database: process.env.MYSQL_GRADER_DATABASE
  };
  return new Promise((resolve, reject) => {
    fs.exists(configFile, exists => {
      if (!exists) {
        return resolve(config);
      }
      fs.readFile(configFile, 'utf8', (err, text) => {
        if (err) return reject(new Error('Failed to read configuration: ' + err.message));
        try {
          let configFromFile = JSON.parse(text);
          return resolve({ ...config, ...configFromFile });
        } catch (err) {
          return reject(new Error('Failed to parse JSON configuration: ' + err.message));
        }
      });
    });
  });
}
