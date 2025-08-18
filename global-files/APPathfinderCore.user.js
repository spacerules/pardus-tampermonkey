// ==UserScript==
// @name         Pardus Multi-Sector Pathfinder with Hybrid WH/XH
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.6
// @description  Pathfinding with cheapest path using same-sector wormholes + X-holes
// @match        https://*.pardus.at/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    class Pathfinder {
        constructor(sectors) {
            this.sectors = sectors;
        }

        findPath(startSector, startX, startY, endSector, endX, endY) {
            const openSet = [];
            const cameFrom = new Map();
            const gScore = new Map();

            const nodeKey = (sector, x, y) => `${sector}:${x}:${y}`;
            const addNode = (sector, x, y, cost) => {
                const key = nodeKey(sector, x, y);
                if (!gScore.has(key) || cost < gScore.get(key)) {
                    gScore.set(key, cost);
                    openSet.push({ sector, x, y, cost });
                }
            };

            addNode(startSector, startX, startY, 0);

            while (openSet.length) {
                openSet.sort((a,b)=>a.cost-b.cost);
                const current = openSet.shift();
                const keyCurrent = nodeKey(current.sector, current.x, current.y);

                if (current.sector === endSector && current.x === endX && current.y === endY) {
                    return this.reconstructPath(cameFrom, keyCurrent);
                }

                const sectorData = this.sectors[current.sector];

                // 1. Normal neighbors
                for (let n of this.getNeighbors(sectorData, current.x, current.y)) {
                    const neighborKey = nodeKey(current.sector, n.x, n.y);
                    const tentativeG = current.cost + n.cost;
                    if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                        gScore.set(neighborKey, tentativeG);
                        cameFrom.set(neighborKey, keyCurrent);
                        openSet.push({ sector: current.sector, x: n.x, y: n.y, cost: tentativeG });
                    }
                }

                // 2. Same-sector wormholes
                for (let [name, wh] of Object.entries(sectorData.beacons)) {
                    if (wh.type === 'wh' && wh.x === current.x && wh.y === current.y) {
                        const destName = this.getPairedWormhole(current.sector, name);
                        if (destName) {
                            const dest = sectorData.beacons[destName];
                            const whCost = 50;
                            const destKey = nodeKey(current.sector, dest.x, dest.y);
                            const tentativeG = current.cost + whCost;
                            if (!gScore.has(destKey) || tentativeG < gScore.get(destKey)) {
                                gScore.set(destKey, tentativeG);
                                cameFrom.set(destKey, keyCurrent);
                                openSet.push({ sector: current.sector, x: dest.x, y: dest.y, cost: tentativeG });

                                // 3. Hybrid: same-sector wormhole -> X-hole
                                for (let [xname, xh] of Object.entries(sectorData.beacons)) {
                                    if (xh.type === 'xh') {
                                        const xhCost = 2200;
                                        const xhKey = nodeKey(current.sector, xh.x, xh.y);
                                        const combinedG = tentativeG + xhCost;
                                        if (!gScore.has(xhKey) || combinedG < gScore.get(xhKey)) {
                                            gScore.set(xhKey, combinedG);
                                            cameFrom.set(xhKey, destKey);
                                            openSet.push({ sector: current.sector, x: xh.x, y: xh.y, cost: combinedG });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Normal X-hole jumps to other sectors
                for (let [name, xh] of Object.entries(sectorData.beacons)) {
                    if (xh.type === 'xh' && xh.x === current.x && xh.y === current.y) {
                        for (let targetSector of Object.keys(this.sectors)) {
                            if (targetSector === current.sector) continue;
                            const targetData = this.sectors[targetSector];
                            for (let [tname, tXH] of Object.entries(targetData.beacons)) {
                                if (tXH.type === 'xh') {
                                    const xhCost = 2200;
                                    const tKey = nodeKey(targetSector, tXH.x, tXH.y);
                                    const tentativeG = current.cost + xhCost;
                                    if (!gScore.has(tKey) || tentativeG < gScore.get(tKey)) {
                                        gScore.set(tKey, tentativeG);
                                        cameFrom.set(tKey, keyCurrent);
                                        openSet.push({ sector: targetSector, x: tXH.x, y: tXH.y, cost: tentativeG });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return null;
        }

        reconstructPath(cameFrom, key) {
            const path = [];
            let current = key;
            while (current) {
                const [sector, x, y] = current.split(':');
                path.unshift({ sector, x: parseInt(x), y: parseInt(y) });
                current = cameFrom.get(current);
            }
            return path;
        }

        getNeighbors(sectorData, x, y) {
            const dirs = [
                [1,0],[0,1],[-1,0],[0,-1],
                [1,1],[-1,1],[1,-1],[-1,-1]
            ];
            const result = [];
            for (let [dx,dy] of dirs) {
                const nx = x+dx;
                const ny = y+dy;
                if (nx>=0 && ny>=0 && nx<sectorData.width && ny<sectorData.height) {
                    const tile = sectorData.tiles[ny*sectorData.width + nx];
                    let cost = 1;
                    if (tile==='b') cost=1;
                    else if (tile==='e') cost=2;
                    else if (tile==='f') cost=3;
                    else if (tile==='o') cost=5;
                    result.push({x:nx,y:ny,cost});
                }
            }
            return result;
        }

        getPairedWormhole(sector, whName) {
            const sameSectorPairs = {
                "Nex 0004 (SW)": "Nex 0004 (West)",
                "Nex 0004 (West)": "Nex 0004 (SW)",
                "Nex 0004 (SE)": "Nex 0004 (East)",
                "Nex 0004 (East)": "Nex 0004 (SE)",
                "HW 3-863": "Mebsuta",
                "Mebsuta": "HW 3-863"
            };
            return sameSectorPairs[whName] || null;
        }
    }

    window.Pathfinder = Pathfinder;
})();
