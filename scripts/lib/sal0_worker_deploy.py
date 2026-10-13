#!/usr/bin/env python3
"""Validate and render the Mission Control Wrangler configuration."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
import tomllib
from urllib.parse import urlparse


ACCOUNT_ID_PATTERN = re.compile(r"^[a-fA-F0-9]{32}$")
AUDIENCE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{20,128}$")
EMAIL_PATTERN = re.compile(r"^[^@\s,]+@[^@\s,]+\.[^@\s,]+$")
GIT_SHA_PATTERN = re.compile(r"^[a-f0-9]{40}$")
TEAM_HOST_PATTERN = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$"
)


def validated_values(environment: dict[str, str]) -> dict[str, str]:
    account_id = environment.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if not ACCOUNT_ID_PATTERN.fullmatch(account_id):
        raise ValueError("CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal ID")

    team_domain = environment.get("TEAM_DOMAIN", "").strip().rstrip("/")
    parsed_domain = urlparse(team_domain)
    if (
        parsed_domain.scheme != "https"
        or not parsed_domain.hostname
        or not TEAM_HOST_PATTERN.fullmatch(parsed_domain.hostname)
        or parsed_domain.username is not None
        or parsed_domain.password is not None
        or parsed_domain.port is not None
        or parsed_domain.path not in ("", "/")
        or parsed_domain.params
        or parsed_domain.query
        or parsed_domain.fragment
    ):
        raise ValueError("TEAM_DOMAIN must be an https://*.cloudflareaccess.com origin")

    policy_aud = environment.get("POLICY_AUD", "").strip()
    if not AUDIENCE_PATTERN.fullmatch(policy_aud):
        raise ValueError("POLICY_AUD must be a 20-128 character base64url-style audience")

    owners = [owner.strip() for owner in environment.get("OWNER_EMAILS", "").split(",")]
    if not owners or any(not EMAIL_PATTERN.fullmatch(owner) for owner in owners):
        raise ValueError("OWNER_EMAILS must be a comma-separated list of valid email addresses")

    deployed_git_sha = environment.get("DEPLOYED_GIT_SHA", "").strip()
    if not GIT_SHA_PATTERN.fullmatch(deployed_git_sha):
        raise ValueError("DEPLOYED_GIT_SHA must be a full lowercase 40-character Git SHA")

    return {
        "TEAM_DOMAIN": team_domain,
        "POLICY_AUD": policy_aud,
        "OWNER_EMAILS": ",".join(owners),
        "DEPLOYED_GIT_SHA": deployed_git_sha,
    }


def render_config(source: Path, output: Path, environment: dict[str, str]) -> None:
    values = validated_values(environment)
    config = source.read_text()

    for key, value in values.items():
        replacement = f"{key} = {json.dumps(value)}"
        config, count = re.subn(
            rf'(?m)^{key}\s*=\s*".*"$',
            lambda _match, replacement=replacement: replacement,
            config,
        )
        if count != 1:
            raise ValueError(f"expected one {key} line in {source}, found {count}")

    if re.search(r"replace-me|replace-with|owner@example\.com", config):
        raise ValueError("a placeholder survived deployment config rendering")

    parsed = tomllib.loads(config)
    if parsed.get("workers_dev") is not True:
        raise ValueError("workers_dev must stay true because the web app calls that route")

    output.write_text(config)


def main() -> int:
    if len(sys.argv) != 3:
        print(f"usage: {Path(sys.argv[0]).name} SOURCE OUTPUT", file=sys.stderr)
        return 2

    try:
        render_config(Path(sys.argv[1]), Path(sys.argv[2]), dict(os.environ))
    except (OSError, ValueError, tomllib.TOMLDecodeError) as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1

    print("wrangler.toml rendered and parsed; deployment values are structurally valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
