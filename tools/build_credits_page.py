#!/usr/bin/env python3
"""Write credits.html from data/landmark-credits.json (photo credits for the landmark pictures)."""
import html, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
c = json.load(open(os.path.join(ROOT, 'data/landmark-credits.json')))
rows = ''.join(
    f'<li><b>{html.escape(n)}</b> — {html.escape(v["author"] or "unknown author")}, {html.escape(v["license"])}'
    f' · <a href="{html.escape(v["page"])}">source</a></li>' for n, v in sorted(c.items()))
open(os.path.join(ROOT, 'credits.html'), 'w').write(f'''<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photo credits</title>
<style>body{{font:15px/1.5 system-ui,sans-serif;margin:0;padding:20px 16px 40px;max-width:640px;margin:auto;background:#f6f3ea;color:#1f1b16}}li{{margin:0 0 .6em}}a{{color:#0b7a68}}</style>
<h1>Photo credits</h1>
<p>Landmark photos come from Wikimedia Commons under the licenses below (CC BY, CC BY-SA or public domain), reduced in size. The building silhouettes are drawn for this app. <a href="./">Back to the app</a></p>
<ul>{rows}</ul>
''')
print(len(c), 'credits')
