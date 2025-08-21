import { db } from "./db";
import { departments, insuranceProviders, users } from "@shared/schema";

export async function seedData() {
  try {
    console.log("Seeding initial data...");
    
    // Seed users first
    await db.insert(users).values([
      { 
        username: "admin", 
        email: "admin@bahrelghazal.clinic",
        fullName: "Administrator",
        password: "admin123", // In production, this should be hashed
        role: "admin", 
        location: "usa" 
      },
      { 
        username: "staff", 
        email: "staff@bahrelghazal.clinic",
        fullName: "Staff User",
        password: "staff123", // In production, this should be hashed
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