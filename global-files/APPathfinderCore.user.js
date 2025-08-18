// ==UserScript==
// @name         Pardus Multi-Sector Pathfinder with X-holes
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.3
// @description  Multi-sector AP pathfinding with X-holes and same-sector wormholes
// @match        http*://*.pardus.at/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    class Pathfinder {
        constructor(sectors) {
            this.sectors = sectors;
        }

        findPath(sectorData, startX, startY, endX, endY) {
            const width = sectorData.width;
            const height = sectorData.height;
            const tiles = sectorData.tiles.split('');
            const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
            const walkable = (x, y) => {
                const t = tiles[y * width + x];
                return t !== 'b'; // 'b' = blocked
            };

            const openList = [{x:startX, y:startY, g:0, f:Math.abs(endX-startX)+Math.abs(endY-startY), parent:null}];
            const closedSet = new Set();

            while(openList.length > 0){
                openList.sort((a,b) => a.f - b.f);
                const current = openList.shift();
                if(current.x === endX && current.y === endY){
                    const path = [];
                    let c = current;
                    while(c){
                        path.unshift({x:c.x, y:c.y});
                        c = c.parent;
                    }
                    return path;
                }
                closedSet.add(current.y*width + current.x);
                [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
                    const nx = current.x + dx, ny = current.y + dy;
                    if(inBounds(nx,ny) && walkable(nx,ny) && !closedSet.has(ny*width+nx)){
                        const g = current.g + 1;
                        const f = g + Math.abs(endX - nx) + Math.abs(endY - ny);
                        openList.push({x:nx, y:ny, g, f, parent:current});
                    }
                });
            }

            return null; // no path
        }

        multiSectorPath(startSectorName, startX, startY, endSectorName, endX, endY) {
            const path = [];
            let currentSectorName = startSectorName;
            let currentX = startX;
            let currentY = startY;
            const visitedSectors = new Set();

            while(true){
                const sectorData = this.sectors[currentSectorName];
                if(!sectorData) break;

                // Find if end is in same sector
                if(currentSectorName === endSectorName){
                    const singlePath = this.findPath(sectorData, currentX, currentY, endX, endY);
                    if(singlePath) singlePath.forEach(p => path.push({sector:currentSectorName, x:p.x, y:p.y}));
                    break;
                }

                // Look for X-hole in current sector to go closer to target sector
                let xholeFound = null;
                for(const [name, beacon] of Object.entries(sectorData.beacons)){
                    if(beacon.type === 'xh' && !visitedSectors.has(name)){
                        xholeFound = beacon;
                        break;
                    }
                }

                if(xholeFound){
                    const toXH = this.findPath(sectorData, currentX, currentY, xholeFound.x, xholeFound.y);
                    if(toXH) toXH.forEach(p => path.push({sector:currentSectorName, x:p.x, y:p.y}));

                    // Jump to next sector via X-hole
                    currentSectorName = this.findXHoleDestination(xholeFound);
                    const dest = this.sectors[currentSectorName];
                    currentX = xholeFound.x; // approximate entry point, adjust if needed
                    currentY = xholeFound.y;
                    visitedSectors.add(xholeFound);
                    continue;
                }

                // Look for wormhole to next sector
                let whFound = null;
                for(const [name, beacon] of Object.entries(sectorData.beacons)){
                    if(beacon.type === 'wh' && this.sectorConnects(name, currentSectorName, endSectorName)){
                        whFound = beacon;
                        break;
                    }
                }

                if(whFound){
                    const toWH = this.findPath(sectorData, currentX, currentY, whFound.x, whFound.y);
                    if(toWH) toWH.forEach(p => path.push({sector:currentSectorName, x:p.x, y:p.y}));

                    currentSectorName = this.whDestination(whFound.name);
                    currentX = whFound.x;
                    currentY = whFound.y;
                    continue;
                }

                break; // can't progress further
            }

            return path;
        }

        findXHoleDestination(xhole) {
            // Implement sector selection logic for X-hole
            // For simplicity, pick first other sector with X-hole
            for(const [sectorName, sector] of Object.entries(this.sectors)){
                for(const [name, b] of Object.entries(sector.beacons)){
                    if(b.type==='xh' && b!==xhole) return sectorName;
                }
            }
            return null;
        }

        sectorConnects(whName, fromSector, toSector) {
            // Return true if this wormhole connects current sector to target sector
            const mapping = {
                "Nex 0004 (SW)": "Nex 0004 (West)",
                "Nex 0004 (SE)": "Nex 0004 (East)"
            };
            return mapping[whName] === toSector || mapping[whName] === fromSector;
        }

        whDestination(whName) {
            const mapping = {
                "Nex 0004 (SW)": "Nex 0004 (West)",
                "Nex 0004 (SE)": "Nex 0004 (East)"
            };
            return mapping[whName];
        }
    }

    window.Pathfinder = Pathfinder;

})();
