const fs = require('fs');
const mysql = require('mysql');
const _ = require('lodash');

module.exports = {
  run: async function(config) {
    const db = _connectToDatabase(config.host, config.user, config.password, config.database);
    try {
      const solutionQueries = await _getQueriesFromFile(config.solutionFile);
      const submissionQueries = await _getQueriesFromFile(config.queryFile);

      for (var [[solutionQuery, submissionQuery], i] of _enumerate(_zip(solutionQueries, submissionQueries), 1)) {
        if (i > submissionQueries.length) {
          _logerr(new Error('Missing submission for query ' + i), config.debug);
        } else {
          let result = await _test(db, solutionQuery, submissionQuery);
          if (result.passed) {
            console.log(`Query ${i}: Success!`);
          } else {
            _logerr(new Error(`Query ${i}: FAIL: ` + result.error.message), config.debug);
          }
        }
      }
    } catch (err) {
      throw err;
    } finally {
      db.end();
    }
  }
};

function _getQueriesFromFile(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, text) => {
      if (err) return reject(err);
      let queries = _extractCleanQueries(text);
      resolve(queries);
    });
  });
}

function _connectToDatabase(host, user, password, database) {
  let db = mysql.createConnection({
    host,
    user,
    password,
    database
  });

  db.connect();

  return db;
}

function _test(db, solutionQuery, submissionQuery) {
  return new Promise((resolve, reject) => {
    let query = _generateCompareQuery(solutionQuery, submissionQuery);
    db.query(query, (err, res) => {
      if (err) {
        return resolve({ passed: false, error: err });
      }
      let result = Object.values(res[0])[0];
      if (result === 'identical') {
        resolve({ passed: true, error: null });
      } else {
        resolve({ passed: false, error: new Error('Query results do not match') });
      }
    });
  });
}

function _extractCleanQueries(queryString) {
  return queryString
    .replace(/\-\- *.*$/gm, '') // Remove comments
    .replace(/'(.*)'/, '"$1"') // Replace quotes
    .split(';')
    .filter(s => s !== ''); // Split on semicolon
}

function _generateCompareQuery(expected, actual) {
  return `
  SELECT
    CASE WHEN count1 = count2 AND count1 = count3 THEN 'identical' ELSE 'mis-matched' END
  FROM
  (
    SELECT
      (SELECT COUNT(*) FROM ( ${expected} ) qExpected) AS count1,
      (SELECT COUNT(*) FROM ( ${actual} ) qActual) AS count2,
      (SELECT COUNT(*) FROM (SELECT * FROM (
        ${expected}
      ) qExpected UNION SELECT * FROM (
        ${actual}
      ) qActual) AS unioned) AS count3
  )
    AS counts
  `;
}

function _zip(...arrays) {
  return arrays[0].map((v, c) => arrays.map(row => row[c]));
}

function _enumerate(array, start = 0) {
  return array.map((e, i) => [e, start + i]);
}

function _logerr(err, debug) {
  if (debug) {
    console.error(err);
  } else {
    console.error(err.message);
  }
}
