import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Schedule } from "../entities/Schedule";
import { Event } from "../entities/Event";
import { AuthRequest } from "../middleware/auth";

const repo = () => AppDataSource.getRepository(Schedule);
const eventRepo = () => AppDataSource.getRepository(Event);

export const createSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { frequency, time, cronFormat } = req.body;
    const schedule = repo().create({
      userId: req.user!.id,
      frequency: frequency || "daily",
      time,
      cronFormat,
      enabled: true,
    });
    await repo().save(schedule);
    res.status(201).json({ ok: true, schedule: { code: schedule.code, frequency: schedule.frequency, cronFormat: schedule.cronFormat } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  const schedules = await repo().find({ where: { userId: req.user!.id } });
  res.json({ ok: true, schedules });
};

export const updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const code = req.params.code as string;
    const schedule = await repo().findOne({ where: { code, userId: req.user!.id } });
    if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
    const { frequency, time, cronFormat, enabled } = req.body;
    if (frequency !== undefined) schedule.frequency = frequency;
    if (time !== undefined) schedule.time = time;
    if (cronFormat !== undefined) schedule.cronFormat = cronFormat;
    if (enabled !== undefined) schedule.enabled = enabled;
    await repo().save(schedule);
    res.json({ ok: true, schedule });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  const code = req.params.code as string;
  const schedule = await repo().findOne({ where: { code, userId: req.user!.id } });
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
  await repo().remove(schedule);
  res.json({ ok: true });
};

// POST /api/schedules/trigger — called by external cron runner
export const triggerSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cronTime } = req.body;
    if (!cronTime) {
      res.status(400).json({ error: "cronTime required" });
      return;
    }
    // Find all enabled schedules matching this cron expression
    const schedules = await repo().find({ where: { cronFormat: cronTime, enabled: true } });
    const triggered: string[] = [];

    for (const schedule of schedules) {
      // Create an event record for this trigger
      const event = eventRepo().create({
        userId: schedule.userId,
        scheduleId: schedule.id,
      });
      await eventRepo().save(event);

      // Update lastRanAt
      schedule.lastRanAt = new Date();
      await repo().save(schedule);

      triggered.push(schedule.code);
      console.log(`✓ Triggered schedule ${schedule.code} (${schedule.frequency}) for user ${schedule.userId}`);
    }

    res.json({ ok: true, triggered, count: triggered.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
