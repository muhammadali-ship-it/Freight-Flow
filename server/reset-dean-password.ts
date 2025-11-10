import { storage } from "./storage";
import { hashPassword } from "./auth";

async function resetPassword() {
  try {
    const newPassword = "password123";
    const hashedPassword = await hashPassword(newPassword);
    
    await storage.updateUser("a34dc8f2-8953-4c75-a200-ad234e5caa43", {
      password: hashedPassword
    });
    
    console.log("✅ Password reset successfully for dean.west");
    console.log("Username: dean.west");
    console.log("Password: password123");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

resetPassword();
