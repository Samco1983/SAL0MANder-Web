#!/usr/bin/env python3
"""Call the OpenAI API for the coach seat, using nothing but stdlib.

No SDK on purpose. `pip install openai` is one more thing to keep current on a
machine where two agents already disagree about what is installed, and this
needs exactly one HTTPS POST.

Reads OPENAI_API_KEY, MODEL and PROMPT from the environment so the key never
appears in a command line, where `ps` would show it to any process on the box.
"""

import json
import os
import sys
import urllib.error
import urllib.request

ENDPOINT = "https://api.openai.com/v1/chat/completions"
TIMEOUT_SECONDS = 120


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY", "")
    prompt = os.environ.get("PROMPT", "")
    model = os.environ.get("MODEL", "gpt-5")

    if not key:
        print("no OPENAI_API_KEY in environment", file=sys.stderr)
        return 1
    if not prompt:
        print("no PROMPT in environment", file=sys.stderr)
        return 1

    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode()

    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        # Print the status, never the request — the header carries the key.
        detail = error.read().decode(errors="replace")[:400]
        print(f"HTTP {error.code}: {detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"network: {error.reason}", file=sys.stderr)
        return 1

    try:
        text = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        print(f"unexpected response shape: {json.dumps(payload)[:400]}", file=sys.stderr)
        return 1

    print(text.strip())

    usage = payload.get("usage") or {}
    if usage:
        # Spend belongs next to the output that cost it.
        print(
            f"\n---\ntokens: {usage.get('prompt_tokens', '?')} in, "
            f"{usage.get('completion_tokens', '?')} out",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
