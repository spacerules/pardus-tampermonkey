// ==UserScript==
// @name         Pardus Multi-Sector AP Pathfinder Bulletin Board
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.5
// @description  Show multi-sector AP path info for missions on bulletin board with progress and jump filter
// @match        http*://*.pardus.at/bulletin_board.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/APPathfinderCore.user.js
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoard.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoard.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */
/* global multiSectorPath */

(function() {
    'use strict';

    logEnabled(false);
    logGroupStart(`File: ${GM_info.script.name}`);


    let jumpLimit = -1; // default show all
    let missionlist = [];

    function waitForElement(selector, cb) {
        const el = document.querySelector(selector);
        if (el) cb(el);
        else requestAnimationFrame(() => waitForElement(selector, cb));
    }

    function createMissionList() {
      logGroupStart(`Function: createMissionList`);
      const missions = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
      for (const missionTable of missions) {
        logInfo(missionTable);
        const missionItem = { mission: missionTable, checkboxtransport: true, checkboxAttack: true, checkboxOther: true, jumpfilter: true }
        missionlist.push(missionItem);
      }
      logGroupEnd();
    }

    function refreshHidden() {

      logGroupStart(`Function: refreshHidden`);
      missionlist.forEach(missionItem => {
        const shouldHide = !missionItem.checkboxtransport || !missionItem.checkboxAttack || !missionItem.checkboxOther || !missionItem.jumpfilter;

        // Hide the mission itself
        missionItem.mission.hidden = shouldHide;

        // Hide the next sibling only if it exists
        if (missionItem.mission.nextElementSibling) {
          missionItem.mission.nextElementSibling.hidden = shouldHide;
        }
      });
      logInfo(missionlist);
      logGroupEnd();
    }

    function setupFilters() {
        const headerlink = document.querySelector(".messagestyle a");
        if (!headerlink) return;

        const newbr1 = document.createElement("br");
        const newbr2 = document.createElement("br");
        const newspan = document.createElement("span");
        newspan.id = "checkboxfilter";
        headerlink.insertAdjacentElement("afterend", newbr1);
        newbr1.insertAdjacentElement("afterend", newbr2);
        newbr2.insertAdjacentElement("afterend", newspan);


        function createCheckbox(tables, labelText, propertyName) {
          const input = document.createElement("input");
          const label = document.createElement("label");
          input.type = "checkbox";
          input.id = propertyName;
          input.checked = true;
          label.textContent = labelText;
          label.htmlFor = propertyName;

          input.addEventListener("change", function() {
            missionlist.forEach(missionItem => {
              // Only update missions whose table is in the tables array
              if (tables.includes(missionItem.mission)) {
                missionItem[propertyName] = this.checked;
              }
            });

            // Optionally, still apply jump filter or re-render table visibility
            refreshHidden();
          });

          newspan.appendChild(input);
          newspan.appendChild(label);
        }

        const transportTables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
            .filter(t => t.textContent.toLowerCase().includes("transport"));
        createCheckbox(transportTables, "Transports","checkboxtransport");

        const attackTables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
            .filter(t => {
                const text = t.textContent.toLowerCase();
                return text.includes("attack") || text.includes("annihilate");
            });
        createCheckbox(attackTables, "Attack", "checkboxAttack");

        const otherTables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
            .filter(t => {
                const text = t.textContent.toLowerCase();
                return !text.includes("attack") && !text.includes("annihilate") && !text.includes("transport");
            });
        createCheckbox(otherTables, "Other", "checkboxOther");

        // Jumps filter input
        const jumpDiv = document.createElement("div");
        jumpDiv.style.marginTop = "4px";
        jumpDiv.innerHTML = `Jumps filter: <input type="number" id="jumpFilter" value="-1" style="width:50px"> (-1 = show all)`;
        newspan.appendChild(document.createElement("br"));
        newspan.appendChild(jumpDiv);

        document.getElementById("jumpFilter").addEventListener("input", function() {
            jumpLimit = parseInt(this.value, 10);
            applyJumpFilter();
        });

        // Progress display
        const progressDiv = document.createElement("div");
        progressDiv.id = "mission-progress";
        progressDiv.style.fontSize = "12px";
        progressDiv.style.marginTop = "4px";
        progressDiv.textContent = "Loading missions: 0/0";
        newspan.insertAdjacentElement("afterend", progressDiv);
    }

    let resultsCache = []; // store results so we can re-filter without reloading paths

    function applyJumpFilter() {

      // Update jumpfilter property in missionlist for matching tables
      missionlist.forEach(missionItem => {

        const match = resultsCache.find(r => r.table === missionItem.mission);
        if (match) {
          missionItem.jumpfilter = !match.result || match.result.jumps <= jumpLimit || jumpLimit == -1;
        }
      });
      refreshHidden();
    }

    function runBoard() {
      logGroupStart(`Function: runBoard`);
        waitForElement("table.messagestyle", () => {
            const tables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
            const currentSector = readCookie('sector');
            const currentX = parseInt(readCookie('x'), 10);
            const currentY = parseInt(readCookie('y'), 10);
            if (!currentSector || Number.isNaN(currentX) || Number.isNaN(currentY)) {
                logWarn("Current sector/coords not found in cookies.");
                return;
            }

            const progressDiv = document.getElementById("mission-progress");
            let completed = 0;
            progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;

            const promises = tables.map(table => {
                const footerSecondTd = table.querySelector("tr:last-child td:nth-child(2)");
                if (!footerSecondTd) return Promise.resolve({ table, result: null, borderColor: '' });

                footerSecondTd.querySelectorAll("span, br").forEach(e => e.remove());

                const statusSpan = document.createElement("span");
                statusSpan.textContent = "Loading...";
                footerSecondTd.appendChild(document.createElement("br"));
                footerSecondTd.appendChild(statusSpan);
                footerSecondTd.appendChild(document.createElement("br"));

                const tableHTML = table.innerHTML;
                let sectorMatch = tableHTML.match(/sector <b>(.*?)<\/b>/i);
                logInfo(sectorMatch);
                if (!sectorMatch) {
                  sectorMatch = tableHTML.match(/in <b>(.*?)<\/b>/i);
                }
                let coordMatch = null;
                const descTd = table.querySelectorAll("tr")[1]?.querySelectorAll("td")[2];
                if (descTd) {
                    coordMatch = descTd.textContent.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
                }
                if (!sectorMatch || !coordMatch) {
                    statusSpan.textContent = "N/A";
                    statusSpan.remove();
                    completed++;
                    progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;
                    return Promise.resolve({ table, result: null, borderColor: table.style.borderColor || '' });
                }

                const destSector = sectorMatch[1].trim();
                const destX = parseInt(coordMatch[1], 10);
                const destY = parseInt(coordMatch[2], 10);

                return multiSectorPath(
                    { sector: currentSector, x: currentX, y: currentY },
                    { sector: destSector, x: destX, y: destY }
                ).then(result => {
                    const mapperUrl = `https://pardusmapper.com?startSector=${encodeURIComponent(currentSector)}&startX=${currentX}&startY=${currentY}&destSector=${encodeURIComponent(destSector)}&destX=${destX}&destY=${destY}`;
                    const link = document.createElement("a");
                    link.href = mapperUrl;
                    link.target = "_blank";
                    link.innerHTML = `${result.jumps} jumps<br>${Math.round(result.cost)} AP`;
                    statusSpan.textContent = "";
                    statusSpan.appendChild(link);

                    completed++;
                    progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;

                    return { table, result, borderColor: table.style.borderColor || '' };
                }).catch(err => {
                    statusSpan.textContent = "Error";
                    completed++;
                    progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;
                    logError(`Pathfinder error for ${destSector} (${destX},${destY}):`, err);
                    return { table, result: null, borderColor: table.style.borderColor || '' };
                });
            });

          Promise.all(promises).then(results => {
            // Add imageLink property for each result
            results.forEach(r => {
              const imgEl = r.table.querySelector("tr:nth-of-type(2) td img");
              r.imageLink = imgEl ? imgEl.getAttribute("src") : "";
            });

            results.sort((a, b) => {
              // 1. borderColor
              if (a.borderColor < b.borderColor) return 1;
              if (a.borderColor > b.borderColor) return -1;


              // Both have nojump → sort by imageLink
              if (!a.result && !b.result) {
                return a.imageLink.localeCompare(b.imageLink);
              }

              // 2. nojump vs jump
              if (!a.result && b.result) return -1;
              if (a.result && !b.result) return 1;

              // 3. same jumps → sort by imageLink
              if (a.result.jumps === b.result.jumps) {
                const cmp = a.imageLink.localeCompare(b.imageLink);
                if (cmp != 0) return cmp;

                // 4. finally by cost (APs)
                return a.result.cost - b.result.cost;
              }

              // Otherwise sort by jumps
              return a.result.jumps - b.result.jumps;
            });

            // Cleanup and re-render
            document.querySelectorAll("#div_missions > br").forEach(br => br.remove());

            results.forEach(r => {
              r.table.parentNode.appendChild(document.createElement("br"));
              r.table.parentNode.appendChild(r.table);
            });

            resultsCache = results;
            applyJumpFilter(); // apply filter after all results loaded

            const counterSpan = document.getElementById("mission-progress");
            if (counterSpan) counterSpan.remove();
          });

        });
      logGroupEnd();
    }
    createMissionList();
    setupFilters();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runBoard);
    } else {
        runBoard();
    }

  //this is not needed as the groups stay seperate for seperate files
  //logGroupEnd();
})();
