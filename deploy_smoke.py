"""
Post-deploy smoke checks for CardSnap.

Validates that the deployed frontend + backend are reachable, wired together
correctly (CORS, VITE_API_URL), and that core API flows still work in prod.

Usage:
    python deploy_smoke.py --frontend https://cardsnap.vercel.app --backend https://cardsnap-api.up.railway.app

Run this after every deploy. Exits 0 on success, 1 on any failure.
"""

import argparse
import sys
import re
import subprocess
from pathlib import Path

import httpx

_TTY = sys.stdout.isatty()
G = "\033[32m" if _TTY else ""
R = "\033[31m" if _TTY else ""
Y = "\033[33m" if _TTY else ""
B = "\033[1m" if _TTY else ""
N = "\033[0m" if _TTY else ""

failures = []


def step(name, fn):
    print(f"  · {name} ... ", end="", flush=True)
    try:
        detail = fn() or ""
        print(f"{G}OK{N} {detail}")
    except AssertionError as e:
        print(f"{R}FAIL{N}\n    {e}")
        failures.append((name, str(e)))
    except Exception as e:
        print(f"{R}ERROR{N}\n    {type(e).__name__}: {e}")
        failures.append((name, f"{type(e).__name__}: {e}"))


def section(t):
    print(f"\n{B}{t}{N}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frontend", required=True, help="Deployed frontend URL (e.g. https://cardsnap.vercel.app)")
    parser.add_argument("--backend", required=True, help="Deployed backend URL (e.g. https://cardsnap-api.up.railway.app)")
    parser.add_argument("--skip-backend-smoke", action="store_true", help="Skip the in-depth backend smoke (just reachability)")
    args = parser.parse_args()

    frontend = args.frontend.rstrip("/")
    backend = args.backend.rstrip("/")

    print(f"{B}CardSnap deploy smoke{N}")
    print(f"  Frontend: {frontend}")
    print(f"  Backend:  {backend}\n")

    client = httpx.Client(timeout=30.0, follow_redirects=True)

    # ───── Frontend reachability ─────
    section("Frontend")

    state = {"html": ""}

    def frontend_root():
        r = client.get(frontend)
        assert r.status_code == 200, f"expected 200, got {r.status_code}"
        ctype = r.headers.get("content-type", "")
        assert "html" in ctype.lower(), f"expected HTML content-type, got {ctype}"
        state["html"] = r.text
        return f"({len(r.text)} bytes)"

    step("GET / returns HTML", frontend_root)

    def spa_root_div():
        assert '<div id="root">' in state["html"], "missing <div id=\"root\"> — frontend may not be built"

    step("SPA root element present", spa_root_div)

    def spa_route_fallback():
        # Deep route should also return the SPA shell, not 404
        r = client.get(f"{frontend}/contacts")
        assert r.status_code == 200, f"deep SPA route /contacts returned {r.status_code}"

    step("SPA deep route /contacts serves the shell", spa_route_fallback)

    # ───── Backend reachability ─────
    section("Backend reachability")

    def backend_health():
        r = client.get(f"{backend}/health")
        assert r.status_code == 200, f"expected 200, got {r.status_code}"
        body = r.json()
        assert body.get("status") == "ok", f"unexpected body: {body}"

    step("GET /health returns ok", backend_health)

    # ───── CORS wiring (browser-style preflight) ─────
    section("CORS wiring")

    def cors_preflight():
        r = client.request(
            "OPTIONS",
            f"{backend}/extract",
            headers={
                "Origin": frontend,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert r.status_code in (200, 204), f"OPTIONS preflight got {r.status_code}"
        allow_origin = r.headers.get("access-control-allow-origin", "")
        assert allow_origin in (frontend, "*"), (
            f"CORS allow-origin doesn't permit frontend: got {allow_origin!r}, "
            f"frontend is {frontend}"
        )
        allow_methods = r.headers.get("access-control-allow-methods", "").upper()
        assert "POST" in allow_methods or allow_methods == "*", f"POST not allowed: {allow_methods}"
        return f"(allow-origin={allow_origin})"

    step("CORS preflight to /extract permits frontend origin", cors_preflight)

    def cors_actual_request():
        r = client.get(f"{backend}/health", headers={"Origin": frontend})
        allow_origin = r.headers.get("access-control-allow-origin", "")
        assert allow_origin in (frontend, "*"), (
            f"Real request from frontend origin lacks ACAO header. Got: {allow_origin!r}"
        )

    step("Real request from frontend origin gets ACAO header", cors_actual_request)

    # ───── Bundle audit — VITE_API_URL embedded? ─────
    section("Build audit")

    def vite_api_url_baked_in():
        # Pull the main JS bundle referenced in index.html and verify it embeds the backend URL.
        # If VITE_API_URL was unset at build time, the bundle falls back to localhost:8000 → prod breaks.
        m = re.search(r'src="([^"]*\.js)"', state["html"])
        if not m:
            return "(no JS bundle found in HTML — skipping)"
        bundle_path = m.group(1)
        if bundle_path.startswith("/"):
            bundle_url = frontend + bundle_path
        else:
            bundle_url = bundle_path
        r = client.get(bundle_url)
        assert r.status_code == 200, f"bundle fetch returned {r.status_code}"
        text = r.text
        if "localhost:8000" in text:
            raise AssertionError("bundle contains 'localhost:8000' — VITE_API_URL not set at build time")
        # Should reference the deployed backend host
        backend_host = backend.replace("https://", "").replace("http://", "").rstrip("/")
        assert backend_host in text, (
            f"bundle does not reference backend host '{backend_host}' — "
            f"VITE_API_URL may be wrong"
        )
        return f"(references {backend_host})"

    step("Frontend bundle has correct VITE_API_URL", vite_api_url_baked_in)

    # ───── Full backend smoke (delegates) ─────
    if not args.skip_backend_smoke:
        section("Backend in-depth smoke")
        smoke = Path(__file__).parent / "backend" / "smoke_test.py"
        if not smoke.exists():
            print(f"  {Y}!{N} smoke_test.py not found at {smoke} — skipping")
        else:
            print(f"  -> running {smoke.name} against {backend}\n")
            result = subprocess.run(
                [sys.executable, str(smoke), backend],
                capture_output=False,
            )
            if result.returncode != 0:
                failures.append(("backend smoke", "smoke_test.py failed — see output above"))

    # ───── Summary ─────
    print()
    if failures:
        print(f"{R}{B}DEPLOY SMOKE FAILED{N} — {len(failures)} issue(s):")
        for name, detail in failures:
            print(f"  · {name}: {detail}")
        sys.exit(1)
    print(f"{G}{B}DEPLOY SMOKE PASSED{N} — frontend + backend are wired correctly.")
    sys.exit(0)


if __name__ == "__main__":
    main()
