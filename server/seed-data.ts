import { db } from "./db";
import { departments, insuranceProviders, users } from "@shared/schema";
import bcrypt from "bcryptjs";

export async function seedData() {
  try {
    console.log("Seeding initial data...");
    
    // Seed users first
    const hashedAdminPassword = await bcrypt.hash("admin123", 10);
    const hashedStaffPassword = await bcrypt.hash("staff123", 10);
    
    await db.insert(users).values([
      { 
        username: "admin", 
        password: hashedAdminPassword,
        firstName: "Admin",
        lastName: "User",
        email: "admin@bahrelghazal.clinic",
        role: "admin", 
        location: "usa" 
      },
      { 
        username: "staff", 
        password: hashedStaffPassword,
        firstName: "Staff",
        lastName: "Member",
        email: "staff@bahrelghazal.clinic",
        role: "staff", 
        location: "south_sudan" 
      }
    ]).onConflictDoNothing();

    // Seed departments
    await db.insert(departments).values([
      { code: 'CON', name: 'Consultation' },
      { code: 'LAB', name: 'Laboratory' }, 
      { code: 'ULTRASOUND', name: 'Ultrasound' },
      { code: 'XRAY', name: 'X-Ray' },
      { code: 'PHARMACY', name: 'Pharmacy' }
    ]).onConflictDoNothing();

    // Seed insurance providers
    await db.insert(insuranceProviders).values([
      { code: 'CIC', name: 'CIC Insurance' },
      { code: 'UAP', name: 'UAP Insurance' },
      { code: 'CIGNA', name: 'CIGNA Insurance' },
      { code: 'NSI', name: 'New Sudan Insurance' },
      { code: 'AMAANAH', name: 'Amaanah Insurance' }
    ]).onConflictDoNothing();

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Seeding error:", error);
  }
}

// Only run when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().then(() => process.exit(0));
}