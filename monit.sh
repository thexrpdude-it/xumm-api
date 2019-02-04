#!/bin/bash

ssh -t xrparrot 'docker exec -it xrpl-sign sh -c "cd /usr/src/app;/usr/local/bin/pm2 monit"'
