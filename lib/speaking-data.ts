export interface Part1Topic {
  id: string;
  emoji: string;
  name: string;
  questions: {
    q: string;
    sample: string;
    phrases?: string[];
  }[];
}

export interface Part2Card {
  id: string;
  topic: string;
  points: string[];
  sample: string;
  usefulPhrases: string[];
  tipUz: string;
}

export interface Part3Question {
  id: string;
  theme: string;
  question: string;
  sample: string;
  usefulPhrases: string[];
  tipUz: string;
}

export const PART1_TOPICS: Part1Topic[] = [
  {
    id: "hometown",
    emoji: "🏙️",
    name: "Hometown",
    questions: [
      {
        q: "Where are you from, and what do you like about your hometown?",
        sample:
          "I'm from Tashkent, the capital of Uzbekistan. What I love most about it is the mixture of old and new — you can walk from centuries-old madrasahs to modern shopping centres in the same afternoon. The food is also fantastic, especially the plov cooked in traditional courtyard kitchens.",
        phrases: ["What I love most about it is…", "It's a mixture of old and new", "There's a real sense of…"],
      },
      {
        q: "Has your hometown changed much in recent years?",
        sample:
          "It's changed a lot, actually. When I was a child, most people took the metro or buses everywhere, but now every family seems to own a car, so the traffic is much heavier. On the positive side, there are far more cafés and parks than there used to be.",
      },
      {
        q: "Do you think you will stay in your hometown in the future?",
        sample:
          "I'd like to, but I'm not sure yet. If I can find a good career here, I'd definitely stay because my family and friends are nearby. On the other hand, if I get a scholarship abroad, I'd take that opportunity and probably come back later.",
      },
      {
        q: "What would you show a foreign visitor in your hometown?",
        sample:
          "I'd take them to Khast Imom Square first, because it has some of the oldest religious buildings in Central Asia and one of the earliest surviving Qurans. Then we'd go to Chorsu bazaar for lunch — you can't really understand the city until you've eaten fresh non and shashlik in a busy market.",
      },
      {
        q: "Is your hometown a good place for children to grow up?",
        sample:
          "I'd say yes on the whole. There are plenty of parks, schools and clubs, and neighbourhoods still feel safe. The one drawback is air pollution in winter, which is becoming a real problem for young children.",
      },
      {
        q: "How is your hometown different from other cities you've visited?",
        sample:
          "The biggest difference is probably how friendly people are. In many capital cities, strangers don't really speak to each other, but here it's very common to be invited into someone's home for tea after only ten minutes of conversation.",
      },
    ],
  },
  {
    id: "work-study",
    emoji: "📚",
    name: "Work & Study",
    questions: [
      {
        q: "Do you work or are you a student?",
        sample:
          "I'm currently a full-time student. I'm in my second year of a Business Administration degree, and I also work part-time as an English tutor for younger children, which helps me practise the language every day.",
      },
      {
        q: "What is your favourite subject and why?",
        sample:
          "My favourite is definitely economics. I enjoy it because it explains real-life questions — why prices change, why some countries are richer than others — using very clear logic. Once I understood supply and demand, I started noticing them everywhere.",
      },
      {
        q: "What is the most difficult part of your studies?",
        sample:
          "For me, it's writing academic essays in English. I have plenty of ideas, but organising them into a clear structure with the right connecting words still takes me much longer than writing in my own language.",
      },
      {
        q: "Would you like to change your job or field of study in the future?",
        sample:
          "I don't want to change my field, but I'd like to specialise more. At the moment my degree is quite broad, and eventually I'd like to focus on digital marketing, which combines the business side with technology.",
      },
      {
        q: "How do you usually study for exams?",
        sample:
          "I try to start at least two weeks in advance, otherwise I panic. My routine is to summarise each chapter on a single page, then test myself by explaining the summary out loud, as if I were teaching someone else. It's the fastest way I've found to check whether I really understand.",
      },
      {
        q: "What skills would you like to develop in the next few years?",
        sample:
          "Two things — public speaking and data analysis. I'm quite comfortable one-to-one, but I'd love to feel confident presenting to a large room. And data analysis is something almost every job seems to want now, so I've started learning Excel and basic Python.",
      },
    ],
  },
  {
    id: "free-time",
    emoji: "🎨",
    name: "Free Time",
    questions: [
      {
        q: "What do you usually do in your free time?",
        sample:
          "It depends on my mood. On busy weeks I just want to relax with a series or a novel, but when I have more energy I meet friends for a walk in the park or go cycling along the river. I've also recently taken up cooking, which I never expected to enjoy so much.",
      },
      {
        q: "Do you prefer spending free time alone or with other people?",
        sample:
          "Honestly, both. I need some quiet time on my own each day, usually for reading, but I also make sure to see friends at least twice a week. I think a balance keeps me happy — too much of either feels wrong.",
      },
      {
        q: "How has the way you spend your free time changed since you were a child?",
        sample:
          "When I was younger, I spent almost every free hour outside, playing football with my cousins. These days I still love sport, but I'm on my phone or laptop far more than I should be. It's something I'd like to change.",
      },
      {
        q: "Do you think people today have enough free time?",
        sample:
          "Not really. Most of my friends complain that between studies, part-time work and family responsibilities, they barely have a spare evening. I think part of the problem is also that we don't really switch off — even when we're not working, we're still checking messages.",
      },
      {
        q: "What hobby would you like to try in the future?",
        sample:
          "I'd love to try photography seriously. Right now I just take snapshots with my phone, but I've seen friends produce genuinely beautiful images once they learned about light and composition. I think it would also make me pay closer attention to the world around me.",
      },
      {
        q: "Is it important to have hobbies? Why or why not?",
        sample:
          "Yes, I think so. Hobbies give you something to look forward to that isn't tied to money or achievement, and they often help you meet people you wouldn't otherwise cross paths with. Even a simple hobby can protect your mental health during a stressful week.",
      },
    ],
  },
  {
    id: "technology",
    emoji: "📱",
    name: "Technology",
    questions: [
      {
        q: "How often do you use your phone during a typical day?",
        sample:
          "Probably more than I'd like to admit — around five hours if I include music and messaging. I've started using an app that shows my screen time, and seeing the numbers made me cut back on scrolling social media, at least a little.",
      },
      {
        q: "Do you think technology helps or harms your studies?",
        sample:
          "On balance, it helps far more than it harms. I can access lectures from top universities on YouTube, use flashcard apps for vocabulary and get instant grammar feedback from AI. The main danger is distraction, so I put my phone in another room when I really need to focus.",
      },
      {
        q: "How would you feel if you had to live without the internet for a week?",
        sample:
          "Honestly, uncomfortable for the first day or two, and then probably relieved. So much of my mental energy goes into replying to messages that a week offline would be genuinely restful — though I'd need to warn my family and teachers in advance.",
      },
      {
        q: "What piece of technology do you couldn't easily live without?",
        sample:
          "It has to be my headphones. Between studying, commuting and going for walks, I use them for several hours every day. Music helps me focus, and podcasts are how I've picked up most of my recent knowledge about business and economics.",
      },
      {
        q: "Do older and younger people use technology differently in your country?",
        sample:
          "Very differently. Younger people use their phones for almost everything, whereas my parents still prefer face-to-face contact and phone calls. But that's changing — my mother now buys groceries online and video-calls relatives abroad, which she never did five years ago.",
      },
      {
        q: "What technology would you like to see more of in the future?",
        sample:
          "I'd love to see better translation technology — not the current apps, which are still clunky, but something that can translate a live conversation naturally, including tone and humour. That would open up so many opportunities for people who don't speak English.",
      },
    ],
  },
  {
    id: "food",
    emoji: "🍽️",
    name: "Food & Cooking",
    questions: [
      {
        q: "What kind of food do you enjoy most?",
        sample:
          "I've got a soft spot for Central Asian food — plov, shashlik, manti and lagman. That said, I love trying new things too. I recently discovered Vietnamese pho, and it's become one of my favourite comfort foods when the weather is cold.",
      },
      {
        q: "Do you enjoy cooking? Why or why not?",
        sample:
          "I do, though only in the last couple of years. Cooking used to feel like a chore, but once I started following simple recipes on YouTube, I realised how satisfying it is to make something delicious with just a few ingredients. It also saves quite a lot of money.",
      },
      {
        q: "Do you usually eat at home or in restaurants?",
        sample:
          "Mostly at home — probably five or six days a week. I eat out on Fridays with friends because that's a small tradition we've kept for years. Cooking at home is healthier and cheaper, but going to a restaurant is really about the company rather than the food.",
      },
      {
        q: "Has food in your country changed in recent years?",
        sample:
          "A lot. When I was young there were very few international restaurants, but now you can eat Korean, Japanese, Italian and Turkish food easily. Traditional dishes are still central, though — I don't think that will ever change.",
      },
      {
        q: "Do you think people should learn to cook at school?",
        sample:
          "Yes, absolutely. So many young people leave school without knowing how to prepare a simple, healthy meal, and end up buying fast food out of habit. Even a basic course covering rice, eggs, vegetables and pasta would make a real difference to public health.",
      },
      {
        q: "What foods do you avoid, and why?",
        sample:
          "I try to avoid overly sugary drinks and processed snacks like crisps. It's not that I never touch them, but I've noticed that when I cut them out I feel more energetic and sleep much better. I'm not strict about it — just careful.",
      },
    ],
  },
  {
    id: "travel",
    emoji: "✈️",
    name: "Travel",
    questions: [
      {
        q: "Do you enjoy travelling?",
        sample:
          "I love it. Even a short weekend trip in my own country lifts my mood for weeks afterwards. What I enjoy most isn't just the sightseeing — it's noticing how ordinary life is different somewhere else, from the food people eat for breakfast to how they queue for buses.",
      },
      {
        q: "What is the most memorable place you have visited?",
        sample:
          "Probably Samarkand. I'd seen photos of Registan Square my whole life, but standing in front of the tiled portals in real life was something else entirely. The scale, the colour and the sunset light all together — I don't think any photograph can capture it.",
      },
      {
        q: "Do you prefer travelling alone, with friends or with family?",
        sample:
          "It really depends on the trip. For a relaxing beach holiday I love being with family, because we don't have to plan much. But for adventurous trips — hiking, exploring new cities — I'd rather go with one or two close friends, or even alone. You move faster and take more risks.",
      },
      {
        q: "How has travelling changed since your parents were young?",
        sample:
          "Enormously. My parents' generation rarely travelled abroad, and if they did, it was a huge event. Today, with cheap flights and online booking, my friends and I can plan a foreign trip in an afternoon. The only downside is that airports and popular attractions are much more crowded.",
      },
      {
        q: "Is it better to travel to a place you have visited before or somewhere new?",
        sample:
          "Both have their charms. Returning somewhere gives you the pleasure of recognition — you know where the good coffee is and you can meet friends. But going somewhere completely new, especially where you don't speak the language, keeps you alert in a way that ordinary life doesn't.",
      },
      {
        q: "Would you like to work in a different country in the future?",
        sample:
          "I'd like to try it, at least for a few years. Working in a different culture forces you to adapt in ways that pure tourism doesn't, and it's supposed to be excellent for language skills and CVs. Eventually, though, I'd want to come home and use what I'd learned.",
      },
    ],
  },
];

