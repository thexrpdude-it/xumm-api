#!/bin/bash

ssh -t xumm "docker logs --tail 30 -f xumm"
