import { storage } from "./storage.js";
import { hashPassword } from "./auth.js";

async function createRegularUsers() {
  try {
    const users = [
      {
        username: "sarah_chen",
        password: "user123",
        email: "sarah.chen@freighttrack.com",
        name: "Sarah Chen",
        company: "Freight Operations",
        role: "User"
      },
      {
        username: "mike_johnson",
        password: "user123",
        email: "mike.johnson@freighttrack.com",
        name: "Mike Johnson",
        company: "Freight Operations",
        role: "User"
      },
      {
        username: "emily_rodriguez",
        password: "user123",
        email: "emily.rodriguez@freighttrack.com",
        name: "Emily Rodriguez",
        company: "Freight Operations",
        role: "User"
      },
      {
        username: "james_williams",
        password: "user123",
        email: "james.williams@freighttrack.com",
        name: "James Williams",
        company: "Freight Operations",
        role: "User"
      },
      {
        username: "lisa_thompson",
        password: "user123",
        email: "lisa.thompson@freighttrack.com",
        name: "Lisa Thompson",
        company: "Freight Operations",
        role: "User"
      }
    ];

    console.log("Creating regular users...\n");

    for (const userData of users) {
      try {
        // Check if user already exists
        const existing = await storage.getUserByUsername(userData.username);
        
        if (existing) {
          console.log(`⏭️  User ${userData.username} already exists, skipping...`);
          continue;
        }

        const hashedPassword = await hashPassword(userData.password);
        
        await storage.createUser({
          username: userData.username,
          password: hashedPassword,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          company: userData.company,
          googleId: null,
          avatar: null,
        });
        
        console.log(`✅ Created user: ${userData.name} (${userData.username})`);
      } catch (error: any) {
        if (error.message?.includes('unique constraint')) {
          console.log(`⏭️  User ${userData.username} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    console.log("\n📋 All Users Created with Credentials:");
    console.log("   Role: User");
    console.log("   Password: user123 (for all users)");
    console.log("\n👥 Usernames:");
    users.forEach(u => console.log(`   - ${u.username} (${u.name})`));
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating users:", error);
    process.exit(1);
  }
}

createRegularUsers();