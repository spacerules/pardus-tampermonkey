// ==UserScript==
// @name         Pardus Multi-Sector AP Pathfinder (Chebyshev) v5.4 Auto & Minimize
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.2
// @description  Weighted Chebyshev pathfinder across sectors using Sweetener maps. Highlights current sector path automatically. Saves inputs via cookies. Minimize/maximize panel. Auto-runs if start/end are filled. Tracks wormhole jumps.
// @author       Spacerules
// @match        http://*.pardus.at/bulletin_board.php
// @match        https://*.pardus.at/bulletin_board.php
// @include      http*://pardusmapper.com/*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/APPathFinder.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/APPathFinder.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */

(function() {
    'use strict';

    const SWEETENER_REF = "9af82720543b8464aeab27af589c53c6a6c774ec";
    const TILE_COST = { b: Infinity, e: 19, f: 10, g: 15, o: 24, m: 35, v: 10 };
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    const OPPOSITE = { North: "South", South: "North", East: "West", West: "East" };

    function normalizeSectorName(name){ return name.trim().replace(/\s+/g,"_"); }
    function sectorToUrl(sector){ const file=normalizeSectorName(sector); return `https://raw.githubusercontent.com/Tsunder/Pardus-Sweetener/${SWEETENER_REF}/chrome/map/${file[0]}/${file}.json`; }
    function waitForElement(selector,cb){ const el=document.querySelector(selector); if(el) cb(el); else requestAnimationFrame(()=>waitForElement(selector,cb)); }
    function baseSectorName(label){ const idx=label.indexOf(" ("); return (idx>=0)?label.slice(0,idx).trim():label.trim(); }
    function beaconDirection(label){ const m=label.match(/\((North|South|East|West)\)/i); return m?(m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()):null; }

    class PQ{ constructor(){this.q=[];} push(node,p){ this.q.push({node,priority:p});} pop(){this.q.sort((a,b)=>a.priority-b.priority); return this.q.shift()?.node;} get length(){return this.q.length;} }
    function keyOf(sector,x,y){ return `${sector}::${x},${y}`; }

    const mapCache = new Map();
    async function loadSector(sector){
        sector=normalizeSectorName(sector);
        if(mapCache.has(sector)) return mapCache.get(sector);
        const res = await fetch(sectorToUrl(sector));
        if(!res.ok) throw new Error(`Failed to fetch ${sector}: ${res.status}`);
        const data = await res.json();
        const grid = Array.from({length:data.height},(_,y)=>Array.from({length:data.width},(_,x)=>data.tiles[y*data.width+x]));
        const beaconsByCoord = new Map();
        const beaconList = [];
        for(const [name,b] of Object.entries(data.beacons||{})){
            const item={name,type:b.type,x:b.x,y:b.y};
            beaconList.push(item);
            beaconsByCoord.set(`${b.x},${b.y}`,item);
        }
        const wrapped={...data,grid,beaconList,beaconsByCoord};
        mapCache.set(sector,wrapped);
        return wrapped;
    }

    async function resolveWormholeExit(currentSector,beaconName){
        const destSector=baseSectorName(beaconName);
        const destMap=await loadSector(destSector);
        const wantBase=baseSectorName(currentSector);
        let candidates=destMap.beaconList.filter(b=>baseSectorName(b.name)===wantBase);
        if(candidates.length===1) return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        if(candidates.length>1){
            const hereDir=beaconDirection(beaconName);
            if(hereDir && OPPOSITE[hereDir]){
                const exact=candidates.find(b=>beaconDirection(b.name)===OPPOSITE[hereDir]);
                if(exact) return {sector:destSector,x:exact.x,y:exact.y};
            }
            return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        }
        const anyWH=destMap.beaconList.filter(b=>b.type==="wh");
        if(anyWH.length>0) return {sector:destSector,x:anyWH[0].x,y:anyWH[0].y};
        if(destMap.beaconList.length>0) return {sector:destSector,x:destMap.beaconList[0].x,y:destMap.beaconList[0].y};
        return null;
    }

    async function multiSectorPath(start,end){
        await loadSector(start.sector);
        await loadSector(end.sector);
        const dist=new Map(), prev=new Map(), jumpsMap=new Map();
        const startKey=keyOf(start.sector,start.x,start.y);
        dist.set(startKey,0);
        jumpsMap.set(startKey,0);
        const pq=new PQ();
        pq.push({...start,jumps:0},0);

        while(pq.length){
            const current=pq.pop();
            const {sector,x,y,jumps} = current;
            const curKey=keyOf(sector,x,y);
            const curDist=dist.get(curKey)??Infinity;
            const curJumps=jumpsMap.get(curKey)??0;

            if(sector===end.sector && x===end.x && y===end.y){
                const path=[]; let k=curKey;
                while(k){ const [sec,rest]=k.split("::"); const [cx,cy]=rest.split(",").map(Number); path.unshift({sector:sec,x:cx,y:cy}); k=prev.get(k)||null; }
                return {cost:curDist, path, jumps: curJumps};
            }

            const mapData=await loadSector(sector);
            const {width,height,grid,beaconsByCoord}=mapData;

            for(const [dx,dy] of DIRS){
                const nx=x+dx, ny=y+dy;
                if(nx<0||ny<0||nx>=width||ny>=height) continue;
                const code=grid[ny][nx];
                const stepCost=TILE_COST[code]??10;
                if(!isFinite(stepCost)) continue;
                const nKey=keyOf(sector,nx,ny);
                const alt=curDist+stepCost;
                if(alt<(dist.get(nKey)??Infinity)){
                    dist.set(nKey,alt); prev.set(nKey,curKey); jumpsMap.set(nKey,curJumps);
                    pq.push({sector,x:nx,y:ny,jumps:curJumps},alt);
                }
            }

            const beacon=beaconsByCoord.get(`${x},${y}`);
            if(beacon && beacon.type==="wh"){
                const exit=await resolveWormholeExit(sector,beacon.name);
                if(exit){
                    const nKey=keyOf(exit.sector,exit.x,exit.y);
                    const wormholeCost = 23;
                    const alt=curDist+wormholeCost;
                    if(alt<(dist.get(nKey)??Infinity)){
                        dist.set(nKey,alt); prev.set(nKey,curKey); jumpsMap.set(nKey,curJumps+1);
                        pq.push({sector:exit.sector,x:exit.x,y:exit.y,jumps:curJumps+1},alt);
                    }
                }
            }
        }
        throw new Error("No path found");
    }

    function highlightPathOnCurrentPage(path){
        const currentSector=decodeURIComponent(location.pathname.split("/").pop()||"").replace(/_/g," ").trim();
        if(!path||path.length===0) return;
        waitForElement("#sectorTableMap",table=>{
            const rows=table.querySelectorAll("tbody tr");
            rows.forEach(tr=>tr.querySelectorAll("td.grid").forEach(td=>{td.style.outline=""; td.style.backgroundColor="";}));
            for(const step of path){
                if(step.sector!==currentSector) continue;
                const tr=rows[step.y]; if(!tr) continue;
                const td=tr.querySelectorAll("td.grid")[step.x]; if(!td) continue;
                td.style.outline="2px solid yellow"; td.style.backgroundColor="rgba(255,255,0,0.3)";
            }
        });
    }

    function savePathfinderInputs(panel){
        const data={
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
        const saved=readCookie("pfInputs");
        if(saved && saved!==" "){
            try{
                const data=JSON.parse(decodeURIComponent(saved));
                panel.querySelector("#pf-start-sector").value=data.sSec||"";
                panel.querySelector("#pf-start-x").value=data.sX||"";
                panel.querySelector("#pf-start-y").value=data.sY||"";
                panel.querySelector("#pf-end-sector").value=data.eSec||"";
                panel.querySelector("#pf-end-x").value=data.eX||"";
                panel.querySelector("#pf-end-y").value=data.eY||"";
            }catch(e){console.warn("Failed to load saved inputs",e);}
        }
    }

    function runPathfinder(panel){
        const sSec=panel.querySelector("#pf-start-sector").value.trim();
        const sX=parseInt(panel.querySelector("#pf-start-x").value,10);
        const sY=parseInt(panel.querySelector("#pf-start-y").value,10);
        const eSec=panel.querySelector("#pf-end-sector").value.trim();
        const eX=parseInt(panel.querySelector("#pf-end-x").value,10);
        const eY=parseInt(panel.querySelector("#pf-end-y").value,10);
        if(!sSec||!eSec||Number.isNaN(sX)||Number.isNaN(sY)||Number.isNaN(eX)||Number.isNaN(eY)) return;
        savePathfinderInputs(panel);
        const status=panel.querySelector("#pf-status");
        const out=panel.querySelector("#pf-output");
        out.textContent=""; status.textContent="computing…";
        multiSectorPath({sector:sSec,x:sX,y:sY},{sector:eSec,x:eX,y:eY})
        .then(result=>{
            let text=`Total APs used: ${result.cost}\nSteps: ${result.path.length-1}\nJumps: ${result.jumps}\n\nPath:\n`;
            for(const step of result.path) text+=`${step.sector}: (${step.x},${step.y})\n`;
            out.textContent=text;
            highlightPathOnCurrentPage(result.path);
            status.textContent="done";
            setTimeout(()=>{status.textContent="";},1500);
        }).catch(err=>{
            out.textContent="Error: "+(err?.message||err);
            status.textContent="";
            console.error(err);
        });
    }

    function runPathfinderIfReady(panel){
        const sSec=panel.querySelector("#pf-start-sector").value.trim();
        const sX=panel.querySelector("#pf-start-x").value;
        const sY=panel.querySelector("#pf-start-y").value;
        const eSec=panel.querySelector("#pf-end-sector").value.trim();
        const eX=panel.querySelector("#pf-end-x").value;
        const eY=panel.querySelector("#pf-end-y").value;
        if(sSec && sX && sY && eSec && eX && eY){
            runPathfinder(panel);
        }
    }

    function getStringPath(){

        const sSec=readCookie("sector");
        console.log(sSec);
        const sX=parseInt(readCookie("x"),10);
        const sY=parseInt(readCookie("y"),10);
        const eSec=readCookie("sector");
        const eX=parseInt(readCookie("x"),10)+3;
        const eY=parseInt(readCookie("y"),10)+2;
        if(!sSec||!eSec||Number.isNaN(sX)||Number.isNaN(sY)||Number.isNaN(eX)||Number.isNaN(eY)) return;
        console.log("computing…");
        multiSectorPath({sector:sSec,x:sX,y:sY},{sector:eSec,x:eX,y:eY})
        .then(result=>{
            let text=`Total APs used: ${result.cost}\nSteps: ${result.path.length-1}\nJumps: ${result.jumps}\n\nPath:\n`;
            for(const step of result.path) text+=`${step.sector}: (${step.x},${step.y})\n`;
            console.log(text);
            highlightPathOnCurrentPage(result.path);
            console.log("done");
            //setTimeout(()=>{status.textContent="";},1500);
        }).catch(err=>{
            console.log("Error: "+(err?.message||err));
            console.log("");
            console.error(err);
        });
    }

    function addGridClickHandlers(){
        waitForElement("#sectorTableMap",table=>{
            const currentSector=decodeURIComponent(location.pathname.split("/").pop()||"").replace(/_/g," ").trim();
            const rows=table.querySelectorAll("tbody tr");
            rows.forEach((tr,y)=>{
                const tds=tr.querySelectorAll("td.grid");
                tds.forEach((td,x)=>{
                    td.style.cursor="pointer";
                    td.addEventListener("click",async e=>{
                        const panel=document.getElementById("ap-pathfinder-panel");
                        if(!panel) return;
                        if(e.shiftKey){
                            panel.querySelector("#pf-end-sector").value=currentSector;
                            panel.querySelector("#pf-end-x").value=x;
                            panel.querySelector("#pf-end-y").value=y;
                        }else if(e.ctrlKey){
                            panel.querySelector("#pf-start-sector").value=currentSector;
                            panel.querySelector("#pf-start-x").value=x;
                            panel.querySelector("#pf-start-y").value=y;
                        }
                        savePathfinderInputs(panel);
                        runPathfinderIfReady(panel);
                    });
                });
            });
        });
    }

    function createPanel(){
        const panel=document.createElement("div");
        panel.id="ap-pathfinder-panel";
        panel.innerHTML=`
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-weight:600;">AP Pathfinder (Chebyshev) v5.4</div>
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
        Object.assign(panel.style,{
            position:"fixed", right:"12px", bottom:"12px", zIndex:99999,
            background:"rgba(0,0,0,0.85)", color:"#eee", padding:"10px",
            borderRadius:"10px", boxShadow:"0 4px 18px rgba(0,0,0,0.35)", width:"360px"
        });
        document.body.appendChild(panel);

        const toggleBtn = panel.querySelector("#pf-toggle");
        const mainDiv = panel.querySelector("#pf-main");
        toggleBtn.addEventListener("click",()=>{
            if(mainDiv.style.display==="none"){ mainDiv.style.display="block"; toggleBtn.textContent="_"; }
            else { mainDiv.style.display="none"; toggleBtn.textContent="◯"; }
        });

        loadPathfinderInputs(panel);
        runPathfinderIfReady(panel);

        ["#pf-start-sector","#pf-start-x","#pf-start-y","#pf-end-sector","#pf-end-x","#pf-end-y"].forEach(sel=>{
            panel.querySelector(sel).addEventListener("input",()=>runPathfinderIfReady(panel));
        });

        panel.querySelector("#pf-run").addEventListener("click",()=>runPathfinder(panel));
    }

    function main(){
        if(location.href.match('pardusmapper.com')){
            if(document.readyState==="loading"){
                document.addEventListener("DOMContentLoaded",()=>{ createPanel(); addGridClickHandlers(); });
            } else { createPanel(); addGridClickHandlers(); }
        }
        if (location.href.match('bulletin_board.php')) {
const runBoard = () => {
    waitForElement("table.messagestyle", () => {
        const tables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
        const currentSector = readCookie('sector');
        const currentX = parseInt(readCookie('x'), 10);
        const currentY = parseInt(readCookie('y'), 10);

        if (!currentSector || Number.isNaN(currentX) || Number.isNaN(currentY)) {
            console.warn("Current sector/coords not found in cookies.");
            return;
        }

        const promises = tables.map(table => {
            const footerSecondTd = table.querySelector("tr:last-child td:nth-child(2)");
            if (!footerSecondTd) return Promise.resolve({ table, result: null, borderColor: '' });

            // Status span
            const statusSpan = document.createElement("span");
            statusSpan.textContent = "Loading";
            footerSecondTd.appendChild(document.createElement("br"));
            footerSecondTd.appendChild(statusSpan);
            footerSecondTd.appendChild(document.createElement("br"));

            // Extract sector & coords
            const tableHTML = table.innerHTML;
            const sectorMatch = tableHTML.match(/sector <b>(.*?)<\/b>/i);
            let coordMatch = null;
            const descTd = table.querySelectorAll("tr")[1]?.querySelectorAll("td")[2];
            if (descTd) {
                coordMatch = descTd.textContent.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/)
                    || descTd.innerHTML.match(/\[\s*(?:<[^>]*>)*\s*(\d+)\s*,\s*(\d+)\s*(?:<[^>]*>)*\s*\]/i);
            }

            if (!sectorMatch || !coordMatch) {
                statusSpan.textContent = "N/A";
                statusSpan.remove();
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

                // Capture border color for sorting
                const borderColor = table.style.borderColor || '';
                return { table, result, borderColor };
            }).catch(err => {
                statusSpan.textContent = "Error";
                console.error(`Pathfinder error for ${destSector} (${destX},${destY}):`, err);
                return { table, result: null, borderColor: table.style.borderColor || '' };
            });
        });

        Promise.all(promises).then(results => {
            // Sort first by border color (lexicographically), then by jumps
            results.sort((a, b) => {
                if (a.borderColor < b.borderColor) return 1;
                if (a.borderColor > b.borderColor) return -1;
                if (!a.result) return -1;
                if (!b.result) return 1;
                if (a.result.jumps == b.result.jumps) return a.result.cost - b.result.cost
                return a.result.jumps - b.result.jumps;
            });

            document.querySelectorAll("#div_missions > br").forEach(br => br.remove());

          var brelem = document.createElement("br");
    document.querySelectorAll("#div_missions")[0].appendChild(brelem);

            // Append tables back in sorted order
            results.forEach(r => {
    // Append table back to its original parent
    var brelem = document.createElement("br");
    r.table.parentNode.appendChild(brelem);

    r.table.parentNode.appendChild(r.table);
    // Move the second child of div_missions to the end
   // const divMissions = document.getElementById("div_missions");
    //if (divMissions && divMissions.children.length > 1) {
//        divMissions.appendChild(divMissions.children[1]);
//    }
});
        });
    });
};
runBoard();
}
    }

    main();
})();
