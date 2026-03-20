import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { createSchedule, getSchedules, updateSchedule, deleteSchedule, triggerSchedules } from "../controllers/schedule.controller";

const router = Router();

router.post("/", authMiddleware, createSchedule);
router.get("/", authMiddleware, getSchedules);
router.patch("/:code", authMiddleware, updateSchedule);
router.delete("/:code", authMiddleware, deleteSchedule);

// Trigger endpoint — can be called by external cron or protected by API key
router.post("/trigger", triggerSchedules);

export default router;
