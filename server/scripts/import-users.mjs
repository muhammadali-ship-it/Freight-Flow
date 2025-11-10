import XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

async function importUsers() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile('attached_assets/Broker Staffs_1761858171741.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Found ${data.length} users in Excel file`);
  
  // Delete all existing users
  console.log('Deleting all existing users...');
  await sql('DELETE FROM notifications');
  await sql('DELETE FROM users');
  console.log('All existing users deleted');
  
  // Hash the default password
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // Insert new users from Excel
  console.log('Creating new users...');
  let created = 0;
  let failed = 0;
  
  for (const row of data) {
    try {
      const email = row.Email || row.Login;
      const name = row.Name;
      const office = row.Organization;
      const role = row.Role.toLowerCase(); // admin, manager, user
      
      await sql(
        'INSERT INTO users (email, name, office, role, password) VALUES ($1, $2, $3, $4, $5)',
        [email, name, office, role, hashedPassword]
      );
      
      created++;
      console.log(`✓ Created user: ${name} (${email}) - ${role}`);
    } catch (error) {
      failed++;
      console.error(`✗ Failed to create user ${row.Name}:`, error.message);
    }
  }
  
  console.log('\n=================================');
  console.log(`Import complete!`);
  console.log(`Created: ${created} users`);
  console.log(`Failed: ${failed} users`);
  console.log(`Default password: password123`);
  console.log('=================================\n');
}

importUsers().catch(console.error);
