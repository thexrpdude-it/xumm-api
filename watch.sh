#!/bin/bash

ssh xrparrot "docker logs --tail 30 -f xrpl-sign"
