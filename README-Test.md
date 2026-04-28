
# 測試POST
curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-d '{"id": "MAC-010", "temp": 98.8, "status": "running"}'
    