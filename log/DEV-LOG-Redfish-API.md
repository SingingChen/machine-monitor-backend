# Redfish API 開發紀錄

> 📅 開發日期：2026-05-19  
> 🎯 目標：實作符合 DMTF Redfish 標準的冷卻設備散熱監控 API

---

## 📋 需求說明

建立一個 Redfish 標準 API 端點，用於查詢冷卻主機（Chassis）的散熱/溫度數據。API 需要：
- 遵循 DMTF Redfish v1.7.0 標準格式
- 從 PostgreSQL 資料庫讀取最新的機器溫度資料
- 動態判斷設備健康狀態（超過 85°C 顯示 Critical）
- 若找不到機器資料則返回 404 錯誤

---

## 🛠️ 開發步驟

### 步驟 1：建立 Redfish Controller

#### 1.1 執行 NestJS CLI 指令生成 Controller

```bash
docker exec -it machine_api npx nest g co redfish --no-spec
```

**指令說明：**
- `docker exec -it machine_api`：在運行中的 Docker 容器內執行指令
- `npx nest g co redfish`：使用 NestJS CLI 生成 (generate) Controller
- `--no-spec`：不生成測試檔案

**輸出訊息：**
```
CREATE src/redfish/redfish.controller.ts (103 bytes)
UPDATE src/app.module.ts (XXX bytes)
```

**檔案位置：**
```
machine-monitor-backend/src/redfish/
└── redfish.controller.ts
```

---

### 步驟 2：實作 Redfish Controller

#### 2.1 編輯 `src/redfish/redfish.controller.ts`

**完整程式碼：**

```typescript
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { MachineService } from '../machine.service'; // 💡 引入原本用來讀取資料庫的 Service

@Controller('redfish/v1') // 🎯 這是 DMTF 國際標準規定的根路徑
export class RedfishController {
  // 注入你原本用來讀取資料庫的 Service
  constructor(private readonly machineService: MachineService) {}

  // 🎯 模擬獲取特定冷卻主機（Chassis）的散熱/溫度數據
  // 當打 GET http://localhost:3000/redfish/v1/Chassis/COOLING-01/Thermal 時會觸發
  @Get('Chassis/:id/Thermal')
  async getCoolingUnitThermal(@Param('id') id: string) {
    // 💡 呼叫你原本撈取最新一筆資料的 Function
    const latestData = await this.machineService.getLatestStatus(id);

    // 如果資料庫裡完全沒有這台機器的紀錄，回傳 404 錯誤
    if (!latestData) {
      throw new NotFoundException(`Cooling Unit ${id} not found in database`);
    }

    // 🎯 這裡回傳符合 DMTF Redfish 規格書的標準 JSON 格式
    return {
      '@odata.context': '/redfish/v1/$metadata#Thermal.Thermal',
      '@odata.id': `/redfish/v1/Chassis/${id}/Thermal`,
      '@odata.type': '#Thermal.v1_7_0.Thermal',
      Id: 'Thermal',
      Name: 'Kaori Cooling Unit Thermal Metrics', // 高力冷卻設備數據
      Temperatures: [
        {
          '@odata.id': `/redfish/v1/Chassis/${id}/Thermal#/Temperatures/0`,
          MemberId: '0',
          Name: 'Internal Water Loop Temperature',
          SensorNumber: 1,
          ReadingCelsius: latestData.temperature || 25.0, // 👈 綁定從資料庫撈出來的真實溫度
          UpperThresholdCritical: 85.0, // 臨界高溫警告線（工業標準通常會設定閾值）
          UpperThresholdFatal: 95.0, // 致死高溫停機線
          Status: {
            State: 'Enabled',
            // 動態判斷設備健康狀態：超過 85 度就顯示 Critical (危急)
            Health: (latestData.temperature || 0) > 85.0 ? 'Critical' : 'OK',
          },
        },
      ],
    };
  }
}
```

**關鍵設計決策：**

| 項目 | 說明 |
|------|------|
| **路由設計** | `@Controller('redfish/v1')` 遵循 DMTF 標準根路徑 |
| **依賴注入** | 注入 `MachineService` 以重用現有的資料庫查詢邏輯 |
| **錯誤處理** | 使用 `NotFoundException` 處理找不到機器的情況 |
| **動態健康狀態** | 根據溫度值動態判斷 `Health` 欄位（OK / Critical） |
| **預設值保護** | 使用 `|| 25.0` 和 `|| 0` 避免 null 值錯誤 |

---

### 步驟 3：實作 `getLatestStatus` 方法

#### 3.1 分析需求

Controller 需要呼叫 `this.machineService.getLatestStatus(id)`，但此方法尚未存在於 `machine.service.ts`。

**需求規格：**
- 輸入：`machineId: string`（機器識別碼）
- 輸出：最新的 `MachineStatus` 資料（若無則回傳 `null`）
- 查詢邏輯：
  - 篩選條件：`machineId` 符合輸入值
  - 排序條件：按 `createdAt` 降序排列
  - 取前 1 筆（最新）

#### 3.2 編輯 `src/machine.service.ts`

**新增方法：**

```typescript
// 🎯 根據機器 ID 取得最新一筆狀態資料
async getLatestStatus(machineId: string) {
  const latestStatus = await this.prisma.machineStatus.findFirst({
    where: {
      machineId: machineId,
    },
    orderBy: {
      createdAt: 'desc', // 最新的在前面
    },
  });

  return latestStatus; // 找不到時回傳 null
}
```

**完整檔案結構：**

```typescript
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MachineGateway } from './machine.gateway';

