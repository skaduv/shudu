#!/usr/bin/env python3
# 液态数独静态站点服务（Next.js 静态导出）
import os, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial

ROOT = os.path.expanduser("~/sudoku/site")
PORT = int(os.environ.get("PORT", "8787"))

class H(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json", ".json": "application/json", ".js": "text/javascript", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".html": "text/html; charset=utf-8"}
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=os.path.realpath(ROOT), **kw)
    def end_headers(self):
        p = self.path.split("?")[0]
        if p.startswith("/_next/static/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif p == "/sw.js":
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()
    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path):
            # /play -> /play/ 由父类处理目录；不存在的路径返回 404 页
            alt = path.rstrip("/") + ".html"
            if os.path.isfile(alt):
                self.path = self.path.split("?")[0].rstrip("/") + ".html"
                return super().send_head()
            f = os.path.join(os.path.realpath(ROOT), "404.html")
            if os.path.isfile(f):
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                data = open(f, "rb").read()
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                import io
                return io.BytesIO(data)
        return super().send_head()
    def log_message(self, fmt, *args):
        pass

ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
