# sysnapse/e2e

獨立 e2e 測試 repo。**本 repo 由測試自動化 bot 全權維護；產品 repo `sysnapse/rakazo` 只讀。**

## 邊界（權威：`shared/product-dev/流程.md` §21.3／§21.3a／§21.3b／§21.4）

- 測試自動化 bot 的**全部寫入權只在這裡**。它可以自由新增／修改本 repo 的資料夾、測試檔與 workflow。
- 對產品 repo `sysnapse/rakazo` 一律**只讀**，只能用唯讀 token（`RAKAZO_READ_PAT`，權限 `pull=true` / `push=false` / `admin=false`）。物理上推不到碼，也不能在產品 repo 觸發 workflow。
- 需要改產品碼、產品 repo 內的測試檔或 workflow 時，一律**寫派單交 Coding bot**，不自行落手。
- 本 repo 內的 git 寫入操作（fork／branch／commit／push／rebase／開 PR／合併）只由 **Coding bot** 執行（§21.4）。
- 產品 repo 的 PR **不會**因此得到 check 狀態；「e2e 綠」**不是**驗收 bot PASS 的替代品（§21.3a）。

## 目錄結構

```
rakazo/web/      # rakazo Web 端（Playwright）
rakazo/mobile/   # rakazo Mobile 端（Playwright）
.github/workflows/
  rakazo-web.yml     # dispatch-able：以指定 sha checkout sysnapse/rakazo 跑 web e2e
  rakazo-mobile.yml  # dispatch-able：同上，跑 mobile e2e
```

每個 project folder 自帶 README、測試檔與自己的 workflow（§21.3）。

## 為何 public

owner 2026-11-16 14:0x 拍板：public repo 的 GitHub Actions **免費無限分鐘**；private 只有每月 2,000 分鐘，而 Playwright 一次十幾分鐘，不夠用。

## 如何觸發

```sh
gh workflow run rakazo-web.yml -R sysnapse/e2e \
  -f sha=<rakazo commit sha> -f spec=<可選，spec 檔路徑篩選>
```

交付證據須附 **run URL ＋ run id ＋ 被測 sha**（§21.3a）。
