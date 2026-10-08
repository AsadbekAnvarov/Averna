#!/usr/bin/env python3
"""Private local XLSX -> reviewable finance learner CSV; never uploads or creates accounts.
Requires Python + openpyxl. Unknown fees, checkbox states, payments/debts and hidden
sheets are NOT guessed. Fill/verify CSV and use the admin preview before committing.
"""
import argparse,csv,hashlib,json,re,pathlib,openpyxl
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('workbook');p.add_argument('--staff-map',required=True,help='JSON: worksheet name -> verified finance staff ID')
p.add_argument('--namespace',required=True,help='Stable source name, e.g. center-register-2026')
p.add_argument('--out',required=True);p.add_argument('--monthly-fee',default='',help='Only supply an explicitly confirmed common fee; otherwise CSV requires manual review')
a=p.parse_args();w=openpyxl.load_workbook(a.workbook,data_only=False);mapping=json.loads(pathlib.Path(a.staff_map).read_text())
normalize=lambda s:re.sub(r'[^a-z0-9]','',str(s).lower())
sheets={normalize(s.title):s for s in w if s.sheet_state=='visible'}
settings=w['Sozlamalar'];groups=[(str(r[0].value),str(r[1].value),int(r[2].value)) for r in settings.iter_rows(min_row=3) if r[0].value and r[1].value and isinstance(r[2].value,(int,float))]
rows=[];skipped=0;issues=[]
for name,group,start in groups:
 s=sheets.get(normalize(name))
 if s is None:issues.append({'group':group,'error':'missing visible worksheet'});continue
 following=[r for n,g,r in groups if normalize(n)==normalize(name) and r>start];end=min(following)-1 if following else min(s.max_row,start+40)
 staff_id=next((v for k,v in mapping.items() if normalize(k)==normalize(name)),'')
 for values in s.iter_rows(min_row=start,max_row=end):
  if not isinstance(values[0].value,(int,float)):continue
  full_name=values[1].value
  if values[1].data_type=="f" or not isinstance(full_name,str) or not full_name.strip():skipped+=1;continue
  key='xls_'+hashlib.sha256(f'{a.namespace}|{s.title}|{values[1].row}'.encode()).hexdigest()[:32]
  rows.append({'fullName':full_name.strip(),'phone':'','groupName':group,'staffId':staff_id,'monthlyFee':a.monthly_fee,'dueDay':'5','sourceKey':key,'status':'ACTIVE','note':f'Review source {s.title}!B{values[1].row}; fee/due/status require confirmation'})
headers=['fullName','phone','groupName','staffId','monthlyFee','dueDay','sourceKey','status','note']
with open(a.out,'w',encoding='utf-8-sig',newline='') as f:
 out=csv.DictWriter(f,fieldnames=headers);out.writeheader();out.writerows(rows)
pathlib.Path(a.out+'.review.json').write_text(json.dumps({'candidateRows':len(rows),'skippedNamelessRows':skipped,'issues':issues,'mustConfirm':['staff mapping','monthly fee','due day','active status','name/contact split'],'notImported':['cash/card/terminal entries','debt signs','checkbox meaning','hidden intake sheets','salary advances','expense amounts','formula caches']},ensure_ascii=False,indent=2))
print(f'Prepared {len(rows)} candidate rows. {skipped} nameless numbered rows skipped. Review CSV privately; no upload/import performed.')
