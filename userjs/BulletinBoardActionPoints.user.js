// ==UserScript==
// @name         Bulletin Board AP Filter
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.0
// @description  Display jumps & AP as a single clickable link, filter by max jumps, type filters, persist max jumps, show progress, cache results 6h
// @match        http*://*.pardus.at/bulletin_board.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/APPathfinderCore.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @tag          Pardus
// @tag          Spacerules
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoardActionPoints.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoardActionPoints.user.js
// @supportURL   https://github.com/spacerules/pardus-tampermonkey/issues/new?template=Issue%20Report.yaml&title=Bulletin%20Board%20AP%20Filter%20-%20&version=1.0.0
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */
/* global multiSectorPath */

(function(){
    'use strict';
    logEnabled(false); // keep logging disabled by default
    logGroupStart(`File: ${GM_info.script.name}`);

    let missionlist = [];
    let jumpLimit = GM_getValue("missionJumpFilter", -1);
    let totalMissions = 0;
    let completedMissions = 0;
    let progressDiv;

    /**
     * Build an array of mission objects with metadata.
     */
    function createMissionList(){
        logInfo("Creating mission list...");
        missionlist = Array.from(document.querySelectorAll("#div_missions > table.messagestyle")).map(mission=>{
            return {
                mission,
                table: mission,
                jumpInfo: null,
                count: getMissionCount(mission),
                typeVisible: true,
                jumpVisible: true
            };
        });
        totalMissions = missionlist.length;
        completedMissions = 0;
        logDebug(`Total missions detected: ${totalMissions}`);
    }

    /**
     * Get mission count value from a table.
     * @param {HTMLTableElement} table - The mission table.
     * @returns {number|null} Parsed mission count, or null if not found.
     */
    function getMissionCount(table){
        try {
            const countRow = table.querySelectorAll("tr")[2];
            if(!countRow) return null;
            const countTdBFont = countRow.querySelector("td b font");
            const countTdB = countRow.querySelector("td b");
            const value = countTdBFont
                ? parseInt(countTdBFont.textContent.trim(),10)
                : countTdB
                    ? parseInt(countTdB.textContent.trim(),10)
                    : null;
            logDebug(`Mission count parsed: ${value}`);
            return value;
        } catch (e) {
            logWarn("Failed to parse mission count", e);
            return null;
        }
    }

    /**
     * Create progress indicator above the mission list.
     */
    function createProgressDiv(){
        const container = document.querySelector("#div_missions");
        if(!container) return;
        progressDiv = document.createElement("div");
        progressDiv.id = "mission-progress";
        progressDiv.style.fontSize = "12px";
        progressDiv.style.marginTop = "4px";
        progressDiv.textContent = `Loading missions: 0/0`;
        container.insertBefore(progressDiv, container.firstChild);
        logInfo("Progress div created");
    }

    /**
     * Update the progress indicator text.
     */
    function updateProgress(){
        if(progressDiv){
            progressDiv.textContent = `Loading missions: ${completedMissions}/${totalMissions}`;
            logDebug(`Progress updated: ${completedMissions}/${totalMissions}`);
        }
    }

    /**
     * Setup the max jump filter input and type filters.
     */
    function setupJumpFilterUI(){
        logInfo("Setting up jump filter UI");
        const typeFilter = document.querySelector("#checkboxfilter");

        const filterDiv = document.createElement("div");
        filterDiv.style.margin = "4px 0";
        filterDiv.style.fontSize = "14px";

        const label = document.createElement("label");
        label.textContent = "Max Jumps: ";
        label.style.marginRight = "4px";

        const input = document.createElement("input");
        input.type = "number";
        input.value = jumpLimit;
        input.style.width = "50px";
        input.placeholder = "-1 (show all)";
        input.addEventListener("input", ()=> {
            jumpLimit = input.value === "" ? -1 : parseInt(input.value,10);
            GM_setValue("missionJumpFilter", jumpLimit);
            logInfo(`Jump limit updated: ${jumpLimit}`);
            applyJumpFilter();
            sortMissions();
        });

        filterDiv.appendChild(label);
        filterDiv.appendChild(input);

        if(typeFilter) typeFilter.insertAdjacentElement("afterend", filterDiv);
        else {
            const container = document.querySelector("#div_missions");
            if(container) container.insertBefore(filterDiv, container.firstChild);
        }

        if(typeFilter){
            const checkboxes = typeFilter.querySelectorAll("input[type=checkbox]");
            checkboxes.forEach(cb => {
                cb.addEventListener("change", ()=> {
                    logInfo(`Type filter changed: ${cb.id} -> ${cb.checked}`);
                    applyTypeFilter();
                    sortMissions();
                });
            });
        }
    }

    /**
     * Get the cache key for a mission.
     * @param {string} missionId - Mission ID.
     * @returns {string} Cache key.
     */
    function getMissionCacheKey(missionId) {
        return `missionData_${missionId}`;
    }

    /**
     * Retrieve cached mission data if not expired.
     * @param {string} missionId - Mission ID.
     * @returns {object|null} Cached mission data or null.
     */
    function getCachedMissionData(missionId) {
        const raw = GM_getValue(getMissionCacheKey(missionId));
        if(!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            if(Date.now() - parsed.timestamp > 6*60*60*1000) {
                logDebug(`Cache expired for mission ${missionId}`);
                return null;
            }
            logDebug(`Cache hit for mission ${missionId}`);
            return parsed.data;
        } catch (e) {
            logWarn(`Invalid cache data for mission ${missionId}`, e);
            return null;
        }
    }

    /**
     * Store mission data in cache with timestamp.
     * @param {string} missionId - Mission ID.
     * @param {object} data - Mission path data.
     */
    function setCachedMissionData(missionId, data) {
        GM_setValue(getMissionCacheKey(missionId), JSON.stringify({ timestamp: Date.now(), data }));
        logDebug(`Mission ${missionId} cached`);
    }

    /**
     * Process each mission: resolve path, cache results, and render jump/AP info.
     */
    async function processMissions(){
        logInfo("Processing missions...");
        for(const item of missionlist){
            const table = item.table;
            const footerTd = table.querySelector("tr:last-child td:nth-child(2)");
            if(!footerTd) continue;
            footerTd.querySelectorAll("span, div").forEach(e=>e.remove());

            const missionIdMatch = table.innerHTML.match(/bulletin_board_accept\.php\?m=(\d+)/);
            const missionId = missionIdMatch ? missionIdMatch[1] : null;

            let result = missionId ? getCachedMissionData(missionId) : null;

            if(!result && missionId){
                logDebug(`No cache found for mission ${missionId}, computing path...`);
                const html = table.innerHTML;
                let sectorMatch = html.match(/sector <b>(.*?)<\/b>/i) || html.match(/in <b>(.*?)<\/b>/i);
                const descTd = table.querySelectorAll("tr")[1]?.querySelectorAll("td")[2];
                let coordMatch = descTd ? descTd.textContent.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/) : null;
                if(sectorMatch && coordMatch){
                    const destSector = sectorMatch[1].replace(/\s*\(.*?\)/g,"").trim();
                    const destX = parseInt(coordMatch[1],10);
                    const destY = parseInt(coordMatch[2],10);

                    const currentSector = readCookie('sector');
                    const currentX = parseInt(readCookie('x'),10);
                    const currentY = parseInt(readCookie('y'),10);

                    try {
                        result = await multiSectorPath(
                            {sector:currentSector,x:currentX,y:currentY},
                            {sector:destSector,x:destX,y:destY}
                        );
                        setCachedMissionData(missionId, result);
                        logSuccess(`Path computed for mission ${missionId}`);
                    } catch (e) {
                        logError(`Path computation failed for mission ${missionId}`, e);
                        result = null;
                    }
                }
            }

            item.jumpInfo = result;

            if(result){
                const pathEnd = result.path[result.path.length - 1];
                const mapperUrl = `https://pardusmapper.com/${encodeURIComponent(readCookie('uni'))}/${encodeURIComponent(pathEnd.sector)}?startSector=${encodeURIComponent(readCookie('sector'))}&startX=${readCookie('x')}&startY=${readCookie('y')}&destSector=${encodeURIComponent(pathEnd.sector)}&destX=${pathEnd.x}&destY=${pathEnd.y}&pathEnabled=true&pathNeedsReload=true`;

                const link = document.createElement("a");
                link.href = mapperUrl;
                link.target = "_blank";
                link.innerHTML = `${result.jumps} Jumps<br>${Math.round(result.cost)} AP`;

                const infoDiv = document.createElement("div");
                infoDiv.style.marginTop = "2px";
                infoDiv.appendChild(link);
                footerTd.appendChild(infoDiv);

                logDebug(`Mission ${missionId} rendered: ${result.jumps} jumps, ${Math.round(result.cost)} AP`);
            }

            completedMissions++;
            updateProgress();
        }

        applyTypeFilter();
        applyJumpFilter();
        sortMissions();

        if(progressDiv) progressDiv.style.display = "none";
        logSuccess("Mission processing complete");
    }

    /**
     * Apply type filters to mission visibility.
     */
    function applyTypeFilter(){
        const typeFilter = document.querySelector("#checkboxfilter");
        if(!typeFilter) return;

        const transport = typeFilter.querySelector("#checkboxtransport")?.checked ?? true;
        const attack = typeFilter.querySelector("#checkboxAttack")?.checked ?? true;
        const other = typeFilter.querySelector("#checkboxOther")?.checked ?? true;

        missionlist.forEach(item=>{
            const text = item.table.textContent.toLowerCase();
            if(text.includes("transport")) item.typeVisible = transport;
            else if(text.includes("attack")||text.includes("annihilate")) item.typeVisible = attack;
            else item.typeVisible = other;

            updateVisibility(item);
        });

        logInfo("Type filter applied");
    }

    /**
     * Apply jump limit filter to mission visibility.
     */
    function applyJumpFilter(){
        missionlist.forEach(item=>{
            if(!item.jumpInfo){
                item.jumpVisible = true;
            } else {
                item.jumpVisible = (jumpLimit === -1 || item.jumpInfo.jumps <= jumpLimit);
            }
            updateVisibility(item);
        });
        logInfo("Jump filter applied");
    }

    /**
     * Update mission table visibility.
     * @param {object} item - Mission object.
     */
    function updateVisibility(item){
        item.mission.hidden = !(item.typeVisible && item.jumpVisible);
    }

    /**
     * Sort missions by border color, jumps, AP, image, and count.
     */
    function sortMissions(){
        logInfo("Sorting missions...");
        const container = document.querySelector("#div_missions");
        if(!container) return;

        // Remove only top-level <br> children (between tables)
        Array.from(container.children)
            .filter(c => c.tagName === "BR")
            .forEach(br => br.remove());

        missionlist.sort((a,b)=>{
            // 1️⃣ Border color, reversed
            const borderA = a.table.style.borderColor || "";
            const borderB = b.table.style.borderColor || "";
            if(borderA !== borderB) return borderB.localeCompare(borderA);

            // 2️⃣ Jumps: undefined first, then ascending
            const jumpsA = a.jumpInfo?.jumps;
            const jumpsB = b.jumpInfo?.jumps;
            if(jumpsA === undefined && jumpsB !== undefined) return -1;
            if(jumpsA !== undefined && jumpsB === undefined) return 1;
            if(jumpsA !== undefined && jumpsB !== undefined && jumpsA !== jumpsB) return jumpsA - jumpsB;

            // 3️⃣ AP ascending
            const apA = a.jumpInfo?.cost ?? Infinity;
            const apB = b.jumpInfo?.cost ?? Infinity;
            if(apA !== apB) return apA - apB;

            // 4️⃣ Image in second <tr>, first <td>
            const imgA = a.table.querySelector("tr:nth-child(2) td img")?.src ?? "";
            const imgB = b.table.querySelector("tr:nth-child(2) td img")?.src ?? "";
            if(imgA !== imgB) return imgA.localeCompare(imgB);

            // 5️⃣ Count: null first, then ascending
            const countA = a.count ?? -1;
            const countB = b.count ?? -1;
            return countA - countB;
        });

        // Append visible missions with <br> between them
        let firstAppended = false;
        missionlist.forEach(item=>{
            if(item.mission.hidden) return;
            if(firstAppended) container.appendChild(document.createElement("br"));
            container.appendChild(item.table);
            firstAppended = true;
        });

        logSuccess("Missions sorted and rendered");
    }

    /**
     * Initialize mission board filtering and rendering.
     */
    function runBoard(){
        logGroupStart("Running Bulletin Board AP Filter");
        createMissionList();
        createProgressDiv();
        setupJumpFilterUI();
        processMissions();
        logGroupEnd();
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded", runBoard);
    } else runBoard();

})();
