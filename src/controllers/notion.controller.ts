import { Response } from "express";
import { AppDataSource } from "../data-source";
import { NotionConfig } from "../entities/NotionConfig";
import { NotionRequest } from "../middleware/requireNotion";
import { AuthRequest } from "../middleware/auth";
import { Client } from "@notionhq/client";
import { cleanDbId, queryDb, mapStatus, formatPageId, getName, getSel, getMulti, getNum, getDate, getStat, getRich, fmtTime, smStatus } from "../services/notion.service";

const repo = () => AppDataSource.getRepository(NotionConfig);

export const saveConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { workspaceUrl, notionToken, tasksDbId, dailySummaryDbId, expenseDebtDbId, weeklyExpenseDbId } = req.body;
    let config = await repo().findOne({ where: { userId: req.user!.id } });
    if (!config) {
      config = repo().create({ userId: req.user!.id });
    }
    if (workspaceUrl !== undefined) config.workspaceUrl = workspaceUrl;
    if (notionToken !== undefined) config.notionToken = notionToken;
    if (tasksDbId !== undefined) config.tasksDbId = cleanDbId(tasksDbId);
    if (dailySummaryDbId !== undefined) config.dailySummaryDbId = cleanDbId(dailySummaryDbId);
    if (expenseDebtDbId !== undefined) config.expenseDebtDbId = cleanDbId(expenseDebtDbId);
    if (weeklyExpenseDbId !== undefined) config.weeklyExpenseDbId = cleanDbId(weeklyExpenseDbId);
    config.status = "ACTIVE";
    await repo().save(config);
    res.json({ ok: true, config: { code: config.code, status: config.status } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  const config = await repo().findOne({ where: { userId: req.user!.id } });
  if (!config) {
    res.json({ ok: true, config: null });
    return;
  }
  res.json({
    ok: true,
    config: {
      code: config.code,
      workspaceUrl: config.workspaceUrl,
      tasksDbId: config.tasksDbId,
      dailySummaryDbId: config.dailySummaryDbId,
      expenseDebtDbId: config.expenseDebtDbId,
      weeklyExpenseDbId: config.weeklyExpenseDbId,
      status: config.status,
      // Don't send token back
      hasToken: !!config.notionToken,
    },
  });
};

export const testDbs = async (req: NotionRequest, res: Response): Promise<void> => {
  const notion = req.notionClient!;
  const config = req.notionConfig!;
  const dbs: Record<string, string> = {
    tasks: config.tasksDbId,
    daily: config.dailySummaryDbId,
    expense: config.expenseDebtDbId,
    wkExp: config.weeklyExpenseDbId,
  };
  const results: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const [key, dbId] of Object.entries(dbs)) {
    if (!dbId) { results[key] = "empty"; continue; }
    try {
      const db = await notion.databases.retrieve({ database_id: dbId });
      results[key] = "ok";
      console.log(`✓ ${key} DB (${dbId}): "${(db as any).title?.[0]?.plain_text || "Untitled"}" accessible`);
    } catch (e: any) {
      results[key] = "failed";
      errors[key] = e.message;
      console.error(`✗ ${key} DB (${dbId}): ${e.message}`);
    }
  }
  const allOk = Object.values(results).filter(v => v !== "empty").every(v => v === "ok");
  res.json({ ok: true, results, errors, allOk });
};

