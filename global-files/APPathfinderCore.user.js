// ==UserScript==
// @name         AP Pathfinder Core with X-holes + GM Storage
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.3
// @description  Multi-sector AP Pathfinder logic (Chebyshev) for Pardus with X-hole teleportation and GM storage for costs
// @author       spacerules
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function(){
    'use strict';

    const SWEETENER_REF = "9af82720543b8464aeab27af589c53c6a6c774ec";
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    const OPPOSITE = { North:"South", South:"North", East:"West", West:"East" };
    const XHOLE_SECTORS = ["Nex_0001","Nex_0002","Nex_0003","Nex_0004","Nex_0005","Nex_Kataam"];

    // --------------------------
    // DEFAULT COSTS
    // --------------------------
    const DEFAULT_TILE_COST = { b: Infinity, // blocked (hard energy)
                                e: 19,       // energy
                                f: 10,       // fuel
                                g: 15,       // nitrogen gas
                                o: 24,       // ore
                                m: 35,       // exotic mater
                                v: 10 };     // viral (see pardus core sector)
    const DEFAULT_WH_COST = 22;
    const DEFAULT_XHOLE_COST = 2200;

    // --------------------------
    // CURRENT COSTS (mutable)
    // --------------------------
    let TILE_COST = {};
    let WH_COST = 22;
    let XHOLE_COST = 2200;

    // --------------------------
    // LOGGING HELPER
    // --------------------------
    function logInfo(msg){ console.log("[Pathfinder] " + msg); }

    // --------------------------
    // GM STORAGE CONFIG
    // --------------------------
    function saveConfig(){
        //GM_setValue("config", { tileCosts: {...TILE_COST}, wormholeCost: WH_COST, xholeCost: XHOLE_COST });
    }

    function loadConfig(){
        //const cfg = GM_getValue("config", null);
        //if(cfg){
            //TILE_COST = {...cfg.tileCosts};
            //WH_COST = cfg.wormholeCost;
            //XHOLE_COST = cfg.xholeCost;
            //logInfo("Config loaded from GM storage");
        //} else {
            //resetAll();
            logInfo("No saved config, using defaults");
        //}
    }

    function getConfig() {
        return {
            tileCosts: {...TILE_COST},
            wormholeCost: WH_COST,
            xholeCost: XHOLE_COST
        };
    }
    
    function getDefaults() {
        return {
            tileCosts: {...DEFAULT_TILE_COST},
            wormholeCost: DEFAULT_WH_COST,
            xholeCost: DEFAULT_XHOLE_COST
        };
    }

    function setTileCost(tileCode,cost){ TILE_COST[tileCode]=cost; saveConfig(); logInfo(`Tile '${tileCode}' set to ${cost}`); }
    function resetTileCosts(){ TILE_COST={...DEFAULT_TILE_COST}; saveConfig(); logInfo("Tile costs reset"); }
    function setWHCost(cost){ WH_COST=cost; saveConfig(); logInfo(`WH cost set to ${cost}`); }
    function resetWHCost(){ WH_COST=DEFAULT_WH_COST; saveConfig(); logInfo(`WH cost reset to ${DEFAULT_WH_COST}`); }
    function setXholeCost(cost){ XHOLE_COST=cost; saveConfig(); logInfo(`X-hole cost set to ${cost}`); }
    function resetXholeCost(){ XHOLE_COST=DEFAULT_XHOLE_COST; saveConfig(); logInfo(`X-hole cost reset to ${DEFAULT_XHOLE_COST}`); }
    function resetAll(){ resetTileCosts(); resetWHCost(); resetXholeCost(); }

    // Expose config functions globally
    window.PathfinderConfig = { setTileCost, resetTileCosts, setWHCost, resetWHCost, setXholeCost, resetXholeCost, resetAll, getConfig, getDefaults };

    // --------------------------
    // SECTOR HELPERS
    // --------------------------
    function normalizeSectorName(name){ return name.trim().replace(/\s+/g,"_"); }
    function sectorToUrl(sector){ const file=normalizeSectorName(sector); return `https://raw.githubusercontent.com/Tsunder/Pardus-Sweetener/${SWEETENER_REF}/chrome/map/${file[0]}/${file}.json`; }
    function baseSectorName(label){ const idx=label.indexOf(" ("); return (idx>=0)? label.slice(0,idx).trim() : label.trim(); }
    function beaconDirection(label){ const m=label.match(/\((North|South|East|West)\)/i); return m ? (m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()) : null; }

    class PQ { constructor(){ this.q=[]; } push(node,p){ this.q.push({node,priority:p}); } pop(){ this.q.sort((a,b)=>a.priority-b.priority); return this.q.shift()?.node; } get length(){ return this.q.length; } }
    function keyOf(sector,x,y){ return `${sector}::${x},${y}`; }

    const mapCache = new Map();
    async function loadSector(sector){
        sector = normalizeSectorName(sector);
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

    async function resolveWormholeExit(currentSector, beaconName){
        const destSector = baseSectorName(beaconName);
        const destMap = await loadSector(destSector);
        const wantBase = baseSectorName(currentSector);
        let candidates = destMap.beaconList.filter(b=>baseSectorName(b.name)===wantBase);
        if(candidates.length===1) return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        if(candidates.length>1){
            const hereDir = beaconDirection(beaconName);
            if(hereDir && OPPOSITE[hereDir]){
                const exact = candidates.find(b=>beaconDirection(b.name)===OPPOSITE[hereDir]);
                if(exact) return {sector:destSector,x:exact.x,y:exact.y};
            }
            return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        }
        const anyWH = destMap.beaconList.filter(b=>b.type==="wh");
        if(anyWH.length>0) return {sector:destSector,x:anyWH[0].x,y:anyWH[0].y};
        if(destMap.beaconList.length>0) return {sector:destSector,x:destMap.beaconList[0].x,y:destMap.beaconList[0].y};
        return null;
    }

    async function multiSectorPath(start, end){
    if(!window.sectorData) throw new Error("sectorData not loaded");

    const visited = new Set();
    const queue = [{sector: start.sector, x: start.x, y: start.y, path: [{...start}], cost: 0}];
    let finalResult = null;

    while(queue.length > 0){
        const current = queue.shift();
        const key = `${current.sector}:${current.x},${current.y}`;
        if(visited.has(key)) continue;
        visited.add(key);

        if(current.sector === end.sector && current.x === end.x && current.y === end.y){
            finalResult = current;
            break;
        }

        const sectorInfo = window.sectorData[current.sector];
        if(!sectorInfo) continue;

        // -------------------
        // Neighbor tiles (8 directions)
        // -------------------
        const dirs = [
            {dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
            {dx:1,dy:1},{dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1}
        ];

        for(const d of dirs){
            const nx = current.x + d.dx;
            const ny = current.y + d.dy;
            if(nx < 0 || ny < 0 || nx >= sectorInfo.width || ny >= sectorInfo.height) continue;

            const tile = sectorInfo.tiles[ny*sectorInfo.width + nx];
            if(tile === 'b') continue;

            const nKey = `${current.sector}:${nx},${ny}`;
            if(visited.has(nKey)) continue;

            queue.push({
                sector: current.sector,
                x: nx,
                y: ny,
                path: [...current.path, {sector: current.sector, x: nx, y: ny}],
                cost: current.cost + 1
            });
        }

        // -------------------
        // Wormholes
        // -------------------
        for(const [name, wh] of Object.entries(sectorInfo.beacons)){
            if(wh.type !== "wh") continue;

            const whTargetSector = current.sector; // self-sector WH
            const whKey = `${whTargetSector}:${wh.x},${wh.y}`;
            if(visited.has(whKey)) continue;

            // Only allow if moving closer to destination
            const curDist = Math.abs(current.x - end.x) + Math.abs(current.y - end.y);
            const whDist = Math.abs(wh.x - end.x) + Math.abs(wh.y - end.y);
            if(whDist >= curDist) continue;

            queue.push({
                sector: whTargetSector,
                x: wh.x,
                y: wh.y,
                path: [...current.path, {sector: whTargetSector, x: wh.x, y: wh.y}],
                cost: current.cost + 10 // wormhole AP
            });
        }

        // -------------------
        // X-holes (global)
        // -------------------
        for(const [name, wh] of Object.entries(sectorInfo.beacons)){
            if(wh.type !== "xh") continue;
            if(!wh.destination) continue;

            const xhKey = `${wh.destination.sector}:${wh.destination.x},${wh.destination.y}`;
            if(visited.has(xhKey)) continue;

            queue.push({
                sector: wh.destination.sector,
                x: wh.destination.x,
                y: wh.destination.y,
                path: [...current.path, {sector: wh.destination.sector, x: wh.destination.x, y: wh.destination.y}],
                cost: current.cost + 2200
            });
        }
    }

    if(!finalResult) throw new Error("No path found");

    // Deduplicate consecutive coordinates
    const dedupedPath = [];
    for(const step of finalResult.path){
        const last = dedupedPath[dedupedPath.length-1];
        if(!last || last.x !== step.x || last.y !== step.y || last.sector !== step.sector){
            dedupedPath.push(step);
        }
    }

    return {
        path: dedupedPath,
        cost: dedupedPath.length, // approximate AP; can sum costs if desired
        jumps: dedupedPath.filter(s => s.sector !== start.sector).length
    };
};

    // --------------------------
    // INITIALIZE CONFIG
    // --------------------------
    loadConfig();

    // --------------------------
    // EXPOSE GLOBALS
    // --------------------------
    window.multiSectorPath = multiSectorPath;

})();
