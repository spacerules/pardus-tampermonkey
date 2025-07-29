// ==UserScript==
// @name         Pardus Log Total List
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.4
// @description  adds a total to the log files
// @author       Spacerules
// @match        http://*.pardus.at/*
// @match        https://*.pardus.at/*
// @include      http*://*.pardus.at/overview*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/LogTotalList.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/LogTotalList.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd */
/* global readCookie, writeCookie */

(function() {
    'use strict';


  const LOGGING_ENABLED = false;

  logGroupStart(LOGGING_ENABLED, 'File: LogTotalList.js');

    function getColumnNr(firstRowTR, searchString, searchOccurrence = 1) {
      logGroupStart(LOGGING_ENABLED, 'Function: getColumnNr');

      const searchStrings = searchString.toLowerCase().split('~').map(s => s.trim());
      let foundOccurrence = 0;

      for (let i = 0; i < firstRowTR.children.length; i++) {
        const text = firstRowTR.children[i].textContent.trim().toLowerCase();

        if (searchStrings.some(s => text === s)) {
          foundOccurrence += 1;
          if (foundOccurrence === searchOccurrence) {
            logSuccess(LOGGING_ENABLED, `"${searchString}" matched at column index:`, i);
            logGroupEnd(LOGGING_ENABLED);
            return i;
          }
        }
      }

      logGroupEnd(LOGGING_ENABLED);
      return -1;
    }

    function parduslogtotals(logtable) {
        const firstRow = logtable?.querySelector('tr');
        const columnCount = firstRow ? firstRow.children.length : 0;

        logDebug('Number of columns:', columnCount);

        // Step 1: Find the "Total" column index
        let totalColIndex = getColumnNr(firstRow,'total~price~reward');
        let actionColIndex = getColumnNr(firstRow,'action');
        let pilotColIndex = getColumnNr(firstRow,'pilot');

        let username = readCookie('user');

        // Step 2: Sum values in that column
        let totalSum = 0;

        const rows = logtable.querySelectorAll('tr');
        for (let i = 1; i < rows.length; i++) { // skip the header row
            const cells = rows[i].children;
            if (cells.length <= totalColIndex) continue;

            const cellTexttotal = cells[totalColIndex].textContent.trim().replace(/,/g, '');
            if (actionColIndex > -1) {
                const cellTextAction = cells[actionColIndex].textContent.trim().replace(/,/g, '');
                logDebug("action:",cellTextAction);
                if (pilotColIndex > -1) {
                    const cellTexPilot = cells[pilotColIndex].textContent.trim().replace(/,/g, '');
                    if (cellTexPilot === username) {
                        if (cellTextAction.toLowerCase().includes("bought") ||
                            cellTextAction.toLowerCase().includes("repaired")
                           ) {
                            const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                            totalSum -= num;
                        } else {
                            const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                            totalSum += num;
                        }
                    } else {
                        if (cellTextAction.toLowerCase().includes("bought") ||
                            cellTextAction.toLowerCase().includes("repaired") ||
                            cellTextAction.toLowerCase().includes("received")
                           ) {
                            const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                            totalSum += num;
                        } else {
                            const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                            totalSum -= num;
                        }
                    }
                } else
                    if (cellTextAction.toLowerCase().includes("bought") ||
                        cellTextAction.toLowerCase().includes("repaired")
                       ) {
                        const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                        totalSum -= num;
                    } else {
                        const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                        totalSum += num;
                    }

            } else {
                const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                totalSum += num;
            }
        }

        // Step 3: Build the final row
        const finalTotalTR = document.createElement('tr');
        const finalTotalCredits = document.createElement('img');
        finalTotalCredits.src = "//static.pardus.at/img/stdhq/credits.png";
        finalTotalCredits.title = "Credits";
        finalTotalCredits.alt = "Credits";

        for (let i = 0; i < columnCount; i++) {
            const finalTotalTD = document.createElement('td');

            if (i === totalColIndex) {
                finalTotalTD.align = "right";
                finalTotalTD.style.color = "#A2EAF6";
                finalTotalTD.textContent = totalSum.toLocaleString() + " ";
                finalTotalTD.appendChild(finalTotalCredits);
            } else
                if (i === totalColIndex-1) {
                    finalTotalTD.align = "right";
                    finalTotalTD.style.color = "#A2EAF6";
                    finalTotalTD.textContent = "Total";
                    finalTotalTD.appendChild(finalTotalCredits);
                } else {
                    finalTotalTD.innerHTML = "&nbsp;";
                }

            finalTotalTR.appendChild(finalTotalTD);
        }

        logtable.querySelector('tbody').appendChild(finalTotalTR);

    }

    // Your code here..
    function pardusSubtotalInit() {
        // Load Document data into short variables
        var doc = document;
        var loc = doc.location.href;

        logGroupStart(LOGGING_ENABLED, 'Function: pardusSubtotalInit | loc=' + loc);
        //  not used in this script but want to keep it for potential mods.
        //  var search = doc.location.search.substring(doc.location.search.indexOf("=") + 1);

        if (loc.match('overview_tl_res.php') ||
            loc.match('overview_tl_eq.php') ||
            loc.match('overview_missions_log.php') ||
            loc.match('overview_payment_log.php') ||
            loc.match('overview_tl_eq.php')) {
            var logtable = document.querySelectorAll('table.messagestyle')[1];
            logSuccess(LOGGING_ENABLED, 'location matched:', loc);
            if (typeof logtable != 'undefined') {
                parduslogtotals(logtable);
            }
        }

        logGroupEnd(LOGGING_ENABLED);
    }


  pardusSubtotalInit();

  logGroupEnd(LOGGING_ENABLED);
})();
