from pathlib import Path
from bs4 import BeautifulSoup, NavigableString
import json,re,hashlib,argparse
parser=argparse.ArgumentParser(description="Convert supplied article HTML into data; never execute source scripts.")
parser.add_argument("source", type=Path, help="Folder containing pre-intermediate/ and intermediate/ HTML sources")
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1]/"lib/articles/catalog.json")
args=parser.parse_args()
root=args.source; out=args.output
def text(n): return re.sub(r'\s+',' ',n.get_text()).strip()
def inline(n):
 parts=[]
 for c in n.children:
  if isinstance(c,NavigableString):
   if str(c): parts.append({'text':str(c),'highlight':False})
  else:
   assert c.name in ['mark','b','i','strong','em','br'],c.name
   parts.append({'text':' ' if c.name=='br' else c.get_text(),'highlight':c.name=='mark'})
 return parts
def blocks(n):
 result=[]
 for c in n.children:
  if isinstance(c,NavigableString):
   assert not c.strip(),repr(c)
   continue
  if c.name in ['h2','h3','p']: result.append({'kind':'heading' if c.name.startswith('h') else 'paragraph','parts':inline(c)})
  elif c.name=='figure': result.append({'kind':'caption','parts':[{'text':text(c),'highlight':False}]})
  elif c.name=='div':
   if c.find(['div','figure','p','h2'],recursive=False): result+=blocks(c)
   else: result.append({'kind':'paragraph','parts':inline(c)})
  else: raise ValueError(c.name)
 return result
lessons=[]
for p in sorted(root.glob('*/*.html')):
 s=BeautifulSoup(p.read_text(),'html.parser'); script=s.script.string
 def literal(name):
  m=re.search(r'\bvar\s+'+name+r'\s*=\s*',script)
  if not m: return []
  return json.JSONDecoder().raw_decode(script[m.end():])[0]
 article=s.article; content=blocks(article)
 original=text(article); converted=re.sub(r'\s+',' ', ' '.join(''.join(part['text'] for part in b['parts']) for b in content)).strip()
 assert re.sub(r"\s+","",original)==re.sub(r"\s+","",converted),p.name
 vocab=[]
 for v in s.select('.vcard'):
  heading=v.parent.find_previous_sibling('h3')
  vocab.append({'word':text(v.b),'meaning':text(v.select_one('.d')),'group':text(heading) if heading else ''})
 notes=[]
 for n in s.select('#vocab-h ~ .bank, #vocab-h ~ .tips li'):
  notes.append(n.get_text(' ',strip=True))
 exercises=[]
 for e in s.select('.ex[id]'):
  kind=e['id'][3:]; items=literal(kind); assert items,(p.name,kind)
  questions=[]
  for item in items:
   if kind=='tf': prompt=item['q']; options=['True','False']; answer='True' if item['a'] else 'False'
   elif kind=='mc': prompt=item['q']; options=item['o']; answer=options[item['a']]
   elif kind=='match': prompt=item['word']; options=[m['def'] for m in items]; answer=item['def']
   elif kind=='gap': prompt=item['q']; options=literal('gapWords'); answer=item['a']
   elif kind=='pre': prompt=item['w']; options=literal('preOpts'); answer=item['a']
   else: raise ValueError(kind)
   assert answer in options
   questions.append({'prompt':prompt,'options':options,'answer':answer,'explanation':item.get('full','')})
  exercises.append({'id':kind,'title':text(e.h3),'instruction':text(e.select_one('.ex-head p')),'questions':questions})
 talk=s.select('.ex')[-1]
 lessons.append({'slug':re.sub(r'^\d+-','',p.stem),'title':text(s.h1),'level':'Intermediate' if p.parent.name=='intermediate' else 'Pre-intermediate','description':text(s.select_one('.hero p')),'blocks':content,'body':'\n\n'.join(''.join(t['text'] for t in b['parts']).strip() for b in content if b['kind']!='caption'),'vocabulary':vocab,'notes':notes,'exercises':exercises,'discussion':[text(li) for li in talk.select('.talk li')],'writingInstruction':text(talk.select_one('.ex-body > p')) if talk.select_one('.ex-body > p') else 'Write five sentences about this topic.','sourceFile':p.name,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(lessons)==11, 'Expected all 11 supplied lessons'
assert sum(l['level']=='Intermediate' for l in lessons)==1
# Keep the supplied folder order: Pre-intermediate first, then Intermediate.
lessons.sort(key=lambda x:(x['level']=='Intermediate',x['sourceFile']))
out.write_text(json.dumps(lessons,ensure_ascii=False,indent=2)+'\n')
print('Imported',len(lessons),'lessons;',sum(len(l['vocabulary']) for l in lessons),'vocabulary entries;',sum(len(e['questions']) for l in lessons for e in l['exercises']),'questions. Source article text equality checked for all 11.')
