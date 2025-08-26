import { db } from "./db";
import { departments, insuranceProviders, users } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedData() {
  try {
    console.log("Seeding initial data...");
    
    // Note: No default admin user - create via registration process

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
      { code: 'ALIMA', name: 'ALIMA' },
      { code: 'AMANAH', name: 'Amanah Insurance' },
      { code: 'CIC', name: 'CIC Insurance' },
      { code: 'CIGNA', name: 'CIGNA Insurance' },
      { code: 'NSI', name: 'New Sudan Insurance' },
      { code: 'UAP', name: 'UAP Insurance' },
      { code: 'OTHER', name: 'Other' }
    ]).onConflictDoUpdate({
      target: insuranceProviders.code,
      set: { name: sql`EXCLUDED.name` }
    });

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Seeding error:", error);
  }
}

// Only run when called directly (CLI usage only)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData();
}