import { sql } from "drizzle-orm";
import { createDatabase, voters } from "./index.js";
const given = ["Aarav","Aditi","Akash","Anaya","Arjun","Diya","Ishan","Kavya","Mira","Neel","Rohan","Sana","Tara","Vihaan","Zoya"];
const family = ["Rao","Iyer","Nair","Shah","Menon","Patel","Das","Kapoor","Reddy","Khan","Fernandes","Pillai"];
const demoVoters = Array.from({ length: 5000 }, (_, i) => ({ voterId: `DEMO-${String(i + 1).padStart(5, "0")}`, name: `${given[i % given.length]} ${family[Math.floor(i / given.length) % family.length]}`, districtId: `D${(i % 12) + 1}`, hasVoted: i < 3250, issuedTokenId: null }));
const { db, client } = createDatabase();
try {
 await db.insert(voters).values(demoVoters).onConflictDoUpdate({ target: voters.voterId, set: { name: sql`excluded.name`, districtId: sql`excluded.district_id`, hasVoted: sql`excluded.has_voted`, issuedTokenId: null } });
 const [totals] = await client`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE has_voted = TRUE)::int AS voted FROM voters WHERE voter_id LIKE 'DEMO-%'`;
 console.log(`Demo seed complete: ${totals.total} voters; ${totals.voted} voted; ${Number(totals.total) - Number(totals.voted)} not voted.`);
} finally { await client.end(); }