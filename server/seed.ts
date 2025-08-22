import { storage } from "./storage";

async function seedDatabase() {
  console.log("Seeding database with initial data...");

  try {
    // Create departments
    const departments = [
      { code: "CON", name: "Consultation" },
      { code: "LAB", name: "Laboratory" }, 
      { code: "ULTRASOUND", name: "Ultrasound" },
      { code: "XRAY", name: "X-Ray" },
      { code: "PHARMACY", name: "Pharmacy" },
      { code: "OTHER", name: "Other" },
    ];

    for (const dept of departments) {
      try {
        await storage.createDepartment(dept);
        console.log(`Created department: ${dept.name}`);
      } catch (error) {
        console.log(`Department ${dept.name} may already exist`);
      }
    }

    // Create insurance providers
    const insuranceProviders = [
      { code: "CIC", name: "CIC Insurance" },
      { code: "UAP", name: "UAP Insurance" },
      { code: "CIGNA", name: "CIGNA" },
      { code: "NILE", name: "Nile International" },
      { code: "NEW_SUDAN", name: "New Sudan Insurance" },
      { code: "AMAANAH", name: "Amaanah Insurance" },
    ];

    for (const provider of insuranceProviders) {
      try {
        await storage.createInsuranceProvider(provider);
        console.log(`Created insurance provider: ${provider.name}`);
      } catch (error) {
        console.log(`Insurance provider ${provider.name} may already exist`);
      }
    }

    // Create default admin user
    try {
      await storage.createUser({
        username: "admin",
        password: "admin123", // In production, this should be hashed
        role: "admin",
        location: "usa"
      });
      console.log("Created admin user");
    } catch (error) {
      console.log("Admin user may already exist");
    }

    // Create default staff user
    try {
      await storage.createUser({
        username: "staff",
        password: "staff123", // In production, this should be hashed
        role: "staff", 
        location: "south_sudan"
      });
      console.log("Created staff user");
    } catch (error) {
      console.log("Staff user may already exist");
    }

    console.log("Database seeding completed successfully!");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

export { seedDatabase };
