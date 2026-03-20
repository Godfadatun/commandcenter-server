import { Response } from "express";
import { google } from "googleapis";
import { AppDataSource } from "../data-source";
import { Calendar } from "../entities/Calendar";
import { AuthRequest } from "../middleware/auth";

const repo = () => AppDataSource.getRepository(Calendar);

export const saveCalendarConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { apiKey, calendarId } = req.body;
    let config = await repo().findOne({ where: { userId: req.user!.id } });
    if (!config) {
      config = repo().create({ userId: req.user!.id });
    }
    if (apiKey) config.apiKey = apiKey;
    if (calendarId) config.calendarId = calendarId;
    await repo().save(config);
    res.json({ ok: true, hasCalendar: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getCalendarEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const config = await repo().findOne({ where: { userId: req.user!.id } });
    if (!config || !config.apiKey) {
      res.status(400).json({ error: "No Google Calendar API key configured" });
      return;
    }
    const calendar = google.calendar({ version: "v3", auth: config.apiKey });
    const now = new Date();
    const response = await calendar.events.list({
      calendarId: config.calendarId || "primary",
      timeMin: (req.query.timeMin as string) || now.toISOString(),
      timeMax: (req.query.timeMax as string) || new Date(now.getTime() + 7 * 86400000).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });
    const events = (response.data.items || []).map((e: any) => ({
      id: e.id, title: e.summary || "",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      allDay: !e.start?.dateTime, location: e.location || "", description: e.description || "",
    }));
    res.json({ ok: true, events });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
