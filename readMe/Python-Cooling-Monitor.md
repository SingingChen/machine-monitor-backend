# Python 冷卻設備監控系統開發紀錄

> 📅 開發日期：2026-05-19  
> 🎯 目標：建立 Python 自動化監控程式，透過 Redfish API 即時監控冷卻設備溫度與健康狀態

---

## 📋 系統架構概述

本系統採用**前後端分離**的監控架構：

```
┌───────────────────────────────���─────────────────────────────┐
│  Python 監控腳本 (monitor.py)                                │
│  - 每 3 秒輪詢 (Polling)                                     │
│  - 解析 Redfish 標準格式                                     │
│  - 根據健康狀態自動控制                                      │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP GET Request
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  Redfish API (NestJS Backend)                               │
│  GET /redfish/v1/Chassis/{id}/Thermal                       │
│  - 從 PostgreSQL 讀取最新溫度                                │
│  - 回傳符合 DMTF 標準的 JSON                                 │
└────────────────┬────────────────────────────────────────────┘
                 │ SQL Query
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                         │
│  Table: MachineStatus                                        │
│  - machineId, temperature, status, createdAt                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 開發步驟

### 步驟 1：建立 Python 監控腳本

#### 1.1 建立檔案

在專案根目錄建立 `monitor.py`：

```bash
cd /home/nickfeng/workspace/demo/machine-monitor
touch monitor.py
```

#### 1.2 安裝 Python 依賴套件

```bash
# 確認 Python 版本
python3 --version

# 安裝 requests 套件（用於發送 HTTP 請求）
pip3 install requests
```

---

### 步驟 2：實作監控邏輯

#### 2.1 完整程式碼

```python
import os
import time
import requests

# 🎯 優先讀取 Docker 給的環境變數，讀不到才用 localhost
REDFISH_URL = os.getenv("REDFISH_URL", "http://localhost:3000/redfish/v1/Chassis/MAC-002/Thermal")

def monitor_cooling_system():
    print("🚀 高力冷卻設備自動化監控軟體已啟動...")
    print("📡 正在透過 Redfish 協定監控設備狀態...\n")

    while True:
        try:
            # 1. 發送 GET 請求讀取標準 Redfish 數據
            response = requests.get(REDFISH_URL)

            if response.status_code == 200:
                data = response.json()

                # 2. 解析 Redfish 標準格式中的溫度與健康狀態
                temp_info = data["Temperatures"][0]
                chassis_id = data["@odata.id"].split("/")[-2]
                sensor_name = temp_info["Name"]
                current_temp = temp_info["ReadingCelsius"]
                health_status = temp_info["Status"]["Health"]
                critical_threshold = temp_info["UpperThresholdCritical"]

                # 3. 根據健康狀態執行不同的控制邏輯
                if health_status == "Critical":
                    print(f"❌ [🚨 警報] 設備 {chassis_id} 發生異常！")
                    print(f"   ⚠️ 傳感器: {sensor_name}")
                    print(f"   ⚠️ 當前水溫: {current_temp}°C (已超越臨界值 {critical_threshold}°C)")
                    print(f"   ⚙️ [自動控制下達]: 觸發冷卻閥門全開，並準備通知工程師...\n")
                else:
                    print(f"✅ [正常] 設備 {chassis_id} 運作良好 | 當前水溫: {current_temp}°C | 狀態: {health_status}")

            else:
                print(f"⚠️ 無法讀取 Redfish 數據，錯誤碼: {response.status_code}")

        except Exception as e:
            print(f"💥 連線失敗，請確保 NestJS 後端容器運作中。錯誤訊息: {e}")

        # 4. 每 3 秒輪詢一次
        time.sleep(3)

if __name__ == "__main__":
    monitor_cooling_system()
