# rakazo/web — rakazo Web 端 E2E（PR 合併前最終閘）

用途：對 `sysnapse/rakazo` 的 Web 端跑 Playwright E2E。測試檔只住在本資料夾，不寫回產品 repo。

- 觸發：`.github/workflows/rakazo-web.yml`（`workflow_dispatch`，inputs `sha`／`spec`）。
- 被測對象：workflow 以唯讀 token checkout `sysnapse/rakazo@<sha>` 到 `rakazo-src`，再用產品自己的
  e2e harness（`pnpm test:e2e`，即 `packages/testkit/src/cli/harness.ts`）起 migrations、API 與
  Vite web server。資料庫由 workflow 的 `services: postgres` 提供，經 `CI_POSTGRES_URL` 傳入，
  harness 因此跳過 Testcontainers——runner 不需要 Docker-in-Docker。
- spec 如何進入被測對象：harness 的 Playwright `testDir` 是 `apps/web/e2e`，所以 workflow 把
  `rakazo/web/e2e/e2e-gate.spec.ts` 複製到 runner 內的 `rakazo-src/apps/web/e2e/`（暫存
  workspace，不 push）。緊接的 Guard step 會驗證產品 checkout **只**多了這一個檔，多了其他改動即紅。

## 目前 spec

`rakazo/web/e2e/e2e-gate.spec.ts` — 一條真實旅程：

1. 經 `/api/auth/sign-up/email` 建新帳號（與註冊表單同一端點）；
2. onboarding 必須落在與第一個 bot 的對話，不是錯誤頁；
3. 由 UI 建一個新 bot，必須開啟它自己的對話；
4. 整頁 reload 後該 bot 仍可由 URL 解析、仍在側欄——證明資料真的寫入伺服器（DB round trip）。

每個帳號與 bot 名都帶 timestamp，測試不依賴其他測試留下的資料，也不用種子帳號。無硬 sleep，
所有等待都是條件（URL／元素／placeholder）。

## 觸發方式（往後每個 PR）

```bash
gh workflow run rakazo-web.yml -R sysnapse/e2e -f sha=<PR head sha>
# 只跑某些 spec：-f spec=<Playwright 檔名篩選>（預設 e2e-gate.spec.ts）
gh run list -R sysnapse/e2e --workflow=rakazo-web.yml --limit 5      # 找 run id
gh run view <run_id> -R sysnapse/e2e --log                          # Playwright 計數
```

結果落點：run URL／run id ＋ artifacts（`e2e-run.log`、`e2e-summary.txt`、trace）
＋ 交付 JSON `shared/product-dev/results/TICKET-<id>-<short-sha>.json`。

## 閘的判定（Gate verdict）

三個條件全過才綠：harness exit＝0、log 內無 `N failed`、log 內有 `≥1 passed`。
**0 tests 永不當綠**——log 內沒有測試計數即紅，避免「零測試假綠」。

## 慣例

- 測試檔命名 `*.spec.ts`，放本目錄。
- selector 優先 role 與 label／placeholder；`data-testid` 只在 app 沒有語義化標籤時用（如建立選單），
  且必須是產品自身 e2e 已在用的穩定 hook。
- 失敗時靠 trace 與 `e2e-run.log` 診斷；flake 要修 selector 或等待條件，不以 retry 代替。
