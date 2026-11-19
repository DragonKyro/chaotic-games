"""fetchtext.py URL [--archive] [--grep WORD] [--max N] [--links] [--cdx]

Research helper for rules work (see "Rules sources" in CLAUDE.md). Fetch a page
with curl (browser UA, follows redirects) and print it as readable text.

  --archive   fetch the newest Wayback Machine copy instead (web.archive.org/web/2025id_/URL).
              Most live rules sites are unreachable from this network; archived copies of
              server-rendered pages (MediaWiki wikis, plain HTML rule pages) usually work.
  --grep W    print only lines mentioning W, with context
  --max N     print at most N characters (default 20000)
  --links     list the page's links instead of its text (find card / rules pages)
  --cdx       treat URL as a prefix (e.g. explodingkittens.fandom.com/wiki/) and list the
              pages the Wayback Machine has archived under it — then fetch them with --archive

Every fetch is cached under .research-cache/ at the repo root (git-ignored), so repeat
lookups are free. Archive requests are paced to one every 10 s across all processes
(the archive blocks bursts as "abusive bot traffic") and retried with backoff on 429.
"""
import hashlib
import html
import os
import re
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
# The cache lives at the repo root (git-ignored), shared by everyone running this.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.research-cache')
STAMP = os.path.join(CACHE, 'last-archive-request')
os.makedirs(CACHE, exist_ok=True)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

args = sys.argv[1:]
url = args[0]
grep = args[args.index('--grep') + 1] if '--grep' in args else None
mx = int(args[args.index('--max') + 1]) if '--max' in args else 20000
archive = '--archive' in args or '--cdx' in args
if '--cdx' in args:
    url = ('https://web.archive.org/cdx/search/cdx?url=' + url.rstrip('*') + '*'
           '&output=txt&fl=original&collapse=urlkey&filter=statuscode:200&limit=400')
elif archive:
    url = 'https://web.archive.org/web/2025id_/' + url


def pace():
    """Wait until 10 s have passed since anyone's last archive request."""
    while True:
        try:
            last = float(open(STAMP).read().strip() or 0)
        except (OSError, ValueError):
            last = 0
        wait = last + 10 - time.time()
        if wait <= 0:
            open(STAMP, 'w').write(str(time.time()))
            return
        time.sleep(min(wait, 10) + 0.2)


def fetch(u):
    key = os.path.join(CACHE, hashlib.sha1(u.encode()).hexdigest() + '.html')
    if os.path.exists(key) and os.path.getsize(key) > 0:
        return open(key, encoding='utf-8', errors='ignore').read(), 'cached'
    for attempt in range(4):
        if archive:
            pace()
        r = subprocess.run(['curl', '-sL', '--compressed', '-A', UA, '--max-time', '60', '-w', '\n__HTTP__%{http_code}', u], capture_output=True)
        raw = r.stdout.decode('utf-8', 'ignore')
        body, _, code = raw.rpartition('\n__HTTP__')
        if code == '429' or 'flagged it as suspected abusive bot traffic' in body:
            time.sleep(30 * (attempt + 1))
            continue
        if code == '200':
            open(key, 'w', encoding='utf-8').write(body)
        return body, code
    return '', '429 (gave up after retries)'


body, code = fetch(url)
if '--cdx' in args:
    print(f'[{code}] archived pages', file=sys.stderr)
    print(body)
    sys.exit(0)
if '--links' in args:
    links = sorted(set(re.findall(r'href="([^"#]+)"', body)))
    print(f'[{code}] {len(links)} links from {url}', file=sys.stderr)
    print('\n'.join(html.unescape(l) for l in links))
    sys.exit(0)
t = re.sub(r'<(script|style|noscript)\b.*?</\1>', ' ', body, flags=re.S | re.I)
t = re.sub(r'<br\s*/?>|</(p|div|li|tr|h\d|td|th|dd|dt)>', '\n', t, flags=re.I)
t = html.unescape(re.sub(r'<[^>]+>', ' ', t))
t = re.sub(r'[ \t]+', ' ', t)
t = re.sub(r'\n\s*\n+', '\n', t).strip()
print(f'[{code}] {len(t)} chars from {url}', file=sys.stderr)
if grep:
    lines = t.split('\n')
    for i, line in enumerate(lines):
        if grep.lower() in line.lower():
            print('\n'.join(lines[max(0, i - 2):i + 5]))
            print('---')
else:
    print(t[:mx])
