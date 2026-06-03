export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ReadingTest from "@/components/learning/reading-test";

// Sample reading test data
const READING_TESTS = {
  "academic-1": {
    id: "academic-1",
    title: "Academic Reading Test 1",
    description: "Technology and Innovation",
    timeLimit: 60,
    passages: [
      {
        id: "passage-1",
        title: "The History of Artificial Intelligence",
        text: `Artificial Intelligence (AI) has evolved dramatically since its inception in the mid-20th century. The term "artificial intelligence" was first coined by John McCarthy in 1956 at the Dartmouth Conference, where he and other pioneers gathered to discuss the possibility of creating machines that could simulate human intelligence.

The early years of AI research were marked by both optimism and significant challenges. In the 1960s and 1970s, researchers developed programs that could solve algebra problems, prove theorems, and understand natural language to a limited extent. However, these systems were often brittle and could only handle problems in narrow domains.

The 1980s saw the rise of expert systems, which used rule-based approaches to encode human expertise in specific fields such as medicine and engineering. While these systems achieved some commercial success, they were expensive to develop and maintain, leading to what became known as the "AI winter" - a period of reduced funding and interest in AI research.

The resurgence of AI in the 21st century has been driven largely by advances in machine learning, particularly deep learning. These techniques allow computers to learn from vast amounts of data without being explicitly programmed. Today, AI systems can recognize speech, translate languages, identify objects in images, and even compete at the highest levels in complex games like chess and Go.

Despite these impressive achievements, current AI systems still lack many capabilities that humans take for granted, such as common sense reasoning, genuine understanding, and the ability to learn from small amounts of data. Researchers continue to work on these challenges, aiming to develop more general and flexible AI systems.`,
        questions: [
          {
            id: "q1",
            type: "multiple-choice",
            question: "When was the term 'artificial intelligence' first introduced?",
            options: [
              "In the early 1950s",
              "At the 1956 Dartmouth Conference",
              "During the 1960s",
              "In the 1980s"
            ],
            correctAnswer: 1
          },
          {
            id: "q2",
            type: "true-false-not-given",
            question: "Early AI programs could only solve problems in specific, narrow areas.",
            correctAnswer: "true"
          },
          {
            id: "q3",
            type: "true-false-not-given",
            question: "Expert systems were cheap to develop and maintain.",
            correctAnswer: "false"
          },
          {
            id: "q4",
            type: "multiple-choice",
            question: "What primarily drove the AI resurgence in the 21st century?",
            options: [
              "Expert systems",
              "Rule-based approaches",
              "Machine learning and deep learning",
              "Natural language processing"
            ],
            correctAnswer: 2
          },
          {
            id: "q5",
            type: "sentence-completion",
            question: "Current AI systems still lack ___________ that humans possess naturally.",
            correctAnswer: "common sense reasoning"
          }
        ]
      },
      {
        id: "passage-2",
        title: "Climate Change and Biodiversity",
        text: `The relationship between climate change and biodiversity loss represents one of the most pressing environmental challenges of our time. As global temperatures rise, ecosystems around the world are experiencing unprecedented stress, forcing species to adapt, migrate, or face extinction.

Scientific evidence shows that many species are already responding to climate change by shifting their geographic ranges. Birds, butterflies, and marine species have been observed moving toward the poles or to higher elevations in search of suitable habitats. However, not all species can relocate successfully, particularly those with limited mobility or highly specialized habitat requirements.

Coral reefs provide a stark example of climate change's impact on biodiversity. Rising ocean temperatures cause coral bleaching, a stress response in which corals expel the algae living in their tissues. Without these algae, corals lose their primary food source and their vibrant colors, often leading to death. The loss of coral reefs has cascading effects on marine biodiversity, as these ecosystems support approximately 25% of all marine species despite covering less than 1% of the ocean floor.

Forests, another crucial biodiversity hotspot, face multiple climate-related threats. Increased temperatures and altered precipitation patterns can make forests more susceptible to wildfires, pest outbreaks, and diseases. The Amazon rainforest, often called the "lungs of the Earth," is particularly vulnerable. Recent studies suggest that parts of the Amazon may be approaching a tipping point, beyond which the forest could transition to a savanna-like ecosystem, with devastating consequences for global biodiversity and climate regulation.

Conservation efforts must evolve to address these interconnected challenges. Protected areas need to be designed with climate change in mind, creating corridors that allow species to move to new habitats as conditions change. Additionally, reducing greenhouse gas emissions remains crucial for limiting the extent of future climate change and its impact on biodiversity.`,
        questions: [
          {
            id: "q6",
            type: "multiple-choice",
            question: "According to the passage, how are many species responding to climate change?",
            options: [
              "By evolving rapidly",
              "By shifting to different geographic locations",
              "By reducing their population",
              "By changing their diet"
            ],
            correctAnswer: 1
          },
          {
            id: "q7",
            type: "true-false-not-given",
            question: "All species can successfully relocate to escape climate change impacts.",
            correctAnswer: "false"
          },
          {
            id: "q8",
            type: "sentence-completion",
            question: "Coral reefs support about _____ of all marine species.",
            correctAnswer: "25%"
          },
          {
            id: "q9",
            type: "multiple-choice",
            question: "What might happen to parts of the Amazon rainforest?",
            options: [
              "It could expand significantly",
              "It could transform into a savanna-like ecosystem",
              "It could become an ocean",
              "It could freeze over"
            ],
            correctAnswer: 1
          },
          {
            id: "q10",
            type: "true-false-not-given",
            question: "Protected areas are already perfectly designed for climate change adaptation.",
            correctAnswer: "false"
          }
        ]
      },
      {
        id: "passage-3",
        title: "The Evolution of Urban Planning",
        text: `Urban planning has undergone significant transformations throughout history, reflecting changing societal values, technological capabilities, and environmental concerns. Ancient cities were often designed around religious or defensive considerations, with temples, palaces, and fortifications serving as focal points. The grid system, still widely used today, was employed by civilizations such as the Greeks and Romans to organize their urban spaces efficiently.

The Industrial Revolution marked a turning point in urban development. Rapid industrialization led to explosive urban growth, but also created numerous problems including overcrowding, pollution, and poor sanitation. These conditions prompted the emergence of modern urban planning as a profession. Reformers like Ebenezer Howard proposed the "Garden City" concept in the late 19th century, advocating for planned communities that balanced urban and rural elements.

The 20th century witnessed various planning philosophies. Le Corbusier's vision of the "Radiant City" emphasized high-rise buildings, wide roads, and functional zoning - separating residential, commercial, and industrial areas. While some of these ideas were implemented, they often resulted in sterile, car-dependent environments that lacked the vibrancy of traditional cities.

In recent decades, urban planning has shifted toward sustainability and livability. The "New Urbanism" movement promotes walkable neighborhoods, mixed-use development, and public transportation. Smart city initiatives leverage technology to improve urban services, from traffic management to energy efficiency. Many cities are now prioritizing green spaces, bicycle infrastructure, and pedestrian-friendly streets.

Climate change has added urgency to urban planning challenges. Cities must now consider flood resilience, heat island effects, and carbon emissions in their planning decisions. Concepts like "sponge cities," which use natural systems to manage stormwater, and "15-minute cities," where residents can access most daily needs within a short walk or bike ride, are gaining traction worldwide.`,
        questions: [
          {
            id: "q11",
            type: "multiple-choice",
            question: "What characterized ancient city design?",
            options: [
              "Environmental sustainability",
              "Religious and defensive purposes",
              "Industrial production",
              "Transportation efficiency"
            ],
            correctAnswer: 1
          },
          {
            id: "q12",
            type: "true-false-not-given",
            question: "The grid system used today was invented during the Industrial Revolution.",
            correctAnswer: "false"
          },
          {
            id: "q13",
            type: "sentence-completion",
            question: "Ebenezer Howard's 'Garden City' concept aimed to balance _____ and _____ elements.",
            correctAnswer: "urban and rural"
          },
          {
            id: "q14",
            type: "true-false-not-given",
            question: "Le Corbusier's planning ideas were never implemented anywhere.",
            correctAnswer: "false"
          },
          {
            id: "q15",
            type: "multiple-choice",
            question: "What is a key principle of New Urbanism?",
            options: [
              "Car-dependent design",
              "Functional zoning separation",
              "Walkable neighborhoods",
              "High-rise construction"
            ],
            correctAnswer: 2
          }
        ]
      }
    ]
  },
  "academic-2": {
    id: "academic-2",
    title: "Academic Reading Test 2",
    description: "Environment and Climate",
    timeLimit: 60,
    passages: [
      {
        id: "passage-1",
        title: "Renewable Energy Technologies",
        text: `The transition to renewable energy sources represents one of the most important technological shifts of the 21st century. Solar, wind, and hydroelectric power are becoming increasingly competitive with fossil fuels, driven by technological improvements and economies of scale.

Solar photovoltaic technology has seen dramatic cost reductions over the past decade. The price of solar panels has dropped by more than 90% since 2010, making solar energy one of the cheapest sources of electricity in many parts of the world. Advances in panel efficiency and energy storage systems continue to improve the viability of solar power.

Wind energy has also experienced remarkable growth. Modern wind turbines are significantly larger and more efficient than their predecessors, with some offshore turbines now standing over 200 meters tall. These massive structures can generate enough electricity to power thousands of homes, even in areas with moderate wind speeds.

However, renewable energy faces challenges. The intermittent nature of solar and wind power requires either energy storage solutions or backup power sources. Battery technology is improving rapidly, but large-scale energy storage remains expensive. Additionally, the manufacturing of renewable energy equipment has its own environmental impacts, including the mining of rare earth elements.`,
        questions: [
          {
            id: "q1",
            type: "multiple-choice",
            question: "What has driven renewable energy to become competitive with fossil fuels?",
            options: [
              "Government regulations only",
              "Technological improvements and economies of scale",
              "Decreased demand for energy",
              "Higher fossil fuel taxes"
            ],
            correctAnswer: 1
          },
          {
            id: "q2",
            type: "sentence-completion",
            question: "Solar panel prices have decreased by more than _____ since 2010.",
            correctAnswer: "90%"
          },
          {
            id: "q3",
            type: "true-false-not-given",
            question: "Modern offshore wind turbines can be over 200 meters in height.",
            correctAnswer: "true"
          },
          {
            id: "q4",
            type: "true-false-not-given",
            question: "Large-scale energy storage is now affordable for all countries.",
            correctAnswer: "false"
          },
          {
            id: "q5",
            type: "multiple-choice",
            question: "What is mentioned as an environmental concern with renewable energy?",
            options: [
              "Excessive water usage",
              "Noise pollution",
              "Mining of rare earth elements",
              "Radioactive waste"
            ],
            correctAnswer: 2
          }
        ]
      }
    ]
  }
};

export default async function ReadingTestPage({
  params,
}: {
  params: { testId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const test = READING_TESTS[params.testId as keyof typeof READING_TESTS];
  
  if (!test) {
    redirect("/learning/reading");
  }

  return <ReadingTest test={test} userId={session.user.id} />;
}
