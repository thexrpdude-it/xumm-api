#!/usr/bin/env bash

docker stop xumm
docker rm xumm

# git pull
# npm install
# docker rmi xumm/xumm-backend
# docker build -t xumm/xumm-backend .

docker run \
  --name xumm \
  -d \
  --restart=always \
  -p 3000:3000 \
  -v $(pwd):/usr/src/app \
  --link mysql \
  --link redis \
  xumm/xumm-backend --env production
