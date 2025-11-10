import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from "../config";

// Create postgres connection
const queryClient = postgres(config.databaseUrl);

// Create drizzle instance with schema
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
