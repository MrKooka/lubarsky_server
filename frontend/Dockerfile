# Stage 1: Build the React app
FROM node:20-alpine AS build

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package.json package-lock.json ./

# Установка зависимостей
RUN npm install --silent

# Копирование остального кода приложения
COPY . .

# Сборка React-приложения
RUN npm run build

# Stage 2: Serve the React app with serve
FROM node:20-alpine

# Установка serve глобально
RUN npm install -g serve

# Установка рабочей директории
WORKDIR /app

# Копирование сборки из предыдущего этапа
COPY --from=build /app/dist ./dist

# Экспонирование порта 5000 (можно выбрать другой, если нужно)
EXPOSE 5000

# Запуск приложения с помощью serve
CMD ["serve", "-s", "dist", "-l", "5000"]
