
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