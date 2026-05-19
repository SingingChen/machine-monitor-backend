# Docker 部署詳細解析補充文件

> 📅 補充日期：2026-05-19  
> 🎯 目標：詳細解析 Python 監控程式的 Docker 部署配置

---

## 📦 必要檔案清單

在開始 Docker 部署前，確保專案根目錄有以下檔案：

```
machine-monitor/
├── docker-compose.yml        # ✨ 服務編排檔案
├── Dockerfile.monitor        # ✨ Python 監控的映像檔
├── requirements.txt          # ✨ Python 依賴清單
└── monitor.py                # ✨ 監控主程式
```

---

## 📄 檔案 1：requirements.txt

### 完整內容

```txt
requests==2.31.0
```

### 為什麼需要這個檔案？

| 原因 | 說明 |
|------|------|
| **可重現性** | 確保每次建置都使用相同版本的套件 |
| **穩定性** | 避免新版本的 breaking changes 導致程式崩潰 |
| **安全性** | 可透過版本號追蹤 CVE 漏洞 |
| **最佳實踐** | 符合 Python 專案的標準做法 |

### 版本鎖定的重要性

```bash
# ❌ 不推薦：未指定版本
requests

# ⚠️ 部分推薦：只鎖定主要版本
requests>=2.31.0

# ✅ 推薦：完整鎖定版本
requests==2.31.0
```

**實際案例：**
- 2023 年 requests 2.31.0 修復了 CVE-2023-32681（代理認證洩漏）
- 如果未鎖定版本，舊環境可能裝到有漏洞的 2.30.0

---

## 📄 檔案 2：Dockerfile.monitor

### 完整內容

```dockerfile
# 使用官方極簡版的 Python 鏡像
FROM python:3.10-slim

# 設定容器內的工作目錄
WORKDIR /app

# 複製套件清單並安裝
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製 Python 腳本
COPY monitor.py .

# 運行監控程式
CMD ["python", "monitor.py"]
```

---

### 逐行解析

#### 第 1-2 行：`FROM python:3.10-slim`

```dockerfile
FROM python:3.10-slim
```

**為什麼選擇 `slim` 版本？**

| 映像檔版本 | 大小 | 包含內容 | 適用場景 |
|-----------|------|----------|----------|
| `python:3.10` | ~900 MB | 完整工具鏈、編譯器 | 需要編譯 C 擴展套件 |
| `python:3.10-slim` | ~50 MB | 基本 Python 執行環境 | **純 Python 專案**（推薦） |
| `python:3.10-alpine` | ~20 MB | 極簡 Alpine Linux | 需要特別處理相容性 |

我們的專案只需要 `requests` 套件（純 Python），所以 `slim` 版本最適合。

---

#### 第 4-5 行：`WORKDIR /app`

```dockerfile
WORKDIR /app
```

**作用：**
- 建立 `/app` 目錄（如果不存在）
- 將後續指令的工作目錄切換到 `/app`
- 容器啟動時的預設目錄也是 `/app`

**為什麼不用根目錄？**
```dockerfile
# ❌ 不推薦：檔案散落在根目錄
COPY monitor.py /monitor.py
CMD ["python", "/monitor.py"]

# ✅ 推薦：統一放在 /app
WORKDIR /app
COPY monitor.py .
CMD ["python", "monitor.py"]
```

---

#### 第 7-9 行：安裝依賴套件

```dockerfile
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```

**為什麼先複製 requirements.txt？**

這是 **Docker Layer Caching** 的最佳實踐：

```
┌─────────────────────────────────────┐
│ Layer 1: FROM python:3.10-slim      │ ← 幾乎不變
├─────────────────────────────────────┤
│ Layer 2: WORKDIR /app               │ ← 不變
├─────────────────────────────────────┤
│ Layer 3: COPY requirements.txt      │ ← 套件沒改就不變
│ Layer 4: RUN pip install ...        │ ← 使用 cache，超快！
├─────────────────────────────────────┤
│ Layer 5: COPY monitor.py            │ ← 程式碼常改，但不影響上面
├─────────────────────────────────────┤
│ Layer 6: CMD ["python", ...]        │ ← 不變
└─────────────────────────────────────┘
```

**實際效果：**
```bash
# 第一次建置：需要下載安裝套件（慢）
docker build -t monitor:v1 -f Dockerfile.monitor .
# => 耗時 30 秒

# 修改 monitor.py 後重新建置（快！）
docker build -t monitor:v2 -f Dockerfile.monitor .
# => 耗時 2 秒（Layer 1-4 使用 cache）
```

