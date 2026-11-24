"""Regression: monthly checklist fields + deletedRecords tombstones (server side).
Runs against a temporary data file; never touches the real .todo-data.json."""
import importlib.util, json, tempfile, threading, urllib.request
from pathlib import Path

APP_ROOT = Path("/Users/galigali/Documents/Codex/2026-05-14/new-chat")
spec = importlib.util.spec_from_file_location("todo_server_t", APP_ROOT / "todo_server.py")
ts = importlib.util.module_from_spec(spec); spec.loader.exec_module(ts)
ts.TodoHandler.log_message = lambda *a, **k: None


def call(url, payload=None):
    req = urllib.request.Request(url, data=None if payload is None else json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"},
                                 method="GET" if payload is None else "POST")
    return json.loads(urllib.request.urlopen(req).read())


def ids(data, key):
    return [r["id"] for r in data.get(key, [])]


with tempfile.TemporaryDirectory() as d:
    ts.DATA_FILE = str(Path(d) / "data.json"); ts.DATA_HISTORY_DIR = str(Path(d) / "h")
    srv = ts.ThreadingHTTPServer(("127.0.0.1", 0), ts.TodoHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    u = f"http://127.0.0.1:{srv.server_port}/api/data"
    T0 = "2026-10-01T00:00:00.000Z"
    try:
        # --- monthly checklist ---
        call(u, {"todos": [{"id": "t1", "createdAt": T0}], "issueDrafts": [{"id": "i1", "createdAt": T0}, {"id": "i2", "createdAt": T0}],
                 "monthlyItems": [{"id": "m1", "updatedAt": "1"}],
                 "monthlyChecks": {"2026-10": {"m1": {"done": True, "updatedAt": "2026-10-21T10:00"}}}})
        g = call(u)
        old_page_snapshot = json.loads(json.dumps(g))  # an "old page" that loaded now
        call(u, {"todos": g["todos"], "issueDrafts": g["issueDrafts"], "baseSavedAt": g["savedAt"]})  # no monthly keys
        g = call(u)
        assert ids(g, "monthlyItems") == ["m1"] and g["monthlyChecks"]["2026-10"]["m1"]["done"], "monthly kept"
        call(u, {"monthlyItems": [{"id": "m2", "updatedAt": "1"}],
                 "monthlyChecks": {"2026-10": {"m1": {"done": False, "updatedAt": "2026-10-20"}}}, "baseSavedAt": "stale"})
        g = call(u)
        assert set(ids(g, "monthlyItems")) == {"m1", "m2"} and g["monthlyChecks"]["2026-10"]["m1"]["done"] is True, "monthly merge"

        # --- 1. delete via direct replace -> server records tombstone automatically ---
        call(u, {**g, "issueDrafts": [r for r in g["issueDrafts"] if r["id"] != "i1"], "baseSavedAt": g["savedAt"]})
        g = call(u)
        assert ids(g, "issueDrafts") == ["i2"] and "i1" in g["deletedRecords"]["issueDrafts"], "auto tombstone"

        # --- 2. old page (stale base, no deletedRecords) saves -> record stays deleted ---
        stale = {k: v for k, v in old_page_snapshot.items() if k != "deletedRecords"}
        stale["baseSavedAt"] = old_page_snapshot["savedAt"]
        stale["todos"] = stale["todos"] + [{"id": "t-new-old-page", "createdAt": "2026-10-21T12:00:00.000Z"}]
        r = call(u, stale)
        g = call(u)
        assert r["merged"] and ids(g, "issueDrafts") == ["i2"], ("stale page resurrected", ids(g, "issueDrafts"))
        assert "t-new-old-page" in ids(g, "todos"), "stale page's new record kept"
        assert "i1" in g["deletedRecords"]["issueDrafts"], "tombstones not wiped by old page"

        # --- 3. API adds a record; an old page with stale base must NOT delete it ---
        call(u, {**g, "todos": g["todos"] + [{"id": "t-api", "createdAt": "2026-10-21T12:11:00.000Z"}], "baseSavedAt": g["savedAt"]})
        r = call(u, stale)  # stale page saves again without t-api
        g = call(u)
        assert "t-api" in ids(g, "todos") and "t-api" not in g["deletedRecords"].get("todos", {}), "stale page wrongly deleted new record"

        # --- 4. direct replace without deletedRecords key keeps tombstones ---
        payload = {k: v for k, v in g.items() if k != "deletedRecords"}
        payload["baseSavedAt"] = g["savedAt"]
        call(u, payload)
        g = call(u)
        assert "i1" in g["deletedRecords"]["issueDrafts"], "direct replace cleared tombstones"
        # direct replace that re-sends the deleted (older) record -> still dropped
        call(u, {**g, "issueDrafts": g["issueDrafts"] + [{"id": "i1", "createdAt": T0}], "baseSavedAt": g["savedAt"]})
        g = call(u)
        assert ids(g, "issueDrafts") == ["i2"], "tombstoned record re-sent by direct replace"

        # --- 5. explicit client tombstone via merge path (stale page deletes something) ---
        call(u, {"todos": [r for r in g["todos"] if r["id"] != "t1"], "deletedRecords": {"todos": {"t1": "2026-10-21T13:00:00.000Z"}}, "baseSavedAt": "stale"})
        g = call(u)
        assert "t1" not in ids(g, "todos") and "t-api" in ids(g, "todos"), "client tombstone"

        # --- 6. record edited after deletion is kept ---
        call(u, {"todos": [{"id": "t1", "createdAt": T0, "updatedAt": "2026-10-21T14:00:00.000Z"}], "baseSavedAt": "stale"})
        g = call(u)
        assert "t1" in ids(g, "todos"), "edit-after-delete should win"
        # ...and deleting it again works
        call(u, {**g, "todos": [r for r in g["todos"] if r["id"] != "t1"], "baseSavedAt": g["savedAt"]})
        call(u, stale)
        g = call(u)
        assert "t1" not in ids(g, "todos"), "re-delete after revive"

        # --- 7. missing collections are not wiped; t46OpenEvents never tombstoned ---
        call(u, {**g, "t46OpenEvents": [{"id": "e1"}], "baseSavedAt": g["savedAt"]})
        g = call(u)
        call(u, {**g, "t46OpenEvents": [{"id": "e2"}], "baseSavedAt": g["savedAt"]})
        g = call(u)
        assert "t46OpenEvents" not in g["deletedRecords"], "t46 must not get tombstones"
        before = len(g["todos"])
        call(u, {"issueDrafts": g["issueDrafts"], "baseSavedAt": g["savedAt"]})
        g = call(u)
        assert len(g["todos"]) == before, "collection missing from payload got wiped"
        print("tombstone-monthly-regression OK")
    finally:
        srv.shutdown()
