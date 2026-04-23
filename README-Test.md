
# 測試POST
curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-d '{"id": "MAC-001", "temp": 55.4, "status": "running"}'
