const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Notion ───
let notion = null;
let TASKS_DB = "2dbbf02b-7870-8054-afe4-000bef3847f5";
let DAILY_DB = "2dbbf02b-7870-81a7-8edf-000bea950a5a";
let EXPENSE_DB = "2f4bf02b-7870-80c4-a28c-000b8c87713a";
let WK_EXP_DB = "";

// Helper: map app status → Notion status
const statusMap = { "Not started":"Not started","In progress":"In progress","Done":"Done","Missed":"Missed","Paused":"Paused","Deferred":"Deffered","Deffered":"Deffered" };
const mapStatus = s => statusMap[s] || s;

// Helper: strip collection:// prefix and clean DB ID
const cleanDbId = (id) => (id || "").replace("collection://","").trim();

// Helper: query a Notion database (v5 uses dataSources.query instead of databases.query)
const queryDb = async (dbId, opts = {}) => {
  const args = { data_source_id: dbId, page_size: opts.page_size || 100 };
  if (opts.start_cursor) args.start_cursor = opts.start_cursor;
  return notion.dataSources.query(args);
};

// ─── Config endpoint ───
app.post("/api/config", (req, res) => {
  const { notionToken, tasksDb, dailyDb, expenseDb, wkExpDb } = req.body;
  if (notionToken) {
    notion = new Client({ auth: notionToken });
    console.log("✓ Notion client configured");
  }
  if (tasksDb) TASKS_DB = cleanDbId(tasksDb);
  if (dailyDb) DAILY_DB = cleanDbId(dailyDb);
  if (expenseDb) EXPENSE_DB = cleanDbId(expenseDb);
  if (wkExpDb) WK_EXP_DB = cleanDbId(wkExpDb);
  res.json({ ok: true, hasNotion: !!notion });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasNotion: !!notion, hasCalendar: !!calendarClient });
});

// ─── Test each database by actually querying Notion ───
app.post("/api/test-dbs", async (req, res) => {
  if (!notion) return res.status(400).json({ ok: false, error: "No Notion token configured. Enter your integration token first." });

  const dbs = {
    tasks: TASKS_DB,
    daily: DAILY_DB,
    expense: EXPENSE_DB,
    wkExp: WK_EXP_DB,
  };

  const results = {};
  const errors = {};

  for (const [key, dbId] of Object.entries(dbs)) {
    if (!dbId) {
      results[key] = "empty";
      continue;
    }
    try {
      // Retrieve database metadata — confirms token + DB ID + access are all valid
      const db = await notion.databases.retrieve({ database_id: dbId });
      results[key] = "ok";
      console.log(`✓ ${key} DB (${dbId}): "${db.title?.[0]?.plain_text || 'Untitled'}" accessible`);
    } catch (e) {
      results[key] = "failed";
      errors[key] = e.message;
      console.error(`✗ ${key} DB (${dbId}): ${e.message}`);
    }
  }

  const allTested = Object.values(results).filter(v => v !== "empty");
  const allOk = allTested.length > 0 && allTested.every(v => v === "ok");

  res.json({ ok: true, results, errors, allOk });
});

