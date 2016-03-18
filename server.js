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
    var pld = {};

    try {
        pld = JSON.parse(msg.payload.split(':').slice(3).join(':'));

    } catch (err) {
        pld = {
            table: 'messages',
            op: 'NOTIFY',
            data: {
                processId: msg.processId,
                text: msg.payload
            }
        };
    }

    _checkTableChannel(pld.table);
    return pld;
}

function _checkTableChannel(name) {
    if (channels[name] !== undefined) return;

    // init channel
    channels[name] = [];
    channels[name].push({subscribers: []});

    if (name === 'messages') return;

    // get records from database
    pgClient.query("SELECT * FROM " + name + " WHERE id > 0 ORDER BY id",
        function (err, result) {
            if (err) return console.error('error running query', err);

            for (var i = 0; i < result.rows.length; i++)
                channels[name][result.rows[i].id] = result.rows[i];

            console.log('initialized channel: "%s", %s row(s)',
                name, channels[name].length);
        });
}

function _updateSubscribers(channel, data) {
    try {
        var list = channels[table][0].subscribers;

        for (var i = 0; i < list.length; i++)
            list[i].socket.send(JSON.stringify(data));

    } catch (error) {
        console.error(error);
    }

}

function _insertRow(table, data) {
    //console.log('insert into "%s": "id:%s"', table, data[0].id);
    channels[table][data[0].id] = data;
    _updateSubscribers(table, data);
}

function _deleteRow(table, data) {
    //console.log('delete from "%s": "id:%s"', table, data[0].id);
    delete channels[table][data[0].id];

    _updateSubscribers(table, {
        table: table,
        op: 'DELETE',
        data: [{id: data[0].id}]
    });
}

function _updateRow(table, data) {
    //TODO: update data and subscribers
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
    //if (pld.table === 'variables')
    //    console.log(channels[pld.table]);
});

// set to listen notifications on channel 'livepg'
// by our trigger
pgClient.query("LISTEN livepg");

// custom send notification (and init channel "messages")
// (other way: "SELECT pg_notify('livepg', 'test via SELECT')")
pgClient.query("NOTIFY livepg, 'web server say: hello!'");

// close connection and cleanup on server exit
process.on('SIGINT', function () {
    pgClient.end();
    process.exit();
});
