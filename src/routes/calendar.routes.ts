import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { saveCalendarConfig, getCalendarEvents } from "../controllers/calendar.controller";

const router = Router();

router.post("/config", authMiddleware, saveCalendarConfig);
router.get("/events", authMiddleware, getCalendarEvents);

export default router;
