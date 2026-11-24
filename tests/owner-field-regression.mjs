import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const APP_URL = process.env.TODO_APP_URL || pathToFileURL("/Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html").href;
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");

const storagePayloads = {
  "weekly-reminders:v1": "[]",
  "todo-workbench:v1": "[]",
  "todo-issue-drafts:v1": "[]",
  "todo-memo-items:v1": "[]",
  "todo-projects:v1": "[]",
  "todo-project-items:v1": "[]",
  "todo-lark-calendar-state:v1": "[]",
  "todo-t46-open-events:v1": "[]",
};

function readTodos(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("todo-workbench:v1") || "[]"));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await page.addInitScript((payloads) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(payloads)) localStorage.setItem(key, value);
  }, storagePayloads);

  await page.goto(APP_URL);

  const ownerSelect = page.locator("#ownerInput");
  const ownerCustom = page.locator("#ownerCustomInput");

  assert.equal(await ownerSelect.inputValue(), "我", "负责人默认应为「我」");
  assert.equal(await ownerSelect.isVisible(), true, "默认应显示负责人下拉");
  assert.equal(await ownerCustom.isVisible(), false, "默认不应露出自定义输入框");

  await ownerSelect.selectOption("custom");
  assert.equal(await ownerSelect.isVisible(), false, "选「其他人」后下拉应隐藏");
  assert.equal(await ownerCustom.isVisible(), true, "选「其他人」后输入框应显示");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "ownerCustomInput", "自定义输入框应自动聚焦");

  await page.locator("#todoInput").focus();
  assert.equal(await ownerSelect.inputValue(), "我", "留空失焦后应回到「我」");
  assert.equal(await ownerCustom.isVisible(), false, "留空失焦后输入框应重新隐藏");

  await ownerSelect.selectOption("custom");
  await ownerCustom.fill("笑黎");
  await page.locator("#todoInput").fill("回归测试：负责人自定义");
  await page.locator('#todoForm button[type="submit"]').click();
  const todos = await readTodos(page);
  assert.equal(todos.length, 1, "应新增一条 Todo");
  assert.equal(todos[0].owner, "笑黎", "新 Todo 的负责人应为输入的名字");

  assert.equal(await ownerSelect.inputValue(), "我", "提交后负责人应回到「我」");
  assert.equal(await ownerSelect.isVisible(), true, "提交后应恢复显示负责人下拉");
  assert.equal(await ownerCustom.isVisible(), false, "提交后自定义输入框应隐藏");

  await page.locator("#todoInput").fill("回归测试：负责人为我");
  await page.locator('#todoForm button[type="submit"]').click();
  const after = await readTodos(page);
  assert.equal(after.length, 2, "应再新增一条 Todo");
  const selfTodo = after.find((todo) => todo.title === "回归测试：负责人为我");
  assert.equal(selfTodo?.owner, "我", "默认「我」时负责人应为「我」");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
