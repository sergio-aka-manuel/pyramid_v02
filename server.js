/**
 * Created by manuel on 11.03.16.
 */

'use strict';

var server = require('http').createServer(),
    url = require('url'),
    WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({server: server}),
    bodyParser = require("body-parser"),
    express = require('express'),
    app = express(),
    port = 4080;

app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(__dirname + '/app'));

wss.on('connection', function connection(ws) {
    var location = url.parse(ws.upgradeReq.url, true);
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

    ws.on('message', function incoming(message) {
        console.log('ws received: %s', message);
    });

    ws.send('greeting');
});

server.on('request', app);
server.listen(process.env.PORT || port || 3000, function () {
    console.log('Listening on ' + server.address().port);
});


// database -------------------------------------------------------------------
var tables = {};

var pg = require('pg');
var pgConString = 'postgres://manuel:0560044@192.168.5.29/manuel';
var pgClient = new pg.Client(pgConString);

// connect to server
pgClient.connect(function (err) {
    if (err) {
        return console.error('could not connect to postgres', err);
    }
});

/**
 * TODO: documentation
 * @param msg
 * @returns {{table: string, op: string, data: {processId: (*|number), text: (string|*)}}}
 */
function _parsePayload(msg) {
    //'78801100f4c2dfbb5e6afdb2dde95194:1:1:{"table":"variables","op":"INSERT",
    // "data":[{"id":2,"type":2,"data":{},"created_at":"2016-03-17T15:38:45.097962+03:00",
    // "modified_at":"2016-03-17T15:38:45.097962+03:00"}]}'
    try {
        return JSON.parse(msg.payload.split(':').slice(3).join(':'));

    } catch (err) {
        return {
            table: 'none',
            op: 'NOTIFY',
            data: {
                processId: msg.processId,
                text: msg.payload
            }
        };
    }
}

function _insertRow(table, data) {
    //console.log('insert into "%s": "id:%s"', table, data[0].id);
    if (tables[table] === undefined)
        tables[table] = [];

    tables[table][data[0].id] = data;
}

function _deleteRow(table, data) {
    //console.log('delete from "%s": "id:%s"', table, data[0].id);
    if (tables[table] === undefined)
        tables[table] = [];

    delete tables[table][data[0].id];
}

function _customNotify(data) {
    console.log('notify pid[%s]: "%s"', data.processId, data.text);
}


// notification listener
pgClient.on('notification', function (msg) {
    var pld = _parsePayload(msg);

    switch (pld.op) {
        case 'DELETE':
            _deleteRow(pld.table, pld.data);
            break;

        case 'INSERT':
            _insertRow(pld.table, pld.data);
            break;

        case 'UPDATE':
            _updateRow(pld.table, pld.data);
            break;

        case 'NOTIFY':
            _customNotify(pld.data);
            break;

        default:
            console.error('Can`t process notify:');
            console.error(pld);
    }

    if (pld.table === 'variables')
        console.log(tables[pld.table]);
});

// set to listen notifications on channel 'livepg'
// by our trigger
pgClient.query("LISTEN livepg");

// simple select
//pgClient.query("SELECT * FROM variables ORDER BY id", function(err, result) {
//    if (err) {
//        return console.error('error running query', err);
//    }
//    //console.log(result.rows);
//});

//// custom send notification
//pgClient.query("NOTIFY livepg, 'test via NOTIFY'");
//
//// custom send notification, other way
//pgClient.query("SELECT pg_notify('livepg', 'test via SELECT')", function(err, result) {
//    if (err) {
//        return console.error('error running query', err);
//    }
//});


// close connection and cleanup on server exit
process.on('SIGINT', function () {
    pgClient.end();
    process.exit();
});