@Injectable()
export class MachineService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => MachineGateway))
    private machineGateway: MachineGateway,
  ) {}

  async createStatus(data: { id: string; temp: number; status: string }) {
    // ... 現有程式碼 ...
  }

  async getStats() {
    // ... 現有程式碼 ...
  }

  // ✨ 新增的方法
  async getLatestStatus(machineId: string) {
    const latestStatus = await this.prisma.machineStatus.findFirst({
      where: {
        machineId: machineId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return latestStatus;
  }
}
```

**技術細節：**

| Prisma 方法 | 說明 |
|-------------|------|
| `findFirst()` | 查詢單一筆資料（比 `findUnique()` 更靈活，不需要唯一欄位） |
| `where` | 篩選條件，只找符合 `machineId` 的資料 |
| `orderBy` | 排序條件，`desc` 表示降序（最新的在前） |
| 回傳值 | `MachineStatus \| null`（TypeScript 型別安全） |

---

## 🧪 測試驗證

### 測試 1：重啟後端容器

```bash
docker-compose restart api
```

**確認重啟成功：**
```bash
docker-compose logs api | tail -20
```

應看到類似訊息：
```
Nest application successfully started
Listening on port 3000
```

---

### 測試 2：新增測試資料

```bash
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "COOLING-01", "temp": 28.5, "status": "running"}'
```

**預期回應：**
```json
{
  "id": 1,
  "machineId": "COOLING-01",
  "temperature": 28.5,
  "status": "running",
  "rawData": {...},
  "createdAt": "2026-05-19T..."
}
```

---

### 測試 3：查詢 Redfish API（正常情況）

```bash
curl http://localhost:3000/redfish/v1/Chassis/COOLING-01/Thermal
```

**預期回應（格式化後）：**
```json
{
  "@odata.context": "/redfish/v1/$metadata#Thermal.Thermal",
  "@odata.id": "/redfish/v1/Chassis/COOLING-01/Thermal",
  "@odata.type": "#Thermal.v1_7_0.Thermal",
  "Id": "Thermal",
  "Name": "Kaori Cooling Unit Thermal Metrics",
  "Temperatures": [
    {
      "@odata.id": "/redfish/v1/Chassis/COOLING-01/Thermal#/Temperatures/0",
      "MemberId": "0",
      "Name": "Internal Water Loop Temperature",
      "SensorNumber": 1,
      "ReadingCelsius": 28.5,           // ✅ 從資料庫讀取的真實值
      "UpperThresholdCritical": 85.0,
      "UpperThresholdFatal": 95.0,
      "Status": {
        "State": "Enabled",
        "Health": "OK"                   // ✅ 28.5°C < 85°C，狀態正常
      }
    }
  ]
}
```

---

### 測試 4：查詢 Redfish API（高溫警告）

```bash
# 新增一筆高溫資料
curl -X POST http://localhost:3000/machine/status \
  -H "Content-Type: application/json" \
  -d '{"id": "COOLING-02", "temp": 92.3, "status": "warning"}'

# 查詢高溫設備
curl http://localhost:3000/redfish/v1/Chassis/COOLING-02/Thermal
```

**預期回應重點：**
```json
{
  "Temperatures": [
    {
      "ReadingCelsius": 92.3,
      "Status": {
        "State": "Enabled",
        "Health": "Critical"  // ✅ 92.3°C > 85°C，觸發危急狀態
      }
    }
  ]
}
```

---

### 測試 5：查詢不存在的機器（404 錯誤）

```bash
curl -i http://localhost:3000/redfish/v1/Chassis/NON-EXISTENT-ID/Thermal
```

**預期回應：**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "statusCode": 404,
  "message": "Cooling Unit NON-EXISTENT-ID not found in database",
  "error": "Not Found"
}
```

---

## 📊 資料流程圖

```
┌─────────────────┐
│  前端/客戶端     │
│  (curl/Browser) │
└────────┬────────┘
         │ GET /redfish/v1/Chassis/{id}/Thermal
         ↓
┌─────────────────────────────────────────┐
│  RedfishController                       │
│  - getCoolingUnitThermal(@Param id)     │
└────────┬────────────────────────────────┘
         │ this.machineService.getLatestStatus(id)
         ↓
┌─────────────────────────────────────────┐
│  MachineService                          │
│  - getLatestStatus(machineId: string)   │
└────────┬────────────────────────────────┘
         │ prisma.machineStatus.findFirst()
         ↓
┌─────────────────────────────────────────┐
│  PrismaService                           │
│  (PostgreSQL ORM)                        │
└────────┬────────────────────────────────┘
         │ SQL Query
         ↓
┌─────────────────────────────────────────┐
│  PostgreSQL Database                     │
│  Table: MachineStatus                    │
│  - machineId, temperature, status, ...   │
└────────┬────────────────────────────────┘
         │ Return latest record
         ↓
         (回傳資料 → Service → Controller → 客戶端)
```

---

## 🎯 關鍵學習點

### 1. NestJS CLI 自動化

使用 `nest g co` 指令可以自動：
- 建立 controller 檔案
- 更新 `app.module.ts` 的 imports
- 保持程式碼結構一致性

### 2. Prisma 查詢最佳實踐

```typescript
// ❌ 不推薦：取所有資料再排序（效能差）
const allData = await prisma.machineStatus.findMany({ where: { machineId } });
const latest = allData.sort((a, b) => b.createdAt - a.createdAt)[0];

// ✅ 推薦：讓資料庫處理排序（效能佳）
const latest = await prisma.machineStatus.findFirst({
  where: { machineId },
  orderBy: { createdAt: 'desc' }
});
```

### 3. Redfish 標準欄位

**必要欄位：**
- `@odata.context`：OData metadata 連結
- `@odata.id`：資源唯一識別 URI
- `@odata.type`：資源類型（含版本號）

**溫度監控欄位：**
- `ReadingCelsius`：攝氏溫度讀數
- `UpperThresholdCritical`：臨界溫度閾值
- `Status.Health`：健康狀態 (OK / Warning / Critical)

### 4. Docker 熱重載機制

因為 `docker-compose.yml` 已配置 volume 掛載：
```yaml
volumes:
  - ./machine-monitor-backend:/usr/src/app
  - /usr/src/app/node_modules
```

所以程式碼修改會自動同步到容器內，NestJS 的 `start:dev` 會自動重新載入。

---

## 📁 影響的檔案清單

1. ✅ **新增檔案：** `src/redfish/redfish.controller.ts`
2. ✅ **修改檔案：** `src/machine.service.ts`（新增 `getLatestStatus` 方法）
3. ✅ **自動更新：** `src/app.module.ts`（NestJS CLI 自動加入 RedfishController）

---

## 🔍 故障排除

### 問題 1：Container 無法啟動

**症狀：** `docker-compose restart api` 後容器持續 Restarting

**檢查步驟：**
```bash
# 查看錯誤日誌
docker-compose logs api --tail=50

# 常見錯誤：Prisma Client 未生成
# 解決方式：
docker exec -it machine_api npx prisma generate
docker-compose restart api
```

---

### 問題 2：404 Not Found（即使資料存在）

**可能原因：**
- 資料庫中的 `machineId` 與請求的 ID 不一致（大小寫敏感）
- 資料尚未寫入資料庫

**除錯指令：**
```bash
# 查看資料庫中的所有 machineId
docker exec -it machine_postgres psql -U user -d machine_db \
  -c "SELECT DISTINCT \"machineId\" FROM \"MachineStatus\";"
```

---

### 問題 3：Temperature 顯示 null

**可能原因：** 資料庫欄位 `temperature` 允許 NULL

**檢查資料：**
```bash
docker exec -it machine_postgres psql -U user -d machine_db \
  -c "SELECT * FROM \"MachineStatus\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

**程式碼保護：** 已使用 `|| 25.0` 提供預設值

---

## 📚 參考資源

- [DMTF Redfish Specification](https://www.dmtf.org/standards/redfish)
- [Prisma findFirst Documentation](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#findfirst)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)

---

## ✅ 檢查清單

開發完成前請確認：

- [ ] Controller 已正確注入 `MachineService`
- [ ] `getLatestStatus` 方法已加入 `machine.service.ts`
- [ ] 已重啟 Docker 容器使程式碼生效
- [ ] 測試資料已成功寫入資料庫
- [ ] GET API 回傳正確的 Redfish 格式
- [ ] 404 錯誤處理正常運作
- [ ] 健康狀態（Health）判斷邏輯正確
- [ ] 程式碼已提交到版本控制

---

**開發完成！** 🎉

此 API 現已可整合至監控儀表板或第三方管理系統使用。

