#!/usr/bin/env bash

docker stop xrpl-sign
docker rm xrpl-sign
# docker rmi xrpl-sign
# docker build -t xign/xrpl-sign .
docker run \
  --name xrpl-sign \
  -d \
  --restart=always \
  -p 3000:3000 \
  -v $(pwd):/usr/src/app \
  --link mysql \
  --link redis \
  xign/xrpl-sign --env production
