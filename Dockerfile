# 使用 Node.js 官方鏡像
FROM node:18-alpine

# 設定容器內的工作目錄
WORKDIR /usr/src/app

# 只複製 package 檔案安裝，利用快取縮短之後的 build 時間
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 複製其餘程式碼
# 這裡先不寫 RUN npx prisma generate，等我們寫好 schema 再手動跑
COPY . .

# 開放 API 端口
EXPOSE 3000

# 改用開發模式
CMD ["npm", "run", "start:dev"]