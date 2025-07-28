// ==UserScript==
// @name         Pardus Adjust Sweetener pluging
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.1
// @description  changes the location of certain elements so the map is not overlapped
// @author       Spacerules
// @match        http*://*.pardus.at/msgframe.php
// @match        https://*.pardus.at/msgframe.php
// @match        http*://*.pardus.at/main.php
// @match        https://*.pardus.at/main.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd */
/* global readCookie, writeCookie */
(function() {
    'use strict';

    const LOGGING_ENABLED = false;

    logGroupStart(LOGGING_ENABLED, 'File: AdjSweetenerPlugin.user.js');

    function addusername() {
        logGroupStart(LOGGING_ENABLED, 'Function: adjSweetener');
        let username = readCookie('user');
        logDebug(LOGGING_ENABLED, 'Username: ', username);

        var statuselem = document.getElementById('status_content');
        var tbody = statuselem.querySelector('table tbody');
        var newRow = document.createElement('tr');
        newRow.vAlign = "middle";

        var newCell = document.createElement('td');
        newCell.innerHTML = '<b><u>'+username+'</u></b>';
        newCell.align="center";
        newCell.id="tdStatusUserName";
        newCell.colSpan=4;
        newRow.appendChild(newCell);


        tbody.insertBefore(newRow, tbody.firstChild);
        logGroupEnd(LOGGING_ENABLED);
    }

    // tightwad update
    function updtightwad() {
        logGroupStart(LOGGING_ENABLED, 'Function: updtightwad');
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
        logGroupEnd(LOGGING_ENABLED);
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

        logGroupStart(LOGGING_ENABLED, 'Function: adjSweetener');

        waitForElement('body > div', (div) => {

            div.style.position = "";
            div.style.margin = "0px 0px 5px 0px";
            //Main Table > Table Body > TR0 top/only row, top row is pictures, td2 right column aligned middle,
            var thirdTd = document.getElementsByTagName("Table")[0].children[0].children[0].children[2];
            if (thirdTd) {
                thirdTd.insertBefore(div, thirdTd.firstChild)
            }
        });
        logGroupEnd(LOGGING_ENABLED);

    }

function pardusAdjSweetenerInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;

    logGroupStart(LOGGING_ENABLED, 'Function: pardusAdjSweetenerInit | loc=' + loc);
    if (loc.match('msgframe.php')) {
        logSuccess(LOGGING_ENABLED, 'location matched:', loc);
        adjSweetener();
    }
    else if (loc.match('main.php')) {
       logSuccess(LOGGING_ENABLED, 'location matched:', loc);
       addusername();
       updtightwad();
    }

    logGroupEnd(LOGGING_ENABLED);
}


  pardusAdjSweetenerInit();

  logGroupEnd(LOGGING_ENABLED);
})();