```

---

#### 2.2 核心設計邏輯

| 功能模組 | 實作方式 | 說明 |
|---------|---------|------|
| **環境變數讀取** | `os.getenv("REDFISH_URL", "預設值")` | 支援 Docker 部署時動態配置 |
| **HTTP 客戶端** | `requests.get()` | 發送 GET 請求到 Redfish API |
| **JSON 解析** | `data["Temperatures"][0]` | 提取 Redfish 標準格式中的溫度陣列 |
| **健康狀態判斷** | `if health_status == "Critical"` | 依據 Redfish 標準的 Health 欄位決策 |
| **輪詢機制** | `time.sleep(3)` | 每 3 秒查詢一次，避免過度頻繁的 API 呼叫 |
| **錯誤處理** | `try-except` | 捕捉網路錯誤或 API 不可用情況 |

---

#### 2.3 關鍵資料欄位對應

Python 程式從 Redfish API 回應中提取以下欄位：

```python
# Redfish API 回應格式
{
  "@odata.id": "/redfish/v1/Chassis/MAC-002/Thermal",  # ← 提取 chassis_id
  "Temperatures": [
    {
      "Name": "Internal Water Loop Temperature",        # ← sensor_name
      "ReadingCelsius": 28.5,                          # ← current_temp
      "UpperThresholdCritical": 85.0,                  # ← critical_threshold
      "Status": {
        "Health": "OK"                                  # ← health_status
      }
    }
  ]
}
```

---

### 步驟 3：測試監控系統

#### 3.1 啟動後端服務

確保 Docker 容器正在運行：

```bash
cd /home/nickfeng/workspace/demo/machine-monitor
docker-compose up -d
```

檢查後端狀態：

```bash
docker-compose ps
# 應該看到 machine_api 和 machine_postgres 都是 Up 狀態
```

---

#### 3.2 新增測試資料（正常溫度）

```bash
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "MAC-002", "temp": 28.5, "status": "running"}'
```

**預期回應：**
```json
{
  "id": 1,
  "machineId": "MAC-002",
  "temperature": 28.5,
  "status": "running",
  ...
}
```

---

#### 3.3 啟動 Python 監控程式

```bash
python3 monitor.py
```

**預期輸出（正常情況）：**
```
🚀 高力冷卻設備自動化監控軟體已啟動...
📡 正在透過 Redfish 協定監控設備狀態...

✅ [正常] 設備 MAC-002 運作良好 | 當前水溫: 28.5°C | 狀態: OK
✅ [正常] 設備 MAC-002 運作良好 | 當前水溫: 28.5°C | 狀態: OK
✅ [正常] 設備 MAC-002 運作良好 | 當前水溫: 28.5°C | 狀態: OK
```

監控程式會每 3 秒自動輪詢一次，持續顯示設備狀態。

---

#### 3.4 測試高溫警報觸發

**開啟新終端機**，發送高溫資料：

```bash
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "MAC-002", "temp": 92.8, "status": "critical"}'
```

**預期輸出（警報觸發）：**
```
❌ [🚨 警報] 設備 MAC-002 發生異常！
   ⚠️ 傳感器: Internal Water Loop Temperature
   ⚠️ 當前水溫: 92.8°C (已超越臨界值 85.0°C)
   ⚙️ [自動控制下達]: 觸發冷卻閥門全開，並準備通知工程師...
