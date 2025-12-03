import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

const { Client } = pg;

async function checkColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cargoes_flow_shipments'
    `);

        const columns = res.rows.map(r => r.column_name);
        console.log("Columns in cargoes_flow_shipments:");
        console.log(columns.join(", "));

        const hasAtd = columns.includes('atd');
        const hasAta = columns.includes('ata');

        console.log(`\nHas 'atd': ${hasAtd}`);
        console.log(`Has 'ata': ${hasAta}`);

    } catch (err) {
        console.error("Error executing query", err);
    } finally {
        await client.end();
    }
}

checkColumns();
