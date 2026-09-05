#!/usr/bin/env python3
"""Repair known single-byte corruptions in data-store.parts.b64 before assemble."""
from pathlib import Path
import base64, zlib, hashlib

PARTS = Path('data-store.parts.b64')
EXPECTED = {
    '01': {'sha256': 'fb7d2507b383e240da2b5e6f7be611f24318fc4c74452dd2517173f276cdb159', 'len': 3844},
    '11': {'sha256': '38f320a7efe6c134454d37a302c945fdfdad4f80e6add33a6abe6ce32734d5f4', 'len': 3036},
    '13': {'sha256': '24cf0810ed30c612ca2ecd6ccc271424c517217799b40e2e5ffb7e0a4bc0fc81', 'len': 3700},
}

def apply_01(s: str) -> str:
    # Missing 'H' in ...K+H3HPiD... (became K+H3Pi)
    needle = 'edkz/6K+H3PiDGvxub7MBf2tQ'
    fixed_needle = 'edkz/6K+H3HPiDGvxub7MBf2tQ'
    if fixed_needle in s:
        return s
    if needle not in s:
        raise SystemExit('01: unexpected content, cannot repair')
    return s.replace(needle, fixed_needle, 1)

def apply_11(s: str) -> str:
    # Typo qiq -> liq in ...TqiqJLvw...
    bad = 'TqiqJLvwDA1fW8OP8KqweGDW3bo'
    good = 'TliqJLvwDA1fW8OP8KqweGDW3bo'
    if good in s:
        return s
    if bad not in s:
        raise SystemExit('11: unexpected content, cannot repair')
    return s.replace(bad, good, 1)

def apply_13(s: str) -> str:
    # Missing 's' after kmU and Z->J in WirZ
    if 'kmUs6VdK' in s and 'kWirJVNx' in s:
        return s
    if 'kmU6VdK' not in s:
        raise SystemExit('13: unexpected content (kmU), cannot repair')
    s = s.replace('kmU6VdK', 'kmUs6VdK', 1)
    if 'kWirZVNx' in s:
        s = s.replace('kWirZVNx', 'kWirJVNx', 1)
    elif 'kWirJVNx' not in s:
        raise SystemExit('13: unexpected content (Wir), cannot repair')
    return s

APPLIERS = {'01': apply_01, '11': apply_11, '13': apply_13}

for name, applier in APPLIERS.items():
    path = PARTS / f'{name}.zlib.b64'
    original = path.read_text().strip()
    fixed = applier(original).strip()
    # must decode
    zlib.decompress(base64.b64decode(fixed))
    exp = EXPECTED[name]
    digest = hashlib.sha256(fixed.encode()).hexdigest()
    if len(fixed) != exp['len'] or digest != exp['sha256']:
        raise SystemExit(f'{name}: repaired but checksum mismatch len={len(fixed)} sha={digest}')
    if fixed != original:
        path.write_text(fixed + '\n')
        print(f'repaired {name}')
    else:
        print(f'ok {name}')
print('repair complete')
