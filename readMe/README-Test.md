
# 測試POST
curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-d '{"id": "MAC-010", "temp": 98.8, "status": "running"}'




curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-d '{"id": "MAC-010", "temp": 98.8, "status": "running"}'


curl -X POST http://localhost:3000/machine/status -H "Content-Type: application/json" -d '{"id": "MAC-021", "temp": 38.4, "status": "running"}'


curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-H "x-api-key: asdfvcxz" \
-d '{"id": "MAC-022", "temp": 68.4, "status": "running"}'


# 新增一筆高溫資料
curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-H "x-api-key: asdfvcxz" \
-d '{"id": "COOLING-02", "temp": 92.3, "status": "warning"}'

# 查詢高溫設備
curl http://localhost:3000/redfish/v1/Chassis/COOLING-02/Thermal