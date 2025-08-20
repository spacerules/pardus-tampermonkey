// ==UserScript==
// @name         Pardus Multi-Sector AP Pathfinder Bulletin Board
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.1
// @description  Show multi-sector AP path info for missions on bulletin board (lazy, cached, fixed sector names)
// @match        http*://*.pardus.at/bulletin_board.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/APPathfinderCore.user.js
// @tag          Pardus
// @tag          Spacerules
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function(){
    'use strict';

    logEnabled(false);

    let jumpLimit = -1;
    let missionlist = [];

    function getGM_list() {
        const storedStr = GM_getValue("missionSettings", null);
        const stored = storedStr ? JSON.parse(storedStr) : {};
        const defaults = { checkboxtransport:true, checkboxAttack:true, checkboxOther:true, jumpfilter:-1 };
        const missionSettings = {
            checkboxtransport: stored.checkboxtransport!==undefined?stored.checkboxtransport:defaults.checkboxtransport,
            checkboxAttack: stored.checkboxAttack!==undefined?stored.checkboxAttack:defaults.checkboxAttack,
            checkboxOther: stored.checkboxOther!==undefined?stored.checkboxOther:defaults.checkboxOther,
            jumpfilter: stored.jumpfilter!==undefined?stored.jumpfilter:defaults.jumpfilter
        };
        if(!storedStr || Object.keys(stored).length< Object.keys(defaults).length){
            GM_setValue("missionSettings", JSON.stringify(missionSettings));
        }
        return missionSettings;
    }

    function setGM_list(key,value){
        const settings=getGM_list();
        settings[key]=value;
        GM_setValue("missionSettings",JSON.stringify(settings));
    }

    function createMissionList(){
        const missions = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
        const settings = getGM_list();
        missionlist = missions.map(m=>({
            mission:m,
            checkboxtransport: settings.checkboxtransport,
            checkboxAttack: settings.checkboxAttack,
            checkboxOther: settings.checkboxOther,
            jumpfilter:true,
            type: m.textContent.toLowerCase().includes("transport")?"transport":
                  (m.textContent.toLowerCase().includes("attack")||m.textContent.toLowerCase().includes("annihilate")?"attack":"other")
        }));
    }

    function refreshHidden(){
        missionlist.forEach(item=>{
            let hide = false;
            if(item.type==="transport") hide=!item.checkboxtransport;
            else if(item.type==="attack") hide=!item.checkboxAttack;
            else hide=!item.checkboxOther;
            hide = hide || item.jumpfilter===false;
            item.mission.hidden = hide;
            if(item.mission.nextElementSibling) item.mission.nextElementSibling.hidden = hide;
        });
    }

    function setupFilters(){
        const headerLink = document.querySelector(".messagestyle a");
        if(!headerLink) return;

        const newspan=document.createElement("span"); newspan.id="checkboxfilter";
        headerLink.insertAdjacentElement("afterend",document.createElement("br"));
        headerLink.insertAdjacentElement("afterend",newspan);

        const settings=getGM_list();
        jumpLimit=settings.jumpfilter;

        function createCheckbox(label,prop){
            const input=document.createElement("input"); input.type="checkbox"; input.id=prop; input.checked=settings[prop];
            const lbl=document.createElement("label"); lbl.textContent=label; lbl.htmlFor=prop;
            input.addEventListener("change",()=>{ setGM_list(prop,input.checked); missionlist.forEach(item=>item[prop]=input.checked); refreshHidden(); });
            newspan.appendChild(input); newspan.appendChild(lbl);
        }

        createCheckbox("Transports","checkboxtransport");
        createCheckbox("Attack","checkboxAttack");
        createCheckbox("Other","checkboxOther");

        const jumpDiv=document.createElement("div");
        jumpDiv.style.marginTop="4px";
        jumpDiv.innerHTML=`Jumps filter: <input type="number" id="jumpFilter" value="${jumpLimit}" style="width:50px"> (-1 = show all)`;
        newspan.appendChild(document.createElement("br"));
        newspan.appendChild(jumpDiv);

        document.getElementById("jumpFilter").addEventListener("input",function(){
            jumpLimit=parseInt(this.value,10);
            setGM_list("jumpfilter",jumpLimit);
            applyJumpFilter();
        });

        const progressDiv=document.createElement("div");
        progressDiv.id="mission-progress";
        progressDiv.style.fontSize="12px"; progressDiv.style.marginTop="4px";
        progressDiv.textContent="Loading missions: 0/0";
        newspan.insertAdjacentElement("afterend",progressDiv);
    }

    function applyJumpFilter(){
        missionlist.forEach(item=>{
            const match = resultsCache.find(r=>r.table===item.mission);
            item.jumpfilter = match ? (!match.result || jumpLimit===-1 || match.result.jumps<=jumpLimit) : true;
        });
        refreshHidden();
    }

    let resultsCache=[];

    async function processMissions(){
        const tables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
        if(!tables.length) return;
        const total=tables.length; let completed=0;
        const progressDiv=document.getElementById("mission-progress");

        const promises = tables.map(async table=>{
            const footerTd = table.querySelector("tr:last-child td:nth-child(2)");
            if(!footerTd) return {table,result:null,borderColor:table.style.borderColor||''};
            footerTd.querySelectorAll("span,br").forEach(e=>e.remove());
            const statusSpan=document.createElement("span"); statusSpan.textContent="Loading...";
            footerTd.appendChild(document.createElement("br"));
            footerTd.appendChild(statusSpan);
            footerTd.appendChild(document.createElement("br"));

            const html = table.innerHTML;
            let sectorMatch = html.match(/sector <b>(.*?)<\/b>/i) || html.match(/in <b>(.*?)<\/b>/i);
            const descTd = table.querySelectorAll("tr")[1]?.querySelectorAll("td")[2];
            let coordMatch = descTd ? descTd.textContent.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/) : null;

            if(!sectorMatch||!coordMatch){
                statusSpan.remove(); completed++; if(progressDiv) progressDiv.textContent=`Loading missions: ${completed}/${total}`;
                return {table,result:null,borderColor:table.style.borderColor||'',span:statusSpan};
            }

            // ✅ Fix sector name
            const destSector=sectorMatch[1].replace(/\s*\(.*?\)/g,"").trim();
            const destX=parseInt(coordMatch[1],10);
            const destY=parseInt(coordMatch[2],10);
            const currentSector=readCookie('sector');
            const currentX=parseInt(readCookie('x'),10);
            const currentY=parseInt(readCookie('y'),10);

            try {
                const result = await multiSectorPath({sector:currentSector,x:currentX,y:currentY},{sector:destSector,x:destX,y:destY});
                completed++; if(progressDiv) progressDiv.textContent=`Loading missions: ${completed}/${total}`;
                return {table,result,borderColor:table.style.borderColor||'',span:statusSpan};
            } catch {
                completed++; if(progressDiv) progressDiv.textContent=`Loading missions: ${completed}/${total}`;
                return {table,result:null,borderColor:table.style.borderColor||'',span:statusSpan};
            }
        });

        resultsCache = await Promise.all(promises);

        resultsCache.forEach(r=>{
            const rows = r.table.querySelectorAll("tr");
            r.imageLink = rows.length>1 && rows[1].querySelector("td img") ? rows[1].querySelector("td img").src : "";
        });

        // 🔹 Original sort reinserted
        resultsCache.sort((a,b)=>{
            if(a.borderColor !== b.borderColor) return b.borderColor.localeCompare(a.borderColor);
            if(!a.result && b.result) return -1;
            if(a.result && !b.result) return 1;
            if(!a.result && !b.result) return a.imageLink.localeCompare(b.imageLink);
            if(a.result.jumps !== b.result.jumps) return a.result.jumps - b.result.jumps;
            return a.result.cost - b.result.cost;
        });

        document.querySelectorAll("#div_missions > br").forEach(br=>br.remove());

        resultsCache.forEach((r,idx)=>{
            if(idx>0) r.table.parentNode.appendChild(document.createElement("br"));
            r.table.parentNode.appendChild(r.table);
        });

        resultsCache.forEach(r=>{
            if(!r.span) return;
            if(r.result){
                const pathEnd=r.result.path[r.result.path.length-1];
                const mapperUrl=`https://pardusmapper.com?startSector=${encodeURIComponent(readCookie('sector'))}&startX=${readCookie('x')}&startY=${readCookie('y')}&destSector=${encodeURIComponent(pathEnd.sector)}&destX=${pathEnd.x}&destY=${pathEnd.y}`;
                const link=document.createElement("a"); link.href=mapperUrl; link.target="_blank";
                link.innerHTML=`${r.result.jumps} jumps<br>${Math.round(r.result.cost)} AP`;
                r.span.textContent=""; r.span.appendChild(link);
            } else r.span.textContent="Error";
        });

        applyJumpFilter();
        if(progressDiv) progressDiv.style.display="none";
    }

    function runBoard(){
        createMissionList();
        processMissions();
    }

    setupFilters();
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",runBoard);
    } else runBoard();

})();