// ─── Create Task ───
app.post("/api/tasks", async (req, res) => {
  if (!notion) return res.status(400).json({ error: "No Notion token configured" });
  try {
    const t = req.body;
    const props = {
      "Task name": { title: [{ text: { content: t.name || "Untitled" } }] },
      "Status": { status: { name: mapStatus(t.status || "Not started") } },
    };
    if (t.priority) props["Priority"] = { select: { name: t.priority } };
    if (t.type) props["Type"] = { select: { name: t.type } };
    if (t.impactPoints) props["Impact Points"] = { number: parseFloat(t.impactPoints) || 0 };
    if (t.effortLevel) props["Effort level"] = { select: { name: t.effortLevel } };
    if (t.dueDate) props["Due date"] = { date: { start: t.dueDate } };
    if (t.taskType) {
      const types = t.taskType.split(",").map(x => x.trim()).filter(Boolean);
      props["Task type"] = { multi_select: types.map(name => ({ name })) };
    }
    const page = await notion.pages.create({ parent: { database_id: TASKS_DB }, properties: props });
    console.log("✓ Created task:", t.name, "→", page.id);
    res.json({ ok: true, pageId: page.id.replace(/-/g, "") });
  } catch (e) {
    console.error("✗ Create task error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Update Task ───
app.patch("/api/tasks/:pageId", async (req, res) => {
  if (!notion) return res.status(400).json({ error: "No Notion token configured" });
  try {
    const { pageId } = req.params;
    const t = req.body;
    const props = {};
    if (t.name) props["Task name"] = { title: [{ text: { content: t.name } }] };
    if (t.status) props["Status"] = { status: { name: mapStatus(t.status) } };
    if (t.priority) props["Priority"] = { select: { name: t.priority } };
    if (t.type) props["Type"] = { select: { name: t.type } };
    if (t.taskType) {
      const types = t.taskType.split(",").map(x => x.trim()).filter(Boolean);
      props["Task type"] = { multi_select: types.map(name => ({ name })) };
    }
    if (t.impactPoints !== undefined) props["Impact Points"] = { number: parseFloat(t.impactPoints) || 0 };
    if (t.effortLevel) props["Effort level"] = { select: { name: t.effortLevel } };
    if (t.dueDate) props["Due date"] = { date: { start: t.dueDate } };
    if (t.resultSatisfaction) props["Result Satisfaction"] = { select: { name: t.resultSatisfaction } };
    if (t.noiseFactor !== undefined) props["Noise Factor"] = { number: parseFloat(t.noiseFactor) || 0 };
    if (t.hrs !== undefined) props["hrs"] = { number: parseFloat(t.hrs) || 0 };
    if (t.score !== undefined) props["End of Day Score"] = { number: parseFloat(t.score) || 0 };
    const pid = pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    await notion.pages.update({ page_id: pid, properties: props });
    console.log("✓ Updated task:", pid);
    res.json({ ok: true });
  } catch (e) {
    console.error("✗ Update task error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Create Expense ───
app.post("/api/expenses", async (req, res) => {
  if (!notion) return res.status(400).json({ error: "No Notion token configured" });
  try {
    const e = req.body;
    const props = {
      "Name": { title: [{ text: { content: e.name || "Expense" } }] },
      "Number": { number: parseFloat(e.amount) || 0 },
      "Status": { status: { name: e.status || "Not Paid" } },
      "Classification ": { select: { name: (e.classification || "Family").trim() } },
    };
    if (e.unit) props["Unit"] = { rich_text: [{ text: { content: e.unit } }] };
    if (e.salaryPeriod) props["Select"] = { multi_select: [{ name: e.salaryPeriod }] };
    if (e.datePaid) props["Date Paid"] = { date: { start: e.datePaid } };
    const page = await notion.pages.create({ parent: { database_id: EXPENSE_DB }, properties: props });
    console.log("✓ Created expense:", e.name, "→", page.id);
    res.json({ ok: true, pageId: page.id.replace(/-/g, "") });
  } catch (e2) {
    console.error("✗ Create expense error:", e2.message);
    res.status(500).json({ error: e2.message });
  }
});

// ─── Update Expense ───
app.patch("/api/expenses/:pageId", async (req, res) => {
  if (!notion) return res.status(400).json({ error: "No Notion token configured" });
  try {
    const { pageId } = req.params;
    const e = req.body;
    const props = {};
    if (e.name) props["Name"] = { title: [{ text: { content: e.name } }] };
    if (e.amount !== undefined) props["Number"] = { number: parseFloat(e.amount) || 0 };
    if (e.status) props["Status"] = { status: { name: e.status } };
    if (e.classification) props["Classification "] = { select: { name: e.classification.trim() } };
    if (e.unit !== undefined) props["Unit"] = { rich_text: [{ text: { content: e.unit || "" } }] };
    if (e.salaryPeriod) props["Select"] = { multi_select: [{ name: e.salaryPeriod }] };
    if (e.datePaid) props["Date Paid"] = { date: { start: e.datePaid } };
    const pid = pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    await notion.pages.update({ page_id: pid, properties: props });
    console.log("✓ Updated expense:", pid);
    res.json({ ok: true });
  } catch (e2) {
    console.error("✗ Update expense error:", e2.message);
    res.status(500).json({ error: e2.message });
  }
});

// ─── Full Sync (read all from Notion) ───
app.post("/api/sync", async (req, res) => {
  if (!notion) return res.status(400).json({ error: "No Notion token configured" });
  try {
    const result = { tasks: [], days: {}, expenses: [] };

    // Fetch all tasks
    let hasMore = true, startCursor = undefined;
    while (hasMore) {
      const r = await queryDb(TASKS_DB, { start_cursor: startCursor, page_size: 100 });
      for (const p of r.results) {
        const pr = p.properties;
        const getName = prop => (prop?.title || []).map(t => t.plain_text).join("") || "";
        const getSel = prop => prop?.select?.name || "";
        const getMulti = prop => (prop?.multi_select || []).map(s => s.name).join(", ");
        const getNum = prop => prop?.number ?? "";
        const getDate = prop => prop?.date?.start || "";
        const getStat = prop => prop?.status?.name || "";
        const status = getStat(pr["Status"]);
        const dueDate = getDate(pr["Due date"]);
        // If task is Done, set completedOn to dueDate so day metrics work
        const completedOn = status === "Done" ? dueDate : "";
        result.tasks.push({
          id: "nt" + p.id.replace(/-/g, ""),
          name: getName(pr["Task name"]),
          status,
          priority: getSel(pr["Priority"]),
          type: getSel(pr["Type"]),
          taskType: getMulti(pr["Task type"]),
          impactPoints: String(getNum(pr["Impact Points"]) || ""),
          effortLevel: getSel(pr["Effort level"]),
          dueDate,
          completedOn,
          hrs: String(getNum(pr["hrs"]) || ""),
          noiseFactor: String(getNum(pr["Noise Factor"]) || ""),
          description: "",
          resultSatisfaction: getSel(pr["Result Satisfaction"]),
          score: getNum(pr["End of Day Score"]) || 0,
          notionPageId: p.id.replace(/-/g, ""),
        });
      }
      hasMore = r.has_more;
      startCursor = r.next_cursor;
    }

    // Fetch all daily records
    hasMore = true; startCursor = undefined;
    while (hasMore) {
      const r = await queryDb(DAILY_DB, { start_cursor: startCursor, page_size: 100 });
      for (const p of r.results) {
        const pr = p.properties;
        const getDate = prop => prop?.date?.start || "";
        const getNum = prop => prop?.number ?? 0;
        const getStat = prop => prop?.status?.name || "";
        const sm = v => v === "Done" ? "done" : v === "Missed" ? "missed" : "ns";
        const fmtT = v => { if (!v && v !== 0) return ""; const n = parseFloat(v); if (isNaN(n)) return ""; return String(Math.floor(n)).padStart(2, "0") + ":" + String(Math.round((n % 1) * 60)).padStart(2, "0"); };
        const key = getDate(pr["Date"]);
        if (!key) continue;
        const dateKey = key.split("T")[0];
        const day = {
          date: dateKey,
          exercise: sm(getStat(pr["Exercise"])),
          sleep: sm(getStat(pr["Sleep"])),
          calendar: sm(getStat(pr["Update Calendar"])),
          scheduling: sm(getStat(pr["Next Day-Scheduling"])),
          docPrep: sm(getStat(pr["Next-Day Document Prep"])),
          wakeUp: fmtT(getNum(pr["Wake-Up Time [24hrs]"])),
          sleepTime: fmtT(getNum(pr["Sleep Time [24hrs]"])),
          spendLog: [],
          noiseLog: [],
          reviewed: false,
          notionPageId: p.id.replace(/-/g, ""),
          // Pre-computed metrics from Notion (source of truth)
          notionMetrics: {
            totalTasks: getNum(pr["Total Tasks"]) || 0,
            tasksDone: getNum(pr["Tasks Done"]) || 0,
            impactExpected: getNum(pr["Days Imapct Score"]) || getNum(pr["Days Impact Score"]) || 0,
            impactAchieved: getNum(pr["Achieved Impact Score"]) || getNum(pr["Achieved Imapct Score"]) || 0,
            snr: getNum(pr["SNR"]) || 0,
            signalScore: getNum(pr["Signal Score [Score]"]) || 0,
            noiseScore: getNum(pr["Noise Score [Score]"]) || 0,
            noiseHrs: getNum(pr["Noise Time[hrs]"]) || 0,
            awakeTime: getNum(pr["Awake Time"]) || 0,
            distractedPct: getNum(pr["Distracted Time"]) || 0,
            spend: getNum(pr["Spend (NGN)"]) || 0,
          },
        };
        const noise = getNum(pr["Noise Time[hrs]"]);
        if (noise > 0) day.noiseLog = [{ id: "nn" + Date.now() + Math.random(), type: "Imported", hours: Math.floor(noise), minutes: Math.round((noise % 1) * 60) }];
        const spend = getNum(pr["Spend (NGN)"]);
        if (spend > 0) day.spendLog = [{ id: "ns" + Date.now() + Math.random(), amount: spend, note: "Notion import", category: "Other", time: "—" }];
        result.days[dateKey] = day;
      }
      hasMore = r.has_more;
      startCursor = r.next_cursor;
    }

    // Fetch all expenses
    hasMore = true; startCursor = undefined;
    while (hasMore) {
      const r = await queryDb(EXPENSE_DB, { start_cursor: startCursor, page_size: 100 });
      for (const p of r.results) {
        const pr = p.properties;
        const getName = prop => (prop?.title || []).map(t => t.plain_text).join("") || "";
        const getSel = prop => prop?.select?.name || "";
        const getMulti = prop => (prop?.multi_select || []).map(s => s.name);
        const getNum = prop => prop?.number ?? 0;
        const getDate = prop => prop?.date?.start || "";
        const getStat = prop => prop?.status?.name || "";
        const getRich = prop => (prop?.rich_text || []).map(t => t.plain_text).join("") || "";
        result.expenses.push({
          id: "ne" + p.id.replace(/-/g, ""),
          name: getName(pr["Name"]),
          amount: String(getNum(pr["Number"]) || 0),
          status: getStat(pr["Status"]),
          classification: (getSel(pr["Classification "]) || "Family").trim(),
          salaryPeriod: (getMulti(pr["Select"]) || [])[0] || "",
          datePaid: getDate(pr["Date Paid"]),
          unit: getRich(pr["Unit"]),
          parentId: "",
          recurring: false,
          notionPageId: p.id.replace(/-/g, ""),
        });
      }
      hasMore = r.has_more;
      startCursor = r.next_cursor;
    }

    console.log(`✓ Full sync: ${result.tasks.length} tasks, ${Object.keys(result.days).length} days, ${result.expenses.length} expenses`);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("✗ Sync error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Google Calendar ───
let calendarClient = null;
let calendarId = "primary";

app.post("/api/calendar/config", (req, res) => {
  const { apiKey, calId } = req.body;
  if (apiKey) {
    const calendar = google.calendar({ version: "v3", auth: apiKey });
    calendarClient = calendar;
    console.log("✓ Google Calendar configured");
  }
  if (calId) calendarId = calId;
  res.json({ ok: true, hasCalendar: !!calendarClient });
});

app.get("/api/calendar/events", async (req, res) => {
  if (!calendarClient) return res.status(400).json({ error: "No Google Calendar API key configured" });
  try {
    const { timeMin, timeMax } = req.query;
    const now = new Date();
    const response = await calendarClient.events.list({
      calendarId,
      timeMin: timeMin || now.toISOString(),
      timeMax: timeMax || new Date(now.getTime() + 7 * 86400000).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });
    const events = (response.data.items || []).map(e => ({
      id: e.id,
      title: e.summary || "",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      allDay: !e.start?.dateTime,
      location: e.location || "",
      description: e.description || "",
    }));
    res.json({ ok: true, events });
  } catch (e) {
    console.error("✗ Calendar error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Start ───
const PORT = 3456;
app.listen(PORT, () => {
  console.log(`\n🚀 Proxy server running on http://localhost:${PORT}`);
  console.log("   POST /api/config          — set Notion token + DB IDs");
  console.log("   POST /api/test-dbs        — test each DB connection");
  console.log("   POST /api/sync            — full Notion sync");
  console.log("   POST /api/tasks           — create task");
  console.log("   PATCH /api/tasks/:id      — update task");
  console.log("   POST /api/expenses        — create expense");
  console.log("   PATCH /api/expenses/:id   — update expense");
  console.log("   GET  /api/calendar/events — get calendar events\n");
});
