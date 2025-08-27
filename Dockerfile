FROM node:18-alpine

WORKDIR /app

# 安裝系統依賴
RUN apk add --no-cache sqlite

# 複製 package 檔案
COPY package*.json ./

# 安裝 Node.js 依賴
RUN npm ci --only=production

# 複製應用程式檔案
COPY src/ ./src/
COPY public/ ./public/

# 建立上傳目錄
RUN mkdir -p uploads

# 設定環境變數
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 啟動應用程式
CMD ["node", "src/server.js"]
