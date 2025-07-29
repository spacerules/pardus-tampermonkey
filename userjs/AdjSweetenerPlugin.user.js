// ==UserScript==
// @name         Pardus Adjust Sweetener Plugin
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.4
// @description  Moves interface elements to avoid overlap with the map and injects username
// @author       Spacerules
// @match        http*://*.pardus.at/msgframe.php
// @match        http*://*.pardus.at/main.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/AdjSweetenerPlugin.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd */
/* global readCookie */
(function () {
    'use strict';

    const LOGGING_ENABLED = true;
    logGroupStart(LOGGING_ENABLED, 'File: AdjSweetenerPlugin.user.js');

    function addusername() {
        logGroupStart(LOGGING_ENABLED, 'Function: addusername');
        let username = readCookie('user');
        logDebug(LOGGING_ENABLED, 'Username:', username);

        let statuselem = document.getElementById('status_content');
        if (!statuselem) {
            logWarn(LOGGING_ENABLED, 'status_content not found');
            logGroupEnd(LOGGING_ENABLED);
            return;
        }

        let tbody = statuselem.querySelector('table tbody');
        if (!tbody) {
            logWarn(LOGGING_ENABLED, 'No tbody found under #status_content');
            logGroupEnd(LOGGING_ENABLED);
            return;
        }

        if (document.getElementById('tdStatusUserName')) {
            logDebug(LOGGING_ENABLED, 'Username row already exists.');
            logGroupEnd(LOGGING_ENABLED);
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
        logGroupEnd(LOGGING_ENABLED);
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
                logDebug(LOGGING_ENABLED, 'updateStatus patched, reinserting username');
                try {
                    addusername();
                } catch (e) {
                    logError(LOGGING_ENABLED, 'addusername() failed in updateStatus:', e);
                }
            };

            uw.updateStatus._patchedBySweetener = true;
        } else if (!uw.updateStatus) {
            logWarn(LOGGING_ENABLED, 'updateStatus not yet defined; retrying...');
            setTimeout(patchUpdateStatus, 250);
        }
    }

    function updtightwad() {
        logGroupStart(LOGGING_ENABLED, 'Function: updtightwad');
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
        logGroupEnd(LOGGING_ENABLED);
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
        logGroupStart(LOGGING_ENABLED, 'Function: adjSweetener');
        waitForElement('body > div', (div) => {
            div.style.position = "";
            div.style.margin = "0px 0px 5px 0px";

            const table = document.getElementsByTagName("Table")[0];
            const thirdTd = table?.rows[0]?.cells[2];
            if (thirdTd) {
                thirdTd.insertBefore(div, thirdTd.firstChild);
            }
        });
        logGroupEnd(LOGGING_ENABLED);
    }

    function pardusAdjSweetenerInit() {
        const loc = document.location.href;
        logGroupStart(LOGGING_ENABLED, `Init | loc=${loc}`);

        if (loc.includes('msgframe.php')) {
            logSuccess(LOGGING_ENABLED, 'Location matched msgframe.php');
            adjSweetener();
        } else if (loc.includes('main.php')) {
            logSuccess(LOGGING_ENABLED, 'Location matched main.php');

            // No longer call addusername or observeStatusTable directly
            patchUpdateStatus();
            addusername();
            updtightwad();
        }

        logGroupEnd(LOGGING_ENABLED);
    }

    pardusAdjSweetenerInit();
    logGroupEnd(LOGGING_ENABLED);
})();
