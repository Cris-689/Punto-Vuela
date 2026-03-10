FROM node:20-slim
WORKDIR /app

# Copiamos los archivos desde la subcarpeta frontend
COPY frontend/package*.json ./
RUN npm install

# Copiamos todo el contenido de la subcarpeta frontend
COPY frontend/ .

RUN npm run build

# Etapa de producción (Nginx)
FROM nginx:stable-alpine
COPY --from=0 /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
