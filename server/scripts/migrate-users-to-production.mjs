#!/usr/bin/env node

/**
 * Migration Script: Copy Development Users to Production Database
 * 
 * This script exports users from development and provides SQL to import into production.
 * Run this AFTER deploying to production.
 */

import { db } from '../server/storage.js';
import { users } from '../shared/schema.js';
import fs from 'fs';
import path from 'path';

async function exportUsersToSQL() {
  console.log('🔄 Exporting users from development database...\n');
  
  try {
    // Fetch all users from development
    const allUsers = await db.select().from(users);
    
    console.log(`✅ Found ${allUsers.length} users in development database\n`);
    
    // Generate SQL INSERT statements
    let sqlStatements = [];
    sqlStatements.push('-- Import Users to Production Database');
    sqlStatements.push('-- Generated: ' + new Date().toISOString());
    sqlStatements.push('-- Total Users: ' + allUsers.length);
    sqlStatements.push('');
    
    // First, delete existing users (optional - uncomment if needed)
    sqlStatements.push('-- DELETE FROM users; -- Uncomment to clear existing users first');
    sqlStatements.push('');
    
    for (const user of allUsers) {
      const values = [
        `'${user.id}'`,
        `'${user.name.replace(/'/g, "''")}'`, // Escape single quotes
        `'${user.email}'`,
        `'${user.password}'`,
        `'${user.role}'`,
        user.office ? `'${user.office.replace(/'/g, "''")}'` : 'NULL',
        `'${user.createdAt.toISOString()}'`
      ];
      
      const insertSQL = `INSERT INTO users (id, name, email, password, role, office, created_at) VALUES (${values.join(', ')}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role, office = EXCLUDED.office;`;
      sqlStatements.push(insertSQL);
    }
    
    const sqlContent = sqlStatements.join('\n');
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'migration-users-production.sql');
    fs.writeFileSync(outputPath, sqlContent);
    
    console.log(`✅ SQL export complete!`);
    console.log(`📄 File saved to: ${outputPath}\n`);
    console.log(`📋 Next steps:`);
    console.log(`1. Click Submit in the deployment dialog to complete deployment`);
    console.log(`2. Go to your deployed app's Database tab in Replit`);
    console.log(`3. Switch to Production database`);
    console.log(`4. Open the SQL console`);
    console.log(`5. Copy and paste the contents of migration-users-production.sql`);
    console.log(`6. Execute the SQL to import all ${allUsers.length} users\n`);
    
    // Also display summary
    console.log('📊 User Summary:');
    const roleCount = allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} users`);
    });
    
  } catch (error) {
    console.error('❌ Error exporting users:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

exportUsersToSQL();
