import { createHash } from "node:crypto";
import type { Block } from "./types.js";
import { getChain } from "../storage/sqlite.js";

export interface DistrictNode {
  id: string;
  name: string;
  status: "ONLINE" | "PARTITIONED" | "SYNCING";
  blockHeight: number;
  lastCheckpointHash: string;
  lastHeartbeat: string;
  pendingTransactions: number;
}

export interface StateCheckpoint {
  checkpointIndex: number;
  timestamp: string;
  stateRootHash: string;
  districtRoots: Record<string, string>;
  totalBlocksSummarized: number;
}

let districts: DistrictNode[] = [
  {
    id: "D1",
    name: "Capital Metro District D1",
    status: "ONLINE",
    blockHeight: 3,
    lastCheckpointHash: "0000000000000000000000000000000000000000000000000000000000000000",
    lastHeartbeat: new Date().toISOString(),
    pendingTransactions: 0
  },
  {
    id: "D2",
    name: "Northern Highlands District D2",
    status: "ONLINE",
    blockHeight: 1,
    lastCheckpointHash: "0000000000000000000000000000000000000000000000000000000000000000",
    lastHeartbeat: new Date().toISOString(),
    pendingTransactions: 0
  },
  {
    id: "D3",
    name: "Coastal Port District D3",
    status: "ONLINE",
    blockHeight: 1,
    lastCheckpointHash: "0000000000000000000000000000000000000000000000000000000000000000",
    lastHeartbeat: new Date().toISOString(),
    pendingTransactions: 0
  }
];

let checkpoints: StateCheckpoint[] = [];

export async function getDistrictsStatus(): Promise<DistrictNode[]> {
  const chain = await getChain();
  const d1Blocks = chain.filter((b) => b.districtId.startsWith("D1") || b.districtId === "DEMO-DISTRICT");

  districts = districts.map((d) => {
    if (d.id === "D1") {
      return {
        ...d,
        blockHeight: d1Blocks.length,
        lastCheckpointHash: d1Blocks[d1Blocks.length - 1]?.hash || d.lastCheckpointHash,
        lastHeartbeat: new Date().toISOString()
      };
    }
    return {
      ...d,
      lastHeartbeat: new Date().toISOString()
    };
  });

  return districts;
}

export function failDistrict(id: string): boolean {
  const d = districts.find((x) => x.id === id);
  if (!d) return false;
  d.status = "PARTITIONED";
  return true;
}

export function recoverDistrict(id: string): boolean {
  const d = districts.find((x) => x.id === id);
  if (!d) return false;
  d.status = "ONLINE";
  d.lastHeartbeat = new Date().toISOString();
  return true;
}

export async function generateStateCheckpoint(): Promise<StateCheckpoint> {
  const currentDistricts = await getDistrictsStatus();
  const districtRoots: Record<string, string> = {};

  let combined = "";
  let totalBlocks = 0;

  for (const d of currentDistricts) {
    districtRoots[d.id] = d.lastCheckpointHash;
    combined += `${d.id}:${d.lastCheckpointHash}:${d.blockHeight};`;
    totalBlocks += d.blockHeight;
  }

  const stateRootHash = createHash("sha256").update(combined).digest("hex");
  const checkpoint: StateCheckpoint = {
    checkpointIndex: checkpoints.length + 1,
    timestamp: new Date().toISOString(),
    stateRootHash,
    districtRoots,
    totalBlocksSummarized: totalBlocks
  };

  checkpoints.unshift(checkpoint);
  return checkpoint;
}

export function getCheckpoints(): StateCheckpoint[] {
  return checkpoints;
}
