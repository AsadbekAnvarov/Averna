import { tashkentDayOfYear } from "@/lib/utils";

export interface DailyArticleContent {
  title: string;
  theme?: string;
  body: string;
  vocabulary: { word: string; meaning: string }[];
}

// A rotating pool of short English-learning articles. One per day,
// chosen deterministically by the Tashkent day-of-year. Themes span
// the common IELTS topic families so learners see varied vocabulary.
export const ARTICLE_POOL: DailyArticleContent[] = [
  {
    title: "Why Reading Every Day Boosts Your English",
    theme: "Study Skills",
    body:
      "Reading in English for just fifteen minutes a day can dramatically improve your vocabulary, grammar and writing. " +
      "When you read regularly, you absorb how natural sentences are built and you encounter words in context, which makes them easier to remember. " +
      "Experts recommend choosing material slightly above your current level — challenging enough to learn from, but not so hard that you give up. " +
      "News articles, short stories and even subtitles are all excellent sources. The key is consistency: a small amount every day beats a huge effort once a week.",
    vocabulary: [
      { word: "dramatically", meaning: "in a sudden and impressive way" },
      { word: "absorb", meaning: "to take in information gradually" },
      { word: "in context", meaning: "within a surrounding situation that gives meaning" },
      { word: "consistency", meaning: "doing something regularly in the same way" },
    ],
  },
  {
    title: "The Secret to Speaking Fluently",
    theme: "Speaking",
    body:
      "Many learners believe fluency means speaking fast, but true fluency is about speaking smoothly and clearly without long pauses. " +
      "The best way to build it is simple: speak every day, even to yourself. Describe what you see, narrate your routine, or record short answers to IELTS questions. " +
      "Don't worry about perfect grammar at first — communication comes before correctness. Over time, accuracy follows fluency naturally. " +
      "Shadowing, where you repeat after a native speaker, is a powerful technique for improving rhythm and pronunciation.",
    vocabulary: [
      { word: "fluency", meaning: "the ability to speak smoothly and easily" },
      { word: "narrate", meaning: "to describe events as they happen" },
      { word: "accuracy", meaning: "being correct and without mistakes" },
      { word: "shadowing", meaning: "repeating speech immediately after hearing it" },
    ],
  },
  {
    title: "How Sleep Affects Your Learning",
    theme: "Health",
    body:
      "Studying hard is important, but sleep is just as essential for learning a language. While you sleep, your brain consolidates memories, " +
      "moving new vocabulary and grammar from short-term to long-term storage. Students who sleep well after studying remember far more the next day. " +
      "Pulling an all-nighter before an exam often backfires, because tiredness reduces concentration and recall. " +
      "Aim for seven to nine hours, and try reviewing new words shortly before bed — your brain will keep working on them as you rest.",
    vocabulary: [
      { word: "consolidate", meaning: "to make something stronger or more solid" },
      { word: "recall", meaning: "the ability to remember information" },
      { word: "backfire", meaning: "to have the opposite effect to what was intended" },
      { word: "essential", meaning: "absolutely necessary" },
    ],
  },
  {
    title: "Smart Goals for IELTS Success",
    theme: "Study Skills",
    body:
      "A vague goal like 'improve my English' is hard to achieve. Successful learners set SMART goals: Specific, Measurable, Achievable, Relevant and Time-bound. " +
      "Instead of 'get better at writing', try 'write two Task 2 essays per week and review my mistakes'. This gives you a clear action and a way to track progress. " +
      "Breaking a big target, such as Band 7, into weekly steps keeps you motivated and prevents you from feeling overwhelmed. " +
      "Celebrate small wins along the way — they build the confidence that carries you to your final goal.",
    vocabulary: [
      { word: "vague", meaning: "not clearly expressed or defined" },
      { word: "measurable", meaning: "able to be measured or tracked" },
      { word: "overwhelmed", meaning: "feeling unable to cope with too much" },
      { word: "motivated", meaning: "having a strong reason to act" },
    ],
  },
  {
    title: "The Power of Learning Words in Groups",
    theme: "Vocabulary",
    body:
      "Memorising single words is far less effective than learning them in natural groups called collocations. For example, instead of just 'decision', " +
      "learn 'make a decision', 'a difficult decision' and 'reach a decision'. These word partnerships are how native speakers actually use the language. " +
      "When you write or speak using strong collocations, your English sounds more natural and scores higher in exams. " +
      "Keep a vocabulary notebook organised by topic, and always write an example sentence so you remember how each word is used.",
    vocabulary: [
      { word: "collocation", meaning: "words that are often used together" },
      { word: "partnership", meaning: "a close working relationship" },
      { word: "natural", meaning: "sounding normal, not forced" },
      { word: "organise", meaning: "to arrange in a structured way" },
    ],
  },
  {
    title: "Mistakes Are Your Best Teacher",
    theme: "Study Skills",
    body:
      "Many learners fear making mistakes, but mistakes are one of the fastest ways to improve. Each error shows you exactly what to work on next. " +
      "The most successful students keep an 'error log': they write down the mistake, the correction, and a note about the rule. Reviewing this log weekly turns weaknesses into strengths. " +
      "Avoid the trap of perfectionism, which often leads to silence and slow progress. " +
      "Be brave, speak and write often, and treat every correction as a free lesson rather than a failure.",
    vocabulary: [
      { word: "error log", meaning: "a record of mistakes and corrections" },
      { word: "perfectionism", meaning: "the refusal to accept anything less than perfect" },
      { word: "weakness", meaning: "an area that needs improvement" },
      { word: "brave", meaning: "showing courage" },
    ],
  },
  {
    title: "How Technology Is Changing Language Learning",
    theme: "Technology",
    body:
      "Twenty years ago, learning English meant heavy textbooks and a cassette player. Today, technology has transformed the experience. " +
      "Apps deliver bite-sized lessons, speech recognition gives instant pronunciation feedback, and online platforms connect learners across the world. " +
      "Artificial intelligence can now estimate your band score and suggest exactly what to practise next. " +
      "However, technology is a tool, not a magic solution — real progress still depends on regular, focused practice and the courage to use the language.",
    vocabulary: [
      { word: "transform", meaning: "to change completely" },
      { word: "bite-sized", meaning: "small and easy to manage" },
      { word: "instant", meaning: "happening immediately" },
      { word: "focused", meaning: "concentrated on one thing" },
    ],
  },
  {
    title: "Small Actions, Big Environmental Change",
    theme: "Environment",
    body:
      "Fighting climate change can feel impossible for one person, but small daily habits truly add up. " +
      "If a million people switch from driving to cycling twice a week, the reduction in emissions is enormous. " +
      "Choosing local food, refusing single-use plastic and cutting food waste are all realistic actions that help the planet. " +
      "Governments and companies bear the biggest responsibility, but citizens create the demand that pushes them to act. " +
      "The point is not to be perfect, but to be part of the movement — every consistent effort matters.",
    vocabulary: [
      { word: "emissions", meaning: "gases released into the air, often harmful" },
      { word: "single-use", meaning: "designed to be used only once and thrown away" },
      { word: "movement", meaning: "a group of people working towards the same goal" },
      { word: "consistent", meaning: "staying the same over time" },
    ],
  },
  {
    title: "Why Exercise Sharpens Your Mind",
    theme: "Health",
    body:
      "Physical exercise is often praised for keeping the body healthy, but its effect on the brain is equally powerful. " +
      "Even a twenty-minute walk increases blood flow to the brain, boosting concentration and memory for hours afterwards. " +
      "Regular activity also releases endorphins, which reduce stress and improve mood — both essential for effective study. " +
      "Students who exercise several times a week report higher grades and better sleep. " +
      "You don't need a gym: dancing, cycling or a brisk walk all count towards a sharper mind.",
    vocabulary: [
      { word: "brisk", meaning: "quick and energetic" },
      { word: "endorphins", meaning: "chemicals in the body that make you feel good" },
      { word: "boost", meaning: "to improve or increase" },
      { word: "effective", meaning: "producing the result you want" },
    ],
  },
  {
    title: "Online Classes vs the Traditional Classroom",
    theme: "Education",
    body:
      "Since the pandemic, online learning has become part of mainstream education. " +
      "It offers flexibility — students can attend from anywhere, replay lectures and study at their own pace. " +
      "However, traditional classrooms provide something screens struggle to replace: real conversations, spontaneous questions and the discipline of a shared space. " +
      "The best modern schools now blend both, using online tools for homework and in-person time for discussion. " +
      "For language learners especially, live interaction remains one of the fastest ways to build confidence.",
    vocabulary: [
      { word: "mainstream", meaning: "the ideas or activities considered normal" },
      { word: "flexibility", meaning: "the ability to change or adapt easily" },
      { word: "spontaneous", meaning: "happening naturally, without being planned" },
      { word: "blend", meaning: "to mix two or more things together" },
    ],
  },
  {
    title: "The Rise of Remote Work",
    theme: "Work",
    body:
      "Working from home was once rare, but today it is the norm in many industries. " +
      "Employees save hours previously lost to commuting and often report higher productivity in a quiet home office. " +
      "Companies benefit too, gaining access to talent from any city and reducing office costs. " +
      "Yet remote work has drawbacks: loneliness, blurred lines between work and rest, and fewer chances for spontaneous creativity. " +
      "Hybrid schedules — two or three days in the office — are becoming the popular middle ground.",
    vocabulary: [
      { word: "commuting", meaning: "travelling regularly to and from work" },
      { word: "productivity", meaning: "the amount of work done in a period of time" },
      { word: "drawback", meaning: "a disadvantage" },
      { word: "hybrid", meaning: "made by combining two different things" },
    ],
  },
  {
    title: "When Cities Grow Too Fast",
    theme: "Society",
    body:
      "Urbanisation has transformed the world. Every year, millions move from villages to cities in search of better jobs, schools and healthcare. " +
      "Cities offer real opportunities, but rapid growth brings serious problems: traffic jams, overcrowded housing and polluted air. " +
      "When infrastructure cannot keep up, quality of life falls. " +
      "Well-planned cities invest in public transport, green spaces and affordable housing before crises appear. " +
      "Rural regions also need attention, so that not everyone feels forced to leave home to succeed.",
    vocabulary: [
      { word: "urbanisation", meaning: "the movement of people from countryside to cities" },
      { word: "infrastructure", meaning: "the basic systems and structures a country needs to function" },
      { word: "affordable", meaning: "cheap enough to buy" },
      { word: "crisis", meaning: "a time of intense difficulty or danger" },
    ],
  },
  {
    title: "Keeping Traditions Alive in a Modern World",
    theme: "Culture",
    body:
      "Traditions connect us to our history and give a sense of belonging that fast modern life cannot always provide. " +
      "Whether it's cooking a family recipe for a holiday or wearing traditional clothing at a wedding, these rituals carry meaning across generations. " +
      "Some fear that globalisation will erase local customs, replacing them with the same songs, foods and habits everywhere. " +
      "In reality, many communities are finding creative ways to keep traditions relevant — teaching them in schools, sharing them online, " +
      "and adapting them without losing their heart.",
    vocabulary: [
      { word: "ritual", meaning: "a series of actions performed in a set way" },
      { word: "belonging", meaning: "the feeling of being part of a group" },
      { word: "globalisation", meaning: "the process of the world becoming more connected" },
      { word: "adapt", meaning: "to change to fit new conditions" },
    ],
  },
  {
    title: "How to Spot Fake News",
    theme: "Media",
    body:
      "The internet spreads information faster than ever, but not all of it is true. " +
      "Fake news — false stories designed to mislead — can influence elections, damage reputations and even harm public health. " +
      "Before sharing an article, check who wrote it, look for the same story on trusted sites and be suspicious of headlines that make you feel angry or afraid. " +
      "Real journalism cites sources and admits uncertainty; fake stories often don't. " +
      "Digital literacy is now a life skill for everyone, not just journalists.",
    vocabulary: [
      { word: "mislead", meaning: "to make someone believe something untrue" },
      { word: "suspicious", meaning: "believing that something is probably wrong" },
      { word: "cite", meaning: "to mention as a source or example" },
      { word: "literacy", meaning: "the ability to read, write or understand something" },
    ],
  },
  {
    title: "The Value of Multigenerational Families",
    theme: "Family",
    body:
      "In many cultures, grandparents, parents and children still live under the same roof. " +
      "This arrangement offers real benefits: children learn wisdom directly from elders, parents share the load of childcare, and older relatives feel valued and included. " +
      "There are challenges too — privacy is limited and disagreements about parenting can appear. " +
      "In some countries, rising housing costs are actually pushing families back together after decades of separation, " +
      "showing that old models sometimes solve very modern problems.",
    vocabulary: [
      { word: "multigenerational", meaning: "involving more than one generation" },
      { word: "wisdom", meaning: "knowledge gained through experience" },
      { word: "share the load", meaning: "to help with the work" },
      { word: "disagreement", meaning: "a difference of opinion" },
    ],
  },
  {
    title: "Travelling Without Damaging the Planet",
    theme: "Travel",
    body:
      "Tourism supports millions of jobs and lets people experience new cultures, but it also creates pollution, plastic waste and pressure on famous sites. " +
      "Sustainable travel tries to reduce this damage. " +
      "Small choices matter: taking a train instead of a plane for short trips, staying in local guesthouses, and buying from local craftsmen. " +
      "Popular destinations like Venice and Bali now limit visitor numbers to protect their environment and residents. " +
      "Travelling less often but staying longer is another kind, thoughtful approach.",
    vocabulary: [
      { word: "sustainable", meaning: "able to continue without damaging the environment" },
      { word: "guesthouse", meaning: "a small private hotel" },
      { word: "craftsman", meaning: "a skilled person who makes things by hand" },
      { word: "thoughtful", meaning: "showing careful consideration" },
    ],
  },
  {
    title: "Why Renewable Energy Is Winning",
    theme: "Science & Technology",
    body:
      "Solar panels and wind turbines were expensive luxuries twenty years ago. " +
      "Today they are among the cheapest ways to generate electricity in most of the world. " +
      "Governments have invested billions, technology has improved and public demand for clean energy keeps rising. " +
      "Fossil fuels — coal, oil and gas — still dominate globally, but their share is shrinking every year. " +
      "The transition will not be instant, but the direction is clear: the future of energy is renewable.",
    vocabulary: [
      { word: "renewable", meaning: "able to be replaced naturally" },
      { word: "dominate", meaning: "to be the most important or largest" },
      { word: "transition", meaning: "the process of changing from one state to another" },
      { word: "shrink", meaning: "to become smaller" },
    ],
  },
  {
    title: "Why Every School Needs the Arts",
    theme: "Education",
    body:
      "Music, painting and drama are sometimes seen as extras, less important than maths or science. " +
      "Yet research shows the arts develop creativity, confidence and teamwork — skills that employers value across all industries. " +
      "A student who has performed in a school play speaks in public more easily. " +
      "One who has learned to draw pays closer attention to detail. " +
      "Cutting arts programmes to save money often costs more in the long term, because students lose ways to express themselves and enjoy learning.",
    vocabulary: [
      { word: "teamwork", meaning: "working well together as a group" },
      { word: "perform", meaning: "to entertain an audience with a play, music or dance" },
      { word: "express", meaning: "to show what you think or feel" },
      { word: "long term", meaning: "over a long period into the future" },
    ],
  },
  {
    title: "The True Cost of Junk Food",
    theme: "Health",
    body:
      "Fast food is cheap, tasty and everywhere — but it comes with hidden costs. " +
      "Diets high in sugar, salt and processed ingredients are linked to obesity, diabetes and heart disease, which now affect millions of young people. " +
      "Governments pay huge sums treating these conditions in later life. " +
      "Reducing junk food isn't about banning treats, but about making healthy food cheaper and more available. " +
      "Home cooking, even simple meals, gives you control over what you eat and often costs less than takeaway.",
    vocabulary: [
      { word: "processed", meaning: "changed from its natural state" },
      { word: "obesity", meaning: "the condition of being seriously overweight" },
      { word: "takeaway", meaning: "food prepared to be eaten away from a restaurant" },
      { word: "treat", meaning: "something special and enjoyable" },
    ],
  },
  {
    title: "The Wisdom of Saving Early",
    theme: "Money",
    body:
      "Money seems abstract when you're young, but small savings started early grow into surprisingly large amounts. " +
      "Thanks to compound interest — earning interest on your interest — putting aside just a small sum each month for thirty years can outperform much bigger savings started later. " +
      "The habit matters more than the amount. " +
      "Learning to spend a little less than you earn is one of the most useful life skills schools rarely teach. " +
      "Financial confidence, like a language, is built one small step at a time.",
    vocabulary: [
      { word: "abstract", meaning: "existing as an idea, not something you can touch" },
      { word: "compound", meaning: "made up of two or more parts that combine over time" },
      { word: "outperform", meaning: "to do better than" },
      { word: "financial", meaning: "relating to money" },
    ],
  },
  {
    title: "Social Media and Young Minds",
    theme: "Media",
    body:
      "For today's teenagers, social media is not an extra part of life — it is life. " +
      "Instant contact with friends and endless entertainment feel exciting, but psychologists warn of real costs: shorter attention spans, higher anxiety, and constant comparison to unrealistic images. " +
      "Not all effects are negative — young people also use these platforms to learn, campaign and find communities they lack offline. " +
      "The healthy approach is not to abandon social media but to set boundaries: " +
      "fixed hours, phone-free meals and honest conversations about what feels harmful.",
    vocabulary: [
      { word: "anxiety", meaning: "a feeling of worry or nervousness" },
      { word: "unrealistic", meaning: "not based on what is real or possible" },
      { word: "campaign", meaning: "an organised effort to achieve a goal" },
      { word: "boundary", meaning: "a limit that separates one thing from another" },
    ],
  },
  {
    title: "The Problem With Single-Use Plastic",
    theme: "Environment",
    body:
      "Plastic bottles and bags are convenient, but most are used for minutes and then last for centuries in landfills and oceans. " +
      "Tiny plastic particles are now found in fish, tap water and even human blood. " +
      "Some countries have banned certain single-use plastics with encouraging results. " +
      "Individuals can help by carrying reusable bottles, refusing straws, and choosing loose fruit and vegetables. " +
      "Companies must also design packaging with the whole life-cycle in mind — not just the moment of purchase.",
    vocabulary: [
      { word: "landfill", meaning: "a place where rubbish is buried" },
      { word: "particle", meaning: "a very small piece of something" },
      { word: "reusable", meaning: "able to be used again" },
      { word: "life-cycle", meaning: "all the stages of something's life from start to end" },
    ],
  },
  {
    title: "Talking About Mental Health",
    theme: "Health",
    body:
      "For a long time, mental health was a topic families rarely discussed. " +
      "Anxiety and depression were often hidden, and those affected suffered alone. " +
      "Today the conversation is finally opening, with athletes, artists and public figures sharing their experiences. " +
      "Recognising that mental health matters as much as physical health helps young people ask for support before problems grow. " +
      "Schools that teach simple techniques — deep breathing, regular sleep, honest conversation — give students tools they will use for the rest of their lives.",
    vocabulary: [
      { word: "depression", meaning: "a serious feeling of sadness that lasts a long time" },
      { word: "recognise", meaning: "to accept that something exists" },
      { word: "technique", meaning: "a way of doing something skilfully" },
      { word: "figure", meaning: "an important or well-known person" },
    ],
  },
  {
    title: "Learning Never Stops",
    theme: "Education",
    body:
      "Finishing school or university is no longer the end of learning. " +
      "In a world where jobs, technology and industries change rapidly, adults who continue to learn stay adaptable and confident. " +
      "Online courses, evening classes, podcasts and books make it easier than ever to pick up new skills. " +
      "Companies increasingly value curiosity and the willingness to grow more than a single qualification. " +
      "Lifelong learners tend to be happier too — they meet new people, take on new challenges, and rarely feel stuck in one place.",
    vocabulary: [
      { word: "adaptable", meaning: "able to change to fit new conditions" },
      { word: "curiosity", meaning: "a strong desire to learn or know something" },
      { word: "qualification", meaning: "a certificate showing you have completed a course" },
      { word: "lifelong", meaning: "lasting for the whole of a person's life" },
    ],
  },
  {
    title: "Work-Life Balance in the Modern World",
    theme: "Work",
    body:
      "Working long hours was once seen as a sign of success, but attitudes are shifting. " +
      "Employees increasingly demand time to see family, exercise and rest, and studies show they are more productive because of it. " +
      "Some European countries have experimented with four-day weeks and reported no drop in output. " +
      "Balance looks different for everyone: for some it is fixed hours, for others it is flexible schedules that let them start early or work from home. " +
      "What matters is that work does not consume every corner of life.",
    vocabulary: [
      { word: "attitude", meaning: "the way you think or feel about something" },
      { word: "demand", meaning: "to ask for firmly" },
      { word: "output", meaning: "the amount of work produced" },
      { word: "consume", meaning: "to use up completely" },
    ],
  },
  {
    title: "An Ageing World",
    theme: "Society",
    body:
      "Populations in many countries are getting older, thanks to better healthcare and lower birth rates. " +
      "This trend brings challenges: fewer workers, higher pension costs and greater demand for medical care. " +
      "It also brings opportunities. Older adults today are healthier and more active than any previous generation, " +
      "and they carry decades of experience valuable to workplaces and communities. " +
      "Wise societies will design cities, workplaces and technology to include people of all ages, rather than treating ageing as only a problem.",
    vocabulary: [
      { word: "pension", meaning: "regular money paid after retirement" },
      { word: "generation", meaning: "all the people born around the same time" },
      { word: "trend", meaning: "a general direction of change" },
      { word: "workplace", meaning: "the location where a job is done" },
    ],
  },
  {
    title: "Why Small Languages Matter",
    theme: "Culture",
    body:
      "A language dies roughly every two weeks, taking with it a unique way of understanding the world. " +
      "Every language contains stories, humour, jokes and specialised words for local plants, weather and traditions. " +
      "When a language disappears, that cultural knowledge is often lost forever. " +
      "Communities across the world are fighting back, teaching children in school, recording elders and creating apps for endangered languages. " +
      "Speaking two languages, even a small local one alongside a global one, keeps both alive and enriches every mind that learns them.",
    vocabulary: [
      { word: "unique", meaning: "the only one of its kind" },
      { word: "endangered", meaning: "in danger of disappearing" },
      { word: "enrich", meaning: "to improve the quality of" },
      { word: "specialised", meaning: "designed for one particular use" },
    ],
  },
  {
    title: "Streaming Changed How We Watch",
    theme: "Media",
    body:
      "Not long ago, families gathered at the same time to watch a film in the cinema or a show on TV. " +
      "Streaming services have transformed the experience: viewers now choose what, when and where to watch, on any device. " +
      "This freedom is wonderful, but something has been lost — the shared moment, the surprise, the crowded cinema laughing together. " +
      "Interestingly, cinemas have not disappeared. " +
      "Many are refitting with luxury seats and better sound to offer what a phone screen cannot: an event.",
    vocabulary: [
      { word: "viewer", meaning: "a person who watches something, especially TV" },
      { word: "refit", meaning: "to prepare something with new equipment" },
      { word: "gather", meaning: "to come together in one place" },
      { word: "device", meaning: "a piece of equipment made for a particular purpose" },
    ],
  },
  {
    title: "Different Styles of Parenting",
    theme: "Family",
    body:
      "Parents around the world raise children in very different ways. " +
      "Some are strict, valuing rules, respect and academic success. " +
      "Others are gentle, focusing on emotions, freedom and creativity. " +
      "Research shows that children do best when parents combine warmth with clear expectations — supportive but not overly controlling. " +
      "Culture, income and experience all shape parenting, and no single style is 'correct'. " +
      "What matters most is that children feel loved, safe and encouraged to try things without fear of failure.",
    vocabulary: [
      { word: "strict", meaning: "demanding that rules are obeyed" },
      { word: "warmth", meaning: "friendly and loving behaviour" },
      { word: "controlling", meaning: "wanting to control everything others do" },
      { word: "encouraged", meaning: "given confidence to do something" },
    ],
  },
  {
    title: "When Cultures Meet",
    theme: "Travel",
    body:
      "Travel, study abroad and international friendships expose us to lives very different from our own. " +
      "At first, unfamiliar food, customs or humour can be surprising or even uncomfortable. " +
      "With time, however, these encounters usually enrich us — we start to notice hidden assumptions in our own culture and to appreciate other ways of doing things. " +
      "Perhaps the most valuable gift of cultural exchange is realising that people everywhere want similar things: " +
      "safety, respect, learning and love.",
    vocabulary: [
      { word: "expose", meaning: "to let someone experience something new" },
      { word: "unfamiliar", meaning: "not known or recognised" },
      { word: "assumption", meaning: "a belief accepted without proof" },
      { word: "appreciate", meaning: "to recognise the value of" },
    ],
  },
];

export function getTodayArticle(): DailyArticleContent {
  return ARTICLE_POOL[tashkentDayOfYear() % ARTICLE_POOL.length];
}