export const fullSync = async (req: NotionRequest, res: Response): Promise<void> => {
  const notion = req.notionClient!;
  const config = req.notionConfig!;
  try {
    const result: { tasks: any[]; days: Record<string, any>; expenses: any[] } = { tasks: [], days: {}, expenses: [] };

    // Fetch tasks
    if (config.tasksDbId) {
      let hasMore = true, startCursor: string | undefined;
      while (hasMore) {
        const r = await queryDb(notion, config.tasksDbId, { start_cursor: startCursor, page_size: 100 });
        for (const p of r.results) {
          const pr = (p as any).properties;
          const status = getStat(pr["Status"]);
          const dueDate = getDate(pr["Due date"]);
          result.tasks.push({
            id: "nt" + (p as any).id.replace(/-/g, ""),
            name: getName(pr["Task name"]), status, priority: getSel(pr["Priority"]),
            type: getSel(pr["Type"]), taskType: getMulti(pr["Task type"]),
            impactPoints: String(getNum(pr["Impact Points"]) || ""),
            effortLevel: getSel(pr["Effort level"]), dueDate,
            completedOn: status === "Done" ? dueDate : "",
            hrs: String(getNum(pr["hrs"]) || ""), noiseFactor: String(getNum(pr["Noise Factor"]) || ""),
            description: "", resultSatisfaction: getSel(pr["Result Satisfaction"]),
            score: getNum(pr["End of Day Score"]) || 0,
            notionPageId: (p as any).id.replace(/-/g, ""),
          });
        }
        hasMore = r.has_more; startCursor = r.next_cursor;
      }
    }

    // Fetch daily records
    if (config.dailySummaryDbId) {
      let hasMore = true, startCursor: string | undefined;
      while (hasMore) {
        const r = await queryDb(notion, config.dailySummaryDbId, { start_cursor: startCursor, page_size: 100 });
        for (const p of r.results) {
          const pr = (p as any).properties;
          const key = getDate(pr["Date"]);
          if (!key) continue;
          const dateKey = key.split("T")[0];
          const day: any = {
            date: dateKey,
            exercise: smStatus(getStat(pr["Exercise"])), sleep: smStatus(getStat(pr["Sleep"])),
            calendar: smStatus(getStat(pr["Update Calendar"])), scheduling: smStatus(getStat(pr["Next Day-Scheduling"])),
            docPrep: smStatus(getStat(pr["Next-Day Document Prep"])),
            wakeUp: fmtTime(getNum(pr["Wake-Up Time [24hrs]"])), sleepTime: fmtTime(getNum(pr["Sleep Time [24hrs]"])),
            spendLog: [], noiseLog: [], reviewed: false,
            notionPageId: (p as any).id.replace(/-/g, ""),
            notionMetrics: {
              totalTasks: getNum(pr["Total Tasks"]) || 0, tasksDone: getNum(pr["Tasks Done"]) || 0,
              impactExpected: getNum(pr["Days Imapct Score"]) || getNum(pr["Days Impact Score"]) || 0,
              impactAchieved: getNum(pr["Achieved Impact Score"]) || getNum(pr["Achieved Imapct Score"]) || 0,
              snr: getNum(pr["SNR"]) || 0, signalScore: getNum(pr["Signal Score [Score]"]) || 0,
              noiseScore: getNum(pr["Noise Score [Score]"]) || 0, noiseHrs: getNum(pr["Noise Time[hrs]"]) || 0,
              awakeTime: getNum(pr["Awake Time"]) || 0, distractedPct: getNum(pr["Distracted Time"]) || 0,
              spend: getNum(pr["Spend (NGN)"]) || 0,
            },
          };
          const noise = getNum(pr["Noise Time[hrs]"]);
          if (noise > 0) day.noiseLog = [{ id: "nn" + Date.now() + Math.random(), type: "Imported", hours: Math.floor(noise), minutes: Math.round((noise % 1) * 60) }];
          const spend = getNum(pr["Spend (NGN)"]);
          if (spend > 0) day.spendLog = [{ id: "ns" + Date.now() + Math.random(), amount: spend, note: "Notion import", category: "Other", time: "—" }];
          result.days[dateKey] = day;
        }
        hasMore = r.has_more; startCursor = r.next_cursor;
      }
    }

    // Fetch expenses
    if (config.expenseDebtDbId) {
      let hasMore = true, startCursor: string | undefined;
      while (hasMore) {
        const r = await queryDb(notion, config.expenseDebtDbId, { start_cursor: startCursor, page_size: 100 });
        for (const p of r.results) {
          const pr = (p as any).properties;
          result.expenses.push({
            id: "ne" + (p as any).id.replace(/-/g, ""),
            name: getName(pr["Name"]), amount: String(getNum(pr["Number"]) || 0),
            status: getStat(pr["Status"]),
            classification: (getSel(pr["Classification "]) || "Family").trim(),
            salaryPeriod: ((pr["Select"]?.multi_select || []).map((s: any) => s.name) || [])[0] || "",
            datePaid: getDate(pr["Date Paid"]), unit: getRich(pr["Unit"]),
            parentId: "", recurring: false,
            notionPageId: (p as any).id.replace(/-/g, ""),
          });
        }
        hasMore = r.has_more; startCursor = r.next_cursor;
      }
    }

    console.log(`✓ Sync for user ${req.user!.id}: ${result.tasks.length} tasks, ${Object.keys(result.days).length} days, ${result.expenses.length} expenses`);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("Sync error:", e.message);
    res.status(500).json({ error: e.message });
  }
};

