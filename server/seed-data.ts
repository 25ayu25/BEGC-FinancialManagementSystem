import { db } from "./db";
import { departments, insuranceProviders, users, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedData() {
  try {
    console.log("Seeding initial data...");
    
    // Create a sample user for demo data
    const [sampleUser] = await db.insert(users).values({
      username: 'sample_user',
      password: 'sample_hash', // In production, this would be properly hashed
      fullName: 'Sample User',
      role: 'admin',
      location: 'South Sudan'
    }).returning().onConflictDoNothing();

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

    // Get sample departments for transactions
    const [deptLab] = await db.select().from(departments).where(eq(departments.code, 'LAB')).limit(1);
    const [deptUltrasound] = await db.select().from(departments).where(eq(departments.code, 'ULTRASOUND')).limit(1);
    
    // Create sample expense transactions for August 2025 to match expected PDF data
    const sampleUserId = sampleUser?.id || 'fallback-id';
    const augustDate = new Date('2025-08-15'); // Mid-August for current month
    
    // Only create transactions if we have a valid user
    if (!sampleUser?.id) {
      console.log("No sample user created, skipping transaction seed data");
      return;
    }

    await db.insert(transactions).values([
      // Payroll & Insurance expenses (total should be SSP 12,000)
      {
        amount: 200,
        currency: 'SSP',
        type: 'expense',
        description: 'Clinic Operations August',
        expenseCategory: 'Clinic Operations',
        date: augustDate,
        createdBy: sampleUserId
      },
      {
        amount: 4300,
        currency: 'SSP', 
        type: 'expense',
        description: 'Doctor Payments August',
        expenseCategory: 'Doctor Payments',
        date: augustDate,
        createdBy: sampleUserId
      },
      {
        amount: 7500,
        currency: 'SSP',
        type: 'expense', 
        description: 'Lab Tech Payments August',
        expenseCategory: 'Lab Tech Payments',
        date: augustDate,
        createdBy: sampleUserId
      },
      // Operating expenses
      {
        amount: 500,
        currency: 'SSP',
        type: 'expense',
        description: 'Equipment Purchase August',
        expenseCategory: 'Equipment',
        date: augustDate,
        createdBy: sampleUserId
      },
      // Sample income transactions
      {
        amount: 14900,
        currency: 'SSP',
        type: 'income',
        description: 'Laboratory Services',
        departmentId: deptLab?.id,
        date: augustDate,
        createdBy: sampleUserId
      },
      {
        amount: 7000,
        currency: 'SSP',
        type: 'income',
        description: 'Ultrasound Services', 
        departmentId: deptUltrasound?.id,
        date: augustDate,
        createdBy: sampleUserId
      },
      {
        amount: 5000,
        currency: 'SSP',
        type: 'income',
        description: 'Other Services',
        date: augustDate,
        createdBy: sampleUserId
      },
      {
        amount: 11500,
        currency: 'USD',
        type: 'income',
        description: 'International Patient Services',
        date: augustDate,
        createdBy: sampleUserId
      }
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