```

---

#### 3.5 測試 404 錯誤處理

修改 `monitor.py` 中的 `REDFISH_URL` 為不存在的設備 ID：

```python
REDFISH_URL = os.getenv("REDFISH_URL", "http://localhost:3000/redfish/v1/Chassis/NON-EXISTENT/Thermal")
```

重新執行：
```bash
python3 monitor.py
```

**預期輸出：**
```
⚠️ 無法讀取 Redfish 數據，錯誤碼: 404
```

---

### 步驟 4：Docker 化部署（推薦）

> 📖 **詳細解析文件**：[Docker-Deployment-Details.md](./Docker-Deployment-Details.md)  
> 包含 Dockerfile 逐行解析、docker-compose.yml 配置詳解、網路通訊原理等深入說明

#### 4.1 建立 requirements.txt

在專案根目錄建立 `requirements.txt`：

```txt
requests==2.31.0
```

---

#### 4.2 建立 Dockerfile.monitor（實際檔名）

在專案根目錄建立 `Dockerfile.monitor`：

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

詳細的 Dockerfile 解析（分層快取、訊號處理等）請參考 [Docker-Deployment-Details.md](./Docker-Deployment-Details.md)。

---

#### 4.3 更新 docker-compose.yml

在現有的 `docker-compose.yml` 第 71-82 行已包含 monitor 服務：

```yaml
services:
  # ... db, api, frontend ...

  # 4. 高力冷卻設備自動化監控軟體 (Python 模擬端)
  monitor:
    build:
      context: .
      dockerfile: Dockerfile.monitor
    container_name: kaori_monitor
    restart: always
    environment:
      - REDFISH_URL=http://api:3000/redfish/v1/Chassis/MAC-002/Thermal
    depends_on:
      - api
```

**關鍵配置說明：**
- `context: .` - 建置上下文是專案根目錄
- `REDFISH_URL=http://api:3000` - 使用服務名稱而非 localhost
- `restart: always` - 程式崩潰時自動重啟
- `depends_on: api` - 確保 API 容器先啟動

詳細的配置解析（網路命名空間、重啟策略等）請參考 [Docker-Deployment-Details.md](./Docker-Deployment-Details.md)。

---

#### 4.4 啟動完整服務堆疊

```bash
# 建置並啟動所有服務
docker-compose up -d --build

# 查看容器狀態
docker-compose ps

# 查看監控程式日誌
docker-compose logs monitor -f
```

#### 4.5 快速測試（舊版內容保留）

#### 4.1 建立 Dockerfile for Python Monitor（舊版參考）

在專案根目錄建立 `monitor.Dockerfile`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安裝依賴
RUN pip install --no-cache-dir requests

# 複製監控腳本
COPY monitor.py .

# 啟動監控
CMD ["python", "-u", "monitor.py"]
```

---

#### 4.2 更新 docker-compose.yml

在現有的 `docker-compose.yml` 中新增 Python 監控服務：

```yaml
services:
  # ... 現有的 db, api, frontend 服��� ...

  # Python 冷卻設備監控
  monitor:
    build:
      context: .
      dockerfile: monitor.Dockerfile
    container_name: cooling_monitor
    restart: always
    environment:
      # 使用 Docker 內部網路，連接到 api 容器
      REDFISH_URL: "http://api:3000/redfish/v1/Chassis/MAC-002/Thermal"
    depends_on:
      - api
```

---

#### 4.3 啟動完整服務堆疊

```bash
docker-compose up -d --build
```

檢查監控程式日誌：

```bash
docker-compose logs monitor -f
```

---

## 📊 監控流程圖

```
┌────────────────────────────────────────────────────────────┐
│  每 3 秒執行一次                                            │
└────────┬───────────────────────────────────────────────────��
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│  1. 發送 HTTP GET Request                                    │
│     → http://localhost:3000/redfish/v1/Chassis/MAC-002/...  │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│  2. 後端 RedfishController 接收請求                          │
│     → 呼叫 machineService.getLatestStatus("MAC-002")        │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│  3. 從 PostgreSQL 查詢最新一筆資料                           │
│     → SELECT * FROM "MachineStatus"                          │
│       WHERE "machineId" = 'MAC-002'                          │
│       ORDER BY "createdAt" DESC LIMIT 1                      │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│  4. 組裝成 Redfish 標準格式回傳                              │
│     {                                                        │
│       "Temperatures": [{                                     │
│         "ReadingCelsius": 28.5,                              │
│         "Status": {"Health": "OK"}                           │
│       }]                                                     │
│     }                                                        │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Python 解析 JSON 並判斷健康狀態                          │
│     if health_status == "Critical":                          │
│         → 觸發警報與自動控制邏輯                             │
│     else:                                                    │
│         → 顯示正常運作訊息                                   │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
    (循環回步驟 1)
