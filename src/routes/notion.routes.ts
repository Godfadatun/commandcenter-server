import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireNotion } from "../middleware/requireNotion";
import { saveConfig, getConfig, testDbs, fullSync, createTask, updateTask, createExpense, updateExpense } from "../controllers/notion.controller";

const router = Router();

// Config — auth only (no notion required yet)
router.post("/config", authMiddleware, saveConfig);
router.get("/config", authMiddleware, getConfig);

// These need auth + active notion config
router.post("/test-dbs", authMiddleware, requireNotion, testDbs);
router.post("/sync", authMiddleware, requireNotion, fullSync);
router.post("/tasks", authMiddleware, requireNotion, createTask);
router.patch("/tasks/:pageId", authMiddleware, requireNotion, updateTask);
router.post("/expenses", authMiddleware, requireNotion, createExpense);
router.patch("/expenses/:pageId", authMiddleware, requireNotion, updateExpense);

export default router;
