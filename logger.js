/*  logger.js : a flexible logging library intended for use with nodejs.
 *  Copyright (C) 2012 Alexander Vieth <alexander.vieth@mail.mcgill.ca>
 *  
 *  This program is free software: you can redistribute it and/or modify it 
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 3 of the License, or (at your
 *  option) any later version.
 *
 *  This program is distributed in the hope that it will be useful, but WITHOUT
 *  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or 
 *  FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for 
 *  more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var DEFAULT_LOG_LEVELS = ['error', 'info'];

/*  getNextPrime
 *
 *  Produce the smallest prime number larger than p.
 *  This will be used for log level accept codes.
 */

var getNextPrime = function (p)
{
  var isPrime = function (q)
  {
    var root = Math.sqrt(q);
    for (var i = 2; i <= root; i++)
      if (q % i == 0)
        return false;
    return true;
  }
  
  //Simply increment i until a prime is found, then return that number.
  for (var i = p+1; !isPrime(i); i++);
  return i;
};

/*  parseLogLevel : returns a number corresponding to a log level,
 *                  defaulting to log level 1.
 *
 *  @ level : some log level descriptor, should be a string.
 *  @ definedLevels : a map from string log level identifiers to primes.
 */

var parseLogLevel = function (level, definedLevels)
{
  //To be returned. 
  var r = 1;
  
  if (typeof level == 'string')
  {
    r = definedLevels[level]
    //Check whether the level is indeed defined.
    if (r == null)
      r = 1; 
  }
  
  return r;
};

/*  A sink datatype.
 *
 *  This describes where logs should go, and which severity levels should be
 *  noted. For internal use by logger.
 *
 *  @ id     : a (should be unique) string identifier for this destination.
 *             This will allow the removal of destinations from a logger.
 *  @ write  : a function which takes an object with date, level, and message 
 *             attributes, and logs these things somewhere.
 *  @ levels : a list of log levels that should be heard by this sink.
 *  @ logId  : if true, log the logger's id with all messages.
 *  @ definedLevels : map of defined log levels.
 */

var sink = function (id, write, levels, logId, definedLevels)
{
  this.id = id; 
  this.write = write;
  this.logId = logId;
  this.deleted = false;
  
  //Build an accept code using levels and definedLevels.
  this.accept = function ()
  {
    var p;
    var product = 1;
    for (i in levels)
    {
      p = definedLevels[levels[i]]
      //Guard against undefinedness.
      if (typeof p == 'number')
        //Guard against duplicate factors.
        product *= (product % p != 0) ? p : 1;
    }
    return product;
  }();
  
  //Determine whether this sink accepts a given log level.
  this.accepts = function (level, definedLevels)
  {
    //If the log level's associated prime divides the number this.accept,
    //then we accept that level.
    var parsedLevel = parseLogLevel(level, definedLevels);
    //parsedLevel == 1 means level is undefined (see parseLogLevel)
    //In this case, only sinks accepting debug will log the message.
    return (parsedLevel == 1) ? (this.accept % 2 == 0) 
                              : ((this.accept % parsedLevel) == 0);
  };
};

