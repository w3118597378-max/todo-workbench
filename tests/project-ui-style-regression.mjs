import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const APP_URL = process.env.TODO_APP_URL || pathToFileURL("/Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html").href;
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");

const now = "2026-09-17T00:00:00.000Z";
const storagePayloads = {
  "todo-workbench:v1": JSON.stringify([
    {
      id: "todo-project-ui",
      title: "确认活动物料",
      status: "未开始",
      projectId: "project-green",
      date: "2026-09-18",
      owner: "我",
      module: "运营",
      notes: "核对打印数量",
      createdAt: now,
      updatedAt: now,
    },
  ]),
  "weekly-reminders:v1": "[]",
  "todo-issue-drafts:v1": "[]",
  "todo-memo-items:v1": "[]",
  "todo-lark-calendar-state:v1": "[]",
  "todo-t46-open-events:v1": "[]",
  "todo-projects:v1": JSON.stringify([
    {
      id: "project-green",
      name: "自动补位",
      type: "技术需求",
      status: "推进中",
      owner: "我",
      nextStep: "确认补位规则",
      color: "#49b979",
      createdAt: now,
      updatedAt: "2026-09-17T02:00:00.000Z",
    },
    {
      id: "project-blue",
      name: "活动报名优化",
      type: "运营项目",
      status: "推进中",
      owner: "我",
      nextStep: "梳理报名流程",
      color: "#55aaf2",
      createdAt: now,
      updatedAt: "2026-09-17T01:00:00.000Z",
    },
  ]),
  "todo-project-items:v1": JSON.stringify([
    {
      id: "material-ui",
      projectId: "project-green",
      title: "规则资料",
      body: "整理现有规则与会议结论",
      kind: "material",
      status: "资料",
      owner: "我",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "breakdown-ui",
      projectId: "project-green",
      title: "确认边界情况",
      body: "需要继续拆解",
      kind: "breakdown",
      status: "待拆",
      owner: "我",
      createdAt: now,
      updatedAt: now,
    },
  ]),
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await page.addInitScript((payloads) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(payloads)) localStorage.setItem(key, value);
  }, storagePayloads);

  await page.goto(APP_URL);
  await page.getByRole("button", { name: "项目跟进" }).click();
  await page.locator(".project-card").first().waitFor();
  assert.equal(await page.locator("#workCalendarView").evaluate((el) => getComputedStyle(el).display), "none", "work calendar must stay hidden on the project tab");
  assert.equal(await page.locator('#projectDetail [data-project-field="nextStep"]').count(), 0, "project detail should not render the next-step editor");

  const cardStyles = await page.locator(".project-card").evaluateAll((cards) => cards.map((card) => {
    const style = getComputedStyle(card);
    return { background: style.backgroundColor, leftBorder: style.borderLeftColor };
  }));
  assert.equal(cardStyles.length, 2);
  assert.notEqual(cardStyles[0].background, cardStyles[1].background, "project cards should use distinct tinted backgrounds");
  assert.notEqual(cardStyles[0].leftBorder, cardStyles[1].leftBorder, "project cards should use their project color rail");

  const sectionStyles = await page.locator(".project-flow-section").evaluateAll((sections) => sections.map((section) => ({
    key: section.dataset.projectSection,
    background: getComputedStyle(section).backgroundColor,
  })));
  const backgrounds = new Map(sectionStyles.map((item) => [item.key, item.background]));
  assert.equal(new Set(backgrounds.values()).size, 3, "materials, breakdown and todos need distinct section surfaces");
  assert.notEqual(backgrounds.get("materials"), await page.locator("#projectDetail").evaluate((el) => getComputedStyle(el).backgroundColor));
  assert.ok(await page.locator('#projectDetail [data-project-field="name"]').evaluate((el) => el.getBoundingClientRect().width >= 200), "project name field should receive enough desktop width");

  await page.setViewportSize({ width: 720, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "narrow project view should not overflow horizontally");
  assert.equal(await page.locator(".project-dashboard").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length), 1);

  await page.setViewportSize({ width: 480, height: 820 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "mobile project view should not overflow horizontally");
  assert.equal(await page.locator("#projectDetail > .detail-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length), 1);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
