"""CLI: python -m angel_agent_guard (or angel-agent-guard-py) scan|verify|quick ...

Exit codes: 0 clean/pay, 1 caution/unchecked, 2 hostile/do_not_pay, 3 usage or error.
"""

from __future__ import annotations

import json
import sys
from typing import List

from . import guard_untrusted, quick_scan, verify_before_pay
from ._local import local_verdict

USAGE = """usage:
  angel-agent-guard-py scan "<text>" | <https-url> | -      prompt-injection check (local + hosted)
  angel-agent-guard-py verify <https-url> [--post]          pre-purchase check (shop, checkout, payment link, API, x402)
  angel-agent-guard-py verify --token 0x... [--chain base|ethereum]
  angel-agent-guard-py quick "<text>" | -                    offline only"""


def main(argv: List[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(USAGE)
        return 3
    cmd, rest = argv[0], argv[1:]
    flag = lambda name: rest[rest.index(name) + 1] if name in rest and rest.index(name) + 1 < len(rest) else None  # noqa: E731
    positional = [a for i, a in enumerate(rest) if not a.startswith("--") and (i == 0 or rest[i - 1] not in ("--token", "--chain"))]
    if cmd in ("scan", "quick"):
        text = sys.stdin.read() if positional[:1] == ["-"] else " ".join(positional)
        if not text:
            print(USAGE, file=sys.stderr)
            return 3
        if cmd == "quick":
            q = quick_scan(text)
            print(json.dumps(q.to_dict(), ensure_ascii=False, indent=2))
            v = local_verdict(q)
            return 2 if v == "hostile" else 1 if v == "caution" else 0
        g = guard_untrusted(text)
        print(json.dumps(g.to_dict(), ensure_ascii=False, indent=2))
        return 0 if g.verdict == "clean" else 2 if g.verdict == "hostile" else 1
    if cmd == "verify":
        url, token = (positional[0] if positional else None), flag("--token")
        if not url and not token:
            print(USAGE, file=sys.stderr)
            return 3
        r = verify_before_pay(url=url, token=token, chain=flag("--chain") or "base", method="POST" if "--post" in rest else "GET")
        print(json.dumps(r.to_dict(), ensure_ascii=False, indent=2, default=str))
        return 0 if r.verdict == "pay" else 2 if r.verdict == "do_not_pay" else 1
    print(USAGE, file=sys.stderr)
    return 3


def run() -> None:
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # pragma: no cover
        print(str(e), file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    run()
