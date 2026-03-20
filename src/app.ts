import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import notionRoutes from "./routes/notion.routes";
import calendarRoutes from "./routes/calendar.routes";
import scheduleRoutes from "./routes/schedule.routes";

const app = express();

app.use(cors());
app.use(express.json());

// Health check — public
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/notion", notionRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/schedules", scheduleRoutes);

export default app;
