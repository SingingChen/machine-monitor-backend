# 1. 基礎階段 (Base)
# 使用 Node.js 官方鏡像
FROM node:18-alpine AS base

# 設定容器內的工作目錄
WORKDIR /usr/src/app

# 只複製 package 檔案安裝，利用快取縮短之後的 build 時間
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 複製其餘程式碼
# 這裡先不寫 RUN npx prisma generate，等我們寫好 schema 再手動跑
COPY . .
RUN npx prisma generate


# 2. 開發階段 (Development) - 給 docker-compose 用
FROM base AS development
# 在開發階段明確設定 PORT 為 3000
ENV PORT=3000
EXPOSE 3000
# 本地開發不需要執行 build，直接啟動 dev 模式
CMD ["npm", "run", "start:dev"]


# 3. 建構階段 (Builder) - 為了產生 dist 檔案
FROM base AS builder
WORKDIR /usr/src/app

# 確保在編譯前產生 Prisma Client，否則編譯會找不到型別
RUN npx prisma generate
RUN npm run build

# 4. 正式運行階段 (Production) - 給 Cloud Run 用
FROM node:18-alpine AS production
WORKDIR /usr/src/app

# 複製 package 檔案
COPY package*.json ./

# 只安裝生產環境需要的套件（縮小體積並避免工具衝突）
RUN npm install --omit=dev --legacy-peer-deps

# 為了節省空間，只複製編譯後的檔案與必要的套件
COPY --from=builder /usr/src/app/dist ./dist
#COPY --from=builder /usr/src/app/node_modules ./node_modules
#COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /usr/src/app/prisma ./prisma

# Cloud Run 預設監聽 8080，我們讓 NestJS 跟進
# 確保環境變數正確
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# 正式環境啟動指令 增加一項檢查，確保 dist 資料夾真的存在

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
