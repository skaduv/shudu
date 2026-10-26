#!/bin/bash
# 用法：deploy.sh <tgz地址>；原子切换 site 软链，保留最近 3 个版本
set -e
cd ~/sudoku
curl -sfL "$1" -o out.tgz
TS=$(date +%s); mkdir site.$TS; tar xzf out.tgz -C site.$TS
[ -d site/qa-shots ] && cp -r site/qa-shots site.$TS/ || true
ln -sfn site.$TS site
ls -dt site.1* | tail -n +4 | xargs -r rm -rf
echo deployed site.$TS