**`--no-cache-dir` 的作用：**
```bash
# 不加 --no-cache-dir
RUN pip install requests
# => 映像檔大小：65 MB（包含 pip cache）

# 加上 --no-cache-dir
RUN pip install --no-cache-dir requests
# => 映像檔大小：52 MB（省 20%）
```

---

#### 第 11-12 行：複製主程式

```dockerfile
COPY monitor.py .
```

**為什麼放在最後？**

因為 `monitor.py` 是最常修改的檔案，放最後可以：
- ✅ 保留前面的 layer cache
- ✅ 加快建置速度
- ✅ 減少不必要的套件重裝

---

#### 第 14-15 行：啟動指令

```dockerfile
CMD ["python", "monitor.py"]
```

**兩種 CMD 格式比較：**

| 格式 | 範例 | 優點 | 缺點 |
|------|------|------|------|
| **Exec 形式**（推薦） | `CMD ["python", "monitor.py"]` | 可正確接收 SIGTERM 訊號 | 稍微複雜 |
| Shell 形式 | `CMD python monitor.py` | 簡單直觀 | 訊號處理不完整 |

**為什麼訊號處理很重要？**

```bash
# 使用 Exec 形式：
docker stop kaori_monitor
# 1. Docker 發送 SIGTERM 給 Python 程序（PID 1）
# 2. Python 正常關閉，清理資源
# 3. 10 秒後仍未關閉才發送 SIGKILL

# 使用 Shell 形式：
docker stop kaori_monitor
# 1. Docker 發送 SIGTERM 給 /bin/sh（PID 1）
# 2. sh 可能不轉發訊號給 Python
# 3. Python 來不及清理就被 SIGKILL 強制終止
```

**如果需要即時日誌輸出：**
```dockerfile
# Python 預設會緩衝輸出，可能看不到即時日誌
CMD ["python", "monitor.py"]

# 加上 -u 參數禁用緩衝
CMD ["python", "-u", "monitor.py"]
```

---

## 📄 檔案 3：docker-compose.yml 新增部分

### 完整配置

```yaml
services:
  # ... 現有的 db, api, frontend 服務 ...

  # 4. 高力冷卻設備自動化監控軟體 (Python 模擬端)
  monitor:
    build:
      context: .                      # 建置上下文是專案根目錄
      dockerfile: Dockerfile.monitor  # 指定使用這個 Dockerfile
    container_name: kaori_monitor     # 容器名稱（方便識別）
    restart: always                   # 容器異常退出時自動重啟
    environment:
      # ⚠️ 關鍵：在 Docker 網路內，要用服務名稱 'api' 而非 'localhost'
      - REDFISH_URL=http://api:3000/redfish/v1/Chassis/MAC-002/Thermal
    depends_on:
      - api                           # 確保 API 容器先啟動
```

---

### 逐項解析

#### 🔍 `build.context: .`

```yaml
build:
  context: .                      # 這裡的 . 代表專案根目錄
  dockerfile: Dockerfile.monitor
```

**Context（建置上下文）是什麼？**

建置上下文定義了 Dockerfile 中 `COPY` 指令可以存取的檔案範圍：

```
machine-monitor/          ← context: . (根目錄)
├── Dockerfile.monitor    ← 可以 COPY
├── monitor.py            ← 可以 COPY
├── requirements.txt      ← 可以 COPY
├── machine-monitor-backend/
│   └── src/              ← 可以 COPY（但不需要）
└── machine-monitor-frontend/
    └── src/              ← 可以 COPY（但不需要）
```

**如果 context 設錯：**
```yaml
# ❌ 錯誤設定
build:
  context: ./machine-monitor-backend  # 範圍太小
  dockerfile: Dockerfile.monitor      # 檔案路徑錯誤

# 結果：
# ERROR: Dockerfile.monitor not found
# ERROR: Cannot COPY monitor.py (不在 context 內)
```

---

#### 🔍 `dockerfile: Dockerfile.monitor`

```yaml
dockerfile: Dockerfile.monitor
```

**為什麼需要指定？**

專案中有多個 Dockerfile：
```
machine-monitor/
├── Dockerfile.monitor              # ← Python 監控用
└── machine-monitor-backend/
    └── Dockerfile                  # ← NestJS 後端用
```

如果不指定，Docker Compose 會找 `context` 根目錄下的 `Dockerfile`（找不到會報錯）。

---

#### 🔍 `container_name: kaori_monitor`

```yaml
container_name: kaori_monitor
```

**有無自訂名稱的差異：**