```

---

## 🎯 關鍵設計決策

### 1. 為什麼選擇輪詢 (Polling) 而非 WebSocket？

**理由：**
- **簡單可靠**：適合工業控制場景，不需要維持長連線
- **容錯性高**：網��斷線後自動重試，不需要複雜的重連邏輯
- **獨立部署**：監控程式可以獨立於前端運行

**缺點：**
- 即時性較差（3 秒延遲）
- 頻繁請求會增加伺服器負擔

**改進方案（未來）：**
可改用 WebSocket 訂閱機制，當溫度變化時主動推送通知。

---

### 2. 為什麼使用環境變數 `REDFISH_URL`？

**優點：**
- **環境隔離**：開發環境用 `localhost`，Docker 環境用容器名稱 `api`
- **易於配置**：不需要修改程式碼就能切換目標設備
- **符合 12-Factor App 原則**

**範例：**
```bash
# 本地開發
REDFISH_URL=http://localhost:3000/redfish/v1/Chassis/COOLING-01/Thermal python3 monitor.py

# Docker 環境（在 docker-compose.yml 設定）
REDFISH_URL=http://api:3000/redfish/v1/Chassis/COOLING-01/Thermal
```

---

### 3. 錯誤處理策略

程式實作了三層錯誤處理：

```python
try:
    response = requests.get(REDFISH_URL)
    
    if response.status_code == 200:
        # 正常解析
    else:
        # HTTP 錯誤（404, 500 等）
        print(f"⚠️ 無法讀取 Redfish 數據，錯誤碼: {response.status_code}")
        
except Exception as e:
    # 網路錯誤、連線逾時等
    print(f"💥 連線失敗，請確保後端容器運作中。錯誤訊息: {e}")
```

**不會因為單次錯誤而停止**：即使 API 暫時不可用，程式會繼續輪詢。

---

## 🔧 實際應用場景

### 場景 1：冷卻系統正常運作

```
輸入：溫度 25°C - 84°C
輸出：✅ [正常] 設備運作良好
動作：持續監控，無需干預
```

---

### 場景 2：溫度超過臨界值

```
輸入：溫度 ≥ 85°C
輸出：❌ [🚨 警報] 設備發生異常
動作：
  1. 觸發冷卻閥門全開
  2. 發送通知給工程師
  3. 記錄警報日誌
```

---

### 場景 3：設備斷線或 API 不可用

```
輸入：HTTP 錯誤或網路失敗
輸出：💥 連線失敗
動作：
  1. 顯示錯誤訊息
  2. 繼續輪詢（不中斷監控）
  3. 等待網路恢復
```

---

## 🚀 擴展功能建議

### 1. 多設備監控

目前只監控單一設備，可改為同時監控多台：

```python
DEVICE_IDS = ["MAC-001", "MAC-002", "MAC-003", "COOLING-01"]

for device_id in DEVICE_IDS:
    url = f"http://localhost:3000/redfish/v1/Chassis/{device_id}/Thermal"
    # ... 監控邏輯 ...
```

---

### 2. 警報通知整合

當觸發 Critical 狀態時，發送通知：

```python
def send_alert(device_id, temperature):
    # Email 通知
    send_email(f"設備 {device_id} 溫度異常：{temperature}°C")
    
    # Slack 通知
    requests.post(SLACK_WEBHOOK, json={"text": f"🚨 警報：{device_id}"})
    
    # Line Notify
    requests.post(LINE_API, headers={"Authorization": f"Bearer {TOKEN}"}, 
                  data={"message": f"設備 {device_id} 溫度過高"})
```

---

### 3. 歷史資料分析

儲存監控日誌到檔案：

```python
import json
from datetime import datetime

def log_to_file(device_id, temperature, health):
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "device": device_id,
        "temperature": temperature,
        "health": health
    }
    
    with open(f"logs/monitor_{device_id}.jsonl", "a") as f:
        f.write(json.dumps(log_entry) + "\n")
