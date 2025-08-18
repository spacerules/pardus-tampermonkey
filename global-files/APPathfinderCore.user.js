// ==UserScript==
// @name         Pardus Multi-Sector Pathfinder with Wormholes
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0
// @description  Pathfinder with same-sector WHs and X-holes
// @match        http*://*.pardus.at/*
// ==/UserScript==

class Pathfinder {
    constructor(sectors) {
        this.sectors = sectors;
    }

    isWalkable(sector, x, y) {
        const w = this.sectors[sector].width;
        const h = this.sectors[sector].height;
        if (x < 0 || y < 0 || x >= w || y >= h) return false;
        const tile = this.sectors[sector].tiles[y * w + x];
        return tile !== 'b'; // b = blocked
    }

    getNeighbors(sector, x, y) {
        const neighbors = [];
        const moves = [
            [1,0],[0,1],[-1,0],[0,-1],
            [1,1],[1,-1],[-1,1],[-1,-1]
        ];
        for (const [dx,dy] of moves) {
            const nx = x+dx, ny=y+dy;
            if (this.isWalkable(sector,nx,ny)) neighbors.push({sector, x:nx, y:ny, cost:1});
        }

        // Same-sector wormholes
        const whs = Object.entries(this.sectors[sector].beacons || {});
        for (const [name, beacon] of whs) {
            if (beacon.type === 'wh' && (beacon.x !== x || beacon.y !== y)) {
                neighbors.push({sector, x:beacon.x, y:beacon.y, cost:50});
            }
        }

        // X-holes
        for (const [sName, sData] of Object.entries(this.sectors)) {
            for (const [bName, bData] of Object.entries(sData.beacons || {})) {
                if (bData.type === 'xh' && (sName!==sector || bData.x!==x || bData.y!==y)) {
                    neighbors.push({sector:sName, x:bData.x, y:bData.y, cost:2200});
                }
            }
        }

        return neighbors;
    }

    multiSectorPath(startSector, startX, startY, endSector, endX, endY) {
        const open = [{sector:startSector, x:startX, y:startY, g:0, f:0, cameFrom:null}];
        const closed = new Set();

        const hash = (s,x,y) => `${s}|${x}|${y}`;

        while(open.length) {
            open.sort((a,b)=>a.f-b.f);
            const current = open.shift();
            if(current.sector===endSector && current.x===endX && current.y===endY) {
                const path = [];
                let c = current;
                while(c){ path.unshift({sector:c.sector,x:c.x,y:c.y}); c=c.cameFrom; }
                return path;
            }

            closed.add(hash(current.sector,current.x,current.y));

            const neighbors = this.getNeighbors(current.sector,current.x,current.y);
            for(const n of neighbors){
                const nHash = hash(n.sector,n.x,n.y);
                if(closed.has(nHash)) continue;
                const g = current.g + n.cost;
                const existing = open.find(o=>hash(o.sector,o.x,o.y)===nHash);
                if(!existing || g<existing.g){
                    if(existing){ existing.g=g; existing.f=g; existing.cameFrom=current; }
                    else open.push({sector:n.sector,x:n.x,y:n.y,g:g,f:g,cameFrom:current});
                }
            }
        }
        return null; // no path
    }
}

// Expose multiSectorPath on window
window.multiSectorPath = function(sectors, startSector, startX, startY, endSector, endX, endY){
    const pf = new Pathfinder(sectors);
    return pf.multiSectorPath(startSector, startX, startY, endSector, endX, endY);
};
