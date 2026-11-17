# RAK-14 e2e flake 量測 workflow

檔案：`.github/workflows/rakazo-flake-repeat.yml`（195 行）。目的：對 `sysnapse/rakazo` 指定 commit 的單一 e2e 測試反覆取樣，算出可稽核的 flake rate。只讀 repo、只跑測試，不寫回任何東西。

## Job 與 step

- `plan`（`rakazo-flake-repeat.yml:36`）：用 `seq`／`paste` 把 `inputs.jobs` 展開成 JSON 陣列放進 `outputs.matrix`（`:42`），下游以 `fromJSON` 建矩陣。順便印 `budget=jobs×per_job`；`budget < repeats` 只發 `::warning::`，不中斷（`repeats` 是需求值，實際樣本數是 `jobs×per_job`）。
- `measure`（`:54`）：`runs-on: ubuntu-latest`、`timeout-minutes: 60`、`strategy.fail-fast: false`、`matrix.job` 為 `1..jobs`（`:60`）。
  - `services.postgres`（`:62`）：`postgres:18-alpine`，health check 用 `pg_isready -U postgres`（3s/5s/20 次），埠 `5432:5432`；等待完全交給 service 健康檢查，沒有 `sleep`。
  - `Checkout harness repo`（`:77`）：`actions/checkout@v4` + `persist-credentials: false`，取得 workflow 自身與本 repo 內容。
  - `Print evidence`（`:81`）：印 `TARGET_REPO/TARGET_SHA/SPEC/GREP/REPEATS/JOBS/HARNESS_SHA/RUN_ID`，把每次量測的輸入釘在 log 裡。
  - `Checkout rakazo at target sha`（`:91`）：`repository: sysnapse/rakazo`、`ref: inputs.sha`、`token: secrets.RAKAZO_READ_PAT`、`path: rakazo-src`、`persist-credentials: false`、`fetch-depth: 1`。
  - `Verify target sha and clean checkout`（`:100`）：`git -C rakazo-src rev-parse HEAD` 必須等於 `inputs.sha`；`git -C rakazo-src status --porcelain` 必須為空。任一不符即 `::error::` + exit 1（本 workflow 不注入任何 spec）。
  - `Set up pnpm` / `Set up Node`（`:106`、`:110`）：`pnpm/action-setup@v4`（`package_json_file: rakazo-src/package.json`，取得 `pnpm@12.18.0`）、`actions/setup-node@v4`（Node 24、pnpm cache、`cache-dependency-path: rakazo-src/pnpm-lock.yaml`）。
  - `Install dependencies and Chromium`（`:116`）：`pnpm install --frozen-lockfile`；`pnpm --filter @rakazo/web exec playwright install chromium`（刻意不加 `--with-deps`，runner 映像已有 chromium 依賴）。
  - `Measure flake samples`（`:121`，`working-directory: rakazo-src`）：迴圈跑 `per_job` 次。每次先用 `psql -h 127.0.0.1 -U postgres` 建全新資料庫 `flake_${JOB}_${i}`，再以 `CI_POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5432/flake_${JOB}_${i}` 跑一次 `pnpm test:e2e -- --spec=… --grep=…`，輸出 `tee` 到 `iter-${JOB}-${i}.log`，`set +e` 取 `PIPESTATUS[0]` 為 rc。
    每次樣本以 log 分類：有 `N failed` ⇒ `FAIL`；否則有 `N passed` ⇒ `PASS`；兩者皆無 ⇒ `INVALID`（原因寫入 `invalid-reasons.txt`）。`samples.csv` 每次追加一列 `job,i,verdict,rc,elapsed_s`（固定 5 欄，原因另存，避免污染統計格式）。
  - `Upload samples and traces`（`:161`，`if: always()`）：上傳 `samples.csv`、`iter-*.log`、`invalid-reasons.txt`、`rakazo-src/apps/web/test-results`、`rakazo-src/blob-report`、`rakazo-src/playwright-report`，`if-no-files-found: ignore`，`retention-days: 14`。
  - `Summarize flake rate`（`:175`，`if: always()`）：以 awk 數 `PASS/FAIL/INVALID`，印 `valid = PASS + FAIL`、`flake_rate = FAIL / valid`（4 位小數），逐條列出 INVALID 並註明不進分母；`valid == 0` 才 `::error::` + exit 1。測試本身失敗不算 workflow 失敗。

## 為何用 shell 迴圈而不是 `--repeat-each`

`packages/testkit/src/cli/harness.ts:252-260` 傳給 Playwright 的參數只有 `e2eSpec`、`--grep`、`--shard`：

```
258:            ...(e2eSpec ? [e2eSpec] : []),
259:            ...(e2eGrep ? ["--grep", e2eGrep] : []),
260:            ...(shard ? ["--shard", shard] : []),
```

harness 的 argv 解析（`harness.ts:24-28`）也只認 `--spec=`／`--grep=`／`--shard=`／`--runtime=`／`--sandbox=`。其他參數會被靜默丟棄，若用 `--repeat-each=20`，Playwright 只會跑 1 次而報表仍寫 20，屬於假證據。因此重複必須由 shell 迴圈完成，且每次都是獨立 harness 程序、獨立資料庫，避免樣本間狀態累積。

## 已知限制

- Playwright 的 `blob-report`／`playwright-report`／`apps/web/test-results` 每個 iteration 會覆寫，artifact 內只保留最後一次的報告；逐次證據以 `iter-*.log` 為準（每次 log 完整保留）。
- 每個 matrix job 有自己的 Postgres service；`jobs×per_job` 才是實際樣本數，`repeats` 只作預算警示。
- `job,i,...` 的 `i` 只在單一 job 內唯一，跨 job 需以 `job` 區分。
- 需 repo secret `RAKAZO_READ_PAT`（對 `sysnapse/rakazo` 只讀）；workflow 內不落任何憑證值，`persist-credentials: false`。
- 不做 retry：`apps/web/playwright.config.ts` 無 `retries` 鍵（預設 0），workflow 也不加任何 retry 參數、不設 `E2E_SKIP_NIGHTLY`／`E2E_SKIP_HEAVY`；`bot-organization` 屬 nightlySpecs，設了 skip 會變成 0 tests。
- `valid == 0`（全部樣本 INVALID／無法 boot）視為量測失敗；只要至少 1 個有效樣本，測試失敗不影響 workflow 結果。
- guard 只在 checkout 後、安裝與測試前檢查；測試階段 Playwright 會產生報告檔，屬執行產物，不寫回 git。
