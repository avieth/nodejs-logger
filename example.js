var logger = require('./logger.js');

/*  
 *  Create a logger and define the levels 'info' and 'error'.
 *  The level 'debug' is defined by default, and cannot be removed by
 *  undefineLevels().
 */

var logger = logger.logger(['info', 'error']);

logger.defineLevels(['trace', 'security']);

/*  
 *  A write function that formats the message and dumps it to the console.
 */

var consoleWriter = function (m)
{
  var logString = m.date + ' : ' + m.level 
                + ((m.logId) ? ' (' + m.id + ')' : '') 
                + ' >> ' + m.message;
  console.log(logString);
}

/*
 *  Another write function. This one logs to a file.
 */

var fs = require('fs');

var fileWriter = function (path)
{
  var handle = fs.createWriteStream(path, { flags : 'a' });
  return function (m)
  {
    var logString = m.date + ' : ' + m.level
                  + ((m.logId) ? ' (' + m.id + ')' : '')
                  + ' >> ' + m.message + '\n';
    handle.write(logString);
  };
};

/*
 *  Add two sinks, one for each of our writers.
 *  The console logger will accept all log levels because null is given.
 *  The file logger accepts only info level messages.
 */

logger.addSink('console', consoleWriter, null);
logger.addSink('file', fileWriter('log.txt'), ['info']);

//Both loggers hear this.
logger.log('info', 'Hello world!');

//'file' will not log the next two messages.
logger.log('debug', 'Uh oh, something went wrong!');
logger.log('security', 'Break-in attempt detected!');

logger.hearLevels('file', ['security', 'error']);
logger.ignoreLevels('console', ['info', 'error']);

//Now 'file' will hear the following, but 'console' will not.
logger.log('error', 'There was an error.');
