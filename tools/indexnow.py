#!/usr/bin/env python3
"""Avisa a Bing/Yandex (IndexNow) de todas las URL del sitemap. Uso: python3 tools/indexnow.py"""
import json
import re
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CLAVE = "9bed2c2d09393a8db9d492ed35b949ba"
urls = re.findall(r"<loc>(.*?)</loc>", (RAIZ / "sitemap.xml").read_text())
cuerpo = {"host": "pdf.24bytes.pro", "key": CLAVE, "keyLocation": f"https://pdf.24bytes.pro/{CLAVE}.txt", "urlList": urls}
peticion = urllib.request.Request("https://api.indexnow.org/indexnow", data=json.dumps(cuerpo).encode(),
                                  headers={"Content-Type": "application/json; charset=utf-8"})
print(urllib.request.urlopen(peticion).status, len(urls), "URL enviadas")
