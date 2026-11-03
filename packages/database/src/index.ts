import postgres from "postgres";
import {drizzle,type PostgresJsDatabase} from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
export type EvotingDatabase=PostgresJsDatabase<typeof schema>;
export function createDatabase(connectionString=process.env.DATABASE_URL){if(!connectionString)throw new Error("DATABASE_URL is required.");const client=postgres(connectionString,{max:10,idle_timeout:20,connect_timeout:10});return {client,db:drizzle(client,{schema}),close:()=>client.end()};}
export * from "./schema.js";
