import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const APP_URL = process.env.TODO_APP_URL || pathToFileURL("/Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html").href;
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");

const storagePayloads = {
  "todo-workbench:v1": JSON.stringify([
    {
      id: "todo-stage-move",
      title: "阶段迁移验证",
      status: "未开始",
      projectId: "project-calendar-sync",
      stageId: "stage-0",
      date: "2026-09-21",
      owner: "我",
      module: "运营",
      notes: "",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    },
  ]),
  "weekly-reminders:v1": "[]",
  "todo-issue-drafts:v1": "[]",
  "todo-memo-items:v1": "[]",
  "todo-project-items:v1": "[]",
  "todo-lark-calendar-state:v1": "[]",
  "todo-projects:v1": JSON.stringify([
    {
      id: "project-calendar-sync",
      name: "日历同步项目",
      type: "运营项目",
      status: "推进中",
      owner: "我",
      nextStep: "确认项目能在日历里看到",
      color: "#93d9a3",
      date: "2026-09-20",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    },
  ]),
  "todo-t46-open-events:v1": JSON.stringify([
    {
      id: "t46-event-1",
      name: "盲盒酒局(上海) - 9/20",
      city: "上海",
      time: "20:30",
      date: "2026-09-20",
      eventType: "bar",
      syncedAt: "2026-09-15T00:00:00.000Z",
    },
    {
      id: "t46-event-2",
      name: "盲盒酒局(北京) - 9/20",
      city: "北京",
      time: "20:30",
      date: "2026-09-20",
      eventType: "bar",
      syncedAt: "2026-09-15T00:00:00.000Z",
    },
  ]),
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.addInitScript((payloads) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(payloads)) {
      localStorage.setItem(key, value);
    }
  }, storagePayloads);

  await page.goto(APP_URL);
  await page.getByRole("button", { name: "工作日历" }).click();
  await page.getByRole("button", { name: "日历视角" }).click();
  await page.locator("#calendarMonthInput").fill("2026-09");
  await page.locator("#calendarMonthInput").dispatchEvent("change");

  await page.locator(".calendar-project-date-card").filter({ hasText: "日历同步项目" }).first().waitFor({ timeout: 1200 });
  await page.locator(".calendar-activity-card").filter({ hasText: "盲盒酒局" }).first().waitFor({ timeout: 1200 });

  const activityCards = page.locator(".calendar-activity-card");
  assert.equal(await activityCards.count(), 1);
  const firstDayCardClass = await page.locator(".calendar-day-nodes").first().locator(":scope > article").first().getAttribute("class");
  assert.match(firstDayCardClass || "", /calendar-activity-card/);
  const activityCard = activityCards.first();
  assert.equal(await activityCard.getAttribute("data-activity-type"), "bar");
  assert.match(await activityCard.textContent(), /2 城市/);
  assert.doesNotMatch(await activityCard.textContent(), /上海/);

  await activityCard.click();
  await page.locator("#calendarNodeDetail").filter({ hasText: "上海" }).waitFor({ timeout: 1200 });
  await page.locator("#calendarNodeDetail").filter({ hasText: "北京" }).waitFor({ timeout: 1200 });

  await page.getByRole("button", { name: "阶段视角" }).click();
  await page.locator(".calendar-stage-column").filter({ hasText: "时间节点" }).waitFor({ timeout: 1200 });

  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /新阶段名称/);
    await dialog.accept("招募排期");
  });
  await page.locator('button[data-calendar-action="add-stage"]').click();
  await page.locator(".calendar-stage-column").filter({ hasText: "招募排期" }).waitFor({ timeout: 1200 });

  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /阶段名称/);
    await dialog.accept("招募排期改");
  });
  await page.locator(".calendar-stage-column").filter({ hasText: "招募排期" }).locator('button[data-calendar-action="rename-stage"]').click();
  const renamedStage = page.locator(".calendar-stage-column").filter({ hasText: "招募排期改" });
  await renamedStage.waitFor({ timeout: 1200 });

  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /阶段迁移验证|节点会移动/);
    await dialog.accept();
  });
  await page.locator(".calendar-stage-column").filter({ hasText: "时间节点" }).locator('button[data-calendar-action="delete-stage"]').click();
  await page.locator(".calendar-stage-head h3").filter({ hasText: "时间节点" }).waitFor({ state: "detached", timeout: 1200 });
  assert.match(await renamedStage.textContent(), /阶段迁移验证/);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
