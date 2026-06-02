import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import WritingEditor from "@/components/learning/writing-editor";

const WRITING_PROMPTS = {
  task1: [
    {
      id: "task1-1",
      title: "Bar Chart: Student Enrollment",
      prompt: "The bar chart below shows the number of students enrolled in different courses at a university over three years.\n\nSummarize the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
      imageUrl: "/images/writing/task1-chart1.png",
      type: "Bar Chart",
    },
    {
      id: "task1-2",
      title: "Line Graph: Temperature Changes",
      prompt: "The line graph below shows average monthly temperatures in three different cities throughout the year.\n\nSummarize the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
      imageUrl: "/images/writing/task1-graph1.png",
      type: "Line Graph",
    },
    {
      id: "task1-3",
      title: "Process Diagram: Coffee Production",
      prompt: "The diagram below shows the process of coffee production from seed to cup.\n\nSummarize the information by selecting and reporting the main features.\n\nWrite at least 150 words.",
      imageUrl: "/images/writing/task1-process1.png",
      type: "Process",
    },
  ],
  task2: [
    {
      id: "task2-1",
      title: "Technology and Education",
      prompt: "Some people believe that technology has made learning easier and more accessible, while others think it has made students lazy and less focused.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Discussion + Opinion",
    },
    {
      id: "task2-2",
      title: "Environmental Problems",
      prompt: "Environmental problems are too big for individual countries and individual people to address. We have reached the stage where the only way to protect the environment is at an international level.\n\nTo what extent do you agree or disagree with this statement?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Opinion",
    },
    {
      id: "task2-3",
      title: "Work-Life Balance",
      prompt: "Many people find it hard to balance their work with other parts of their lives. What are the reasons for this? How can this problem be overcome?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Problem-Solution",
    },
  ],
};

export default async function WritingTaskPage({
  params,
}: {
  params: { taskType: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const taskType = params.taskType as "task1" | "task2";
  
  if (!["task1", "task2"].includes(taskType)) {
    redirect("/learning/writing");
  }

  // Get random prompt for this task type
  const prompts = WRITING_PROMPTS[taskType];
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

  const taskConfig = {
    task1: {
      title: "IELTS Writing Task 1",
      timeLimit: 20,
      wordCount: 150,
      type: "task1",
    },
    task2: {
      title: "IELTS Writing Task 2",
      timeLimit: 40,
      wordCount: 250,
      type: "task2",
    },
  };

  const config = taskConfig[taskType];

  return (
    <WritingEditor
      prompt={randomPrompt}
      config={config}
      userId={session.user.id}
    />
  );
}
