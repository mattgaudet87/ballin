"""
serve.py
-----------------------------------------------------------------------------
A tiny local web server for testing the game. It's the same as
`python3 -m http.server`, except it tells the browser NOT to cache files,
so a normal refresh always shows your latest changes.

    python3 tools/serve.py          (then open http://localhost:8000)
    python3 tools/serve.py 9000     (use a different port)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving Ballin' at http://localhost:{PORT}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
