import { Response, NextFunction } from "express";
import { Client } from "@notionhq/client";
import { AppDataSource } from "../data-source";
import { NotionConfig } from "../entities/NotionConfig";
import { AuthRequest } from "./auth";

export interface NotionRequest extends AuthRequest {
  notionClient?: Client;
  notionConfig?: NotionConfig;
}

export const requireNotion = async (req: NotionRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Auth required" });
    return;
  }
  const config = await AppDataSource.getRepository(NotionConfig).findOne({
    where: { userId: req.user.id, status: "ACTIVE" },
  });
  if (!config || !config.notionToken) {
    res.status(400).json({ error: "No Notion configuration found. Set up your Notion integration first." });
    return;
  }
  req.notionClient = new Client({ auth: config.notionToken });
  req.notionConfig = config;
  next();
};
