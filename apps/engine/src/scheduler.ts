export type RuntimeNode={name:string;region:string;status:'online'|'draining'|'offline';capacityCpuMillis:number;usedCpuMillis:number;capacityMemoryBytes:number;usedMemoryBytes:number};

/** Capacity-aware, region-aware node selection. Returns undefined when no node can safely host the workload. */
export function selectRuntimeNode(nodes:RuntimeNode[],requestedCpuMillis=100,requestedMemoryBytes=128*1024*1024,preferredRegion?:string){
  const candidates=nodes.filter(n=>n.status==='online'&&n.capacityCpuMillis-n.usedCpuMillis>=requestedCpuMillis&&n.capacityMemoryBytes-n.usedMemoryBytes>=requestedMemoryBytes);
  return candidates.sort((a,b)=>{const ar=preferredRegion&&a.region===preferredRegion?0:1;const br=preferredRegion&&b.region===preferredRegion?0:1;if(ar!==br)return ar-br;const ac=(a.usedCpuMillis/a.capacityCpuMillis)+(a.usedMemoryBytes/a.capacityMemoryBytes);const bc=(b.usedCpuMillis/b.capacityCpuMillis)+(b.usedMemoryBytes/b.capacityMemoryBytes);return ac-bc;})[0];
}
