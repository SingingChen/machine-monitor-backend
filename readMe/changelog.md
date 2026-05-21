## [1.1.0] - 2026-05-20

### Added
- **Redfish 國際標準雙向控制協定實作**：
    - 在 `RedfishController` 中正式新增 `PATCH /redfish/v1/Chassis/:id/Thermal` 遠端配置路由，呼應工業物聯網（IIoT）遠端調控硬體設備之核心需求。
    - 串接 `MachineService` 與 `PrismaService`，使遠端下達的設備配置參數（如水泵轉速 `pumpSpeed`、警報閾值 `upperThreshold`）能真正持久化寫入 **GCP Cloud SQL (PostgreSQL)**，拒絕傳統 Mock 假數據。
    - 實作**動態水溫感知機制**：執行 `PATCH` 控制配置時，系統會自動向資料庫查詢該設備當前最新一秒的真實水溫並自動帶入，解決過去測試時溫度數據「寫死（Hardcoded）」的架構痛點。
- **邊緣端控制軟體基礎架構 (Python Core)**：
    - 新增 `monitor.py` 自動化監控服務，在獨立的 **Docker 容器**網路環境中，透過標準 HTTP RESTful 協定，每 10 秒對 NestJS 核心進行狀態輪詢（Polling）。

### Changed
- **即時稽核日誌與前端同步 (Audit Trail & WebSocket)**：
    - 優化 NestJS 後端架構，當外部控制端（如 Python 或 網頁管理員）下達 `PATCH` 配置後，資料庫狀態將立即儲存為 `configured: pumpSpeed=XX` 之審計字串。
    - 觸發 WebSocket Gateway（大喇叭機制）進行全網廣播，使 **Vue 3 前端監控面板**在「完全不需重新整理網頁」的前提下，微秒級即時跳出全新的控制參數卡片，達成雲端與實體現場狀態的 100% 同步。

---

## [Next Steps] - 預計進行之優化
- **Python 控制核心防禦性編程（Flag 狀態鎖定）**：
    - 解決當前「過熱狀態下 Python 持續觸發 PATCH 請求」導致的指令風暴（Command Storm）問題。
    - 預計引入布林旗標（Boolean Flag）鎖定機制，確保單次過熱事件僅下達一次緊急降溫配置，隨後進入控制鎖定狀態，直至硬體實質降溫恢復正常，以符合工業級 SCADA 系統穩定性規範。

## [1.2.0] - 2026-05-21

### Fixed
- **動態阻斷「指令風暴（Command Storm）」問題**：
    - 修復了邊緣端在持續過熱狀態下，因無限循環導致 Cloud SQL 資料庫與前端網頁遭到 `configured: pumpSpeed=95` 訊息轟炸的架構缺陷。
    - 成功引入**邊緣端旗標鎖定機制（Boolean Flag State Lock）**，確保在單次過熱事件中，Python 控制軟體僅會發送「唯一一次」的緊急降溫配置指令。
    - 當指令成功送達後，Python 核心會自動切換至「控制鎖定」狀態進行靜態監控，直到設備實質降溫、狀態恢復正常（OK）後才會自動解除鎖定，大幅提升工業級系統的網路與資料庫穩定性。

### Changed
- **邊緣端容器開發流優化 (Docker Hot-Reload)**：
    - 調整 `docker-compose.yml` 部署設定，針對 `monitor` 服務引入本地磁碟卷掛載（Bind Mount Volumes）。
    - 解決了過去本機 `monitor.py` 程式碼變更無法即時同步至運行中容器內部的問題，打通了邊緣端軟體的熱重載（Hot-Reload）開發流程。
    - 處理了 Linux 環境下 Python 標準輸出的緩衝區（Buffer）延遲問題，確保 `docker logs -f` 能夠即時、精準地觀測到邊緣端的控制決策。