from pathlib import Path

p = Path('.github/final-audit.py')
s = p.read_text()

oud = 'if(Math.abs(a.x-b.x)<48 && Math.abs(a.v-b.v)<=1) redundant.push(a.v+"°/"+b.v+"°");'
nieuw = 'if(Math.abs(a.x-b.x)<48 && a.v===b.v) redundant.push(a.v+"°/"+b.v+"°");'
if s.count(oud) != 1:
    raise SystemExit('temperatuurtest niet eenduidig gevonden')
s = s.replace(oud, nieuw, 1)

oud = '  const root=__dirname, html=fs.readFileSync(path.join(root,"index.html"),"utf8");\n  const ids=[...html.matchAll(/\\sid="([^\"]+)"/g)].map(m=>m[1]);'
nieuw = '  const root=__dirname, html=fs.readFileSync(path.join(root,"index.html"),"utf8");\n  const markup=html.split("<script",1)[0];\n  const ids=[...markup.matchAll(/\\sid="([^\"]+)"/g)].map(m=>m[1]);'
if s.count(oud) != 1:
    raise SystemExit('HTML-id-test niet eenduidig gevonden')
s = s.replace(oud, nieuw, 1)

p.write_text(s)
Path(__file__).unlink()
