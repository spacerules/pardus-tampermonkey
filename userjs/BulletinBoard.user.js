// ==UserScript==
// @name         Pardus Multi-Sector AP Pathfinder Bulletin Board
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.3
// @description  Show multi-sector AP path info for missions on bulletin board with progress
// @match        http*://*.pardus.at/bulletin_board.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/APPathfinderCore.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoard.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoard.user.js
// ==/UserScript==

/* global multiSectorPath */
/* global readCookie, writeCookie */

(function() {
    'use strict';

    function waitForElement(selector, cb) {
        const el = document.querySelector(selector);
        if (el) cb(el);
        else requestAnimationFrame(() => waitForElement(selector, cb));
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

        function createCheckbox(tables, labelText) {
            const input = document.createElement("input");
            const label = document.createElement("label");
            input.type = "checkbox";
            input.checked = true;
            label.textContent = labelText;
            input.addEventListener("change", function() {
                tables.forEach(t => {
                    t.hidden = !this.checked;
                    if (t.nextElementSibling) t.nextElementSibling.hidden = !this.checked;
                });
            });
            newspan.appendChild(input);
            newspan.appendChild(label);
        }

        const transportTables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
            .filter(t => t.textContent.toLowerCase().includes("transport"));
        createCheckbox(transportTables, "Transports");

        const attackTables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
            .filter(t => {
                const text = t.textContent.toLowerCase();
                return text.includes("attack") || text.includes("annihilate");
            });
        createCheckbox(attackTables, "Attack");

        const otherTables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"))
            .filter(t => {
                const text = t.textContent.toLowerCase();
                return !text.includes("attack") && !text.includes("annihilate") && !text.includes("transport");
            });
        createCheckbox(otherTables, "Other");

        // Create progress div under filters
        const progressDiv = document.createElement("div");
        progressDiv.id = "mission-progress";
        progressDiv.style.fontSize = "12px";
        progressDiv.style.marginTop = "4px";
        progressDiv.textContent = "Loading missions: 0/0";
        newspan.insertAdjacentElement("afterend", progressDiv);
    }

    function runBoard() {
        waitForElement("table.messagestyle", () => {
            const tables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
            const currentSector = readCookie('sector');
            const currentX = parseInt(readCookie('x'), 10);
            const currentY = parseInt(readCookie('y'), 10);
            if (!currentSector || Number.isNaN(currentX) || Number.isNaN(currentY)) {
                console.warn("Current sector/coords not found in cookies.");
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
                const sectorMatch = tableHTML.match(/sector <b>(.*?)<\/b>/i);
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
                    console.error(`Pathfinder error for ${destSector} (${destX},${destY}):`, err);
                    return { table, result: null, borderColor: table.style.borderColor || '' };
                });
            });

            Promise.all(promises).then(results => {
                results.sort((a, b) => {
                    if (a.borderColor < b.borderColor) return 1;
                    if (a.borderColor > b.borderColor) return -1;
                    if (!a.result) return -1;
                    if (!b.result) return 1;
                    if (a.result.jumps === b.result.jumps) return a.result.cost - b.result.cost;
                    return a.result.jumps - b.result.jumps;
                });

                document.querySelectorAll("#div_missions > br").forEach(br => br.remove());

                results.forEach(r => {
                    r.table.parentNode.appendChild(document.createElement("br"));
                    r.table.parentNode.appendChild(r.table);
                });

              const counterSpan = document.getElementById("mission-progress");
              if (counterSpan) counterSpan.remove();
            });
        });
    }

    setupFilters();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runBoard);
    } else {
        runBoard();
    }
})();
