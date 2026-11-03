export interface DemoVoterSeed {
  voterId: string;
  name: string;
  districtId: string;
  hasVoted: boolean;
  issuedTokenId: null;
}

const givenNames = ["Aarav", "Aditi", "Akash", "Anaya", "Arjun", "Diya", "Ishan", "Kavya", "Mira", "Neel", "Rohan", "Sana", "Tara", "Vihaan", "Zoya"];
const familyNames = ["Rao", "Iyer", "Nair", "Shah", "Menon", "Patel", "Das", "Kapoor", "Reddy", "Khan", "Fernandes", "Pillai"];

export const DEMO_VOTER_COUNT = 5_000;
export const DEMO_VOTED_COUNT = 3_250;

export function buildDemoVoters(): DemoVoterSeed[] {
  return Array.from({ length: DEMO_VOTER_COUNT }, (_, index) => ({
    voterId: `DEMO-${String(index + 1).padStart(5, "0")}`,
    name: `${givenNames[index % givenNames.length]} ${familyNames[Math.floor(index / givenNames.length) % familyNames.length]}`,
    districtId: `D${(index % 12) + 1}`,
    hasVoted: index < DEMO_VOTED_COUNT,
    issuedTokenId: null
  }));
}
