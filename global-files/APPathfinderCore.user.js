// ==UserScript==
// @name         AP Pathfinder Core with Wormholes + X-holes (Safe v1.6)
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.6
// @description  Multi-sector AP Pathfinder logic (Chebyshev) for Pardus with wormholes and X-hole teleportation, fully safe
// @author       spacerules
// @match        http*://*.pardus.at/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    const SWEETENER_REF = "9af82720543b8464aeab27af589c53c6a6c774ec";
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    const TILE_COST = { b: Infinity, e: 19, f: 10, g: 15, o: 24, m: 35, v: 10 };
    const OPPOSITE = { North:"South", South:"North", East:"West", West:"East" };
    const mapCache = new Map();

    function normalizeSectorName(name){ return name.trim().replace(/\s+/g,"_"); }
    function baseSectorName(label){ const idx=label.indexOf(" ("); return idx>=0? label.slice(0,idx).trim() : label.trim(); }
    function beaconDirection(label){
        const m = label.match(/\((North|South|East|West)\)/i);
        return m ? (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) : null;
    }
    function keyOf(sector,x,y){ return `${sector}::${x},${y}`; }

    class PQ {
        constructor(){ this.q=[]; }
        push(node,p){ this.q.push({node,priority:p}); }
        pop(){ this.q.sort((a,b)=>a.priority-b.priority); return this.q.shift()?.node; }
        get length(){ return this.q.length; }
    }

    async function loadSector(sector){
        sector = normalizeSectorName(sector);
        if(mapCache.has(sector)) return mapCache.get(sector);

        const url = `https://raw.githubusercontent.com/Tsunder/Pardus-Sweetener/${SWEETENER_REF}/chrome/map/${sector[0]}/${sector}.json`;
        const res = await fetch(url);
        if(!res.ok) throw new Error(`Failed to fetch ${sector}: ${res.status}`);
        const data = await res.json();

        const width = data.width || 0;
        const height = data.height || 0;
        const tiles = data.tiles || "";
        const grid = Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>tiles[y*width+x]||"b"));

        const beaconsObj = data.beacons || {};
        const beaconList = [];
        const beaconsByCoord = new Map();
        for(const [name,b] of Object.entries(beaconsObj)){
            if(!b) continue;
            const item = {name,type:b.type,x:b.x,y:b.y};
            beaconList.push(item);
            beaconsByCoord.set(`${b.x},${b.y}`, item);
        }

        const wrapped = {...data, grid, beaconList, beaconsByCoord};
        mapCache.set(sector, wrapped);
        return wrapped;
    }

    async function resolveWormholeExit(currentSector, beaconName){
        const destSector = baseSectorName(beaconName);
        const destMap = await loadSector(destSector);
        if(!destMap) return null;

        const beacons = Array.isArray(destMap.beaconList) ? destMap.beaconList : [];
        if(beacons.length===0) return null;

        let candidates = beacons.filter(b=>baseSectorName(b.name)===baseSectorName(currentSector));
        if(candidates.length===1) return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        if(candidates.length>1){
            const hereDir = beaconDirection(beaconName);
            if(hereDir && OPPOSITE[hereDir]){
                const exact = candidates.find(b=>beaconDirection(b.name)===OPPOSITE[hereDir]);
                if(exact) return {sector:destSector,x:exact.x,y:exact.y};
            }
            return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        }
        return null;
    }

    async function resolveXholeExit(currentSector, beaconName){
        const destSector = baseSectorName(beaconName);

        if(normalizeSectorName(destSector)===normalizeSectorName(currentSector)){
            console.log(`X-hole exit loops back into ${currentSector}. Path disallowed.`);
            return null;
        }

        const destMap = await loadSector(destSector);
        if(!destMap) return null;

        const beacons = Array.isArray(destMap.beaconList) ? destMap.beaconList : [];
        if(beacons.length===0) return null;

        let candidates = beacons.filter(b=>baseSectorName(b.name)===baseSectorName(currentSector));
        if(candidates.length===1) return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        if(candidates.length>1){
            const hereDir = beaconDirection(beaconName);
            if(hereDir && OPPOSITE[hereDir]){
                const exact = candidates.find(b=>beaconDirection(b.name)===OPPOSITE[hereDir]);
                if(exact) return {sector:destSector,x:exact.x,y:exact.y};
            }
            return {sector:destSector,x:candidates[0].x,y:candidates[0].y};
        }
        return null;
    }

    async function multiSectorPath(start,end){
        const dist = new Map(), prev = new Map(), jumpsMap = new Map();
        const startKey = keyOf(start.sector,start.x,start.y);
        dist.set(startKey,0); jumpsMap.set(startKey,0);

        const pq = new PQ();
        pq.push({...start,jumps:0},0);

        const XHOLE_SECTORS = ["Nex_0001","Nex_0002","Nex_0003","Nex_0004","Nex_0005","Nex_Kataam"];
        const XHOLE_COST = 2200;

        while(pq.length){
            const current = pq.pop();
            const {sector,x,y,jumps} = current;
            const curKey = keyOf(sector,x,y);
            const curDist = dist.get(curKey) ?? Infinity;
            const curJumps = jumpsMap.get(curKey) ?? 0;

            if(sector===end.sector && x===end.x && y===end.y){
                const path=[];
                let k = curKey;
                while(k){
                    const [sec,rest] = k.split("::");
                    const [cx,cy] = rest.split(",").map(Number);
                    path.unshift({sector:sec,x:cx,y:cy});
                    k = prev.get(k) || null;
                }
                return {cost:curDist, path, jumps: curJumps};
            }

            const mapData = await loadSector(sector);
            const {width,height,grid,beaconsByCoord} = mapData;

            for(const [dx,dy] of DIRS){
                const nx=x+dx, ny=y+dy;
                if(nx<0||ny<0||nx>=width||ny>=height) continue;
                const code = grid[ny][nx] || "b";
                const stepCost = TILE_COST[code] ?? 10;
                if(!isFinite(stepCost)) continue;
                const nKey = keyOf(sector,nx,ny);
                const alt = curDist + stepCost;
                if(alt < (dist.get(nKey) ?? Infinity)){
                    dist.set(nKey,alt);
                    prev.set(nKey,curKey);
                    jumpsMap.set(nKey,curJumps);
                    pq.push({sector,x:nx,y:ny,jumps:curJumps},alt);
                }
            }

            const beacon = beaconsByCoord?.get(`${x},${y}`);
            if(beacon && beacon.type==="wh"){
                const exit = await resolveWormholeExit(sector,beacon.name);
                if(exit){
                    const nKey = keyOf(exit.sector,exit.x,exit.y);
                    const wormholeCost = 23;
                    const alt = curDist + wormholeCost;
                    if(alt<(dist.get(nKey)??Infinity)){
                        dist.set(nKey,alt);
                        prev.set(nKey,curKey);
                        jumpsMap.set(nKey,curJumps+1);
                        pq.push({sector:exit.sector,x:exit.x,y:exit.y,jumps:curJumps+1},alt);
                    }
                }
            }

            if(beacon && beacon.type==="xh"){
                for(const targetSector of XHOLE_SECTORS){
                    const targetMap = await loadSector(targetSector);
                    const xholes = Array.isArray(targetMap?.beaconList) ? targetMap.beaconList.filter(b=>b.type==="xh") : [];
                    for(const target of xholes){
                        const exit = await resolveXholeExit(sector,target.name);
                        if(!exit) continue;
                        const nKey = keyOf(exit.sector,exit.x,exit.y);
                        const alt = curDist + XHOLE_COST;
                        if(alt<(dist.get(nKey)??Infinity)){
                            dist.set(nKey,alt);
                            prev.set(nKey,curKey);
                            jumpsMap.set(nKey,curJumps+1);
                            pq.push({sector:exit.sector,x:exit.x,y:exit.y,jumps:curJumps+1},alt);
                        }
                    }
                }
            }
        }

        throw new Error("No path found");
    }

    // Expose globally
    window.multiSectorPath = multiSectorPath;
    window.resolveWormholeExit = resolveWormholeExit;
    window.resolveXholeExit = resolveXholeExit;

})();
