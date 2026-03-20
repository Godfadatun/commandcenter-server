import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "../data-source";
import { seedEventTypes } from "./event-types.seed";

const run = async () => {
  try {
    await AppDataSource.initialize();
    console.log("✓ Database connected\n");

    console.log("Seeding EventTypes...");
    await seedEventTypes();

    console.log("\n✓ All seeds complete");
    process.exit(0);
  } catch (e: any) {
    console.error("✗ Seed failed:", e.message);
    process.exit(1);
  }
};

run();
