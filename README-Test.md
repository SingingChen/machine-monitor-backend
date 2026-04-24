
# 測試POST
curl -X POST http://localhost:3000/machine/status \
-H "Content-Type: application/json" \
-d '{"id": "MAC-003", "temp": 88.8, "status": "stopped"}'
    