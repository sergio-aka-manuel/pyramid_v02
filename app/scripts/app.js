/**
 * Created by manuel on 11.03.16.
 */
'use strict';

console.log("application started!");

/**
 * Conditionally loads webcomponents polyfill if needed.
 * Credit: Glen Maddern (geelen on GitHub)
 */
function lazyLoadPolymerAndElements() {
    // Let's use Shadow DOM if we have it, because awesome.
    window.Polymer = window.Polymer || {};
    window.Polymer.dom = 'shadow';

    var elements = [
        //'/path/to/bundle/one.html',
        '/elements/config-app/layout.html',
        '/elements/config-app/sources-list.html',
        '/elements/config-app/variables-list.html',
        '/elements/config-app/tree-node.html'
    ];

    elements.forEach(function (elementURL) {

        var elImport = document.createElement('link');
        elImport.rel = 'import';
        elImport.href = elementURL;

        document.head.appendChild(elImport);
    });
}

var webComponentsSupported = ('registerElement' in document
&& 'import' in document.createElement('link')
&& 'content' in document.createElement('template'));

if (!webComponentsSupported) {
    var wcPoly = document.createElement('script');
    wcPoly.src = '/bower_components/webcomponentsjs/webcomponents-lite.min.js';
    wcPoly.onload = lazyLoadPolymerAndElements;

    document.head.appendChild(wcPoly);

} else {
    lazyLoadPolymerAndElements();

}


// WebSocket --------------------
var wsuri = 'ws://localhost:4080';
var ws = null;

function wsConnect() {
    if ("WebSocket" in window) {
        ws = new WebSocket(wsuri);
    } else if ("MozWebSocket" in window) {
        ws = new MozWebSocket(wsuri);
    } else {
        console.log('Browser does not support WebSocket!');
    }

    if (ws) {
        ws.onopen = function () {
            console.log('ws: Connection established.');
            ws.send('hello ws server!', function ack(error) {
                if (error)
                    console.log('ws: Send error: ' + error.message);
            });
        };

        ws.onerror = function (error) {
            console.log('ws: Error: ' + error.message);
        };

        ws.onclose = function (event) {
            if (event.wasClean)
                console.log('ws: Connection closed cleanly.');
            else
                console.log('ws: Disconnected, code: "%s", reason: "%s"', event.code, event.reason);
        };

        // processing data
        ws.onmessage = function (event) {
            switch (event.data) {
                case 'AUTHENTICATE:': //TODO: secure authentication
                    var authData = {
                        func: 'AUTHENTICATION',
                        user: 'manuel',
                        password: 'qwerty'
                    };

                    try {
                        authData = JSON.stringify(authData);
                        ws.send(authData);
                    } catch (error) {
                        console.error(error);
                    }
                    break;

                case 'AUTHENTICATION: PASSED':
                    console.log('ws: Authentication passed.');
                    break;

                case 'AUTHENTICATION: FAILED':
                    console.log('ws: Authentication failed!');
                    break;

                //TODO: channel operations

                default:
                    console.log('ws: Received data: ' + event.data);
            }
        };
    }
}
cf0f0286d0516f0a88ab70bd83fb790b##10##33##
function wsConnectionCheck() {
    if (!ws || ws.readyState == 3) wsConnect();
    //console.log(new Date());
}

wsConnect(); //init connection
setInterval(wsConnectionCheck, 5000); //check every 5s




