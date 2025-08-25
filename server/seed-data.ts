import { db } from "./db";
import { departments, insuranceProviders, users } from "@shared/schema";

export async function seedData() {
  try {
    console.log("Seeding initial data...");
    
    // Create default admin user for initial access
    await db.insert(users).values([
      {
        username: 'admin',
        email: 'admin@bahrelghazalclinic.com',
        password: 'admin123', // Change this after first login
        fullName: 'System Administrator',
        role: 'admin',
        location: 'usa',
        status: 'active'
      }
    ]).onConflictDoNothing();

    // Seed departments
    await db.insert(departments).values([
      { code: 'CON', name: 'Consultation' },
      { code: 'LAB', name: 'Laboratory' }, 
      { code: 'ULTRASOUND', name: 'Ultrasound' },
      { code: 'XRAY', name: 'X-Ray' },
      { code: 'PHARMACY', name: 'Pharmacy' },
      { code: 'OTHER', name: 'Other' }
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

// Only run when called directly (CLI usage only)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData();
}