var logger = function (levels)
{
  /*  definedLevels can be augmented with some other 
   *   
   *                  (string) : (prime number) 
   *
   *  relations automatically, if levels contains a list of strings.
   *  The log level 2 is special because calls to logger.log with undefined 
   *  log levels will go only to sinks that accept this level.
   *  The debug level cannot be removed by undefineLevels
   */
   
  var definedLevels = { 'debug' : 2 };

  //A date object which will be passed to all sink writers.
  var date = new Date();
  
  //Places to log things.
  var sinks = [];

  /*
   *  Bookkeeping variables.
   */ 

  //Deleting a sink is done by setting it to null and incrementing nullEntires.
  //If nullEntires reaches half the list length, we'll rebuild the list.
  var deletedSinks = 0;

  //For defining/undefining log levels. 
  var largestPrimeUsed = 2;

  /*
   *  For internal use.
   */

  var selectSink = function (id)
  {
    for (i in sinks)
    {
      if (sinks[i].id === id)
        return sinks[i];
    }
    return null;
  };

  //Finds the non-deleted sink with id and calls f with it as an argument.
  //Set id = null to exeute f on all sinks.
  var selectSinkAndDo = function (id, f)
  {
    if (id == null)
    {
      for (i in sinks)
      {
        if (sinks[i] != null && !sinks[i].deleted)
          f(sinks[i]);
      }
    }
    else
    {
      var s = selectSink(id);
      if (s != null && !s.deleted)
        f(s);
    }
  };
  
  //This will get rid of deleted entries in sinks.
  var rebuildSinkList = function ()
  {
    var newSinks = [];
    //This will select only non-deleted sinks.
    selectSinkAndDo(null, function (sink)
    {
      newSinks.push(sink);
    });
    sinks = newSinks;
    deletedSinks = 0;
  };
  
  /*
   *  The following functions are available for external use.
   */

  var log = function (level, message)
  {
    selectSinkAndDo(null, function (sink) 
      {
        if (sink.accepts(level, definedLevels))
          sink.write({ id : sink.id
                     , logId : sink.logId
                     , date : date
                     , message : message
                     , level : level
                     });
      });
  };
  
  var addSink = function (id, writer, hearLevels, logId)
  {
    //Default logId to false.
    if (logId == null)
      logId = false;
    
    //Enforce unique identifiers.
    if (selectSink(id) != null)
    {
      //Report the error on log level 1.
      log('debug', 'Attempted to add sink with duplicate id: ' + id);
      return;
    }
    
    //Giving hearLevels = null means we want to hear all log levels.
    if (hearLevels == null)
    {
      hearLevels = []
      for (key in definedLevels)
        hearLevels.push(key);
    }
    
    sinks.push (new sink (id, writer, hearLevels, logId, definedLevels));
  };
  
  var removeSink = function (id)
  {
    selectSinkAndDo(id, function (sink)
      {
        sink.deleted = true;
        deletedSinks += 1;
        //Ensure the sink list does not grow full of null entries.
        if (deletedSinks >= (sinks.length/2))
          rebuildSinkList();
      });
  };
  
  var setLogId = function (id, logId)
  {
    selectSinkAndDo(id, function (s) { s.logId = logId });
  };
  
  var getLogId = function (id)
  {
    return selectSink(id).logId;
  };
  
  var setWriter = function (id, write)
  {
    selectSinkAndDo(id, function (s) { s.writer = write });
  };
  
  var getWriter = function (id)
  {
    return selectSink(id).write;
  };
  
  var ignoreLevels = function (id, levels)
  {
    //For convenience
    if (typeof levels == 'string')
      levels = [levels];
    
    //Set id = null to have all sinks ignore these levels.
    selectSinkAndDo(id, function (sink)
    {
      var p;
      for (i in levels)
      {
        p = definedLevels[levels[i]];
        //Only divide if the level is actually a factor in the accept code.
        sink.accept /= (sink.accept % p == 0) ? p : 1;
      }
    });
  };
  
  var hearLevels = function (id, levels)
  {
    //For convenience
    if (typeof levels == 'string')
      levels = [levels];
    
    selectSinkAndDo(id, function (sink)
    {
      var p;
      for (i in levels)
      {
        p = definedLevels[levels[i]];
        //Avoid duplicate factors.
        sink.accept *= (sink.accept % p != 0) ? p : 1;
      }
    });
  };
  
  var defineLevels = function (levels)
  {
    for (i in levels)
    {
      if (typeof levels[i] == 'string')
      {
        largestPrimeUsed = getNextPrime(largestPrimeUsed);
        definedLevels[levels[i]] = largestPrimeUsed;
      }
      else
      {
        log('debug', 'Blocked the definition of a non-string log level identifier');
      }
    }
  };
  
  var undefineLevels = function (levels)
  {
    var p;    //To hold the prime to which a given level in levels maps.
    var q;    //To hold the largest prime in the map image.
    var r;    //To hold the second largest prime in the map image.
    var sup;  //The hold the keys mapping to q and r.
    
    //A fold over a map. Will be used to find the keys mapping to largest
    //and second largest primes in the image.
    var fold = function (map, base, f)
    {
      for (key in map)
        base = f(base, key);
      return base;
    }
    
    //For convenience.
    if (typeof levels == 'string')
      levels = [levels];
    
    for (i in levels)
    {
      //Do not allow the debug level to be undefined.
      if (levels[i] !== 'debug' && levels[i] in definedLevels)
      {
        p = definedLevels[levels[i]];
        
        //Get the two keys with the biggest images.
        //sup[1] maps to a bigger number than sup[0]
        sup = fold(definedLevels, [null,null], function (a, b)
          {
            return (a[1] == null || definedLevels[a[1]] < definedLevels[b]) 
                   ? [a[1],b] 
                   : a;
          });
        
        q = definedLevels[sup[1]];
        r = definedLevels[sup[0]];
        
        //Update all sink accept codes.
        ignoreLevels(null, [levels[i]])
        
        delete definedLevels[levels[i]];
        largestPrimeUsed = r;
        
        if (sup[1] !== levels[i])
        {
          //Redefine sup to map to the smaller prime p.
          definedLevels[sup[1]] = p;
          //Update sink accepts again.
          //If they accept q, divide by q and multiply by p.
          selectSinkAndDo(null, function (sink)
            {
              //Update accept codes: if it accepted q, then make it accept p.
              if (sink.accept % q == 0)
              {
                sink.accept /= q;
                sink.accept *= p;
              }
            });
        }
      }
    }
  };

  //If no levels are supplied, add the default levels.
  defineLevels((levels == null) ? DEFAULT_LOG_LEVELS : levels);
  
  return { log : log
         , addSink : addSink
         , removeSink : removeSink
         , ignoreLevels : ignoreLevels
         , hearLevels : hearLevels
         , defineLevels : defineLevels
         , undefineLevels : undefineLevels
         , setLogId : setLogId
         , getLogId : getLogId
         , setWriter : setWriter
         , getWriter : getWriter
         };
};

exports.logger = logger;
