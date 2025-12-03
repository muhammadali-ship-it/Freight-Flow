import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

const { Client } = pg;

async function addColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log("Adding 'atd' and 'ata' columns to cargoes_flow_shipments...");

        await client.query(`
      ALTER TABLE cargoes_flow_shipments 
      ADD COLUMN IF NOT EXISTS atd text,
      ADD COLUMN IF NOT EXISTS ata text;
    `);

        console.log("✅ Successfully added columns.");

    } catch (err) {
        console.error("Error executing query", err);
    } finally {
        await client.end();
    }
}

addColumns();
