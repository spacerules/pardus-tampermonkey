// ==UserScript==
// @name         AP Pathfinder Core Optimized with X-holes and Straight Paths
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0
// @description  Optimized Multi-sector AP Pathfinder logic (Chebyshev) for Pardus with X-hole teleportation and straighter paths
// @author       spacerules
// @grant        none
// ==/UserScript==

const TILE_COST = { b: Infinity, e: 19, f: 10, g: 15, o: 24, m: 35, v: 10 };
const WH_COST = 22;
const XH_COST = 2200;

function normalizeSectorName(name){ return name.trim().replace(/\s+/g,"_"); }
function cleanSectorName(name){ return name.replace(/\s*\(.*?\)/g,"").trim(); }

async function fetchSector(sectorName){
    const SWEETENER_REF = "9af82720543b8464aeab27af589c53c6a6c774ec";
    const file = normalizeSectorName(sectorName);
    const url = `https://raw.githubusercontent.com/Tsunder/Pardus-Sweetener/${SWEETENER_REF}/chrome/map/${file[0]}/${file}.json`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Failed to load sector ${sectorName}`);
    return await res.json();
}

async function fetchJumps(){
    const url = "https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/refs/heads/main/resources/wh_jumps.json";
    const res = await fetch(url);
    if(!res.ok) throw new Error("Failed to load jumps");
    return await res.json();
}

function buildPortalLinks(sector, jumps){
    const links = [];
    const sectorName = sector.sector;
    for(const j of jumps){
        const destSector = cleanSectorName(j.dest);
        if(j.src === sectorName){
            if(destSector === sectorName){
                links.push({from:{x:j.srcX,y:j.srcY},to:{x:j.destX,y:j.destY},cost:j.type==='wh'?WH_COST:XH_COST,sameSector:true});
            } else {
                links.push({from:{x:j.srcX,y:j.srcY},to:{sector:destSector,x:j.destX,y:j.destY},cost:j.type==='wh'?WH_COST:XH_COST,sameSector:false});
            }
        }
    }
    return links;
}

function getNeighbors(tileMap,x,y){
    const neighbors = [];
    const directions = [{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:-1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:1,dy:1}];
    for(const d of directions){
        const nx = x+d.dx, ny=y+d.dy;
        if(nx>=0 && ny>=0 && nx<tileMap.width && ny<tileMap.height){
            const t = tileMap.tiles[ny*tileMap.width + nx];
            const cost = TILE_COST[t] ?? Infinity;
            if(cost<Infinity) neighbors.push({x:nx,y:ny,cost});
        }
    }
    return neighbors;
}

class MinHeap {
    constructor(){this.items=[];}
    push(node){
        this.items.push(node);
        let i=this.items.length-1;
        while(i>0){
            const p=Math.floor((i-1)/2);
            if(this.items[p].totalCost<=this.items[i].totalCost) break;
            [this.items[p],this.items[i]]=[this.items[i],this.items[p]];
            i=p;
        }
    }
    pop(){
        if(this.items.length===0) return undefined;
        const top=this.items[0];
        const end=this.items.pop();
        if(this.items.length===0) return top;
        this.items[0]=end;
        let i=0;
        while(true){
            let left=2*i+1,right=2*i+2,smallest=i;
            if(left<this.items.length && this.items[left].totalCost<this.items[smallest].totalCost) smallest=left;
            if(right<this.items.length && this.items[right].totalCost<this.items[smallest].totalCost) smallest=right;
            if(smallest===i) break;
            [this.items[i],this.items[smallest]]=[this.items[smallest],this.items[i]];
            i=smallest;
        }
        return top;
    }
    size(){return this.items.length;}
}

async function multiSectorPath(start,end){
    const visited=new Map();
    const frontier=new MinHeap();
    frontier.push({sector:start.sector,x:start.x,y:start.y,cost:0,path:[],jumps:0,totalCost:0,lastDir:null});
    const jumpsData=await fetchJumps();
    const sectorCache=new Map();

    async function getSectorCached(name){
        if(sectorCache.has(name)) return sectorCache.get(name);
        const data=await fetchSector(name);
        sectorCache.set(name,data);
        return data;
    }

    while(frontier.size()>0){
        const node=frontier.pop();
        const key=`${node.sector}_${node.x}_${node.y}`;
        if(visited.has(key)) continue;
        visited.set(key,node.cost);

        if(node.sector===end.sector && node.x===end.x && node.y===end.y){
            return {cost:node.cost,path:[...node.path,{sector:node.sector,x:node.x,y:node.y}],jumps:node.jumps};
        }

        const sectorData=await getSectorCached(node.sector);
        const neighbors=getNeighbors(sectorData,node.x,node.y);
        for(const n of neighbors){
            const dx = n.x - node.x;
            const dy = n.y - node.y;
            const dirChange = (node.lastDir && (node.lastDir.x !== dx || node.lastDir.y !== dy)) ? 0.00001 : 0;
            const heur = Math.max(Math.abs(end.x-n.x),Math.abs(end.y-n.y)) + dirChange;
            frontier.push({
                sector: node.sector,
                x: n.x,
                y: n.y,
                cost: node.cost + n.cost,
                path: [...node.path,{sector:node.sector,x:node.x,y:node.y}],
                jumps: node.jumps,
                totalCost: node.cost + n.cost + heur,
                lastDir: {x:dx,y:dy}
            });
        }

        const portals=buildPortalLinks(sectorData,jumpsData);
        for(const p of portals){
            if(p.from.x===node.x && p.from.y===node.y){
                const dx = p.to.x - node.x;
                const dy = p.to.y - node.y;
                const dirChange = (node.lastDir && (node.lastDir.x !== dx || node.lastDir.y !== dy)) ? 0.00001 : 0;
                const heur = Math.max(Math.abs(end.x - p.to.x), Math.abs(end.y - p.to.y)) + dirChange;

                if(p.sameSector){
                    frontier.push({
                        sector: node.sector,
                        x: p.to.x,
                        y: p.to.y,
                        cost: node.cost + p.cost,
                        path: [...node.path,{sector:node.sector,x:node.x,y:node.y}],
                        jumps: node.jumps,
                        totalCost: node.cost + p.cost + heur,
                        lastDir: {x:dx,y:dy}
                    });
                } else {
                    frontier.push({
                        sector: p.to.sector,
                        x: p.to.x,
                        y: p.to.y,
                        cost: node.cost + p.cost,
                        path: [...node.path,{sector:node.sector,x:node.x,y:node.y}],
                        jumps: node.jumps + 1,
                        totalCost: node.cost + p.cost + heur,
                        lastDir: {x:dx,y:dy}
                    });
                }
            }
        }
    }
    throw new Error("No path found");
}

window.multiSectorPath=multiSectorPath;
