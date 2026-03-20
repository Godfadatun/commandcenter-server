import { AppDataSource } from "../data-source";
import { Schedule } from "../entities/Schedule";
import { Event } from "../entities/Event";
import { EventType } from "../entities/EventType";
import { User } from "../entities/User";

export const seedSchedules = async () => {
  const scheduleRepo = AppDataSource.getRepository(Schedule);
  const eventRepo = AppDataSource.getRepository(Event);
  const eventTypeRepo = AppDataSource.getRepository(EventType);
  const userRepo = AppDataSource.getRepository(User);

  // Get first user (or skip if no users exist)
  const user = await userRepo.findOne({ where: {}, order: { id: "ASC" } });
  if (!user) {
    console.log("  – No users found, skipping schedule seeds (create a user first)");
    return;
  }

  // Get event types
  const morningType = await eventTypeRepo.findOne({ where: { type: "Morning Check-in" } });
  const eodType = await eventTypeRepo.findOne({ where: { type: "End of Day Check-in" } });
  const weeklyType = await eventTypeRepo.findOne({ where: { type: "Weekly Check-in" } });

  if (!morningType || !eodType || !weeklyType) {
    console.log("  – EventTypes not found, run event-types seed first");
    return;
  }

  const schedules = [
    {
      frequency: "daily",
      time: "06:00",
      cronFormat: "0 6 * * *",
      enabled: true,
      typeId: morningType.id,
      label: "Morning Check-in",
    },
    {
      frequency: "daily",
      time: "21:00",
      cronFormat: "0 21 * * *",
      enabled: true,
      typeId: eodType.id,
      label: "End of Day Check-in",
    },
    {
      frequency: "weekly",
      time: "18:00",
      cronFormat: "0 18 * * 0",  // Sunday at 18:00
      enabled: false,
      typeId: weeklyType.id,
      label: "Weekly Check-in",
    },
  ];

  for (const s of schedules) {
    const exists = await scheduleRepo.findOne({
      where: { userId: user.id, cronFormat: s.cronFormat },
    });

    if (!exists) {
      const schedule = scheduleRepo.create({
        userId: user.id,
        frequency: s.frequency,
        time: s.time,
        cronFormat: s.cronFormat,
        enabled: s.enabled,
      });
      await scheduleRepo.save(schedule);
      console.log(`  ✓ Seeded Schedule: ${s.label} (${s.cronFormat})`);

      // Create linked event
      const event = eventRepo.create({
        userId: user.id,
        scheduleId: schedule.id,
        typeId: s.typeId,
      });
      await eventRepo.save(event);
      console.log(`  ✓ Seeded Event for: ${s.label}`);
    } else {
      console.log(`  – Schedule already exists: ${s.label}`);
    }
  }
};