export const PART2_CARDS: Part2Card[] = [
  {
    id: "skill-to-learn",
    topic: "Describe a skill you would like to learn.",
    points: ["what the skill is", "why you want to learn it", "how you would learn it", "and explain how it would help you"],
    sample:
      "The skill I'd most like to learn is public speaking — being able to stand in front of a large audience and hold their attention without notes.\n\nI'd like to learn it because I've noticed that in my classes the students who speak confidently, even when they aren't the smartest, tend to be listened to and taken seriously. In business, in politics and even in job interviews, presenting yourself well seems just as important as the content.\n\nAs for how, I'd probably start by joining a debating or Toastmasters club, because that gives you regular practice in front of friendly strangers. I'd also record myself and watch it back, which sounds painful but is the fastest way to spot habits like saying 'um' too much or looking at the floor. On top of that, I'd study people I admire — TED speakers, teachers, politicians — and try to copy the specific techniques they use.\n\nIf I mastered public speaking, it would help me in almost every part of my life. In the short term, it would make presentations at university less stressful. In the long term, it could open doors to jobs where communication really matters — teaching, leadership, or even journalism. Perhaps most importantly, it would help me express my ideas so that they actually influence other people, instead of getting lost in nervous mumbling.",
    usefulPhrases: [
      "The skill I'd most like to learn is…",
      "I've noticed that…",
      "As for how, I'd probably start by…",
      "On top of that, I'd study people I admire…",
      "If I mastered it, it would help me in almost every part of my life.",
      "In the short term, … In the long term, …",
    ],
    tipUz: "Cue cardda hamma 4 nuqtani yoritish shart. Har biriga taxminan 30 soniya. Boshida 1-2 gapli 'general answer' bering, keyin har bir nuqtaga alohida abzats.",
  },
  {
    id: "memorable-trip",
    topic: "Describe a memorable trip you have taken.",
    points: ["where you went", "who you went with", "what you did there", "and explain why it was memorable"],
    sample:
      "The trip I remember most vividly is a five-day journey I took to Samarkand and Bukhara last summer.\n\nI went with two of my closest cousins. All three of us had grown up hearing our grandmother talk about these cities, but none of us had actually visited. We travelled by high-speed train from Tashkent, which cut what used to be a full day's drive down to just two hours.\n\nWhile we were there, we walked around Registan Square at dawn to avoid the crowds, ate plov cooked in a huge cauldron outside a local family's home, and got lost in the winding lanes of Bukhara's old town looking for a hidden caravanserai that our grandmother had mentioned. On the second evening a stranger overheard us speaking Uzbek and insisted on inviting us back to his home for tea and dried apricots.\n\nWhat made the trip so memorable, more than the sights, was the sense of connection to the past. Every mosque and madrasah had been standing there for six or seven hundred years, and yet children were still playing football beside them and adults were still selling bread from the same kind of tandir ovens. That mixture of deep history and ordinary daily life is something I'd never really felt in a museum. I think about that trip almost every week, and I've already planned to go back with my parents next spring.",
    usefulPhrases: [
      "The trip I remember most vividly is…",
      "All three of us had grown up hearing…",
      "While we were there, we…",
      "What made the trip so memorable, more than the sights, was…",
      "I think about that trip almost every week…",
    ],
    tipUz: "'Memorable' — nima uchun esda qolganini oxirgi qismda batafsil aytish shart. Faqat 'it was fun' emas — sabab, tuygʻular, taʼsir.",
  },
  {
    id: "influential-person",
    topic: "Describe a person who has influenced you.",
    points: ["who the person is", "how you know them", "what they are like", "and explain how they influenced you"],
    sample:
      "The person who has influenced me most is my aunt Nilufar, my mother's older sister.\n\nI've known her all my life, of course, but I really got to know her from the age of about twelve, when she moved back from Moscow after finishing her PhD and started teaching physics at a local university.\n\nShe's the kind of person who takes ideas seriously. When you ask her a question, she doesn't give a lazy answer — she'll pause, look genuinely interested, and then explain something in a way that suddenly makes it feel simple. She also has an unusual mix of qualities: she's calm and quite modest in public, but she's fierce about intellectual honesty and doesn't tolerate sloppy thinking, even from family.\n\nHer influence on me has been enormous. Because of her, I understood for the first time that studying could be genuinely enjoyable rather than a chore. Watching her teach also showed me how much difference a good teacher can make — students who came to her afraid of maths would leave two years later planning to major in it. Whenever I have to make a difficult decision, I still ask myself what she would say. She doesn't always give me the answer I hope for, but she always makes me think more carefully, and I think that's the greatest gift someone can give another person.",
    usefulPhrases: [
      "I've known her all my life, of course, but I really got to know her from the age of…",
      "She's the kind of person who takes ideas seriously.",
      "She has an unusual mix of qualities…",
      "Her influence on me has been enormous.",
      "Whenever I have to make a difficult decision, I still ask myself…",
    ],
    tipUz: "Odam haqida gapirishda character adjectives koʻp qoʻshing (thoughtful, generous, principled, curious). Faqat 'she is nice' emas.",
  },
  {
    id: "book-or-film",
    topic: "Describe a book or film you enjoyed.",
    points: ["what it was about", "when you read/watched it", "why you chose it", "and explain why you enjoyed it"],
    sample:
      "The book I'd like to describe is 'Sapiens' by Yuval Noah Harari, which is a wide-ranging history of the human species.\n\nIt covers everything from the first stone tools to the rise of empires, money, science and now artificial intelligence. What's impressive is that it manages to fit almost seventy thousand years of history into around four hundred pages without feeling rushed.\n\nI read it about two summers ago. A friend of mine, who is very hard to impress, kept mentioning it in conversation, and eventually I bought a copy just to see what all the fuss was about.\n\nI chose it partly out of curiosity and partly because I'd been enjoying podcasts on similar topics but wanted something deeper.\n\nThe reason I enjoyed it so much is that Harari has a rare gift for making enormous ideas feel personal. He'll take a huge question — why did agriculture spread if it made most people's lives harder? — and turn it into a puzzle you feel you can almost solve yourself. I found myself stopping every few pages just to think, or to argue with him in my head. By the end, I saw ordinary things — money, borders, even the news — quite differently. It's the first book that ever made me feel that non-fiction could be as gripping as a good novel.",
    usefulPhrases: [
      "It covers everything from … to …",
      "It manages to fit … into around … pages without feeling rushed.",
      "A friend of mine, who is very hard to impress, kept mentioning it…",
      "Harari has a rare gift for making enormous ideas feel personal.",
      "By the end, I saw ordinary things quite differently.",
    ],
    tipUz: "Kitob/film haqida gaplashganda — syujetni qisqacha, keyin sizga qanday taʼsir qilganini batafsil. Sinonimlardan foydalaning: 'the book' → 'the novel', 'the work', 'the author's account'.",
  },
  {
    id: "important-decision",
    topic: "Describe an important decision you have made.",
    points: ["what the decision was", "when you made it", "what alternatives you considered", "and explain why the decision was important"],
    sample:
      "The most important decision I've made so far was choosing to study business rather than medicine.\n\nI made the decision in the summer before university, when I was seventeen and had to submit my applications. Everyone in my family — including me — had assumed for years that I would become a doctor, so changing direction was a big step.\n\nI considered two main alternatives. The obvious one was medicine, which would have given me a stable career and pleased my parents. The other option I flirted with was engineering, because I've always liked maths. In the end, though, I realised that what genuinely excited me was reading about how companies grew, how markets moved and how people were persuaded to buy things.\n\nThe decision was important for several reasons. Firstly, it was the first big choice where I set aside what others expected of me and asked myself honestly what I actually wanted. That was uncomfortable at the time but also freeing. Secondly, it changed the direction of the next five to ten years of my life: the friends I've made, the internships I apply for, and probably the country I'll eventually work in are all shaped by that one decision. Finally, it taught me that even loving parents don't always know what's best for you. They came round eventually and now, honestly, my father is my biggest supporter, which I don't think would have happened if I'd stayed on a path I didn't really want.",
    usefulPhrases: [
      "The most important decision I've made so far was…",
      "I considered two main alternatives.",
      "In the end, though, I realised that what genuinely excited me was…",
      "The decision was important for several reasons.",
      "That was uncomfortable at the time but also freeing.",
    ],
    tipUz: "'Important' — nima uchun muhim ekanligini oxirida 2-3 sabab bilan koʻrsating. 'Because it changed my life' — bu juda umumiy; 'because I stopped listening to expectations of others' — bu aniq.",
  },
  {
    id: "useful-website",
    topic: "Describe a website or app you use often.",
    points: ["what it is", "how you found it", "what you use it for", "and explain why you find it useful"],
    sample:
      "The app I want to describe is Anki, a flashcard programme designed for memorising almost anything.\n\nOn the surface it looks quite plain — grey backgrounds, no fancy graphics — but underneath it uses a technique called spaced repetition. The app decides when to show you each card again based on how well you remembered it last time, so easy cards come back rarely and difficult ones return every day.\n\nI first came across Anki through a YouTube video by a medical student who used it to memorise thousands of facts for her exams. I downloaded it that same afternoon, mostly out of curiosity.\n\nI use it primarily for English vocabulary and academic terms, though I've also started using it for economics concepts and even historical dates. Every morning I spend about fifteen minutes reviewing cards on my phone during breakfast, which is short enough that I actually do it every day.\n\nThe reason I find it so useful is that it turns memory into something almost automatic. Before Anki, I'd read a new word, feel that I understood it, and forget it a week later. Now, because the app forces me to see each word at exactly the point when I'm about to forget it, the word gradually moves into long-term memory without me really trying. It sounds like a small change, but over months it's made a bigger difference to my English than any textbook.",
    usefulPhrases: [
      "On the surface it looks quite plain, but underneath it uses…",
      "The app decides when to show you each card again based on…",
      "I first came across it through…",
      "I use it primarily for…, though I've also started using it for…",
      "It turns memory into something almost automatic.",
    ],
    tipUz: "Apps haqida — funksiya (nima qilishi), texnik detal (qanday ishlashi) va shaxsiy taʼsir (senga nima berdi). Uch qismini birlashtiring.",
  },
  {
    id: "childhood-memory",
    topic: "Describe a happy memory from your childhood.",
    points: ["what the memory is", "when and where it happened", "who was there", "and explain why it makes you happy"],
    sample:
      "The happy memory I'd like to describe is the summers I used to spend at my grandparents' house in the village, especially one afternoon when I was around eight years old.\n\nMy grandparents lived in a small village in the Fergana Valley, surrounded by orchards. Every summer my parents would drive me there for a month, and I'd basically live outdoors from morning until nightfall.\n\nOn the particular afternoon I'm thinking of, my grandfather had promised to teach me how to catch fish in the small stream behind the garden. My two younger cousins came along, and my grandmother packed us tea and warm non for the walk. We spent the entire afternoon in the water, none of us catching anything at all — but my grandfather turned it into a series of stories about his own childhood, about the same stream, sixty years earlier.\n\nThat memory makes me happy for several reasons. Firstly, it captures a way of life that's slowly disappearing — no phones, no schedules, just family and long summer days. Secondly, it's connected to my grandfather, who passed away three years ago. Whenever I feel stressed by exams or work, I only need to close my eyes for a moment to hear the sound of that stream, and something in me relaxes. Finally, I think it taught me that happiness doesn't require anything special — a stream, a grandparent and a piece of bread were enough. That's a lesson I try to remember even now.",
    usefulPhrases: [
      "The happy memory I'd like to describe is…",
      "On the particular afternoon I'm thinking of…",
      "That memory makes me happy for several reasons.",
      "It captures a way of life that's slowly disappearing.",
      "Something in me relaxes.",
    ],
    tipUz: "Xotira haqida gapirganda past tenses (past simple, past continuous, past perfect) aralashtirib qoʻllang. Sensory details (soundlar, ranglar, hidlar) 'good memory' hikoyasini jonli qiladi.",
  },
  {
    id: "healthy-lifestyle",
    topic: "Describe a change you have made to lead a healthier life.",
    points: ["what the change was", "when you made it", "how it affected you", "and explain why you decided to make it"],
    sample:
      "The change I'd like to talk about is that I stopped drinking sugary soft drinks about a year and a half ago.\n\nAs a teenager I used to drink a can of cola or an energy drink almost every day, sometimes two. It felt harmless at the time, but by the age of nineteen I noticed that my energy levels were up and down all day, and my skin wasn't as clear as it used to be.\n\nI decided to make the change in January, partly as a New Year resolution but mainly after a routine check-up when the doctor showed me how much added sugar those drinks contained. Seeing the equivalent in sugar cubes was a shock — around fifteen cubes in a single large bottle.\n\nThe effect built up slowly. In the first two weeks I actually felt worse, with mild headaches and stronger cravings than I'd expected. After a month, though, my energy stabilised — no more crashes at three in the afternoon. Within six months I'd lost a few kilograms without really trying, and I started sleeping more deeply. Now I mostly drink water, green tea and, occasionally, freshly-squeezed juice.\n\nI decided to make the change because I realised I couldn't complain about being tired all the time while pouring pure sugar into myself. Also, I saw a family member develop diabetes, and it made me take my long-term health more seriously than any advice from a doctor ever could. Small changes can add up — that's what the whole experience taught me.",
    usefulPhrases: [
      "The change I'd like to talk about is that I stopped…",
      "It felt harmless at the time, but…",
      "Seeing the equivalent in sugar cubes was a shock.",
      "The effect built up slowly.",
      "Small changes can add up.",
    ],
    tipUz: "Salomatlik mavzusida — konkret raqamlar (kanchali kam ichadigan boʻldingiz, necha kilogramm) va tez taʼsir vaqti (2 hafta, 6 oy) essa/gapga 'authentic' tuygʻu beradi.",
  },
  {
    id: "old-object",
    topic: "Describe an old object you own that is important to you.",
    points: ["what the object is", "how you got it", "how old it is", "and explain why it is important to you"],
    sample:
      "The object I'd like to describe is an old fountain pen that once belonged to my grandfather.\n\nIt's a plain black pen with a gold-coloured nib, made in Germany in the 1960s. It doesn't look particularly valuable — no jewels, no engraving — but it writes beautifully once you learn its rhythm.\n\nI got it after my grandfather passed away three years ago. When my parents were sorting through his study, my grandmother asked whether I'd like any small memento. I picked the pen almost by instinct, because I'd seen it on his desk every time I visited as a child.\n\nAs I mentioned, the pen is around sixty years old. My grandfather bought it as a young teacher and, according to my grandmother, used it every day of his working life. There are tiny scratches near the cap where he'd absently opened and closed it during lectures.\n\nThe pen is important to me for several reasons. Firstly, it's a direct physical link to somebody I loved and miss. When I hold it, I can almost picture him at his desk, marking his students' essays late into the evening. Secondly, it's changed the way I write. Because a fountain pen forces you to slow down and think about each stroke, I use it for journal entries and important letters, and my handwriting has improved noticeably. Finally, it reminds me that objects made to last — with proper materials and good design — really can outlive their owner. In a world of cheap plastic gadgets that break after a year, that feels like a small but important lesson.",
    usefulPhrases: [
      "It doesn't look particularly valuable, but it…",
      "I picked it almost by instinct…",
      "There are tiny scratches near the cap where he'd absently opened and closed it…",
      "It's a direct physical link to somebody I loved…",
      "Objects made to last really can outlive their owner.",
    ],
    tipUz: "'Old object' — obyektning tashqi koʻrinishi (past continuous with 'used to look'), qanday tarixi bor, senga qanday tuygʻu keltirishi. Uch qism = 3 abzats.",
  },
  {
    id: "achievement",
    topic: "Describe an achievement you are proud of.",
    points: ["what the achievement was", "how you achieved it", "how long it took", "and explain why you are proud of it"],
    sample:
      "The achievement I'd like to describe is passing my B2 English exam at seventeen — the first serious exam I'd ever really prepared for.\n\nAt the time, my English was probably intermediate at best. I could hold basic conversations and read simple books, but formal writing was a struggle. I decided that I wanted to reach a certified B2 level within a year, mainly because I'd realised that university applications and future scholarships would require it.\n\nAchieving it took a lot of steady work. I started by watching one English documentary a day with subtitles, which took about forty minutes. Then, three evenings a week, I did an hour of grammar exercises from a Cambridge workbook. On weekends I paid a tutor to check my writing and to speak with me for an hour. It wasn't glamorous, but it was consistent.\n\nAll told, it took me around eleven months from starting the routine to sitting the exam.\n\nI'm proud of it for several reasons. Firstly, no one told me to do it — I organised the entire plan by myself, which taught me that I could actually manage my own learning without a teacher directing me. Secondly, it was proof that steady work over months, rather than last-minute cramming, really does produce results. Finally, and most importantly, that exam opened every door I've walked through since — the courses I'm on, the online communities I've joined, and now my preparation for IELTS. It's the kind of small achievement that quietly reshapes the future.",
    usefulPhrases: [
      "The achievement I'd like to describe is…",
      "It wasn't glamorous, but it was consistent.",
      "All told, it took me around eleven months…",
      "It was proof that steady work over months really does produce results.",
      "It's the kind of small achievement that quietly reshapes the future.",
    ],
    tipUz: "Achievement haqida — 'nima' (achievement) → 'qanday' (jarayoni) → 'necha vaqt' → 'nima uchun muhim'. Konkret raqamlar va odatlarni yozing, umumiy gaplardan qochib.",
  },
];

