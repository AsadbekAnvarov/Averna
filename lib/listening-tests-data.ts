export interface ListeningQuestion {
  question: string;
  options: string[];
  answer: number;
}

export interface ListeningSection {
  title: string;
  transcript: string;
  questions: ListeningQuestion[];
}

export interface ListeningTest {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  sections: ListeningSection[];
}

export const LISTENING_TESTS: ListeningTest[] = [
  {
    id: "easy-1",
    title: "Everyday Conversations",
    difficulty: "Easy",
    description: "Simple everyday situations — a great warm-up.",
    sections: [
      {
        title: "Section 1 — Booking a Library Tour",
        transcript:
          "Good morning, and welcome to the city library. Our guided tour starts at ten thirty and lasts about forty five minutes. " +
          "First, we will visit the reading room on the ground floor, which is open from eight in the morning until nine at night. " +
          "Then we will go upstairs to the computer area, where you can print documents for ten cents per page. " +
          "Please remember that membership is free for students, but you must bring a photo identity card to register.",
        questions: [
          { question: "What time does the guided tour start?", options: ["Ten o'clock", "Ten thirty", "Eleven o'clock", "Nine o'clock"], answer: 1 },
          { question: "How long does the tour last?", options: ["30 minutes", "45 minutes", "60 minutes", "15 minutes"], answer: 1 },
          { question: "How much does printing cost per page?", options: ["5 cents", "10 cents", "20 cents", "It's free"], answer: 1 },
          { question: "What must you bring to register?", options: ["A photo ID card", "A passport photo", "A library book", "Cash payment"], answer: 0 },
        ],
      },
      {
        title: "Section 2 — Asking for Directions",
        transcript:
          "Excuse me, could you tell me how to get to the National Museum? Certainly. Go straight ahead for about two hundred metres " +
          "until you reach a small park on your right. Turn left at the traffic lights just after the park, and walk for another five minutes. " +
          "You will see the museum on your left, opposite a large red brick post office. It usually opens at ten in the morning, but on Mondays it is closed all day.",
        questions: [
          { question: "How far should you walk before you see the park?", options: ["About 100 metres", "About 200 metres", "About 500 metres", "About one kilometre"], answer: 1 },
          { question: "Where should you turn left?", options: ["At the roundabout", "At the crossroads", "At the traffic lights after the park", "At the post office"], answer: 2 },
          { question: "What is opposite the museum?", options: ["A hotel", "A red brick post office", "A supermarket", "A school"], answer: 1 },
          { question: "When is the museum closed?", options: ["Sundays", "Mondays", "Every evening", "Weekends"], answer: 1 },
        ],
      },
    ],
  },
  {
    id: "easy-2",
    title: "Shopping and Services",
    difficulty: "Easy",
    description: "Practical listening around shops, delivery and phone calls.",
    sections: [
      {
        title: "Section 1 — Ordering a Sofa",
        transcript:
          "Thank you for calling Cosy Home Furniture. I'd like to confirm your order. You've chosen the grey three-seater sofa, model number BX seven two five. " +
          "The price is four hundred and eighty pounds, and delivery is free within the city. We can deliver on Thursday morning between nine and twelve, " +
          "but please make sure someone over eighteen is at home to sign for the parcel. If you need to reschedule, call us at least twenty-four hours in advance.",
        questions: [
          { question: "What colour is the sofa?", options: ["Blue", "Grey", "Brown", "Black"], answer: 1 },
          { question: "What is the price?", options: ["£420", "£450", "£480", "£520"], answer: 2 },
          { question: "When is the delivery?", options: ["Thursday morning", "Friday afternoon", "Saturday evening", "Monday morning"], answer: 0 },
          { question: "How much notice is needed to reschedule?", options: ["12 hours", "24 hours", "48 hours", "One week"], answer: 1 },
        ],
      },
      {
        title: "Section 2 — At the Pharmacy",
        transcript:
          "This medicine is for a mild cough. Take one tablet three times a day, after meals, for no longer than five days. " +
          "Don't take it on an empty stomach, and avoid driving in the first hour after each dose because it may make you sleepy. " +
          "If your symptoms don't improve within a week, please book an appointment with your doctor.",
        questions: [
          { question: "How many tablets should you take per day?", options: ["One", "Two", "Three", "Four"], answer: 2 },
          { question: "When should you take the tablets?", options: ["Before meals", "After meals", "In the middle of a meal", "Any time"], answer: 1 },
          { question: "Why should you avoid driving?", options: ["The tablets are dangerous", "They may make you sleepy", "You should stay in bed", "The tablets cause vomiting"], answer: 1 },
          { question: "When should you see a doctor?", options: ["If symptoms don't improve within a week", "The next day", "After two doses", "Only in an emergency"], answer: 0 },
        ],
      },
    ],
  },
  {
    id: "medium-1",
    title: "Campus & Lectures",
    difficulty: "Medium",
    description: "Academic announcements and a short lecture.",
    sections: [
      {
        title: "Section 1 — A Lecture on Sleep",
        transcript:
          "Today's lecture is about the importance of sleep. Research shows that adults need between seven and nine hours of sleep each night. " +
          "During deep sleep, the brain processes new information and stores memories. " +
          "A lack of sleep can reduce concentration and weaken the immune system. " +
          "The speaker recommends avoiding screens at least one hour before going to bed to improve sleep quality.",
        questions: [
          { question: "How many hours of sleep do adults need?", options: ["5 to 6 hours", "6 to 7 hours", "7 to 9 hours", "9 to 10 hours"], answer: 2 },
          { question: "What does the brain do during deep sleep?", options: ["Burns calories", "Stores memories", "Grows taller", "Slows the heart only"], answer: 1 },
          { question: "What is recommended before bed?", options: ["Drink coffee", "Avoid screens for an hour", "Exercise hard", "Eat a large meal"], answer: 1 },
        ],
      },
      {
        title: "Section 2 — Student Accommodation",
        transcript:
          "If you are looking for student accommodation, the university offers three options. " +
          "The cheapest is a shared flat, which costs two hundred dollars a month. " +
          "A single room in the halls of residence is three hundred and fifty dollars and includes breakfast. " +
          "Finally, a studio apartment costs five hundred dollars but has its own kitchen. " +
          "Applications must be submitted before the end of August.",
        questions: [
          { question: "How much is a shared flat per month?", options: ["$200", "$350", "$500", "$150"], answer: 0 },
          { question: "What does the halls of residence room include?", options: ["A kitchen", "Breakfast", "Free parking", "A gym pass"], answer: 1 },
          { question: "When must applications be submitted?", options: ["End of July", "End of August", "End of September", "Anytime"], answer: 1 },
        ],
      },
    ],
  },
  {
    id: "medium-2",
    title: "Health & Fitness Talk",
    difficulty: "Medium",
    description: "A radio interview and a gym induction talk.",
    sections: [
      {
        title: "Section 1 — Radio Interview on Exercise",
        transcript:
          "Our guest today is Doctor Patel, who has spent twenty years studying the effects of exercise on health. " +
          "According to Doctor Patel, adults should aim for at least one hundred and fifty minutes of moderate activity every week — for example, brisk walking or cycling. " +
          "You don't have to do it all in one go; three sessions of twenty minutes on five days of the week is enough. " +
          "The most important thing, she says, is consistency rather than intensity. Even light exercise done regularly reduces the risk of heart disease, diabetes and depression.",
        questions: [
          { question: "How long has Dr Patel studied exercise?", options: ["10 years", "15 years", "20 years", "25 years"], answer: 2 },
          { question: "How many minutes of moderate activity should adults do per week?", options: ["30", "75", "100", "150"], answer: 3 },
          { question: "What example of moderate activity is given?", options: ["Weightlifting", "Brisk walking", "Sprinting", "Yoga"], answer: 1 },
          { question: "According to Dr Patel, what matters most?", options: ["Intensity", "Consistency", "Diet", "Sleep"], answer: 1 },
        ],
      },
      {
        title: "Section 2 — Gym Induction",
        transcript:
          "Welcome to Fitway Gym. Before you start using the equipment, please listen carefully. " +
          "New members receive one free consultation with a personal trainer. To book it, use the app or ask at the reception desk. " +
          "The gym opens at six in the morning and closes at eleven at night, seven days a week. " +
          "Please bring your own towel; if you forget one, you can rent one for two pounds. " +
          "Finally, remember to wipe down each machine after use. Cleaning wipes are provided next to every station.",
        questions: [
          { question: "What is free for new members?", options: ["A gym bag", "A consultation with a trainer", "One month of membership", "A locker"], answer: 1 },
          { question: "When does the gym close?", options: ["9 pm", "10 pm", "11 pm", "Midnight"], answer: 2 },
          { question: "How much does towel rental cost?", options: ["£1", "£2", "£5", "It's free"], answer: 1 },
          { question: "What should members do after using a machine?", options: ["Nothing", "Report it to reception", "Wipe it down", "Turn off the power"], answer: 2 },
        ],
      },
    ],
  },
  {
    id: "hard-1",
    title: "Science & Society",
    difficulty: "Hard",
    description: "Faster, detail-heavy academic content.",
    sections: [
      {
        title: "Section 1 — Renewable Energy",
        transcript:
          "The transition to renewable energy is accelerating worldwide. Solar power, once prohibitively expensive, has fallen in cost by " +
          "roughly ninety percent over the past decade, making it competitive with fossil fuels in many regions. Wind energy, meanwhile, " +
          "now supplies around a quarter of electricity in several European countries. However, the main challenge remains storage: because " +
          "the sun does not always shine and the wind does not always blow, large-scale batteries are essential to ensure a stable supply.",
        questions: [
          { question: "By roughly how much has solar power's cost fallen in a decade?", options: ["50%", "70%", "90%", "30%"], answer: 2 },
          { question: "Wind supplies about what share of electricity in several European countries?", options: ["A tenth", "A quarter", "A half", "All"], answer: 1 },
          { question: "What is described as the main challenge?", options: ["Cost", "Storage", "Pollution", "Transport"], answer: 1 },
          { question: "Why is storage needed?", options: ["To reduce cost", "Because sun and wind are intermittent", "To create jobs", "To replace batteries"], answer: 1 },
        ],
      },
      {
        title: "Section 2 — Urban Planning",
        transcript:
          "Modern urban planners increasingly favour the concept of the fifteen-minute city, in which residents can reach work, schools, " +
          "shops and parks within a fifteen-minute walk or cycle. Proponents argue this reduces traffic, lowers emissions and strengthens " +
          "local communities. Critics, however, warn that without careful policy it could raise housing prices in central districts and " +
          "push lower-income families to the outskirts.",
        questions: [
          { question: "In a fifteen-minute city, residents can reach key places within…", options: ["A 15-minute drive", "A 15-minute walk or cycle", "An hour", "Five minutes"], answer: 1 },
          { question: "Which is NOT a stated benefit?", options: ["Less traffic", "Lower emissions", "Stronger communities", "Higher salaries"], answer: 3 },
          { question: "What do critics warn about?", options: ["Higher housing prices", "More pollution", "Slower internet", "Fewer parks"], answer: 0 },
        ],
      },
    ],
  },
  {
    id: "hard-2",
    title: "Economy & Environment",
    difficulty: "Hard",
    description: "Two connected lectures on modern economic and environmental questions.",
    sections: [
      {
        title: "Section 1 — Rethinking Growth",
        transcript:
          "For most of the twentieth century, economists measured a country's success primarily through its gross domestic product, or GDP. " +
          "In recent years, however, this focus on aggregate output has come under increasing criticism. Critics point out that GDP counts " +
          "the production of weapons as positively as the production of medicines, ignores unpaid domestic labour entirely, and fails to " +
          "register environmental damage. Some governments, notably New Zealand and Bhutan, now publish additional well-being indicators " +
          "that track factors such as mental health, air quality and household debt. The aim is not to abandon GDP, but to place it alongside " +
          "measures that reflect what economic activity actually delivers for citizens.",
        questions: [
          { question: "What has traditionally been used to measure a country's success?", options: ["Inflation", "GDP", "Population", "Life expectancy"], answer: 1 },
          { question: "Which criticism of GDP is mentioned?", options: ["It is too easy to calculate", "It ignores unpaid domestic labour", "It over-counts services", "It is not used by governments"], answer: 1 },
          { question: "Which two countries are given as examples?", options: ["Norway and Denmark", "Japan and South Korea", "New Zealand and Bhutan", "Germany and France"], answer: 2 },
          { question: "What is the stated aim of new indicators?", options: ["To replace GDP entirely", "To place them alongside GDP", "To ignore GDP", "To simplify tax policy"], answer: 1 },
        ],
      },
      {
        title: "Section 2 — Carbon Markets",
        transcript:
          "One controversial tool for reducing greenhouse gas emissions is the carbon market. In such a market, governments issue a limited " +
          "number of permits, each allowing the holder to release one tonne of carbon dioxide. Companies must own enough permits to cover " +
          "their emissions; if they emit less, they can sell the surplus to firms that need more. Supporters argue that this creates a strong " +
          "financial incentive to reduce pollution at the lowest possible cost. Critics reply that the price of permits has often been too low " +
          "to change behaviour, and that the system is complex enough to invite fraud. Most economists nevertheless regard well-designed carbon " +
          "markets as one of the more efficient instruments available for meeting climate targets.",
        questions: [
          { question: "In a carbon market, what does one permit allow?", options: ["A tax exemption", "The release of one tonne of CO₂", "Unlimited pollution", "One factory to be built"], answer: 1 },
          { question: "What can a company do if it emits less than its permits allow?", options: ["Nothing", "Return the permits to the government", "Sell the surplus to other firms", "Save them forever"], answer: 2 },
          { question: "What is one criticism of carbon markets?", options: ["Prices are often too high", "Prices have often been too low to change behaviour", "There are no critics", "Only oil companies benefit"], answer: 1 },
          { question: "How do most economists view well-designed carbon markets?", options: ["As useless", "As one of the more efficient tools available", "As illegal", "As the only solution"], answer: 1 },
        ],
      },
    ],
  },
];
