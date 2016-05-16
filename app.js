"use strict";

var express = require('express');
var app = express();
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var async = require('async');

// make sure the environment is set to one of the allowed ones
var env = app.get('env');
if (['development', 'production'].indexOf(env) === -1) {
    console.error("Please specify node enviroment: NODE_ENV");
    process.exit(1);
}
global.options = require('./configs/' + env + '.json');
global.logger = require('./libs/Winston').init(app);
var Log = global.logger.application;
// redirect console.log to winston if not in DEBUG mode
if (!process.env.DEBUG)
    console.log = function(){ Log.debug.apply(Log, arguments) };

// initialization
async.series([
    function(next) {
        if (global.options.beanstalk.length == 0) return next();
        // example config:
        // {
        //     "name": "foo",
        //     "host": "xxx.com",
        //     "port": 11300,
        //     "tube": "tube_name"
        // }
        var BeanstalkClient = require('./libs/database/Beanstalk').Beanstalk;
        BeanstalkClient.load(global.options.beanstalk, next);
    },
    function(next) {
        if (global.options.mongo.length == 0) return next();
        // example config:
        // {
        //     "name": "foo",
        //     "host": "xxx.com",
        //     "port": 27017,
        //     "database": "db_name",
        //     "collections": [
        //         "one",
        //         "two"
        //     ]
        // }
        var MongodbClient = require('./libs/database/MongoDB').Mongo;
        MongodbClient.load(global.options.mongo, next);
    },
    function(next) {
        if (global.options.redis.length == 0) return next();
        // example config:
        // {
        //     "name": "foo",
        //     "host": "xxx.com",
        //     "port": 6379
        // }
        var RedisClient = require('./libs/database/Redis').Redis;
        RedisClient.load(global.options.redis, next);
    },
    function(next) {
        if (global.options.http.length == 0) return next();
        // example config:
        // {
        //     "name": "foo",
        //     "host": "xxx.com",
        //     "port": 3000
        // }
        var HttpClient = require('./libs/Http').Http;
        HttpClient.load(global.options.http, next);
    }
], function(err) {
    if (err) {
        Log.error('Initialization failed', { error: err.message }, function() {
            waitForLoggersToFinish(1);
        });
    } else {
        var routes = require('./routes/index');
        var users = require('./routes/users');

        // view engine setup
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'ejs');

        // uncomment after placing your favicon in /public
        //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
        var morganFormat = 'combined';
        if (app.get('env') === 'development')
            morganFormat = 'dev';
        app.use(morgan(morganFormat, { stream: {
            write: function(log) {
                global.logger.access.info(log);
            }
        }}));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(cookieParser());
        app.use(express.static(path.join(__dirname, 'public')));

        app.use('/', routes);
        app.use('/users', users);

        // catch 404 and forward to error handler
        app.use(function(req, res, next) {
          var err = new Error('Not Found');
          err.status = 404;
          next(err);
        });

        // error handler
        app.use(function(err, req, res, next) {
            //if (err.status && err.status != 404)
                Log.error("Unhandled error!", {
                    message: err.message,
                    code: err.status,
                    trace: err.stack,
                    uri: req.originalUrl
                });

            if (!res.headersSent) {
                res.status(err.status || 500);

                var payload = { message: err.message };
                // no stacktraces leaked to user in production environment
                if (app.get('env') === 'development')
                    payload.error = err;
                res.render('error', payload);
            } else {
              Log.error("Ended up with error router with the headers being already sent!");
            }
        });
    }
});

function waitForLoggersToFinish(code) {
    var numFlushes = 0;
    var numFlushed = 0;
    Object.keys(logger.transports).forEach((k) => {
        if (logger.transports[k]._stream) {
            numFlushes += 1;
            logger.transports[k]._stream.once("finish", () => {
                numFlushed += 1;
                if (numFlushes === numFlushed) {
                    process.exit(code);
                }
            });
            logger.transports[k]._stream.end();
        }
    });
    if (numFlushes === 0) {
        process.exit(code);
    }
}

module.exports = app;