export const PART3_QUESTIONS: Part3Question[] = [
  {
    id: "why-people-travel",
    theme: "Travel",
    question: "Why do you think people enjoy travelling?",
    sample:
      "I think people travel for a mix of reasons that fall into three broad groups. The most obvious is simply escape — from routine, from work pressure, from the same faces and streets they see every day. Even a weekend away can reset the mind in a way that nothing else quite manages.\n\nSecondly, travel satisfies genuine curiosity. Human beings are naturally interested in how other people live: what they eat, how they raise their children, what makes them laugh. Reading about another culture is not quite the same as sitting in a family's living room and being offered tea — the direct experience sticks in a way that information doesn't.\n\nFinally, travel gives people stories that shape their identity. Someone who has crossed a desert, or lived for six months in a foreign city, becomes a slightly different person, and often carries that difference with pride for years afterwards. In that sense, travel is not just something people do — it's part of who they become.",
    usefulPhrases: [
      "There are a mix of reasons that fall into three broad groups.",
      "Even a weekend away can reset the mind…",
      "The direct experience sticks in a way that information doesn't.",
      "Travel gives people stories that shape their identity.",
      "In that sense, travel is not just something people do — it's part of who they become.",
    ],
    tipUz: "Part 3 — javob 3-4 gapdan koʻra 5-6 tayyor gap boʻlishi kerak. Fikringizni kengaytirish uchun 'Firstly / Secondly / Finally' yoki 'For example' ishlating.",
  },
  {
    id: "tech-and-communication",
    theme: "Technology",
    question: "How has technology changed the way we communicate?",
    sample:
      "Technology has changed communication faster and more deeply than almost any other force in modern life, and I'd say the effects are genuinely mixed.\n\nOn the positive side, we can now stay in touch with almost anyone, almost anywhere, for almost nothing. My grandmother speaks to her cousins in Canada every week on video call — something that would have cost her a month's pension in the 1990s. Ideas, news and personal stories now travel across the world in seconds, which has been transformative for global collaboration and even for humanitarian responses to disasters.\n\nOn the negative side, the same technology has changed the quality of our conversations, not just the quantity. Many people, especially my age, find it easier to type than to speak face-to-face, and messages replace phone calls even between close friends. Nuance and warmth are hard to convey through short texts, and small misunderstandings can escalate in ways they never would in person.\n\nSo the balance is complicated. Technology has made communication easier but also thinner, and I think the challenge for the next generation is learning how to keep the depth while enjoying the convenience.",
    usefulPhrases: [
      "…faster and more deeply than almost any other force in modern life.",
      "On the positive side, … On the negative side, …",
      "Ideas, news and personal stories now travel across the world in seconds.",
      "Nuance and warmth are hard to convey through short texts.",
      "The challenge for the next generation is learning how to keep the depth while enjoying the convenience.",
    ],
    tipUz: "Har doim ikkala tomonni koʻrsating — 'positive va negative'. So'ngida 'balanced' xulosa bering ('the balance is complicated' / 'both sides have real weight').",
  },
  {
    id: "free-education",
    theme: "Education",
    question: "Should education be free for everyone? Why?",
    sample:
      "I'd say yes, at least up to a certain level, though the details matter.\n\nPrimary and secondary education, in my view, should absolutely be free. These are the years in which children learn the basic literacy, numeracy and social skills that they'll use for the rest of their lives, and charging for them would deepen inequality between richer and poorer families. Most societies have already accepted this argument.\n\nUniversity is more complicated. There's a strong case for free tuition — a country benefits enormously from having engineers, doctors and teachers, and it seems unfair to price talented students from poorer families out of those careers. On the other hand, graduates typically earn more over their lifetimes, so it's not unreasonable to ask them to contribute towards the cost once they're earning above a certain threshold.\n\nMy own position is that the fairest system would offer free or heavily subsidised university to those from lower-income backgrounds and low-cost loans, repayable only after a good salary is reached, to everyone else. That way education stays open to all without falling entirely on the taxpayer.",
    usefulPhrases: [
      "I'd say yes, at least up to a certain level, though the details matter.",
      "…would deepen inequality between richer and poorer families.",
      "There's a strong case for free tuition — a country benefits enormously from having…",
      "It's not unreasonable to ask them to contribute towards the cost.",
      "The fairest system would offer …, repayable only after…",
    ],
    tipUz: "Part 3 da 'nuanced' javoblar band 7+ dagi belgi. 'Yes' yoki 'no' emas — 'yes with conditions' yoki 'depends on X' desak — imtihonchi 'talabaning fikri chuqur' deb baholaydi.",
  },
  {
    id: "learning-languages",
    theme: "Language",
    question: "What are the advantages of learning a foreign language?",
    sample:
      "The advantages fall into three broad areas: practical, cognitive and personal.\n\nOn the practical side, a foreign language opens up job opportunities that simply don't exist otherwise. Multinational companies, international NGOs and even local firms with foreign clients pay noticeably more to bilingual employees, and knowing English in particular multiplies the amount of professional literature you can read.\n\nCognitively, learning a language is one of the most effective mental workouts we know. Studies suggest that bilingual people are better at multitasking and often show delayed onset of dementia in old age. Whether or not those studies are perfect, my own experience matches them: after two years of serious English study, I noticed I was better at concentrating and better at explaining things clearly in my own language.\n\nFinally, and perhaps most importantly, a foreign language changes how you see the world. You start to notice that certain ideas can't be translated cleanly, and that other cultures have precise words for feelings your own language treats as vague. Reading Dostoevsky in Russian and Shakespeare in English gives you access to two different ways of thinking about being human — that's a gift almost nothing else can offer.",
    usefulPhrases: [
      "The advantages fall into three broad areas: practical, cognitive and personal.",
      "Multinational companies and NGOs pay noticeably more to bilingual employees.",
      "Learning a language is one of the most effective mental workouts we know.",
      "You start to notice that certain ideas can't be translated cleanly.",
      "A foreign language changes how you see the world.",
    ],
    tipUz: "'Practical / cognitive / personal' — bunday umumiy 'framing' band 8 sifatida yoziladi. Har xil turdagi sabablarni ajratib koʻrsatish tashkiliylikni yaqqol koʻrsatadi.",
  },
  {
    id: "social-media-society",
    theme: "Society",
    question: "Does social media have a more positive or negative effect on society?",
    sample:
      "Overall I'd say the negative effects slightly outweigh the positive ones, though the picture is genuinely mixed and depends a lot on how people use these platforms.\n\nThe positive contributions are real. Social media has given a voice to communities that used to be ignored by mainstream press. It's helped democracy movements organise quickly and has been an important tool during natural disasters, when people share urgent information faster than official channels can update.\n\nHowever, I think the harms are becoming clearer and clearer. Firstly, the platforms are designed to be addictive, and independent research now links heavy use to rising rates of anxiety and depression, especially among teenagers. Secondly, algorithms amplify emotionally-charged content, so misinformation about health, elections and international events travels much faster than careful reporting can correct it. Finally, public discussion has become more hostile, because it's easier to attack a stranger online than to argue civilly face-to-face.\n\nWith that said, I don't think social media itself is the enemy. Well-designed platforms, better content moderation and stronger digital literacy in schools could preserve the benefits while reducing the harms. Blaming the technology alone lets both companies and users off too easily.",
    usefulPhrases: [
      "Overall I'd say the negative effects slightly outweigh the positive ones.",
      "Social media has given a voice to communities that used to be ignored.",
      "Independent research now links heavy use to rising rates of anxiety…",
      "Algorithms amplify emotionally-charged content, so misinformation travels much faster than…",
      "Blaming the technology alone lets both companies and users off too easily.",
    ],
    tipUz: "Bahsli mavzuda 'clear position + qarama-qarshi fikrni tan olish' formulasidan foydalaning: 'Overall I'd say X, though the picture is mixed.'",
  },
  {
    id: "young-people-work",
    theme: "Work",
    question: "Why do many young people change jobs so often nowadays?",
    sample:
      "There's a real generational shift happening here, and I think three main reasons explain it.\n\nFirst, the job market itself has changed. A generation ago, people expected to stay with one employer for decades, and companies rewarded that loyalty with pensions and security. Today, contracts are shorter, industries change faster and even large firms make redundancies without much warning. When employers themselves no longer commit for the long term, it makes little sense for employees to do so either.\n\nSecond, young people have different priorities. Many of my friends value learning, autonomy and interesting work more than a stable salary. If a job stops teaching them new skills after two years, they move somewhere that will, even for slightly less money.\n\nThird, technology and remote work have made switching much easier. A young engineer in Tashkent can now be interviewed for a role in Berlin from her bedroom, and platforms like LinkedIn make new opportunities visible almost every day. In the past, changing jobs meant reading physical newspaper ads and posting paper CVs — a much slower process.\n\nWhether this is good or bad is debatable, but the trend is clear, and I don't think it will reverse any time soon.",
    usefulPhrases: [
      "There's a real generational shift happening here…",
      "A generation ago, people expected to stay with one employer for decades.",
      "When employers themselves no longer commit for the long term…",
      "Many of my friends value learning, autonomy and interesting work more than a stable salary.",
      "The trend is clear, and I don't think it will reverse any time soon.",
    ],
    tipUz: "'Trend' savollarida 'A generation ago vs today' — juda kuchli tarkib. Uchta sabab sanab, har biriga 2 gap misol keltirsangiz — mustahkam javob.",
  },
  {
    id: "protecting-environment",
    theme: "Environment",
    question: "Who should be most responsible for protecting the environment — governments, companies or individuals?",
    sample:
      "In my view, the honest answer is that all three share responsibility, but not equally.\n\nGovernments have the largest share, because only they can set the rules that shape everyone else's behaviour. A single individual choosing to recycle changes almost nothing, but a law banning single-use plastics can transform an entire industry overnight. Governments also fund research, negotiate international treaties and can price pollution through carbon taxes. Nothing else can do these things at scale.\n\nCompanies come second. Most environmental damage — from industrial emissions to deforestation for palm oil — is done in the course of producing goods for profit. So corporations have both the power and, arguably, the moral obligation to redesign products and supply chains. Voluntary action is welcome, but I don't think it's realistic to expect it without regulatory pressure.\n\nIndividuals matter too, but often in a different way. Our direct actions — recycling, cycling, eating less meat — help around the edges, but our indirect actions are much more powerful: voting, joining campaigns and demanding better from the companies we buy from. If enough consumers push hard, businesses and politicians follow.\n\nSo I'd rank them: governments first, then companies, then individuals — but the truth is, no single level of society can solve this on its own.",
    usefulPhrases: [
      "The honest answer is that all three share responsibility, but not equally.",
      "Only they can set the rules that shape everyone else's behaviour.",
      "A single individual choosing to recycle changes almost nothing, but a law…",
      "Voluntary action is welcome, but I don't think it's realistic to expect it without…",
      "No single level of society can solve this on its own.",
    ],
    tipUz: "Uch tomonli savolda ('X, Y or Z') — hech qachon 'faqat X' demang. 'All three share responsibility, but…' orqali ochilib, keyin ular orasida ustunlik bergan boʻlsangiz — bu band 8 tuygʻusi.",
  },
  {
    id: "reading-vs-tv",
    theme: "Culture",
    question: "Is reading books still important in the age of television and the internet?",
    sample:
      "Absolutely, and possibly more important than ever.\n\nBooks and screens do overlap in some ways — you can learn from both, be entertained by both and even follow a story on either. But they demand very different things from the reader or viewer. A book requires sustained attention, and it slowly trains you to hold complex ideas in your head. Television and internet content, by contrast, are usually designed to be consumed in short bursts, with constant visual and emotional stimulation.\n\nThat difference matters. Many educators and psychologists worry that young people who mostly consume short videos have a harder time reading long texts, following long arguments, or sitting quietly with their own thoughts. A daily reading habit — even twenty minutes — is one of the best defences against that.\n\nBooks also offer a depth of experience that shorter content rarely matches. A good novel spends hundreds of pages inside another person's mind. A serious non-fiction book presents evidence and counter-evidence in a way that a blog post or TikTok never could.\n\nSo I don't think we should choose one and reject the other. But if I had to pick between them, I'd argue that in a world already full of distraction, the case for reading books is actually stronger, not weaker, than it was fifty years ago.",
    usefulPhrases: [
      "Absolutely, and possibly more important than ever.",
      "They demand very different things from the reader or viewer.",
      "A book requires sustained attention, and it slowly trains you to hold complex ideas in your head.",
      "…psychologists worry that young people who mostly consume short videos have a harder time reading long texts.",
      "In a world already full of distraction, the case for reading books is actually stronger.",
    ],
    tipUz: "Comparison ('X vs Y') savollarida — ikkalasi bir xil narsa ekanini emas, farqni koʻrsatish muhim. 'They both entertain, but they demand different things' — bu shundoq farqni ochish.",
  },
];
