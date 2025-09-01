// ==UserScript==
// @name         Bulletin Board Filters & Sort
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.0
// @description  Filter missions, remove extra top breaks, spacing, use correct left-side images for sorting, log image URLs, null counts first, flexible count parsing, preserve table-internal <br>
// @match        http*://*.pardus.at/bulletin_board.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @tag          Pardus
// @tag          Spacerules
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoardFilter.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoardFilter.user.js
// @supportURL   https://github.com/spacerules/pardus-tampermonkey/issues/new?template=Issue%20Report.yaml&title=Bulletin%20Board%20Filter%20-%20&version=1.0.0
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */

(function(){
    'use strict';

    logEnabled(true);
    logGroupStart(`File: ${GM_info.script.name}`);

    /**
     * Stores the parsed missions on the page.
     * @type {Array<{mission:HTMLElement, type:string, count:number|null, img:string|null, borderColor:string}>}
     */
    let missionlist = [];

    /**
     * Retrieve settings for mission filters from GM storage.
     * Falls back to defaults if not set.
     * @returns {Object} Current mission settings
     */
    function getGM_list() {
        logDebug("Fetching mission filter settings from GM storage...");
        const storedStr = GM_getValue("missionSettings", null);
        const stored = storedStr ? JSON.parse(storedStr) : {};
        const defaults = { checkboxtransport:true, checkboxAttack:true, checkboxOther:true };
        const missionSettings = {
            checkboxtransport: stored.checkboxtransport!==undefined?stored.checkboxtransport:defaults.checkboxtransport,
            checkboxAttack: stored.checkboxAttack!==undefined?stored.checkboxAttack:defaults.checkboxAttack,
            checkboxOther: stored.checkboxOther!==undefined?stored.checkboxOther:defaults.checkboxOther,
        };
        if(!storedStr || Object.keys(stored).length< Object.keys(defaults).length){
            logInfo("Updating GM storage with default/merged mission settings");
            GM_setValue("missionSettings", JSON.stringify(missionSettings));
        }
        return missionSettings;
    }

    /**
     * Update a specific mission filter setting in GM storage.
     * @param {string} key - The setting key to update
     * @param {boolean} value - The new value for the setting
     */
    function setGM_list(key,value){
        logInfo(`Updating mission setting: ${key} -> ${value}`);
        const settings=getGM_list();
        settings[key]=value;
        GM_setValue("missionSettings",JSON.stringify(settings));
    }

    /**
     * Build the mission list from bulletin board DOM.
     * Extracts type, count, image URL, and border color for each mission.
     */
    function createMissionList(){
        logInfo("Creating mission list from DOM...");
        const missions = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
        logDebug(`Found ${missions.length} missions in DOM`);
        missionlist = missions.map(m=>{
            const text = m.textContent.toLowerCase();
            const type = text.includes("transport") ? "transport" :
                         (text.includes("attack")||text.includes("annihilate") ? "attack" : "other");

            // Flexible count parsing
            const countTr = m.querySelectorAll("tr")[2];
            let count = null;
            if(countTr){
                const countMatch = countTr.innerHTML.match(/<b>(?:<font[^>]*>)?(\d+)(?:<\/font>)?<\/b>/);
                if(countMatch) count = parseInt(countMatch[1],10);
            }

            // Use image from second <tr>, first <td>
            let img = null;
            const secondTr = m.querySelectorAll("tr")[1];
            if(secondTr){
                const td = secondTr.querySelector("td");
                if(td){
                    const imgElem = td.querySelector("img");
                    if(imgElem) img = imgElem.src;
                }
            }

            logDebug(`Mission parsed | type:${type} | count:${count} | img:${img} | borderColor:${m.style.borderColor||''}`);
            return {mission:m, type, count, img, borderColor: m.style.borderColor||''};
        });
    }

    /**
     * Remove leading <br> tags from the missions container.
     */
    function removeLeadingBreaks(){
        logInfo("Removing leading <br> tags in #div_missions...");
        const container = document.querySelector("#div_missions");
        while(container.firstChild && container.firstChild.tagName === 'BR'){
            logDebug("Removed a leading <br>");
            container.firstChild.remove();
        }
    }

    /**
     * Hide or show missions based on stored filter settings.
     */
    function refreshHidden(){
        logInfo("Applying visibility filters to missions...");
        const settings = getGM_list();
        missionlist.forEach(item=>{
            let hide = false;
            if(item.type==="transport") hide=!settings.checkboxtransport;
            else if(item.type==="attack") hide=!settings.checkboxAttack;
            else hide=!settings.checkboxOther;
            item.mission.hidden = hide;
            logDebug(`Mission type:${item.type} | hidden:${hide}`);
        });
    }

    /**
     * Sort missions by borderColor (reverse), image URL, null counts first, then numeric counts ascending.
     * Preserves <br> only between visible missions.
     */
    function sortMissions(){
        logInfo("Sorting missions...");
        const container = document.querySelector("#div_missions");
        if(!container){
            logWarn("#div_missions not found, skipping sort");
            return;
        }

        // Remove only <br> nodes that are direct children of #div_missions
        Array.from(container.children).forEach(child => {
            if(child.tagName === 'BR'){
                logDebug("Removed stray <br> before sorting");
                child.remove();
            }
        });

        // Log before sorting
        logInfo("Before sorting mission order:");
        logTable(missionlist.map(item=>({
            type: item.type,
            count: item.count,
            borderColor: item.borderColor,
            img: item.img
        })));

        // Sort missionlist
        missionlist.sort((a,b)=>{
            if(a.borderColor !== b.borderColor) return b.borderColor.localeCompare(a.borderColor);

            const imgA = a.img || "";
            const imgB = b.img || "";
            if(imgA !== imgB) return imgA.localeCompare(imgB);

            if(a.count === null && b.count !== null) return -1;
            if(a.count !== null && b.count === null) return 1;

            return (a.count ?? 0) - (b.count ?? 0);
        });

        // Log after sorting
        logInfo("After sorting mission order:");
        logTable(missionlist.map(item=>({
            type: item.type,
            count: item.count,
            borderColor: item.borderColor,
            img: item.img
        })));

        // Remove tables temporarily
        missionlist.forEach(item => item.mission.remove());

        // Append back
        let firstVisible = true;
        missionlist.forEach(item=>{
            if(!item.mission.hidden && !firstVisible){
                container.appendChild(document.createElement("br"));
                logDebug("Inserted <br> between visible missions");
            }
            container.appendChild(item.mission);
            if(!item.mission.hidden) firstVisible = false;
        });
    }

    /**
     * Setup filter checkboxes (Transport, Attack, Other) below the header link.
     * Updates GM storage and refreshes missions on change.
     */
    function setupFilters(){
        logInfo("Setting up mission filter checkboxes...");
        const headerLink = document.querySelector(".messagestyle a");
        if(!headerLink){
            logWarn("No header link found, skipping filter setup");
            return;
        }

        const newspan=document.createElement("span"); newspan.id="checkboxfilter";
        const newbr=document.createElement("br");
        headerLink.insertAdjacentElement("afterend",newbr);
        newbr.insertAdjacentElement("afterend",newspan);

        const settings=getGM_list();

        /**
         * Create a checkbox for mission filtering.
         * @param {string} label - Text label for checkbox
         * @param {string} prop - Settings property key
         */
        function createCheckbox(label,prop){
            logDebug(`Creating checkbox: ${label} (${prop})`);
            const input=document.createElement("input"); input.type="checkbox"; input.id=prop; input.checked=settings[prop];
            const lbl=document.createElement("label"); lbl.textContent=label; lbl.htmlFor=prop;
            input.addEventListener("change",()=>{
                logInfo(`Checkbox changed: ${prop} -> ${input.checked}`);
                setGM_list(prop,input.checked);
                refreshHidden();
                sortMissions();
            });
            newspan.appendChild(input); newspan.appendChild(lbl);
        }

        createCheckbox("Transports","checkboxtransport");
        createCheckbox("Attack","checkboxAttack");
        createCheckbox("Other","checkboxOther");
    }

    /**
     * Execute mission board setup:
     * - Clean up breaks
     * - Parse mission list
     * - Sort missions
     * - Apply filters
     */
    function runBoard(){
        logInfo("Running mission board initialization...");
        removeLeadingBreaks();
        createMissionList();
        sortMissions();
        refreshHidden();
    }

    setupFilters();
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",runBoard);
    } else runBoard();

})();
