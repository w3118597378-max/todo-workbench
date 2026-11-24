import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join } from "node:path";

const APP_ROOT = "/Users/galigali/Documents/Codex/2026-05-14/new-chat";
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");
const today = new Date().toLocaleDateString("en-CA");
const originalUpdatedAt = "2026-10-15T00:00:00.000Z";
const posts = [];

const serverState = {
  todos: [{
    id: "completion-regression",
    title: "完成状态不能被旧窗口覆盖",
    status: "未开始",
    date: today,
    owner: "我",
    module: "技术需求",
    createdAt: originalUpdatedAt,
    updatedAt: originalUpdatedAt,
  }],
  reminders: [],
  issueDrafts: [],
  memoItems: [],
  projects: [],
  projectItems: [],
  larkCalendarRecords: [],
  t46OpenEvents: [],
  savedAt: "revision-before-completion",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/api/data" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(serverState));
    return;
  }
  if (url.pathname === "/api/data" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    posts.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, savedAt: `revision-${posts.length}`, merged: false }));
    return;
  }
  if (url.pathname === "/api/lark-calendar/today") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"ok":true,"events":[]}');
    return;
  }
  const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  try {
    const body = await readFile(join(APP_ROOT, relativePath));
    response.writeHead(200, { "Content-Type": contentTypes[extname(relativePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
  await page.locator('.todo-card[data-id="completion-regression"] [data-todo-action="done"]').click();
  await page.waitForTimeout(400);
  assert.equal(posts.length, 1, "点击完成应保存一次");
  const savedTodo = posts[0].todos.find((todo) => todo.id === "completion-regression");
  assert.equal(savedTodo.status, "已完成");
  assert.ok(savedTodo.updatedAt > originalUpdatedAt, "点击完成必须更新时间，才能在冲突合并时胜过旧状态");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
