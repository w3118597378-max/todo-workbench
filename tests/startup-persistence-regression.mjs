import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join } from "node:path";

const APP_ROOT = "/Users/galigali/Documents/Codex/2026-05-14/new-chat";
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");

const staleLocalTodo = {
  id: "stale-local-todo",
  title: "浏览器旧缓存",
  status: "未开始",
  date: "",
  owner: "我",
  module: "运营",
  notes: "这个无日期 Todo 会触发启动迁移。",
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
};

const serverState = {
  todos: [{
    id: "server-current-todo",
    title: "服务器最新数据",
    status: "未开始",
    date: "2026-09-18",
    owner: "我",
    module: "运营",
    notes: "关闭再打开后应该保留这一条。",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
  }],
  reminders: [],
  issueDrafts: [],
  memoItems: [],
  projects: [],
  projectItems: [],
  larkCalendarRecords: [],
  t46OpenEvents: [],
  savedAt: "2026-09-18T00:00:00.000Z",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

async function main() {
  let releaseHydration;
  const hydrationGate = new Promise((resolve) => {
    releaseHydration = resolve;
  });
  const posts = [];

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/data" && request.method === "GET") {
      await hydrationGate;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(serverState));
      return;
    }
    if (url.pathname === "/api/data" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      posts.push(JSON.parse(body));
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"ok":true}');
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
  const { port } = server.address();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.addInitScript((todo) => {
      localStorage.clear();
      localStorage.setItem("todo-workbench:v1", JSON.stringify([todo]));
      localStorage.setItem("weekly-reminders:v1", "[]");
      localStorage.setItem("todo-issue-drafts:v1", "[]");
      localStorage.setItem("todo-memo-items:v1", "[]");
      localStorage.setItem("todo-projects:v1", "[]");
      localStorage.setItem("todo-project-items:v1", "[]");
      localStorage.setItem("todo-lark-calendar-state:v1", "[]");
      localStorage.setItem("todo-t46-open-events:v1", "[]");
    }, staleLocalTodo);

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(450);
    assert.equal(posts.length, 0, "服务器读取完成前，旧浏览器缓存不应回写覆盖数据");

    releaseHydration();
    await page.locator(".todo-title", { hasText: "服务器最新数据" }).first().waitFor({ timeout: 2000 });
    const savedTodos = await page.evaluate(() => JSON.parse(localStorage.getItem("todo-workbench:v1") || "[]"));
    assert.deepEqual(savedTodos.map((todo) => todo.title), ["服务器最新数据"]);

    await page.locator("#todoInput").fill("关闭前最后一次操作");
    await page.locator("#todoForm button[type='submit']").click();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    await page.waitForTimeout(100);
    assert.equal(posts.length, 1, "页面关闭时应立即保存尚在等待中的操作");
    assert.ok(posts[0].todos.some((todo) => todo.title === "关闭前最后一次操作"));
  } finally {
    releaseHydration();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
