import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "./data-source";
import app from "./app";

const PORT = process.env.PORT || 3456;

AppDataSource.initialize()
  .then(() => {
    console.log("✓ Database connected");

    app.listen(PORT, () => {
      console.log(`\n🚀 Command Center API running on http://localhost:${PORT}`);
      console.log("   POST /api/auth/register     — create account");
      console.log("   POST /api/auth/login         — get JWT token");
      console.log("   POST /api/auth/verify        — verify email OTP");
      console.log("   POST /api/notion/config      — save Notion config");
      console.log("   GET  /api/notion/config      — get Notion config");
      console.log("   POST /api/notion/test-dbs    — test DB connections");
      console.log("   POST /api/notion/sync        — full Notion sync");
      console.log("   POST /api/notion/tasks       — create task");
      console.log("   PATCH /api/notion/tasks/:id  — update task");
      console.log("   POST /api/notion/expenses    — create expense");
      console.log("   PATCH /api/notion/expenses/:id — update expense");
      console.log("   POST /api/calendar/config    — save calendar config");
      console.log("   GET  /api/calendar/events    — get events");
      console.log("   POST /api/schedules          — create schedule");
      console.log("   POST /api/schedules/trigger   — trigger by cron");
      console.log("   GET  /api/health             — health check\n");
    });
  })
  .catch((error) => {
    console.error("✗ Database connection failed:", error.message);
    process.exit(1);
  });
