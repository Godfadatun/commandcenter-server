import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "./entities/User";
import { NotionConfig } from "./entities/NotionConfig";
import { Verification } from "./entities/Verification";
import { Calendar } from "./entities/Calendar";
import { Schedule } from "./entities/Schedule";
import { Event } from "./entities/Event";
import { EventType } from "./entities/EventType";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV !== "production",
  entities: [User, NotionConfig, Verification, Calendar, Schedule, Event, EventType],
  migrations: [],
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});
