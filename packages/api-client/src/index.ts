import type { Block,Candidate,ReceiptLookup,SystemStats,Voter,VoterAuthResponse,VoteReceipt } from "@evoting/contracts";
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/,"") ?? "";
export class ApiError extends Error { constructor(message:string,public readonly status:number){super(message);this.name="ApiError";} }
async function request<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(API_BASE+path,{...init,headers:{...(init?.body?{"Content-Type":"application/json"}:{}),...init?.headers}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new ApiError(typeof data?.error==="string"?data.error:`Request failed (${response.status})`,response.status);
 return data as T;
}
export const api={
 health:()=>request<{ok:boolean;database:string;latencyMs:number}>("/api/health"),
 info:()=>request<{name:string;status:string;database:string;disclaimer:string}>("/api/info"),
 stats:()=>request<SystemStats>("/api/system/stats"),
 voters:()=>request<{voters:Voter[]}>("/api/voters"),
 candidates:()=>request<{candidates:Candidate[]}>("/api/candidates"),
 chain:()=>request<{blocks:Block[]}>("/chain"),
 verifyChain:()=>request<Record<string,unknown>>("/chain/verify"),
 districts:()=>request<{districts:Array<{id:string;status:string;[key:string]:unknown}>}>("/api/districts"),
 authenticateVoter:(voterId:string)=>request<VoterAuthResponse>("/api/voter/auth",{method:"POST",body:JSON.stringify({voterId})}),
 castVote:(payload:{districtId:string;tokenId:string;candidateId:string;publicKey:string;privateKey:string})=>request<{receipt:VoteReceipt;candidate:string}>("/api/vote/cast",{method:"POST",body:JSON.stringify(payload)}),
 receipt:(id:string)=>request<ReceiptLookup>(`/api/receipt/${encodeURIComponent(id)}`),
 resetDemo:()=>request<{message:string}>("/api/demo/reset",{method:"POST"})
};
