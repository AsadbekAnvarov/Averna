"use client";

import { useState } from "react";
import type { ArticleExercise } from "@/lib/articles/catalog";

function Exercise({ exercise }: { exercise: ArticleExercise }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"working" | "checked" | "revealed">("working");
  const correct = exercise.questions.filter((question, i) => answers[i] === question.answer).length;
  return <section className="article-card article-exercise" aria-labelledby={`exercise-${exercise.id}`}>
    <h3 id={`exercise-${exercise.id}`}>{exercise.title}</h3>
    <p className="article-muted">{exercise.instruction}</p>
    {exercise.id === "gap" && <p className="article-word-bank"><strong>Word bank: </strong>{exercise.questions[0].options.join(" · ")}</p>}
    <ol className="article-questions">
      {exercise.questions.map((question, i) => <li key={i}>
        <label htmlFor={`${exercise.id}-${i}`}><span className="article-question-number">{i + 1}.</span> {question.prompt}</label>
        <select id={`${exercise.id}-${i}`} value={answers[i] || ""} onChange={event => { setAnswers({ ...answers, [i]: event.target.value }); setMode("working"); }}>
          <option value="">Choose an answer…</option>
          {question.options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        {answers[i]?.length > 40 && <p className="article-selected article-muted">Your choice: {answers[i]}</p>}
        {exercise.id === "tf" && <label className="article-correction">If false, write the correct sentence (for your teacher to review):<input type="text" maxLength={1000} value={corrections[i] || ""} onChange={event => setCorrections({ ...corrections, [i]: event.target.value })} /></label>}
        {mode !== "working" && <p className="article-feedback" data-correct={mode === "revealed" ? undefined : answers[i] === question.answer}>{mode === "revealed" ? `Answer: ${question.answer}` : !answers[i] ? "Not answered." : answers[i] === question.answer ? "Correct." : `Not quite. Answer: ${question.answer}`}{question.explanation && ` (${question.explanation})`}</p>}
      </li>)}
    </ol>
    <div className="article-actions">
      <button type="button" className="article-primary" onClick={() => setMode("checked")}>Check answers</button>
      <button type="button" onClick={() => setMode("revealed")}>Show answers</button>
      <button type="button" onClick={() => { setAnswers({}); setCorrections({}); setMode("working"); }}>Try again</button>
    </div>
    <p role="status" className="article-result">{mode === "checked" ? `${correct} / ${exercise.questions.length} correct. ${exercise.questions.length - Object.values(answers).filter(Boolean).length} unanswered.` : mode === "revealed" ? "Answer key shown. Your choices have not been changed." : "Choose your answers, then check them."}</p>
  </section>;
}

export function ArticleExercises({ exercises, discussion, writingInstruction }: { exercises: ArticleExercise[]; discussion: string[]; writingInstruction: string }) {
  return <section id="exercises" className="article-section">
    <h2>Practise what you read</h2>
    <p className="article-muted">Self-study practice, not an IELTS assessment. Answers and notes stay on this page only and are cleared when you leave or reload.</p>
    {exercises.map(exercise => <Exercise key={exercise.id} exercise={exercise} />)}
    <section className="article-card article-exercise">
      <h3>Speak and write</h3>
      <p className="article-muted">Talk to a partner. Then write five sentences.</p>
      <ul className="article-discussion">{discussion.map(question => <li key={question}>{question}</li>)}</ul>
      <label className="article-writing">{writingInstruction}<textarea rows={6} maxLength={10000} placeholder="Write your sentences here…" /></label>
      <p className="article-muted">Open-ended writing and discussion are not automatically graded.</p>
    </section>
  </section>;
}
