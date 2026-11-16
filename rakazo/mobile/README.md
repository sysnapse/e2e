# rakazo/mobile — rakazo Mobile 端 E2E

用途：對 `sysnapse/rakazo` 的 Mobile 端跑 Playwright E2E（行動版網頁／模擬視窗尺寸；若要真機或 Appium，另開資料夾並保持本目錄不動）。

- 觸發：`.github/workflows/rakazo-mobile.yml`（`workflow_dispatch`，inputs `sha`／`spec`）。
- 被測原始碼：workflow 以唯讀 token checkout `sysnapse/rakazo@<sha>` 到 `$RAKAZO_SRC`。
- 目前狀態：骨架，理由與行為同 `rakazo/web/README.md`（無 `playwright.config.ts` 時明確記 skip，不假綠）。

## 慣例

- 測試檔命名 `*.spec.ts`，裝置描述檔（device descriptor）放 `devices/`。
- 產出 `results/*.json`，交付附 run URL ＋ run id ＋ 被測 sha。
