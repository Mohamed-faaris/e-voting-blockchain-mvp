export interface VoteTransaction {
  id: string;
  districtId: string;
  tokenId: string;
  encryptedVote: string;
  createdAt: string;
  publicKey?: string;
  signature?: string;
}

export interface Block {
  index: number;
  districtId: string;
  timestamp: string;
  transactions: VoteTransaction[];
  previousHash: string;
  merkleRoot: string;
  hash: string;
  validatorSignature?: string;
  validatorPublicKey?: string;
}

export interface Voter {
  voterId: string;
  name: string;
  districtId: string;
  hasVoted: boolean;
  issuedTokenId?: string;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  symbol: string;
}