```

---

### 4. Grafana 儀表板整合

將監控資料推送到 Prometheus 或 InfluxDB，透過 Grafana 視覺化：

```python
from prometheus_client import Gauge, start_http_server

# 定義 Metrics
temperature_gauge = Gauge('cooling_unit_temperature', 'Current temperature', ['device_id'])
health_gauge = Gauge('cooling_unit_health', 'Health status (1=OK, 0=Critical)', ['device_id'])

# 更新 Metrics
temperature_gauge.labels(device_id=chassis_id).set(current_temp)
health_gauge.labels(device_id=chassis_id).set(1 if health_status == "OK" else 0)
```

---

## 🔍 故障排除

### 問題 1：`ModuleNotFoundError: No module named 'requests'`

**原因：** 未安裝 requests 套件

**解決：**
```bash
pip3 install requests
```

---

### 問題 2：`Connection refused` 或 `Connection timeout`

**原因：** 後端容器未啟動或網路不通

**檢查步驟：**
```bash
# 檢查容器狀態
docker-compose ps

# 檢查後端是否可存取
curl http://localhost:3000/redfish/v1/Chassis/MAC-002/Thermal

# 查看後端日誌
docker-compose logs api --tail=20
```

---

### 問題 3：`KeyError: 'Temperatures'`

**原因：** Redfish API 回傳的 JSON 格式不正確

**除錯：**
```python
# 在程式中加入除錯輸出
response = requests.get(REDFISH_URL)
print("API 回應內容：", response.json())  # 查看完整回應
```

**常見原因：**
- 資料庫中沒有該設備的資料（API 回傳 404）
- API 端點路徑錯誤

---

### 問題 4：顯示 404 Not Found

**原因：** 資料庫中沒有該 `machineId` 的資料

**解決：**
```bash
# 新增測試資料
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "MAC-002", "temp": 28.5, "status": "running"}'
```

---

## 📁 專案檔案結構

```
machine-monitor/
├── monitor.py                        # ✨ Python 監控主程式
├── monitor.Dockerfile                # (選用) Python 監控的 Docker 映像檔
├── docker-compose.yml                # Docker 編排設定
├── machine-monitor-backend/
│   ├── src/
│   │   ├── redfish/
│   │   │   └── redfish.controller.ts # Redfish API Controller
│   │   ├── machine.service.ts        # 包含 getLatestStatus() 方法
│   │   └── ...
│   ├── readMe/
│   │   ├── Python-Cooling-Monitor.md # 📄 本文件
│   │   ├── DEV-LOG-Redfish-API.md    # Redfish API 開發紀錄
│   │   └── ...
│   └── ...
└── ...
```

---

## ✅ 開發檢查清單

實作 Python 監控程式前，請確認：

- [ ] 後端 Redfish API 已實作完成
- [ ] `MachineService.getLatestStatus()` 方法可正常運作
- [ ] PostgreSQL 資料庫有測試資料
- [ ] Python requests 套件已安裝
- [ ] 環境變數 `REDFISH_URL` 已正確設定
- [ ] 測試過正常溫度顯示
- [ ] 測試過高溫警報觸發
- [ ] 測試過 404 錯誤處理
- [ ] 測試過網路斷線情況
- [ ] (選用) Docker 化部署成功

---

## 📚 相關文件

- [DEV-LOG-Redfish-API.md](./DEV-LOG-Redfish-API.md) - Redfish API 完整開發紀錄
- [AGENTS.md](/home/nickfeng/workspace/demo/machine-monitor/AGENTS.md) - 專案架構總覽
- [DMTF Redfish Specification](https://www.dmtf.org/standards/redfish) - Redfish 官方規格書

---

**開發完成！** 🎉

Python 監控程式現已可獨立運行，持續監控冷卻設備狀態並自動執行控制邏輯。

