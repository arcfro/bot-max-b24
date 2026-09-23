#!/usr/bin/env python3
"""List MAX subscriptions; delete dz-web webhook if same bot also on max.ingeo-lab.ru."""
import json
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

s = json.loads(Path('/opt/bot-max-b24/data/settings.json').read_text())
token = s['botToken']
ctx = ssl.create_default_context()


def api(method: str, path: str) -> tuple[int, str]:
    req = urllib.request.Request(
        f'https://platform-api2.max.ru{path}',
        method=method,
        headers={'Authorization': token, 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=25) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


status, body = api('GET', '/subscriptions')
print('GET', status, body)
data = json.loads(body) if body else {}
subs = data.get('subscriptions') or []
urls = [item.get('url') for item in subs if isinstance(item, dict) and item.get('url')]
print('urls', urls)

for u in urls:
    if u.rstrip('/').endswith('/api/max/webhook') and 'max.ingeo-lab.ru' not in u:
        q = urllib.parse.urlencode({'url': u})
        st, resp = api('DELETE', f'/subscriptions?{q}')
        print('DELETE', u, st, resp)

status, body = api('GET', '/subscriptions')
print('GET after', status, body)
