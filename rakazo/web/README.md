# rakazo/web — rakazo Web 端 E2E

用途：對 `sysnapse/rakazo` 的 Web 端跑 Playwright E2E。測試檔只住在本資料夾，不寫回產品 repo。

- 觸發：`.github/workflows/rakazo-web.yml`（`workflow_dispatch`，inputs `sha`／`spec`）。
- 被測原始碼：workflow 以唯讀 token checkout `sysnapse/rakazo@<sha>` 到 `$RAKAZO_SRC`，本資料夾的測試以該路徑為 baseURL 來源。
- 目前狀態：骨架。放入 `playwright.config.ts` 後 workflow 會自動改跑真測試；未有 config 時 workflow 會明確記 `no playwright.config.ts, skipping`，不會假綠。

## 慣例

- 測試檔命名 `*.spec.ts`，放本目錄或其子目錄。
- 產出 `results/*.json`（Playwright JSON reporter），供交付附證據。
- 失敗時附 trace，不重跑掩蓋 flake；flake 要修 selector 或流程，不以 retry 代替。
