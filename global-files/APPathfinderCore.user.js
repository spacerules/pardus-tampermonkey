// ==UserScript==
// @name         Pardus Multi-Sector Pathfinder Core with Multipath
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.2
// @description  Multi-sector AP pathfinder with X-hole and same-sector wormhole support
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
            const walkable = (x, y) => tiles[y*width + x] !== 'b';

            const openList = [{x:startX, y:startY, g:0, f:Math.abs(endX-startX)+Math.abs(endY-startY), parent:null}];
            const closedSet = new Set();

            while(openList.length > 0){
                openList.sort((a,b)=>a.f-b.f);
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
                closedSet.add(current.y*width+current.x);

                [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
                    const nx = current.x+dx, ny=current.y+dy;
                    if(inBounds(nx,ny) && walkable(nx,ny) && !closedSet.has(ny*width+nx)){
                        const g = current.g + 1;
                        const f = g + Math.abs(endX-nx)+Math.abs(endY-ny);
                        openList.push({x:nx, y:ny, g, f, parent:current});
                    }
                });
            }

            return null; // no path
        }

        multiSectorPath(startSector, startX, startY, endSector, endX, endY){
            const path = [];
            let currentSector = startSector;
            let currentX = startX;
            let currentY = startY;
            const visitedSectors = new Set();

            while(true){
                const sectorData = this.sectors[currentSector];
                if(!sectorData) break;

                // If destination is in same sector
                if(currentSector === endSector){
                    const singlePath = this.findPath(sectorData, currentX, currentY, endX, endY);
                    if(singlePath) singlePath.forEach(p => path.push({sector:currentSector, x:p.x, y:p.y}));
                    break;
                }

                // Check for same-sector wormhole to next sector
                let whFound = null;
                for(const [name, beacon] of Object.entries(sectorData.beacons)){
                    if(beacon.type==='wh' && !visitedSectors.has(name)){
                        const destSector = this.whDestination(name);
                        if(destSector === endSector || this.sectorConnects(name, currentSector, endSector)){
                            whFound = beacon;
                            break;
                        }
                    }
                }

                if(whFound){
                    const toWH = this.findPath(sectorData, currentX, currentY, whFound.x, whFound.y);
                    if(toWH) toWH.forEach(p=>path.push({sector:currentSector, x:p.x, y:p.y}));

                    currentSector = this.whDestination(whFound.name);
                    currentX = whFound.x;
                    currentY = whFound.y;
                    visitedSectors.add(whFound.name);
                    continue;
                }

                // If no WH, check for X-hole
                let xhole = null;
                for(const [name, beacon] of Object.entries(sectorData.beacons)){
                    if(beacon.type==='xh' && !visitedSectors.has(name)){
                        xhole = beacon;
                        break;
                    }
                }

                if(xhole){
                    const toXH = this.findPath(sectorData, currentX, currentY, xhole.x, xhole.y);
                    if(toXH) toXH.forEach(p => path.push({sector:currentSector, x:p.x, y:p.y}));

                    currentSector = this.findXHoleDestination(xhole);
                    currentX = xhole.x;
                    currentY = xhole.y;
                    visitedSectors.add(xhole);
                    continue;
                }

                break; // cannot progress
            }

            return path;
        }

        sectorConnects(whName, fromSector, toSector){
            const mapping = {
                "Nex 0004 (SW)":"Nex 0004 (West)",
                "Nex 0004 (SE)":"Nex 0004 (East)"
            };
            return mapping[whName] === toSector || mapping[whName] === fromSector;
        }

        whDestination(whName){
            const mapping = {
                "Nex 0004 (SW)":"Nex 0004 (West)",
                "Nex 0004 (SE)":"Nex 0004 (East)"
            };
            return mapping[whName];
        }

        findXHoleDestination(xhole){
            for(const [sectorName, sector] of Object.entries(this.sectors)){
                for(const [name, b] of Object.entries(sector.beacons)){
                    if(b.type==='xh' && b!==xhole) return sectorName;
                }
            }
            return null;
        }
    }

    window.Pathfinder = Pathfinder;

})();
