import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const APP_URL = pathToFileURL("/Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html").href;
const require = createRequire(`${process.cwd()}/`);
const { chromium } = require("playwright");
const now = "2026-09-23T08:00:00.000Z";

const storagePayloads = {
  "weekly-reminders:v1": "[]",
  "todo-issue-drafts:v1": "[]",
  "todo-memo-items:v1": "[]",
  "todo-lark-calendar-state:v1": "[]",
  "todo-t46-open-events:v1": "[]",
  "todo-projects:v1": JSON.stringify([
    {
      id: "project-archive-me",
      name: "待归档项目",
      type: "运营项目",
      status: "推进中",
      owner: "我",
      color: "#f8d66d",
      stages: [{ id: "stage-a", name: "准备", order: 0 }],
      createdAt: now,
      updatedAt: "2026-09-23T10:00:00.000Z",
    },
    {
      id: "project-keep",
      name: "保留项目",
      type: "技术需求",
      status: "推进中",
      owner: "我",
      color: "#93d9a3",
      stages: [{ id: "stage-b", name: "执行", order: 0 }],
      createdAt: now,
      updatedAt: "2026-09-23T09:00:00.000Z",
    },
  ]),
  "todo-project-items:v1": JSON.stringify([
    {
      id: "archive-material",
      projectId: "project-archive-me",
      title: "项目资料",
      body: "归档后仍可回顾",
      kind: "material",
      status: "资料",
      owner: "我",
      createdAt: now,
      updatedAt: now,
    },
  ]),
  "todo-workbench:v1": JSON.stringify([
    {
      id: "archive-node",
      title: "归档项目节点",
      projectId: "project-archive-me",
      stageId: "stage-a",
      status: "未开始",
      date: "2026-09-25",
      owner: "我",
      module: "运营",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "keep-node",
      title: "保留项目节点",
      projectId: "project-keep",
      stageId: "stage-b",
      status: "未开始",
      date: "2026-09-26",
      owner: "我",
      module: "技术",
      createdAt: now,
      updatedAt: now,
    },
  ]),
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
  await page.addInitScript((payloads) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(payloads)) localStorage.setItem(key, value);
  }, storagePayloads);

  try {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "项目跟进" }).click();
    const archiveCard = page.locator(".project-card").filter({ hasText: "待归档项目" });
    const archiveButton = archiveCard.getByRole("button", { name: "归档", exact: true });
    await archiveButton.waitFor();

    page.once("dialog", async (dialog) => {
      assert.match(dialog.message(), /完成并归档/);
      await dialog.accept();
    });
    await archiveButton.click();

    assert.equal(await page.locator(".project-card").filter({ hasText: "待归档项目" }).count(), 0);
    assert.equal(await page.locator(".project-card").filter({ hasText: "保留项目" }).count(), 1);
    const projects = await page.evaluate(() => JSON.parse(localStorage.getItem("todo-projects:v1") || "[]"));
    const archived = projects.find((project) => project.id === "project-archive-me");
    assert.equal(archived.status, "已归档");
    assert.match(archived.archivedAt || "", /^\d{4}-\d{2}-\d{2}T/);

    await page.getByRole("button", { name: "工作日历" }).click();
    assert.equal(await page.locator(".calendar-project-card").filter({ hasText: "待归档项目" }).count(), 0);
    assert.equal(await page.locator(".calendar-project-card").filter({ hasText: "保留项目" }).count(), 1);
    assert.equal(await page.locator("#calendarProjectFilter option").filter({ hasText: "待归档项目" }).count(), 0);

    const projectPanelBox = await page.locator(".calendar-project-panel").boundingBox();
    const workspaceBox = await page.locator(".calendar-workspace").boundingBox();
    assert.ok(projectPanelBox.x > workspaceBox.x, "项目卡片栏应位于日历工作区右侧");
    assert.equal(await page.locator(".calendar-project-panel").evaluate((el) => getComputedStyle(el).position), "sticky", "项目栏应固定在右侧");
    assert.equal(await page.locator(".calendar-project-cards").evaluate((el) => getComputedStyle(el).overflowY), "auto", "项目卡片列表应独立滚动");
    await page.locator(".calendar-main").evaluate((el) => { el.style.minHeight = "1800px"; });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(100);
    const stickyPanelBox = await page.locator(".calendar-project-panel").boundingBox();
    assert.ok(stickyPanelBox.y >= 140 && stickyPanelBox.y <= 152, "页面滚动后项目栏仍应固定在视口右侧");
    await page.evaluate(() => window.scrollTo(0, 0));

    const mainBox = await page.locator(".calendar-main").boundingBox();
    assert.ok(mainBox.width / workspaceBox.width > 0.85, "删除中间栏后，日历主视图应占满左侧工作区");
    assert.equal(await page.locator("#calendarNodeDetail").isVisible(), false, "未选择节点时不应显示详情占位栏");

    await page.locator(".calendar-node-card").filter({ hasText: "保留项目节点" }).click();
    const detailBox = await page.locator("#calendarNodeDetail").boundingBox();
    const updatedMainBox = await page.locator(".calendar-main").boundingBox();
    assert.ok(detailBox.y >= updatedMainBox.y + updatedMainBox.height, "节点详情应在左侧主视图下方展开");

    assert.equal(await page.locator('button[data-calendar-action="new-node"]').count(), 0, "阶段视角不应显示新增节点");
    assert.equal(await page.locator('button[data-calendar-action="add-stage-node"]').count(), 0, "阶段列不应显示新增节点");
    await page.getByRole("button", { name: "时间线视角" }).click();
    assert.equal(await page.locator('button[data-calendar-action="new-node"]').count(), 1, "时间线视角应保留唯一新增节点入口");

    await page.getByRole("button", { name: "日程回顾" }).click();
    const archivedReview = page.locator("#archivedProjectList");
    await archivedReview.getByText("待归档项目", { exact: true }).waitFor();
    assert.match(await archivedReview.textContent(), /1 个节点/);
    assert.match(await archivedReview.textContent(), /1 项资料/);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
