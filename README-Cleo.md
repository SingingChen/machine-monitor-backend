

# Machine Monitor System (機器監控系統)

這是一個基於 **NestJS**, **Vue 3**, **GCP Pub/Sub** 與 **PostgreSQL** 構建的即時機器狀態監控系統。

## 🚀 技術堆疊
* **Backend**: NestJS (運行於 Docker 容器)
* **Frontend**: Vue 3 (Composition API)
* **Message Broker**: GCP Pub/Sub (用於訊息削峰與解耦)
* **Database**: PostgreSQL (使用 Prisma ORM)
* **DevOps**: Docker, WSL 2

---

## 🛠 安裝與啟動步驟

### 1. 專案初始化 (已完成)
我們使用了 Docker 「拋棄式容器」技術來建立專案，確保本地環境不被污染：
```bash
docker run --rm -v $(pwd):/app -w /app node:18-alpine sh -c "npx -y @nestjs/cli new . --package-manager npm"
```

### 2. 環境權限修復
由於檔案是由 Docker 內的 root 使用者產生，若遇到「唯讀 (Read-only)」錯誤，請執行：
```bash
sudo chown -R $USER:$USER .
sudo chmod -R 755 .
```

### 3. 套件安裝
方式 A：透過 Docker 執行安裝 (推薦)
這樣做可以確保套件是在與執行環境一致的容器內安裝，並自動同步到你的 WSL 資料夾。
在專案根目錄下安裝必要的通訊與資料庫工具：
```bash
# 1. 安裝正式執行需要的套件  --legacy-peer-deps 參數用於解決相依性衝突問題  
docker exec -it machine_api npm install @google-cloud/pubsub @nestjs/websockets @nestjs/platform-socket.io @prisma/client --save-dev --legacy-peer-deps

# 2. 安裝開發用的 Prisma 工具
docker exec -it machine_api npm install prisma --save-dev --save-dev --legacy-peer-deps
```

### 4. 設定環境變數
請在根目錄建立 `.env` 檔案，內容如下：
```text
DATABASE_URL="postgresql://user:password@db:5432/machine_db?schema=public"
```

---

## 📦 Docker 配置說明

專案包含兩個核心 Docker 檔案：

### Dockerfile (後端服務)
負責將 NestJS 程式碼打包，並設定開發模式下的熱重載 (Hot Reload)。

### docker-compose.yml (多容器編排)
定義了兩個服務：
1. **api**: NestJS 後端程式，掛載了本地目錄以利開發。
2. **db**: PostgreSQL 15 資料庫。

---

## 📂 專案結構
```text
machine-monitor-backend/
├── src/                # NestJS 原始碼
├── prisma/             # 資料庫 Schema 與遷移檔
├── .gitignore          # Git 忽略清單 (包含 JSON 白名單設定)
├── Dockerfile          # 後端鏡像定義
├── docker-compose.yml  # 容器編排設定
└── README.md           # 本說明文件
```

---

## 🚦 如何運行專案
目前進度已準備好啟動，請執行：
1. **啟動容器**: `docker-compose up -d`
2. **同步資料庫**: `docker exec -it machine_api npx prisma db push`

---

## ⚠️ 注意事項
* **安全性**: 所有 `*.json` 檔案預設已被 Git 忽略，以保護 GCP 金鑰。若要上傳 `package.json` 等檔案，已在 `.gitignore` 設定例外規則。
* **GCP 金鑰**: 請確保將你的 `gcp-key.json` 放置於根目錄（此檔案不會被上傳）。

---

## npx prisma generate 要每次輸入嗎？
答案是：不需要。

為什麼不用？
因為 prisma generate 產生的檔案存放在 node_modules 資料夾中。沒有刪除 node_modules 資料夾，或是沒有更動 schema.prisma 模型，這些型別定義就會一直存在。

什麼時候「才要」再輸入？
只有當修改了 prisma/schema.prisma（例如新增了一個欄位、改了表名），你才需要再次執行：

docker exec -it machine_api npx prisma db push（更新資料庫表結構 只有當你修改了模型，且要更新資料庫表格時。）

docker exec -it machine_api npx prisma generate（更新程式碼型別定義 只有當你修改了 schema.prisma 模型時）

## 隔天開機後的「自我檢查」清單

雖然指令不用重打，但建議每天 up 之後做這兩件事確保環境正常：
1. 檢查日誌：確保 NestJS 有順利連上資料庫。
    Bash
    docker logs -f machine_api
2. 確認路由：看看有沒有出現那行藝術品般的 Mapped {/machine/status, POST}。


這行指令是你開發過程中的**最強監視器**，它是了解容器內部「發生了什麼事」的最直接手段。

我們來拆解這句指令的各個部分：



###  指令拆解 docker logs -f machine_api

* **`docker logs`**：
  這是 Docker 的基本指令，用來讀取容器的 **標準輸出 (STDOUT)** 和 **錯誤輸出 (STDERR)**。簡單來說，就是把程式碼裡寫的 `console.log()` 或報錯訊息（Error）印出來給你看。
* **`-f` (follow)**：
  這是最關鍵的參數。它的意思是「**持續追蹤**」。
    * 如果不加 `-f`，它只會印出「到目前為止」的日誌，然後指令就結束了。
    * 加了 `-f`，終端機會保持開啟，只要容器內有新的日誌產生（例如你發送了一個 `curl` 請求），畫面就會**即時更新**彈出新的內容。這就像是在看直播。
* **`machine_api`**：
  指定你要看哪一個容器的日誌。

### 常用小技巧

* **如何退出？**
  當你不想看了，按下 **`Ctrl + C`** 就可以關閉追蹤，回到 WSL 提示字元。這不會停止容器，只是停止看日誌而已。
* **看最後幾行就好？**
  如果日誌累積太多，你可以加上 `--tail` 參數：
  `docker logs -f --tail 100 machine_api` (只看最後 100 行並持續追蹤)。

### 💡 總結
`docker logs -f machine_api` 就好比你在機器的控制室看著**即時監視畫面**。
