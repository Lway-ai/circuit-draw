"""Dev server with no-cache headers so edits show up on refresh.

Usage:
    python serve.py            # default port 8642
    python serve.py 8655       # pick another port

Why the pre-flight check below exists:
    `allow_reuse_address` is kept so a quick restart right after shutdown
    still works, but on Windows SO_REUSEADDR also lets a *second* process
    bind a port that is already being served. Connections then get handed to
    whichever instance the OS feels like, so you can end up debugging a page
    that is not the one you edited. Verifying the port is genuinely free
    first turns that silent, baffling failure into a clear message.
"""
import http.server
import socket
import socketserver
import sys

DEFAULT_PORT = 8642


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()


def port_is_serving(host, port, timeout=0.35):
    """True when something is already accepting connections on host:port."""
    with socket.socket() as probe:
        probe.settimeout(timeout)
        return probe.connect_ex((host, port)) == 0


def main():
    try:
        port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    except ValueError:
        print(f"Port must be a number, got: {sys.argv[1]!r}")
        return 2

    if port_is_serving("127.0.0.1", port):
        print(f"Port {port} is already in use by another server.")
        print(f"  Open the running one:  http://127.0.0.1:{port}/index.html")
        print(f"  Or start another one:  python serve.py {port + 1}")
        return 1

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        print(f"Serving on http://127.0.0.1:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
