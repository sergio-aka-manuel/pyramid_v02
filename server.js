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

// manage ws clients
var wsClients = {};
wss.on('connection', function (ws) {
    //var location = url.parse(ws.upgradeReq.url, true);
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
    //console.log(ws);

    var wskey = ws.upgradeReq.headers['sec-websocket-key'];
    wsClients[wskey] = {
        socket: ws,
        authenticated: false,
        subscriptions: []
    };

    ws.onclose = function (event) {
        console.log('ws "%s" closed with code: %s', wskey, event.code);
        delete wsClients[wskey];
        //console.log(wsClients);
    };

    ws.onmessage = function (event) {
        try {
            var data = {};
            data = JSON.parse(event.data);

            switch (data.func) {
                case 'AUTHENTICATION':
                    _wsClientLogin(wskey, data);
                    break;

                case 'SUBSCRIPT':
                    if (wsClients[wskey].subscription)
                        _wsClientSubscript(wskey, data);
                    else
                        _wsClientLogout(wskey, 'NOT AUTHORISED');
                    break;

                case 'LOGOUT':
                    _wsClientLogout(wskey, 'LOGGED OUT...');
                    break;

                //TODO: subscription

                default:
                    console.log(data);
            }

        } catch (error) {
            console.log('ws "%s" receive: "%s"', wskey, event.data);
            //console.error(error);
        }
    };

    ws.send('AUTHENTICATE:', function ack(error) {
        if (error) console.log('ws "%s" send error: %s', wskey, error.message);
    });
});

// server start
server.on('request', app);
server.listen(process.env.PORT || port || 3000, function () {
    console.log('Listening on ' + server.address().port);
});

function _wsClientSubscript(key, data) {
    //{func: 'SUBSCRIPT', channel: 'variables', data: [{id: 10, per: 1000}, {id: 11}]}

}

function _wsClientLogin(key, data) {
    if (data.user != 'manuel' || data.password != 'qwerty') { //TODO: secure authentication
        wsClients[key].socket.send('AUTHENTICATION: FAILED', function (error) {
            if (error) console.log('ws "%s" send error: %s', wskey, error.message);
            wsClients[key].socket.terminate();
        });

    } else {
        wsClients[key].socket.send('AUTHENTICATION: PASSED');
        wsClients[key].authenticated = true;
        wsClients[key].authdata = data;
    }
}

function _wsClientLogout(key, message) {
    wsClients[key].socket.send(message, function (error) {
        if (error) console.log('ws "%s" send error: %s', key, error.message);
        wsClients[key].socket.terminate();
    });
}


// database -------------------------------------------------------------------
var channels = {};

var pg = require('pg');
var pgConString = process.env.PGCONSTR || 'postgres://manuel:0560044@192.168.5.29/manuel';
var pgClient = new pg.Client(pgConString);

// connect to server
pgClient.connect(function (error) {
    if (error) return console.error('could not connect to postgres', error);

    console.log('pg: connected to database.');
});


var incompletePayloads = {}; //FIXME: turn PgLive to module

/**
 * TODO: documentation
 * @param msg
 * @returns {{table: string, op: string, data: {processId: (*|number), text: (string|*)}}}
 */
function _parseNotification(msg) {
    //console.log(msg);
    // msg format: {
    //       name: 'notification'
    //       length: CHUNK_LENGTH,
    //       processId: PID,
    //       channel: 'CHANNEL_NAME' (for notification(): [update|insert|delete]),
    //       payload: 'TABLE_NAME#ID#CHUNK#CHUNKS#DATA'
    // }
    var note = {
        processId: msg.processId,
        channel: msg.channel,
        data: msg.payload
    };

    if (note.channel == 'update' || note.channel == 'insert' || note.channel == 'delete') {
        var payload = msg.payload.split('#');
        var chunks = payload[3];
        var chunk = payload[2];

        note.table = payload[0];
        note.id = payload[1];
        note.data = payload.slice(4).join('#');

        if (chunks > 1) {
            var hash = note.table + '_' + note.id;
            if (incompletePayloads[hash])
                incompletePayloads[hash] += note.data;
            else
                incompletePayloads[hash] = note.data;

            if (chunk != chunks) return null;

            note.data = incompletePayloads[hash];
            delete incompletePayloads[hash];

        }
        _checkTableChannel(note.table);
    }

    try {
        note.data = JSON.parse(note.data);
    } catch (error) {
        console.error('JSON.parse(\'%s\') error:', note.data, error);
        note.data = msg.payload;
    }

    return note;
}

function _checkTableChannel(table) {
    if (channels[table] !== undefined) return;

    // init channel
    channels[table] = [];
    channels[table].subscribers = [];

    // get records from database
    pgClient.query("SELECT * FROM " + table + " ORDER BY id",
        function (err, result) {
            if (err) return console.error('error running query', err);

            for (var i = 0; i < result.rows.length; i++)
                channels[table][result.rows[i].id] = result.rows[i];

            console.log('initialized channel: "%s", %s row(s)',
                table, channels[table].length);
        });
}

//FIXME: move to upper level (emit event, maybe?)
function _updateSubscribers(n) {
    try {
        // var list = channels[table].subscribers;
        //
        // for (var i = 0; i < list.length; i++)
        //     list[i].socket.send(JSON.stringify(data));

    } catch (error) {
        console.error(error);
    }

    console.log('op: "%s", table: "%s", ', n.channel, n.table, n.data);
}

function _customNotify(n) {
    console.log('notify pid[%s]: "%s"', n.processId, n.data);
}

// notification listener
pgClient.on('notification', function (msg) {
    var note = _parseNotification(msg);
    if (note === null ) return;

    switch (note.channel) {
        case 'delete':
            delete channels[note.table][note.id];
            _updateSubscribers(note);
            break;

        case 'insert':
            channels[note.table][note.id] = note.data;
            _updateSubscribers(note);
            break;

        case 'update':
            channels[note.table][note.id] = note.data;
            _updateSubscribers(note);
            break;

        case 'messages':
            _customNotify(note);
            break;

        default:
            console.error('Can`t process note:');
            console.error(note);
    }
});

// set to listen notifications on channels:
// 'update', 'insert' and 'delete' fired by trigger
pgClient.query("LISTEN delete");
pgClient.query("LISTEN insert");
pgClient.query("LISTEN update");

// set to listen notifications on 'messages' channel:
pgClient.query("LISTEN messages");

// custom send notification (and init channel "messages")
// (other way: "SELECT pg_notify('livepg', 'test via SELECT')")
pgClient.query("NOTIFY messages, 'web server say: hello!'");

// close connection and cleanup on server exit
process.on('SIGINT', function () {
    pgClient.query("NOTIFY messages, 'web server say: goodbye!'");

    pgClient.query("UNLISTEN messages");
    pgClient.query("UNLISTEN delete");
    pgClient.query("UNLISTEN insert");
    pgClient.query("UNLISTEN update");

    pgClient.end();
    process.exit();
});
