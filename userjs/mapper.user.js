// ==UserScript==
// @name         Pardus Multi-Sector AP Pathfinder UI
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.5
// @description  UI for multi-sector AP Pathfinder with cached path restore
// @match        http*://pardusmapper.com/*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/APPathfinderCore.user.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @tag          Pardus
// @tag          Spacerules
// @grant        none
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */
/* global multiSectorPath */

(function(){
    'use strict';

    logEnabled(false);
    logGroupStart(`File: ${GM_info.script.name}`);

    let lastHighlightedPath = [];

    // Load cached path from localStorage
    let cachedPath = [];
    try {
        const stored = localStorage.getItem("pfCachedPath");
        if(stored) cachedPath = JSON.parse(stored);
    } catch(e){ logWarn("Failed to parse cached path", e); }

    // ----------------------------
    // Utility: Wait for DOM element
    // ----------------------------
    function waitForElement(selector, cb){
        const el = document.querySelector(selector);
        if(el) cb(el);
        else requestAnimationFrame(()=>waitForElement(selector, cb));
    }

    // ----------------------------
    // Save/load inputs via cookies
    // ----------------------------
    function savePathfinderInputs(panel){
        const data = {
            sSec: panel.querySelector("#pf-start-sector").value.trim(),
            sX: panel.querySelector("#pf-start-x").value,
            sY: panel.querySelector("#pf-start-y").value,
            eSec: panel.querySelector("#pf-end-sector").value.trim(),
            eX: panel.querySelector("#pf-end-x").value,
            eY: panel.querySelector("#pf-end-y").value
        };
        writeCookie("pfInputs", JSON.stringify(data), 365);
    }

    function loadPathfinderInputs(panel){
        const saved = readCookie("pfInputs");
        if(!saved || saved === " ") return;
        try {
            const data = JSON.parse(decodeURIComponent(saved));
            panel.querySelector("#pf-start-sector").value = data.sSec || "";
            panel.querySelector("#pf-start-x").value = data.sX || "";
            panel.querySelector("#pf-start-y").value = data.sY || "";
            panel.querySelector("#pf-end-sector").value = data.eSec || "";
            panel.querySelector("#pf-end-x").value = data.eX || "";
            panel.querySelector("#pf-end-y").value = data.eY || "";
        } catch(e){
            logWarn("Failed to load saved inputs", e);
        }
    }

    // ----------------------------
    // Highlight path on the map
    // ----------------------------
    function highlightPathOnCurrentPage(path){
        if(!path || !path.length) return;
        waitForElement("#sectorTableMap", table => {
            const rows = table.querySelectorAll("tbody tr");
            const currentSector = decodeURIComponent(location.pathname.split("/").pop() || "")
                .replace(/_/g, " ")
                .trim();

            // Clear previous highlights in the current sector
            lastHighlightedPath.forEach(step => {
                if(step.sector !== currentSector) return;
                const tr = rows[step.y];
                if(!tr) return;
                const td = tr.querySelectorAll("td.grid")[step.x];
                if(!td) return;
                td.style.outline = "";
                td.style.backgroundColor = "";
            });

            // Group path steps by sector
            const sectors = {};
            path.forEach((step, idx) => {
                if(!sectors[step.sector]) sectors[step.sector] = [];
                sectors[step.sector].push({step, idx});
            });

            // Highlight steps for the current sector
            if(sectors[currentSector]){
                sectors[currentSector].forEach(({step, idx}, i, arr) => {
                    const tr = rows[step.y];
                    if(!tr) return;
                    const td = tr.querySelectorAll("td.grid")[step.x];
                    if(!td) return;

                    if(i === 0) {
                        td.style.outline = "2px solid limegreen";
                        td.style.backgroundColor = "rgba(0,255,0,0.3)";
                    } else if(i === arr.length - 1) {
                        td.style.outline = "2px solid red";
                        td.style.backgroundColor = "rgba(255,0,0,0.3)";
                    } else {
                        td.style.outline = "2px solid yellow";
                        td.style.backgroundColor = "rgba(255,255,0,0.3)";
                    }
                });
            }

            lastHighlightedPath = path;
        });
    }

    // ----------------------------
    // Run Pathfinder
    // ----------------------------
    function runPathfinder(panel){
        if(!window.multiSectorPath) return logError("multiSectorPath not loaded!");

        const sSec = panel.querySelector("#pf-start-sector").value.trim();
        const sX = parseInt(panel.querySelector("#pf-start-x").value, 10);
        const sY = parseInt(panel.querySelector("#pf-start-y").value, 10);
        const eSec = panel.querySelector("#pf-end-sector").value.trim();
        const eX = parseInt(panel.querySelector("#pf-end-x").value, 10);
        const eY = parseInt(panel.querySelector("#pf-end-y").value, 10);

        if(!sSec || !eSec || Number.isNaN(sX) || Number.isNaN(sY) || Number.isNaN(eX) || Number.isNaN(eY)) return;

        savePathfinderInputs(panel);

        const status = panel.querySelector("#pf-status");
        const out = panel.querySelector("#pf-output");
        out.textContent = "";
        status.textContent = "computing…";

        window.multiSectorPath({sector:sSec, x:sX, y:sY}, {sector:eSec, x:eX, y:eY})
            .then(result => {
                cachedPath = result.path || [];
                localStorage.setItem("pfCachedPath", JSON.stringify(cachedPath));

                let text = `Total APs used: ${result.cost}\nSteps: ${result.path.length-1}\nJumps: ${result.jumps}\n\nPath:\n`;
                for(const step of result.path) text += `${step.sector}: (${step.x},${step.y})\n`;
                out.textContent = text;

                highlightPathOnCurrentPage(result.path);
                status.textContent = "done";
                setTimeout(()=>{status.textContent = "";}, 1500);
            })
            .catch(err => {
                out.textContent = "Error: " + (err?.message || err);
                status.textContent = "";
                logError(err);
            });
    }

    // ----------------------------
    // Ctrl / Shift click grid handler
    // ----------------------------
    function addGridClickHandlers() {
        waitForElement("#sectorTableMap", table => {
            const currentSector = decodeURIComponent(location.pathname.split("/").pop() || "")
                .replace(/_/g, " ")
                .trim();

            const rows = table.querySelectorAll("tbody tr");
            rows.forEach((tr, y) => {
                const tds = tr.querySelectorAll("td.grid");
                tds.forEach((td, x) => {
                    td.style.cursor = "pointer";

                    td.addEventListener("click", e => {
                        const panel = document.getElementById("ap-pathfinder-panel");
                        if (!panel) return;

                        if (e.shiftKey) {
                            panel.querySelector("#pf-end-sector").value = currentSector;
                            panel.querySelector("#pf-end-x").value = x;
                            panel.querySelector("#pf-end-y").value = y;
                        } else if (e.ctrlKey || e.metaKey) {
                            panel.querySelector("#pf-start-sector").value = currentSector;
                            panel.querySelector("#pf-start-x").value = x;
                            panel.querySelector("#pf-start-y").value = y;
                        }

                        savePathfinderInputs(panel);
                        runPathfinder(panel);
                    });
                });
            });
        });
    }

    // ----------------------------
    // Panel UI
    // ----------------------------
    function createPanel(){
        const panel = document.createElement("div");
        panel.id = "ap-pathfinder-panel";

        panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-weight:600;">AP Pathfinder</div>
            <button id="pf-toggle" style="background:#333;color:#eee;border:none;padding:2px 6px;cursor:pointer;">_</button>
        </div>
        <div id="pf-main">
            <div style="display:grid;grid-template-columns:auto auto;gap:6px;align-items:center;">
                <label>Start sector</label><input id="pf-start-sector" placeholder="e.g. AB 5-848" />
                <label>Start x</label><input id="pf-start-x" type="number" min="0" step="1" style="width:90px;" />
                <label>Start y</label><input id="pf-start-y" type="number" min="0" step="1" style="width:90px;" />
                <label>End sector</label><input id="pf-end-sector" placeholder="e.g. Cegreeth" />
                <label>End x</label><input id="pf-end-x" type="number" min="0" step="1" style="width:90px;" />
                <label>End y</label><input id="pf-end-y" type="number" min="0" step="1" style="width:90px;" />
            </div>
            <div style="margin-top:8px;display:flex;gap:8px;">
                <button id="pf-run" style="padding:6px 10px;">Find Path</button>
                <span id="pf-status" style="font-size:12px;color:#ccc;"></span>
            </div>
            <div id="pf-output" style="margin-top:8px;max-height:280px;overflow:auto;font-family:monospace;font-size:12px;white-space:pre;"></div>
        </div>
        `;

        Object.assign(panel.style, {
            position:"fixed", right:"12px", bottom:"12px",
            zIndex:99999, background:"rgba(0,0,0,0.85)", color:"#eee",
            padding:"10px", borderRadius:"10px", boxShadow:"0 4px 18px rgba(0,0,0,0.35)", width:"360px"
        });

        document.body.appendChild(panel);

        const toggleBtn = panel.querySelector("#pf-toggle");
        const mainDiv = panel.querySelector("#pf-main");
        toggleBtn.addEventListener("click", ()=>{
            if(mainDiv.style.display==="none"){ mainDiv.style.display="block"; toggleBtn.textContent="_"; }
            else { mainDiv.style.display="none"; toggleBtn.textContent="◯"; }
        });

        loadPathfinderInputs(panel);

        // Restore cached path into the panel output and highlight it
        if(cachedPath && cachedPath.length){
            const out = panel.querySelector("#pf-output");
            let text = "";
            cachedPath.forEach(step => { text += `${step.sector}: (${step.x},${step.y})\n`; });
            out.textContent = text;
            highlightPathOnCurrentPage(cachedPath);
        }

        ["#pf-start-sector","#pf-start-x","#pf-start-y","#pf-end-sector","#pf-end-x","#pf-end-y"]
            .forEach(sel => panel.querySelector(sel).addEventListener("input", ()=>runPathfinder(panel)));

        panel.querySelector("#pf-run").addEventListener("click", ()=>runPathfinder(panel));

        addGridClickHandlers();
    }

    // ----------------------------
    // Initialize
    // ----------------------------
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded", ()=>createPanel());
    } else createPanel();

})();
