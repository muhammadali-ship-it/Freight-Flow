import { storage } from "./storage";
import { hashPassword } from "./auth";

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername("admin");
    
    if (existingAdmin) {
      console.log("Admin user already exists. Resetting password...");
      const hashedPassword = await hashPassword("admin123");
      await storage.updateUser(existingAdmin.id, { password: hashedPassword });
      console.log("\n✅ Admin password reset successfully!");
    } else {
      console.log("Creating new admin user...");
      const hashedPassword = await hashPassword("admin123");
      
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        email: "admin@freighttrack.com",
        name: "System Administrator",
        role: "Admin",
        office: "Freight Operations",
        googleId: null,
        avatar: null,
      });
      
      console.log("\n✅ Admin user created successfully!");
    }
    
    console.log("\n📋 Login Credentials:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("\n🔒 Please change this password after first login!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();