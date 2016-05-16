"use strict";

var fs = require('fs');
var path = require('path');
var winston = require('winston');
require('../ext_libs/winston-batch-mail').Mail;
var RotateFile = require('../ext_libs/winston-rotate-file');
// var databaseLog = require('debug')('wallet:database');
// var httpLog = require('debug')('wallet:http');
// var errorLog = require('debug')('wallet:error');
// var accessLog = require('debug')('wallet:access');
// var debugLog = require('debug')('wallet:debug');


var myCustomLevels = {
    levels: {
        error: 0,
        info: 1,
        debug: 2
    },
    colors: {
        error: 'red',
        info: 'yellow',
        debug: 'green'
    }
};

var loggers = {};

exports.init = (app) => {
    var port = process.env.PORT;
    winston.addColors(myCustomLevels.colors);

    var logConfig = global.options.logs.config;
    for (var i = 0, length = logConfig.length; i < length; i++) {
        var logData = logConfig[i];
        var transports = [new (winston.transports.Mail)({
            level: 'error',
            name: logData.type,
            host: global.options.smtp.host,
            port: global.options.smtp.port,
            username: 'admin',
            authentication: false,
            from: global.options.emailAlert.from,
            to: global.options.emailAlert.to.join(','),
            //bufferMaxItems: 1,
            maxBufferTimeSpan: 60*1000,
            json: false,
            prettyPrint: true,
            timestamp: logData.showTimestamp,
            showLevel: logData.showLevel
        })];

        if (process.env.DEBUG) {
            // if DEBUG is enabled, output everything to console
            transports.push(new (winston.transports.Console)({
                level: logData.level,
                name: logData.type,
                label: logData.type,
                colorize: 'all',
                prettyPrint: true,
                timestamp: logData.showTimestamp,
                showLevel: logData.showLevel,
            }));
        } else {
            var logPath = global.options.logs.path;
            if (!path.isAbsolute(logPath))
                logPath = path.join(__dirname, logPath);
            fs.existsSync(logPath) || fs.mkdirSync(logPath);

            transports.push(new RotateFile({
                level: logData.level,
                name: logData.type,
                dirname: logPath,
                filename: port + '_' + logData.type + '.log',
                json: logData.jsonify,
                timestamp: logData.showTimestamp,
                showLevel: logData.showLevel,
                handleExceptions: true,
                datePattern: 'yyyyMMdd',
                preserveExt: true
            }));
        }
        loggers[logData.type] = new (winston.Logger)({
            exitOnError: true,
            transports: transports,
            levels: myCustomLevels.levels
        });

        // else output to files/db/mail
        // Handle logger errors
        // logger.on('error', (err) => { /* Do Something */ });
        // Logger.on('logged', ...) // sent when message is logged
    }

    return loggers;
};
