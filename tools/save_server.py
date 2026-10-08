# -*- coding: utf-8 -*-
"""本机小接收器：网页里 fetch('http://127.0.0.1:8932/save?name=xxx.png',{method:'POST',body:blob}) 就把图存到 art/_raw/。
只监听本机，只接受 .png/.jpg/.webp 文件名，用来从 Gemini 页面把生成的立绘直接存进项目。"""
import re, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
OUT = Path(__file__).resolve().parent.parent / "art" / "_raw"; OUT.mkdir(parents=True, exist_ok=True)

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers", "*")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        q = parse_qs(urlparse(self.path).query); name = (q.get("name") or [""])[0]
        if not re.fullmatch(r"[\w一-鿿-]+\.(png|jpg|jpeg|webp)", name):
            self.send_response(400); self._cors(); self.end_headers(); self.wfile.write(b"bad name"); return
        n = int(self.headers.get("Content-Length", "0")); data = self.rfile.read(n)
        (OUT / name).write_bytes(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(f"saved {name} {n} bytes".encode())
    def log_message(self, *a): pass

print("save server on http://127.0.0.1:8932 ->", OUT, flush=True)
HTTPServer(("127.0.0.1", 8932), H).serve_forever()
