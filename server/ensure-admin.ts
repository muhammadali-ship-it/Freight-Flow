import { storage } from "./storage.js";
import { hashPassword } from "./auth.js";

export async function ensureAdminExists() {
  try {
    const existingAdmin = await storage.getUserByUsername("admin");
    
    if (existingAdmin) {
      console.log("[Admin] Admin user already exists");
      return;
    }
    
    console.log("[Admin] Creating admin user...");
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
    
    console.log("[Admin] ✅ Admin user created successfully!");
    console.log("[Admin] Login with username: admin, password: admin123");
  } catch (error) {
    console.error("[Admin] ❌ Error ensuring admin exists:", error);
  }
}
