# 使用 Node.js 官方鏡像
FROM node:18-alpine

# 設定容器內的工作目錄
WORKDIR /usr/src/app

# 複製 package 檔案並安裝依賴
COPY package*.json ./
RUN npm install

# 複製其餘程式碼
COPY . .

# 產生 Prisma Client (這步很重要)
RUN npx prisma generate

# 編譯 NestJS
RUN npm run build

# 開放 API 端口
EXPOSE 3000

# 啟動指令
CMD ["npm", "run", "start:prod"]