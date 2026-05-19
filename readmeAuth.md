
# 🚀 機器狀態監控系統：API 認證與雲端優化全指南 (V2)

本文件詳述了如何從零開始建立認證、解決雲端重試延遲、以及排除環境變數失效的完整流程。

## 一、 第一階段：使用 NestJS CLI 建立 Auth Guard

透過 CLI 指令可以確保檔案路徑正確並自動生成測試檔案。

### 1. 執行生成指令
在專案根目錄開啟終端機，輸入：
```bash
# g = generate, gu = guard
# 格式：nest g gu [路徑/名稱]
nest g gu auth/api-key/api-key
```

### 2. 生成檔案結構
執行後你會得到兩個檔案：
1. `src/auth/api-key/api-key.guard.ts`：認證邏輯主體。
2. `src/auth/api-key/api-key.guard.spec.ts`：單元測試檔案。

### 3. 編寫 Guard 邏輯 (`api-key.guard.ts`)
```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientKey = request.headers['x-api-key']; // 從 Header 取得
    const serverKey = process.env.API_KEY?.trim();   // 從系統變數取得

    if (!serverKey || clientKey !== serverKey) {
      throw new UnauthorizedException('無效的 API Key，拒絕存取');
    }
    return true;
  }
}
```

---

## 二、 第二階段：解決雲端延遲問題 (3~5 分鐘)

**問題根源：** 格式不對（例如 `statu4`）導致 Prisma 存檔噴出 `500` 錯誤，進而觸發 Pub/Sub 的**重試機制**。

### 🛠️ 優化後的 `MachineService` 存檔邏輯
修改 `src/machine.service.ts`，增加對接容錯：
```typescript
async createStatus(data: any) {
  // 自動將 curl 欄位對接到 Prisma 模型
  const machineId = data.id || data.machineId;
  const temperature = data.temp !== undefined ? data.temp : data.temperature;
  const status = data.status || data.statu4 || 'unknown';

  // 1. 必要欄位檢查 (避免撞 Prisma)
  if (!machineId) return null; 

  try {
    // 2. 資料存檔
    const newLog = await this.prisma.machineStatus.create({
      data: { machineId, temperature, status, rawData: data }
    });
    // 3. 計算統計並 WebSocket 廣播
    const latestStats = await this.getStats();
    this.machineGateway.broadcastUpdate({ newLog, latestStats });
    return newLog;
  } catch (e) {
    console.error('Prisma Error:', e.message);
    return null; // 為了不讓 Pub/Sub 重試，回傳成功信號
  }
}
```

---

## 三、 第三階段：雲端環境變數與清除舊資料

### 1. 修正進入點 (`main.ts`)
雲端環境有時無法自動載入 `.env`，必須手動加載：
```typescript
import * as dotenv from 'dotenv';
dotenv.config(); // 務必放在最頂端

import { NestFactory } from '@nestjs/core';
// ... 略
```

### 2. 清除積壓的「髒資料」
若延遲持續，請進入 **GCP Pub/Sub 控制台**：
* 選擇 **Subscriptions (訂閱)** -> **清除訊息 (Purge Messages)**。
* *這會清空隊列中那些格式錯誤、會導致重試的舊訊息。*

---

## 四、 測試與維護指令表 (Cheat Sheet)

| 動作 | 指令 / 操作 |
| :--- | :--- |
| **生成 Guard** | `nest g gu auth/api-key/api-key` |
| **本地測試 (CURL)** | `curl -H "x-api-key: asdfvcxz" -d '{"id":"MAC-1","temp":50,"status":"running"}' http://localhost:3000/machine/status` |
| **查看雲端日誌** | `gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR"` |
| **手動清空隊列** | GCP Console -> Pub/Sub -> Subscription -> Purge |

---

## 💡 開發小技巧：如何排除測試檔？
如果你不希望 `.spec.ts` 檔案跟著編譯到 Docker 或雲端：
1. 在 `tsconfig.build.json` 的 `exclude` 陣列中加入 `"**/*.spec.ts"`。
2. 或是直接在 `.dockerignore` 加入 `**/*.spec.ts`。

這份文件現在更完整了，包含了 CLI 指令與檔案生成邏輯。之後如果要做新的 Guard（例如 `AdminGuard`），直接複製這個流程即可！