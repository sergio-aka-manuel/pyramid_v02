/**
 * Created by manuel on 11.03.16.
 */
'use strict';

var http = require('http');
var express = require('express');
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(__dirname + '/app'));
//app.use('/bower_components', express.static(__dirname + '/app/bower_components'));
app.set('port', process.env.PORT || 3000);

var server = http.createServer(app).listen(app.get('port'), function () {
    console.log('Started server on port ' + app.get('port'));
});
