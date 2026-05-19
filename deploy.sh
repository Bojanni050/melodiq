#!/bin/bash
cd /var/www/vhosts/bojannatuurlijk.nl/sonara.bojannatuurlijk.nl
/usr/bin/docker compose down
/usr/bin/docker compose up -d --build