```bash
# 沒有設定 container_name
docker-compose up -d
# => 容器名稱：machine-monitor_monitor_1（自動生成）

# 有設定 container_name: kaori_monitor
docker-compose up -d
# => 容器名稱：kaori_monitor（固定）
```

**實用性：**
```bash
# 沒有自訂名稱（需要記憶或查詢）
docker logs machine-monitor_monitor_1

# 有自訂名稱（簡單直觀）
docker logs kaori_monitor
```

---

#### 🔍 `restart: always`

```yaml
restart: always
```

**四種重啟策略比較：**

| 策略 | 何時重啟 | 適用場景 | 範例 |
|------|---------|----------|------|
| `no` | 永不重啟 | 一次性任務 | 資料庫遷移腳本 |
| `on-failure` | 僅非正常退出 | 開發環境 | 開發時除錯 |
| `always` | 總是重啟 | **正式環境** | **監控程式**（推薦） |
| `unless-stopped` | 除非手動停止 | 正式環境進階 | 需要手動控制的服務 |

**實際測試：**

```bash
# 模擬程式崩潰（在 monitor.py 加入錯誤）
docker exec -it kaori_monitor sh -c "kill 1"

# restart: always 的行為
docker ps
# => kaori_monitor 自動重啟，狀態變為 Up 2 seconds

# restart: no 的行為
docker ps -a
# => kaori_monitor 狀態為 Exited，不會自動重啟
```

---

#### 🔍 `environment: REDFISH_URL=http://api:3000`

```yaml
environment:
  - REDFISH_URL=http://api:3000/redfish/v1/Chassis/MAC-002/Thermal
```

**為什麼不能用 `localhost`？**

Docker Compose 中每個容器都有**獨立的網路命名空間**：

```
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  monitor 容器                │    │  api 容器                    │
│  ┌──────────────────┐        │    │  ┌──────────────────┐        │
│  │ Python 程式      │        │    │  │ NestJS 程式      │        │
│  │ localhost:3000   │───✗───>│    │  │ localhost:3000   │        │
│  │ 找不到！         │        │    │  │ (自己的 3000)    │        │
│  └──────────────────┘        │    │  ��────────��─────────┘        │
│                              │    │                              │
│  ┌──────────────────┐        │    │  ┌──────────────────┐        │
│  │ Python 程式      │        │    │  │ NestJS 程式      │        │
│  │ api:3000         │───✓───>│────│─>│ port 3000 監聽   │        │
│  │ 找到了！         │        │    │  │                  │        │
│  └──────────────────┘        │    │  └──────────────────┘        │
└──────────────────────────────┘    └──────────────────────────────┘
```

**Docker Compose 自動建立的虛擬網路：**

```bash
docker network inspect machine-monitor_default
```

輸出（簡化版）：
```json
{
  "Name": "machine-monitor_default",
  "Containers": {
    "kaori_monitor": {
      "IPv4Address": "172.20.0.4/16"
    },
    "machine_api": {
      "IPv4Address": "172.20.0.2/16"
    }
  }
}
```

容器可以透過**服務名稱**（`api`）互相通訊，Docker 內建 DNS 會自動解析。

**驗證方式：**
```bash
# 進入 monitor 容器
docker exec -it kaori_monitor sh

# 測試 DNS 解析
nslookup api
# => Server: 127.0.0.11
# => Name: api
# => Address: 172.20.0.2    ✅ 成功解析

# 測試連線
wget -O- http://api:3000/redfish/v1/Chassis/MAC-002/Thermal
# => 成功取得 JSON 回應
```

---

#### 🔍 `depends_on: - api`

```yaml
depends_on:
  - api
```

**作用：**
1. ✅ 控制啟動順序：`api` 容器先啟動，`monitor` 容器後啟動
2. ⚠️ **不保證服務就緒**：API 容器啟動 ≠ NestJS 程式已準備好

**實際測試：**

```bash
docker-compose up
```

啟動日誌：
```
Creating machine_postgres ... done
Creating machine_api      ... done  ← 先啟動
Creating kaori_monitor    ... done  ← 後啟動（但 API 可能還在初始化）
```

**如果需要等待服務完全就緒：**

方案 1：在 API 容器加入 healthcheck
```yaml
api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 5s
    timeout: 3s
    retries: 5

monitor:
  depends_on:
    api:
      condition: service_healthy  # 等待 API 健康檢查通過
```

