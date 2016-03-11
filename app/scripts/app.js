/**
 * Created by manuel on 11.03.16.
 */
'use strict';

console.log("application started!");

/**
 * Conditionally loads webcomponents polyfill if needed.
 * Credit: Glen Maddern (geelen on GitHub)
 */
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

function lazyLoadPolymerAndElements() {
    // Let's use Shadow DOM if we have it, because awesome.
    window.Polymer = window.Polymer || {};
    window.Polymer.dom = 'shadow';

    var elements = [
        //'/path/to/bundle/one.html',
        '/elements/my-view.html'
    ];

    elements.forEach(function (elementURL) {

        var elImport = document.createElement('link');
        elImport.rel = 'import';
        elImport.href = elementURL;

        document.head.appendChild(elImport);
    });
}
