import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface WritingAssessment {
  taskAchievement: number; // 0-9
  coherenceCohesion: number; // 0-9
  lexicalResource: number; // 0-9
  grammarAccuracy: number; // 0-9
  overallBand: number; // 0-9
  aiDetectionScore: number; // 0-100 (percentage of AI-generated)
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedFeedback: string;
}

export async function assessWritingTask(
  essay: string,
  taskType: "task1" | "task2",
  prompt: string
): Promise<WritingAssessment> {
  const systemPrompt = `You are an expert IELTS Writing examiner. Assess the following ${taskType === "task1" ? "Task 1" : "Task 2"} essay based on IELTS criteria:
  
1. Task Achievement (Task 1) / Task Response (Task 2): 0-9
2. Coherence and Cohesion: 0-9
3. Lexical Resource: 0-9
4. Grammatical Range and Accuracy: 0-9

Also detect if the essay appears to be AI-generated (0-100%).

Provide:
- Scores for each criterion
- Overall band score (average)
- 3-5 strengths
- 3-5 weaknesses
- 3-5 specific recommendations
- Detailed feedback paragraph

Task Prompt: ${prompt}

Essay:
${essay}

Respond in JSON format:
{
  "taskAchievement": number,
  "coherenceCohesion": number,
  "lexicalResource": number,
  "grammarAccuracy": number,
  "overallBand": number,
  "aiDetectionScore": number,
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": string[],
  "detailedFeedback": string
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = completion.choices[0].message.content;
    if (!result) throw new Error("No response from OpenAI");

    return JSON.parse(result) as WritingAssessment;
  } catch (error) {
    console.error("Error assessing writing:", error);
    throw new Error("Failed to assess writing task");
  }
}

export async function generateSpeakingQuestions(
  part: 1 | 2 | 3,
  topic?: string
): Promise<string[]> {
  const prompts = {
    1: "Generate 5 IELTS Speaking Part 1 questions about everyday topics (family, work, hobbies, etc.)",
    2: "Generate 1 IELTS Speaking Part 2 cue card with a topic, talking points, and follow-up question",
    3: `Generate 5 IELTS Speaking Part 3 questions about ${topic || "abstract concepts related to society"}`,
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an IELTS Speaking examiner. Generate authentic IELTS speaking questions.",
        },
        { role: "user", content: prompts[part] },
      ],
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content;
    if (!result) throw new Error("No response from OpenAI");

    return result.split("\n").filter((q) => q.trim().length > 0);
  } catch (error) {
    console.error("Error generating speaking questions:", error);
    throw new Error("Failed to generate speaking questions");
  }
}

export async function aiMentorChat(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert IELTS tutor and English language mentor at Averna Learning Centre. 
          You help students with:
          - Grammar explanations
          - Vocabulary building
          - IELTS tips and strategies
          - Pronunciation guidance
          - Practice questions
          - Motivation and encouragement
          
          Be friendly, encouraging, and provide clear, actionable advice. Always relate answers back to IELTS success.`,
        },
        ...conversationHistory,
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0].message.content || "Sorry, I couldn't process that.";
  } catch (error) {
    console.error("Error in AI mentor chat:", error);
    throw new Error("Failed to get response from AI Mentor");
  }
}

export async function generatePersonalizedStudyPlan(
  studentData: {
    currentLevel: number; // IELTS band
    targetLevel: number;
    weakAreas: string[];
    availableHoursPerWeek: number;
  }
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an IELTS study planner. Create personalized weekly study plans.",
        },
        {
          role: "user",
          content: `Create a personalized IELTS study plan for:
          - Current level: ${studentData.currentLevel}
          - Target level: ${studentData.targetLevel}
          - Weak areas: ${studentData.weakAreas.join(", ")}
          - Available time: ${studentData.availableHoursPerWeek} hours/week
          
          Provide a structured weekly plan with specific activities and time allocation.`,
        },
      ],
      temperature: 0.7,
    });

    return completion.choices[0].message.content || "Could not generate study plan.";
  } catch (error) {
    console.error("Error generating study plan:", error);
    throw new Error("Failed to generate study plan");
  }
}
