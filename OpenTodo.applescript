set todoUrl to "file:///Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html"

try
	do shell script "open -na 'Google Chrome' --args --app='file:///Users/galigali/Documents/Codex/2026-05-14/new-chat/index.html'"
on error
	open location todoUrl
end try