方案 2：在 Python 程式加入重試邏輯
```python
import time
import requests

def wait_for_api():
    max_retries = 30
    for i in range(max_retries):
        try:
            response = requests.get(REDFISH_URL)
            if response.status_code in [200, 404]:  # API 已就緒
                return True
        except:
            pass
        print(f"等待 API 就緒... ({i+1}/{max_retries})")
        time.sleep(2)
    return False

if __name__ == "__main__":
    if wait_for_api():
        monitor_cooling_system()
    else:
        print("API 無法連接，退出程式")
```

---

## 🚀 完整部署流程

### 步驟 1：檢查檔案

```bash
cd /home/nickfeng/workspace/demo/machine-monitor

# 確認必要檔案存在
ls -l Dockerfile.monitor requirements.txt monitor.py docker-compose.yml
```

---

### 步驟 2：建置並啟動

```bash
# 建置並啟動所有服務
docker-compose up -d --build

# --build 的作用：
# 即使映像檔已存在，也重新建置（確保使用最新程式碼）
```

---

### 步驟 3：驗證容器狀態

```bash
docker-compose ps
```

預期輸出：
```
NAME                IMAGE                     STATUS
machine_postgres    postgres:15               Up
machine_api         machine-monitor-api       Up
machine_frontend    machine-monitor-frontend  Up
kaori_monitor       machine-monitor-monitor   Up    ← 監控容器
```

---

### 步驟 4：查看監控日誌

```bash
# 即時追蹤（Ctrl+C 離開）
docker-compose logs monitor -f

# 查看最近 20 行
docker-compose logs monitor --tail=20
```

---

### 步驟 5：測試完整流程

```bash
# 1. 新增測試資料
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "MAC-002", "temp": 28.5, "status": "running"}'

# 2. 觀察監控程式反應（3 秒����）
docker-compose logs monitor --tail=5
# 應該看到：✅ [正常] 設備 MAC-002 運作良好 | 當前水溫: 28.5°C

# 3. 觸發高溫警報
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "MAC-002", "temp": 92.0, "status": "critical"}'

# 4. 觀察警報訊息
docker-compose logs monitor --tail=10
# 應該看到：❌ [🚨 警報] 設備 MAC-002 發生異常！
```

---

## 🔧 常用管理指令

### 重啟服務

```bash
# 重啟單一服務
docker-compose restart monitor

# 重新建置並啟動（程式碼修改後）
docker-compose up -d --build monitor
```

---

### 進入容器除錯

```bash
# 進入容器 shell
docker exec -it kaori_monitor sh

# 查看檔案
ls -l /app

# 查看環境變數
env | grep REDFISH

# 測試網路連線
ping api
wget -O- http://api:3000/redfish/v1/Chassis/MAC-002/Thermal

# 離開容器
exit
```

---

### 停止服務

```bash
# 停止所有服務（保留資料）
docker-compose down

# 停止並刪除 volumes（⚠️ 會清空資料庫）
docker-compose down -v

# 只停止 monitor 服務
docker-compose stop monitor
```

---

## 📊 Docker vs 本地執行對照表

| 項目 | 本地執行 | Docker 執行 |
|------|---------|------------|
| **安裝依賴** | `pip3 install requests` | 自動安裝（Dockerfile 處理） |
| **啟動指令** | `python3 monitor.py` | `docker-compose up -d` |
| **API 網址** | `http://localhost:3000` | `http://api:3000` |
| **查看日誌** | 直接看終端機輸出 | `docker-compose logs monitor` |
| **停止程式** | `Ctrl+C` | `docker-compose stop monitor` |
| **程式崩潰** | 需手動重啟 | 自動重啟 |
| **環境隔離** | 影響宿主機 Python 環境 | 完全隔離，不影響宿主機 |

---

## ✅ 檢查清單

部署前請確認：

- [ ] `requirements.txt` 已建立且包含 `requests==2.31.0`
- [ ] `Dockerfile.monitor` 已建立在專案根目錄
- [ ] `docker-compose.yml` 已新增 `monitor` 服務
- [ ] `monitor.py` 存在於專案根目錄
- [ ] 後端 API 已實作 `getLatestStatus()` 方法
- [ ] PostgreSQL 資料庫有測試資料
- [ ] 已執行 `docker-compose up -d --build`
- [ ] 已用 `docker-compose ps` 確認所有容器都是 Up 狀態
- [ ] 已用 `docker-compose logs monitor` 確認監控程式正常運行
- [ ] 已測試正常溫度顯示與高溫警報觸發

---

**部署完成！** 🎉

你的 Python 監控程式現已在 Docker 容器中穩定運行，具備自動重啟、環境隔離、日誌管理等正式環境所需的特性。

