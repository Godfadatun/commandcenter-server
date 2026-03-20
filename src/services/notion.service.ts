import { Client } from "@notionhq/client";

export const createNotionClient = (token: string): Client => {
  return new Client({ auth: token });
};

export const cleanDbId = (id: string): string => {
  return (id || "").replace("collection://", "").trim();
};

export const queryDb = async (notion: Client, dbId: string, opts: { page_size?: number; start_cursor?: string } = {}) => {
  const args: any = { data_source_id: dbId, page_size: opts.page_size || 100 };
  if (opts.start_cursor) args.start_cursor = opts.start_cursor;
  return (notion as any).dataSources.query(args);
};

export const statusMap: Record<string, string> = {
  "Not started": "Not started",
  "In progress": "In progress",
  "Done": "Done",
  "Missed": "Missed",
  "Paused": "Paused",
  "Deferred": "Deffered",
  "Deffered": "Deffered",
};

export const mapStatus = (s: string): string => statusMap[s] || s;

export const formatPageId = (pageId: string): string => {
  return pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
};

// Notion property extractors
export const getName = (prop: any) => (prop?.title || []).map((t: any) => t.plain_text).join("") || "";
export const getSel = (prop: any) => prop?.select?.name || "";
export const getMulti = (prop: any) => (prop?.multi_select || []).map((s: any) => s.name).join(", ");
export const getNum = (prop: any) => prop?.number ?? 0;
export const getDate = (prop: any) => prop?.date?.start || "";
export const getStat = (prop: any) => prop?.status?.name || "";
export const getRich = (prop: any) => (prop?.rich_text || []).map((t: any) => t.plain_text).join("") || "";
export const fmtTime = (v: number): string => {
  if (!v && v !== 0) return "";
  const n = parseFloat(String(v));
  if (isNaN(n)) return "";
  return String(Math.floor(n)).padStart(2, "0") + ":" + String(Math.round((n % 1) * 60)).padStart(2, "0");
};
export const smStatus = (v: string): string => v === "Done" ? "done" : v === "Missed" ? "missed" : "ns";
