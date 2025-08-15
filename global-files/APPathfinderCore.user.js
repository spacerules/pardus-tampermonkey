async function multiSectorPath(start,end){
    await loadSector(start.sector);
    await loadSector(end.sector);

    const dist = new Map(), prev = new Map(), jumpsMap = new Map();
    const startKey = keyOf(start.sector,start.x,start.y);
    dist.set(startKey,0); jumpsMap.set(startKey,0);

    const pq = new PQ();
    pq.push({...start,jumps:0},0);

    // X-hole constants
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

        // Normal tile moves
        for(const [dx,dy] of DIRS){
            const nx=x+dx, ny=y+dy;
            if(nx<0||ny<0||nx>=width||ny>=height) continue;
            const code = grid[ny][nx];
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

        const beacon = beaconsByCoord.get(`${x},${y}`);

        // Wormhole logic
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

        // X-hole logic
        if(beacon && beacon.type==="xh"){
            for(const targetSector of XHOLE_SECTORS){
                const targetMap = await loadSector(targetSector);
                for(const target of targetMap.beaconList.filter(b=>b.type==="xh")){
                    // Skip self
                    if(targetSector===sector && target.x===x && target.y===y) continue;
                    const nKey = keyOf(targetSector,target.x,target.y);
                    const alt = curDist + XHOLE_COST;
                    if(alt < (dist.get(nKey) ?? Infinity)){
                        dist.set(nKey,alt);
                        prev.set(nKey,curKey);
                        jumpsMap.set(nKey,curJumps+1);
                        pq.push({sector:targetSector,x:target.x,y:target.y,jumps:curJumps+1},alt);
                    }
                }
            }
        }
    }

    throw new Error("No path found");
}
