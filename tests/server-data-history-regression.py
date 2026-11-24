import importlib.util
import json
import tempfile
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


APP_ROOT = Path("/Users/galigali/Documents/Codex/2026-05-14/new-chat")
spec = importlib.util.spec_from_file_location("todo_server", APP_ROOT / "todo_server.py")
todo_server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(todo_server)


def post_json(url, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        assert response.status == 200
        return json.loads(response.read().decode("utf-8"))


with tempfile.TemporaryDirectory() as temp_dir:
    root = Path(temp_dir)
    todo_server.ROOT = str(root)
    todo_server.DATA_FILE = str(root / ".todo-data.json")
    todo_server.DATA_HISTORY_DIR = str(root / ".todo-data-history")
    server = todo_server.ThreadingHTTPServer(("127.0.0.1", 0), todo_server.TodoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        url = f"http://127.0.0.1:{server.server_port}/api/data"
        first = {"todos": [{"id": "first", "title": "第一版"}]}
        first_result = post_json(url, first)
        second = {
            "todos": [{"id": "first", "title": "第一版"}, {"id": "second", "title": "第二版"}],
            "baseSavedAt": first_result["savedAt"],
        }
        second_result = post_json(url, second)

        history_files = list((root / ".todo-data-history").glob("*.json"))
        assert len(history_files) == 1, "覆盖数据前应自动保留上一版本"
        archived = json.loads(history_files[0].read_text(encoding="utf-8"))
        assert archived["todos"][0]["title"] == "第一版"

        stale = {
            "todos": [{"id": "first", "title": "第一版"}, {"id": "stale-addition", "title": "旧窗口新增"}],
            "baseSavedAt": first_result["savedAt"],
        }
        stale_result = post_json(url, stale)
        assert stale_result["merged"] is True, "旧窗口保存时应走冲突合并，不能整包覆盖"
        current = json.loads((root / ".todo-data.json").read_text(encoding="utf-8"))
        assert {item["id"] for item in current["todos"]} == {"first", "second", "stale-addition"}

        shared_revision = stale_result["savedAt"]
        concurrent_payloads = [
            {
                "todos": current["todos"] + [{"id": f"concurrent-{index}", "title": f"并发新增 {index}"}],
                "baseSavedAt": shared_revision,
            }
            for index in range(8)
        ]
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda payload: post_json(url, payload), concurrent_payloads))

        final_data = json.loads((root / ".todo-data.json").read_text(encoding="utf-8"))
        final_ids = {item["id"] for item in final_data["todos"]}
        assert {f"concurrent-{index}" for index in range(8)}.issubset(final_ids), "并发新增不能互相覆盖"
        for history_file in (root / ".todo-data-history").glob("*.json"):
            json.loads(history_file.read_text(encoding="utf-8"))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
