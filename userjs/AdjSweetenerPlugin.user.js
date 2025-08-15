// ==UserScript==
// @name         Pardus Adjust Sweetener Plugin
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.8
// @description  Moves interface elements to avoid overlap with the map and injects username
// @author       Spacerules
// @match        http://*.pardus.at/msgframe.php
// @match        http://*.pardus.at/main.php
// @match        https://*.pardus.at/msgframe.php
// @match        https://*.pardus.at/main.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable  */
/* global readCookie */
(function () {
    'use strict';

    logEnabled(false);

    logGroupStart('File: AdjSweetenerPlugin.user.js');

    function addusername() {
        logGroupStart('Function: addusername');
        let username = readCookie('user');
        logDebug('Username:', username);

        let statuselem = document.getElementById('status_content');
        if (!statuselem) {
            logWarn('status_content not found');
            logGroupEnd();
            return;
        }

        let tbody = statuselem.querySelector('table tbody');
        if (!tbody) {
            logWarn('No tbody found under #status_content');
            logGroupEnd();
            return;
        }

        if (document.getElementById('tdStatusUserName')) {
            logDebug('Username row already exists.');
            logGroupEnd();
            return;
        }

        let newRow = document.createElement('tr');
        newRow.vAlign = "middle";

        let newCell = document.createElement('td');
        newCell.innerHTML = `<b><u>${username}</u></b>`;
        newCell.align = "center";
        newCell.id = "tdStatusUserName";
        newCell.colSpan = 4;

        newRow.appendChild(newCell);
        tbody.insertBefore(newRow, tbody.firstChild);
        logGroupEnd();
    }

    function patchUpdateStatus() {
        let uw;
        try {
            uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        } catch (e) {
            uw = window;
        }

        if (uw.updateStatus && !uw.updateStatus._patchedBySweetener) {
            const originalUpdateStatus = uw.updateStatus;

            uw.updateStatus = function (a) {
                originalUpdateStatus.call(this, a);
                logDebug('updateStatus patched, reinserting username');
                try {
                    addusername();
                } catch (e) {
                    logError('addusername() failed in updateStatus:', e);
                }
            };

            uw.updateStatus._patchedBySweetener = true;
        } else if (!uw.updateStatus) {
            logWarn('updateStatus not yet defined; retrying...');
            setTimeout(patchUpdateStatus, 250);
        }
    }

    function updtightwad() {
        logGroupStart('Function: updtightwad');
        waitForElement('#tightwad_overview', (elem) => {
            elem.style.position = "";
            const br = () => document.createElement('br');
            const tdTabsRight = document.getElementById('tdTabsRight');

            tdTabsRight.insertBefore(br(), document.getElementById('otherships'));
            tdTabsRight.insertBefore(br(), document.getElementById('otherships'));
            tdTabsRight.style.width = "272px";
            tdTabsRight.appendChild(br());
            tdTabsRight.appendChild(br());
        });
        logGroupEnd();
    }

    function waitForElement(selector, callback, timeout = 5000) {
        const interval = 50;
        const start = Date.now();

        const check = () => {
            const el = document.querySelector(selector);
            if (el) return callback(el);
            if (Date.now() - start < timeout) setTimeout(check, interval);
        };
        check();
    }

    function adjSweetener() {
        logGroupStart('Function: adjSweetener');
        waitForElement('body > div', (div) => {
            div.style.position = "";
            div.style.margin = "0px 0px 5px 0px";

            const table = document.getElementsByTagName("Table")[0];
            const thirdTd = table?.rows[0]?.cells[2];
            if (thirdTd) {
                thirdTd.insertBefore(div, thirdTd.firstChild);
            }
        });
        logGroupEnd();
    }

    function pardusAdjSweetenerInit() {
        const loc = document.location.href;
        logGroupStart(`Init | loc=${loc}`);

        if (loc.includes('msgframe.php')) {
            logSuccess('Location matched msgframe.php');
            adjSweetener();
        } else if (loc.includes('main.php')) {
            logSuccess('Location matched main.php');

            // No longer call addusername or observeStatusTable directly
            patchUpdateStatus();
            addusername();
            updtightwad();
        }

        logGroupEnd();
    }

    pardusAdjSweetenerInit();
    logGroupEnd();
})();
