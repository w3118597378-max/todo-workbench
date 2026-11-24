import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const APP_URL = pathToFileURL("/Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html").href;
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");

const todos = [
  { id: "important-first", title: "重要推进一", priority: "重要推进", sortOrder: 1000 },
  { id: "must-first", title: "今天必须一", priority: "今天必须", sortOrder: 2000 },
  { id: "important-second", title: "重要推进二", priority: "重要推进", sortOrder: 3000 },
  { id: "must-second", title: "今天必须二", priority: "今天必须", sortOrder: 8000 },
].map((todo, index) => ({
  ...todo,
  date: "",
  module: "运营",
  owner: "我",
  status: "未开始",
  notes: "",
  ideas: "",
  screenshots: [],
  createdAt: `2026-10-08T0${index}:00:00.000Z`,
}));

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await page.addInitScript((seedTodos) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    localStorage.clear();
    localStorage.setItem("todo-workbench:v1", JSON.stringify(seedTodos.map((todo) => ({ ...todo, date: today }))));
    localStorage.setItem("weekly-reminders:v1", "[]");
    localStorage.setItem("todo-issue-drafts:v1", "[]");
    localStorage.setItem("todo-memo-items:v1", "[]");
    localStorage.setItem("todo-projects:v1", "[]");
    localStorage.setItem("todo-project-items:v1", "[]");
    localStorage.setItem("todo-lark-calendar-state:v1", "[]");
    localStorage.setItem("todo-t46-open-events:v1", "[]");
  }, todos);

  try {
    await page.goto(APP_URL);
    const nowSection = page.locator(".todo-priority-section").filter({ hasText: "现在优先做" });
    const titles = await nowSection.locator(".todo-title").allTextContents();
    assert.deepEqual(titles, ["今天必须一", "今天必须二", "重要推进一", "重要推进二"]);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