export const createTask = async (req: NotionRequest, res: Response): Promise<void> => {
  const notion = req.notionClient!;
  const config = req.notionConfig!;
  try {
    const t = req.body;
    const props: any = {
      "Task name": { title: [{ text: { content: t.name || "Untitled" } }] },
      "Status": { status: { name: mapStatus(t.status || "Not started") } },
    };
    if (t.priority) props["Priority"] = { select: { name: t.priority } };
    if (t.type) props["Type"] = { select: { name: t.type } };
    if (t.impactPoints) props["Impact Points"] = { number: parseFloat(t.impactPoints) || 0 };
    if (t.effortLevel) props["Effort level"] = { select: { name: t.effortLevel } };
    if (t.dueDate) props["Due date"] = { date: { start: t.dueDate } };
    if (t.taskType) {
      const types = t.taskType.split(",").map((x: string) => x.trim()).filter(Boolean);
      props["Task type"] = { multi_select: types.map((name: string) => ({ name })) };
    }
    const page = await notion.pages.create({ parent: { database_id: config.tasksDbId }, properties: props });
    res.json({ ok: true, pageId: (page as any).id.replace(/-/g, "") });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const updateTask = async (req: NotionRequest, res: Response): Promise<void> => {
  const notion = req.notionClient!;
  try {
    const pageId = req.params.pageId as string;
    const t = req.body;
    const props: any = {};
    if (t.name) props["Task name"] = { title: [{ text: { content: t.name } }] };
    if (t.status) props["Status"] = { status: { name: mapStatus(t.status) } };
    if (t.priority) props["Priority"] = { select: { name: t.priority } };
    if (t.type) props["Type"] = { select: { name: t.type } };
    if (t.taskType) { const types = t.taskType.split(",").map((x: string) => x.trim()).filter(Boolean); props["Task type"] = { multi_select: types.map((name: string) => ({ name })) }; }
    if (t.impactPoints !== undefined) props["Impact Points"] = { number: parseFloat(t.impactPoints) || 0 };
    if (t.effortLevel) props["Effort level"] = { select: { name: t.effortLevel } };
    if (t.dueDate) props["Due date"] = { date: { start: t.dueDate } };
    if (t.resultSatisfaction) props["Result Satisfaction"] = { select: { name: t.resultSatisfaction } };
    if (t.noiseFactor !== undefined) props["Noise Factor"] = { number: parseFloat(t.noiseFactor) || 0 };
    if (t.hrs !== undefined) props["hrs"] = { number: parseFloat(t.hrs) || 0 };
    if (t.score !== undefined) props["End of Day Score"] = { number: parseFloat(t.score) || 0 };
    const pid = formatPageId(pageId);
    await notion.pages.update({ page_id: pid, properties: props });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const createExpense = async (req: NotionRequest, res: Response): Promise<void> => {
  const notion = req.notionClient!;
  const config = req.notionConfig!;
  try {
    const e = req.body;
    const props: any = {
      "Name": { title: [{ text: { content: e.name || "Expense" } }] },
      "Number": { number: parseFloat(e.amount) || 0 },
      "Status": { status: { name: e.status || "Not Paid" } },
      "Classification ": { select: { name: (e.classification || "Family").trim() } },
    };
    if (e.unit) props["Unit"] = { rich_text: [{ text: { content: e.unit } }] };
    if (e.salaryPeriod) props["Select"] = { multi_select: [{ name: e.salaryPeriod }] };
    if (e.datePaid) props["Date Paid"] = { date: { start: e.datePaid } };
    const page = await notion.pages.create({ parent: { database_id: config.expenseDebtDbId }, properties: props });
    res.json({ ok: true, pageId: (page as any).id.replace(/-/g, "") });
  } catch (e: any) {
    res.status(500).json({ error: (e as any).message });
  }
};

export const updateExpense = async (req: NotionRequest, res: Response): Promise<void> => {
  const notion = req.notionClient!;
  try {
    const pageId = req.params.pageId as string;
    const e = req.body;
    const props: any = {};
    if (e.name) props["Name"] = { title: [{ text: { content: e.name } }] };
    if (e.amount !== undefined) props["Number"] = { number: parseFloat(e.amount) || 0 };
    if (e.status) props["Status"] = { status: { name: e.status } };
    if (e.classification) props["Classification "] = { select: { name: e.classification.trim() } };
    if (e.unit !== undefined) props["Unit"] = { rich_text: [{ text: { content: e.unit || "" } }] };
    if (e.salaryPeriod) props["Select"] = { multi_select: [{ name: e.salaryPeriod }] };
    if (e.datePaid) props["Date Paid"] = { date: { start: e.datePaid } };
    const pid = formatPageId(pageId);
    await notion.pages.update({ page_id: pid, properties: props });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: (e as any).message });
  }
};
