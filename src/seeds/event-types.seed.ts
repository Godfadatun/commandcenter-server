import { AppDataSource } from "../data-source";
import { EventType } from "../entities/EventType";

export const seedEventTypes = async () => {
  const repo = AppDataSource.getRepository(EventType);

  const types = [
    {
      type: "Morning Check-in",
      description: "Sleep/wake log + ritual swipe",
    },
    {
      type: "End of Day Check-in",
      description: "Review tasks, log bedtime, set alarm",
    },
    {
      type: "Weekly Check-in",
      description: "Review week metrics and plan ahead",
    },
  ];

  for (const t of types) {
    const exists = await repo.findOne({ where: { type: t.type } });
    if (!exists) {
      const entity = repo.create(t);
      await repo.save(entity);
      console.log(`  ✓ Seeded EventType: ${t.type}`);
    } else {
      console.log(`  – EventType already exists: ${t.type}`);
    }
  }
};
