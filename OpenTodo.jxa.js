const app = Application.currentApplication();
app.includeStandardAdditions = true;

const todoDir = "/Users/galigali/Documents/Codex/2026-05-14/new-chat";
const todoUrl = "http://127.0.0.1:4173/";

try {
  app.doShellScript(
    `if ! curl -fsS --max-time 1 '${todoUrl}' >/dev/null 2>&1; then ` +
      `cd '${todoDir}' && screen -S todo-workbench -X quit >/dev/null 2>&1 || true; ` +
      `screen -dmS todo-workbench /bin/zsh '${todoDir}/run-todo-server.sh'; sleep 1; ` +
      `fi; ` +
    `open -n -b com.google.Chrome --args --app='${todoUrl}' || ` +
      `open -na 'Google Chrome' --args --app='${todoUrl}' || ` +
      `open -a 'Safari' '${todoUrl}' || ` +
      `open '${todoUrl}'`,
  );
} catch (error) {
  app.displayDialog("没有成功打开 Todo 工作台，请直接打开 OpenTodo.command。");
}
