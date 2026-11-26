@echo off
title Doga Parkuru - Yerel Sunucu
cd /d "%~dp0"
echo Doga Parkuru baslatiliyor...
echo Tarayicida acilacak adres: http://localhost:8080
echo Kapatmak icin bu pencereyi kapatabilirsiniz.
start "" http://localhost:8080
py -m http.server 8080
