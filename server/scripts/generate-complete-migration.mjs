#!/usr/bin/env node

/**
 * Complete Database Migration Generator
 * Exports ALL data from development database to SQL file for production
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to escape SQL values
function escapeSQLValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') {
    // Handle arrays and JSON objects
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  // Handle strings
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Tables in order (respecting foreign key dependencies)
const TABLES = [
  'users',
  'shipments',
  'milestones',
  'cargoes_flow_shipments',
  'cargoes_flow_posts',
  'cargoes_flow_sync_logs',
  'cargoes_flow_update_logs',
  'cargoes_flow_map_logs',
  'webhook_logs',
  'missing_mbl_shipments',
  'audit_logs',
  'saved_views',
  'cargoes_flow_document_uploads',
  'cargoes_flow_document_upload_logs',
  'shipment_documents',
  'containers',
  'exceptions',
  'vessel_positions',
  'rail_segments',
  'timeline_events',
  'carrier_updates',
  'integration_configs',
  'integration_sync_logs',
];

async function exportAllTables() {
  console.log('🔄 Starting COMPLETE database export...\n');
  
  const sqlStatements = [];
  sqlStatements.push('-- ========================================');
  sqlStatements.push('-- COMPLETE DATABASE MIGRATION');
  sqlStatements.push('-- Development → Production');
  sqlStatements.push('-- Generated: ' + new Date().toISOString());
  sqlStatements.push('-- ========================================');
  sqlStatements.push('');
  sqlStatements.push('-- IMPORTANT: Run this in Production Database SQL Console');
  sqlStatements.push('-- This will completely replace production data with development data');
  sqlStatements.push('');
  
  let totalRows = 0;
  const summary = [];
  
  for (const tableName of TABLES) {
    try {
      // Get row count
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const rowCount = parseInt(countResult.rows[0].count);
      
      if (rowCount === 0) {
        console.log(`⏭️  ${tableName}: 0 rows (skipped)`);
        continue;
      }
      
      console.log(`📦 Exporting ${tableName}: ${rowCount} rows...`);
      
      // Get all data
      const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY 1`);
      
      if (result.rows.length === 0) continue;
      
      sqlStatements.push('-- ========================================');
      sqlStatements.push(`-- TABLE: ${tableName} (${rowCount} rows)`);
      sqlStatements.push('-- ========================================');
      sqlStatements.push(`DELETE FROM ${tableName};`);
      sqlStatements.push('');
      
      // Get column names from first row
      const columns = Object.keys(result.rows[0]);
      
      // Generate INSERT statements
      for (const row of result.rows) {
        const values = columns.map(col => escapeSQLValue(row[col]));
        sqlStatements.push(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
        );
      }
      
      sqlStatements.push('');
      totalRows += rowCount;
      summary.push({ table: tableName, rows: rowCount });
      
    } catch (error) {
      console.error(`❌ Error exporting ${tableName}:`, error.message);
    }
  }
  
  sqlStatements.push('-- ========================================');
  sqlStatements.push('-- MIGRATION SUMMARY');
  sqlStatements.push('-- ========================================');
  summary.forEach(({ table, rows }) => {
    sqlStatements.push(`-- ${table}: ${rows} rows`);
  });
  sqlStatements.push(`-- TOTAL: ${totalRows} rows`);
  sqlStatements.push('-- ========================================');
  
  // Write to file
  const fs = await import('fs');
  const path = await import('path');
  const sqlContent = sqlStatements.join('\n');
  const outputPath = path.join(process.cwd(), 'production-migration-complete.sql');
  fs.writeFileSync(outputPath, sqlContent);
  
  console.log('\n✅ Export complete!');
  console.log(`📄 File: production-migration-complete.sql`);
  console.log(`📊 File size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📈 Total rows: ${totalRows}\n`);
  
  console.log('📋 Summary:');
  summary.forEach(({ table, rows }) => {
    console.log(`   ${table}: ${rows} rows`);
  });
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Go to Replit Database tool → Switch to Production');
  console.log('2. Click SQL Console');
  console.log('3. Copy entire contents of production-migration-complete.sql');
  console.log('4. Paste and execute in production database');
  console.log('5. Refresh to see all your data!\n');
  
  await pool.end();
  process.exit(0);
}

exportAllTables().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
