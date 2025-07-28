// ==UserScript==
// @name         Pardus Adjust Sweetener pluging
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.0
// @description  changes the location of certain elements so the map is not overlapped
// @author       Spacerules
// @match        http*://*.pardus.at/*
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// ==/UserScript==

(function() {
    'use strict';

    function log(...args) {
        const debug = false;
        if (debug) {
            console.log(...args);
        }
    }

    // tightwad update
    function updtightwad() {
        waitForElement('#tightwad_overview', (elem) => {
            elem.style.position = "";
            var brtag1 = document.createElement('br');
            var brtag2 = document.createElement('br');
            var brtag3 = document.createElement('br');
            var brtag4 = document.createElement('br');

            const tdTabsRight = document.getElementById('tdTabsRight');

            tdTabsRight.insertBefore(brtag1, document.getElementById('otherships'));
            tdTabsRight.insertBefore(brtag2, document.getElementById('otherships'));
            tdTabsRight.style.width = "272px";
            tdTabsRight.appendChild(brtag3);
            tdTabsRight.appendChild(brtag4);
        });
    }

    // clock update
    function waitForElement(selector, callback, timeout = 5000) {
        const interval = 50;
        const start = Date.now();

        const check = () => {
            const el = document.querySelector(selector);
            if (el) return callback(el);
            if (Date.now() - start > timeout) return; // Give up after timeout
            setTimeout(check, interval);
        };

        check();
    }

    // Usage:
    function adjSweetener() {
        waitForElement('body > div', (div) => {
            div.style.position = "";
            div.style.margin = "0px 0px 5px 0px";
            const thirdTd = document.querySelector('table tbody tr td:nth-child(3)');
            if (thirdTd) {
                thirdTd.insertBefore(div, thirdTd.firstChild)
            }
        });
    }

function pardusAdjSweetenerInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;
    if (loc.match('msgframe.php')) {
       log('location matched:', loc);
        adjSweetener();
    }
    else if (loc.match('main.php')) {
       updtightwad();
    }
     return;
}


  pardusAdjSweetenerInit();
})();
