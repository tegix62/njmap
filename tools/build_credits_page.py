#!/usr/bin/env python3
"""Write credits.html from data/landmark-credits.json (photo credits for the landmark pictures)."""
import html, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
c = json.load(open(os.path.join(ROOT, 'data/landmark-credits.json')))
njp = os.path.join(ROOT, 'data/nj-landmark-credits.json')
if os.path.exists(njp):
    c.update(json.load(open(njp)))     # (the New Jersey landmarks' photos)
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
<h2>3D buildings</h2>
<p>Building heights come from NYC Open Data building footprints. The shapes of about 190 of the tallest towers (their setbacks, crowns and spires) are cut from the NYC 3D Model by Community District, published by the NYC Department of City Planning from the 2014 aerial survey of the NYC Department of Information Technology and Telecommunications. The towers finished since then (One Vanderbilt, Central Park Tower, 111 W 57th, 432 Park), and about 1,800 buildings whose podiums and setbacks are mapped, are built from OpenStreetMap building parts, as republished by Overture Maps: © OpenStreetMap contributors, ODbL. The Javits Center's shape is from the 2017 NYC aerial LiDAR (NYC and NOAA, public domain). The New Jersey landmarks and the buildings round them are Overture Maps building footprints (© OpenStreetMap contributors, ODbL, and other sources Overture lists).</p>
''')
print(len(c), 'credits')
