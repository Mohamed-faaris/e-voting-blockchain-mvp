export interface DemoVoter{voterId:string;name:string;districtId:string;hasVoted:boolean}
const given=["Aarav","Aditi","Akash","Anaya","Arjun","Diya","Ishan","Kavya","Mira","Neel","Rohan","Sana","Tara","Vihaan","Zoya"];
const family=["Rao","Iyer","Nair","Shah","Menon","Patel","Das","Kapoor","Reddy","Khan","Fernandes","Pillai"];
export function createDemoVoters(count=5000,votedCount=Math.floor(count*.65)):DemoVoter[]{if(!Number.isInteger(count)||count<1)throw new Error("count must be positive");if(!Number.isInteger(votedCount)||votedCount<0||votedCount>count)throw new Error("votedCount must be within count");return Array.from({length:count},(_,i)=>({voterId:`DEMO-${String(i+1).padStart(5,"0")}`,name:`${given[i%given.length]} ${family[Math.floor(i/given.length)%family.length]}`,districtId:`D${i%12+1}`,hasVoted:i<votedCount}));}
export const createDefaultDemoVoters=()=>createDemoVoters(5000,3250);
