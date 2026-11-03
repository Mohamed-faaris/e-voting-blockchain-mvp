export interface Candidate { id:string; name:string; party:string; symbol:string }
export interface Voter { voterId:string; name:string; districtId:string; hasVoted:boolean; issuedTokenId?:string }
export interface VoteTransaction { id:string; districtId:string; tokenId:string; encryptedVote:string; createdAt:string; publicKey?:string; signature?:string }
export interface Block { index:number; districtId:string; timestamp:string; transactions:VoteTransaction[]; previousHash:string; merkleRoot:string; hash:string; validatorSignature?:string; validatorPublicKey?:string }
export interface SystemStats { timestamp:string; uptimeSeconds:number; database:{provider:string;status:string;latencyMs:number;error:string|null;records:{blocks:number;voters:number}}; runtime:{nodeVersion:string;platform:string;arch:string;heapUsedMB:number;heapTotalMB:number;rssMB:number}; consensus:{validatorAlgorithm:string;hashAlgorithm:string;districtsOnline:number} }
export interface VoterAuthResponse { success:boolean; message?:string; voter:Voter; token:{tokenId:string;publicKey:string;privateKey:string} }
export interface VoteReceipt { blockIndex:number; blockHash:string; transactionId:string; timestamp:string }
export interface ReceiptLookup { found:boolean; type?:"BLOCK_HASH"|"TRANSACTION_RECEIPT"; blockIndex?:number; blockHash?:string; merkleRoot?:string; transactionId?:string; timestamp?:string; transactionCount?:number; districtId?:string; error?:string }
