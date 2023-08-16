FROM node:lts-alpine as builder
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
FROM node:lts-alpine as app
ENV NODE_ENV production
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app /app
ENTRYPOINT ["node"]
CMD ["bin/wildduck.js"]
