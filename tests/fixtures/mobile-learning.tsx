import React from 'react';
import { createRoot } from 'react-dom/client';
import WritingEditor from '@/components/learning/writing-editor';
import { PracticeReadiness } from '@/components/dashboard/practice-readiness';
import { practiceReadiness } from '@/lib/assessment/readiness';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { HubNav } from '@/components/ui/hub-nav';
import { SmartEssayReview } from '@/components/teacher/smart-essay-review';
import { AvernaAi } from '@/components/dashboard/averna-ai';
import { PanelTabs } from '@/components/panel-tabs';
const q = new URLSearchParams((window as any).__qaSearch || location.search);
const mode = q.get('mode') || 'editor';
const state = q.get('state') || 'empty';
const remote = { essay: 'An account essay from another device. This is synthetic test text, never real learner work. It has a different version and must not silently replace the local essay.', attemptId: 'remote-123', timeLeft: 1234, version: 2, updatedAt: '2026-10-09T12:00:00Z' };
(window as any).__writes = [];
window.fetch = async (_input, init) => {
  if (String(_input).includes('/teacher/essay-review')) return new Response(JSON.stringify({ taskAchievement:6, coherenceCohesion:6.5, lexicalResource:6, grammarAccuracy:5.5, overallBand:6, aiDetectionScore:80, strengths:['A clear argument'], recommendations:['Practise varied sentences'], detailedFeedback:'Synthetic feedback: build a clearer argument and check verb forms.', issues:[{text:'have went',suggestion:'Use have gone.'}] }));
  if (init?.method === 'PUT') {
    (window as any).__writes.push(JSON.parse(init.body as string));
    if (state === 'conflict') return new Response(JSON.stringify({ error: 'The account draft changed on another device. Reload and compare both copies.' }), {status:409});
    return new Response(JSON.stringify({ draft: { ...JSON.parse(init.body as string), version: 3, updatedAt: remote.updatedAt } }));
  }
  if (state === 'offline') throw new Error('Account saving is unavailable. Your device text is unchanged; try again.');
  return new Response(JSON.stringify({ draft: state === 'remote' ? remote : null }));
};
localStorage.setItem('averna_writing_draft_v1:synthetic-user:synthetic-task:practice', JSON.stringify({essay: 'My local essay must be preserved. '.repeat(10), timeLeft: 2345, attemptId: 'local-123'}));
const base = {id:'r', module:'READING', score:6, completedAt:new Date('2026-10-08T12:00:00Z'), contentKey:'one', format:'exam-v2', part:null, totalQuestions:'40', answeredCount:'40', source:null, taskType:null, examAttemptId:null, recorded:null, typedAnswers:null, teacherBand:null};
const summary = practiceReadiness(state === 'empty' ? [] : [base, {...base,id:'l',module:'LISTENING',score:5.5,contentKey:'listening'}, {...base,id:'w',module:'WRITING',score:6.5,source:'ai',contentKey:'writing'}], new Date('2026-10-09T12:00:00Z'));
const panels = [{key:'overview',label:'Overview',icon:'overview',active:'bg-averna-cyan/15 text-white'}, {key:'teaching',label:'Teaching & preparation',icon:'teaching',active:'bg-averna-purple/15 text-white'}, {key:'insights',label:'Class insights',icon:'insights',active:'bg-averna-cyan/15 text-white'}];
function App() {
 if (mode === 'review') return <main className="min-h-screen premium-gradient p-4"><SmartEssayReview /></main>;
 if (mode === 'ai') return <main className="min-h-screen premium-gradient p-4"><AvernaAi greeting="Synthetic practice guidance, not an exam forecast." /></main>;
 if (mode === 'editor') return <WritingEditor cloudDraftsEnabled userId="synthetic-user" prompt={{id:'synthetic-task',title:'Technology and lifelong learning — a deliberately long mobile title',prompt:'Some people believe technology has made education more accessible, while others argue it can distract learners. Discuss both views and give your own opinion. Include reasons and relevant examples.',type:'Opinion essay'}} config={{title:'IELTS Writing Task 2',timeLimit:40,wordCount:250,type:'task2'}} />;
 return <main className="min-h-screen premium-gradient px-4 py-6"><div className="mx-auto max-w-4xl space-y-6"><h1 className="text-2xl font-bold text-white">Averna · synthetic mobile QA</h1>{mode === 'readiness' ? <PracticeReadiness summary={summary} targetBand="7.0" /> : <><DashboardTabs><p className="rounded-xl border border-white/15 p-4 text-base text-gray-300">Student navigation: swipe inside the tab bar, never the page.</p></DashboardTabs><HubNav hub="progress" label="Progress sections" /><PanelTabs tabs={panels} storageKey="synthetic-tabs" wrapOnMobile content={Object.fromEntries(panels.map(p=>[p.key,<p key={p.key} className="p-4 text-base text-gray-300">{p.label} panel</p>]))} /><PanelTabs tabs={panels.map(p=>({...p,label:p.key==='teaching'?'Markaz boshqaruvi':p.label}))} storageKey="synthetic-admin-tabs" content={Object.fromEntries(panels.map(p=>[p.key,<p key={p.key} className="p-4 text-base text-gray-300">Admin panel</p>]))} /></>}</div></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
