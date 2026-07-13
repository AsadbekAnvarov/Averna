export interface MockQuestion {
  q: string;
  options: string[];
  a: number;
}

export type MockDifficulty = "Easy" | "Medium" | "Hard";
export type MockEssayType = "opinion" | "discuss" | "problem-solution";

export interface MockExam {
  id: string;
  title: string;
  difficulty: MockDifficulty;
  theme: string;
  description: string;
  durationMinutes: number;
  listening: { transcript: string; questions: MockQuestion[] };
  reading: { passage: string; questions: MockQuestion[] };
  writing: { prompt: string; type: MockEssayType };
}

export const MOCK_EXAMS: MockExam[] = [
  // --------------------------------------------------------------------
  {
    id: "urban-life",
    title: "Urban Life",
    difficulty: "Easy",
    theme: "City & Lifestyle",
    description:
      "A relaxed introduction to the mock format — a museum tour recording and a short article about city parks.",
    durationMinutes: 25,
    listening: {
      transcript:
        "Welcome to the City History Museum. Our galleries are open every day except Tuesday, from ten in the morning until six in the evening. " +
        "Admission is free for students, but adults pay a small fee of five pounds. The main exhibition on the ground floor traces the growth of our city " +
        "from a small fishing village into a modern capital, and it includes original maps from the seventeenth century. On the first floor you will find " +
        "the interactive children's zone, which is especially popular at weekends. Free guided tours in English start at eleven o'clock and at three in the " +
        "afternoon. If you would like an audio guide, please leave a photo identity card at the front desk. Photography is allowed everywhere except in the " +
        "portrait gallery on the second floor.",
      questions: [
        {
          q: "Which day is the museum closed?",
          options: ["Monday", "Tuesday", "Wednesday", "Sunday"],
          a: 1,
        },
        {
          q: "How much do adults pay for admission?",
          options: ["Nothing", "Five pounds", "Ten pounds", "Fifteen pounds"],
          a: 1,
        },
        {
          q: "Where is the interactive children's zone?",
          options: ["Ground floor", "First floor", "Second floor", "Basement"],
          a: 1,
        },
        {
          q: "When does the second free guided tour start?",
          options: ["Eleven o'clock", "One in the afternoon", "Three in the afternoon", "Five in the evening"],
          a: 2,
        },
        {
          q: "Where is photography NOT allowed?",
          options: ["Main exhibition", "Children's zone", "Portrait gallery", "Nowhere in the museum"],
          a: 2,
        },
      ],
    },
    reading: {
      passage:
        "City parks do far more than simply make a neighbourhood look attractive. Recent research has shown that people who live within ten minutes' walk " +
        "of a green space report lower levels of stress and are more likely to exercise regularly. In many large cities, parks also act as natural coolers: on " +
        "hot summer days, temperatures inside a well-planted park can be several degrees lower than on nearby streets, which reduces the demand for air " +
        "conditioning in surrounding buildings. Parks are important for wildlife too. Even small green corridors allow birds and insects to move safely across " +
        "the city, and trees planted along paths can absorb a significant amount of the pollution produced by traffic. However, urban parks face growing " +
        "pressure. As populations rise, some councils have been tempted to sell park land for housing or commercial development. Campaigners argue that " +
        "once a park is lost, it is almost never replaced, and its social and environmental benefits vanish with it.",
      questions: [
        {
          q: "According to the passage, people living close to a park are more likely to…",
          options: ["earn more money", "exercise regularly", "own a car", "travel abroad"],
          a: 1,
        },
        {
          q: "Compared with nearby streets on hot days, well-planted parks are…",
          options: ["hotter", "several degrees cooler", "much windier", "about the same temperature"],
          a: 1,
        },
        {
          q: "Green corridors help wildlife mainly by…",
          options: [
            "providing food",
            "letting animals move safely across the city",
            "reducing the number of predators",
            "keeping people away",
          ],
          a: 1,
        },
        {
          q: "What role do path-side trees play?",
          options: [
            "They mark the park boundary",
            "They absorb some traffic pollution",
            "They reduce noise from housing",
            "They store rainwater",
          ],
          a: 1,
        },
        {
          q: "Why are campaigners worried about selling park land?",
          options: [
            "It usually cannot be turned back into a park later",
            "It costs the council money",
            "It causes traffic jams",
            "It reduces the number of tourists",
          ],
          a: 0,
        },
      ],
    },
    writing: {
      type: "opinion",
      prompt:
        "Some people believe that living in a large city offers more advantages than living in a small town or the countryside. " +
        "Others disagree. Discuss both views and give your own opinion. Write at least 250 words.",
    },
  },

  // --------------------------------------------------------------------
  {
    id: "travel",
    title: "Global Travel",
    difficulty: "Easy",
    theme: "Tourism",
    description:
      "Airport announcements and a short piece on how tourism changes local communities — good practice for General Training candidates.",
    durationMinutes: 25,
    listening: {
      transcript:
        "This is a boarding announcement for flight BA two three seven to Rome, now boarding at gate twelve. Please have your boarding pass and passport " +
        "ready for inspection. Passengers travelling with young children, or requiring extra assistance, are welcome to board first. Please note that only one " +
        "piece of hand luggage is permitted in the cabin, with a maximum weight of seven kilograms. Any additional bags must be checked in at the desk, where " +
        "a fee of twenty pounds will apply. The captain has informed us that flight time today will be around two hours and forty minutes, and the weather in " +
        "Rome is currently warm and sunny with a temperature of twenty six degrees. For your safety and comfort, please switch off all mobile phones and " +
        "electronic devices during take-off and landing.",
      questions: [
        {
          q: "Which flight is now boarding?",
          options: ["BA 237 to Rome", "BA 273 to Rome", "BA 237 to Paris", "BA 372 to Rome"],
          a: 0,
        },
        {
          q: "Who is invited to board first?",
          options: [
            "Business class passengers",
            "Passengers with young children or needing assistance",
            "Passengers with only hand luggage",
            "Frequent-flyer members",
          ],
          a: 1,
        },
        {
          q: "What is the maximum weight of hand luggage?",
          options: ["Five kilograms", "Seven kilograms", "Ten kilograms", "Twenty kilograms"],
          a: 1,
        },
        {
          q: "How much does an extra checked bag cost?",
          options: ["Ten pounds", "Fifteen pounds", "Twenty pounds", "Fifty pounds"],
          a: 2,
        },
        {
          q: "What is the current weather in Rome?",
          options: ["Cold and rainy", "Warm and sunny at 26°C", "Cloudy at 16°C", "Windy at 20°C"],
          a: 1,
        },
      ],
    },
    reading: {
      passage:
        "Tourism has become one of the world's largest industries, and its effects on small communities are far-reaching. When travellers arrive in a " +
        "traditional village or coastal town, they usually bring welcome income. Local restaurants, guest houses and craft sellers can grow quickly, and young " +
        "people no longer have to move to distant cities to find work. In some cases, tourism has even helped preserve traditions: festivals and craft skills " +
        "that were slowly dying out have been revived because visitors are willing to pay to experience them. On the other hand, mass tourism can also damage " +
        "the places it depends on. Popular sites suffer from crowded streets, litter, and rising rents that push local families out of the very areas that " +
        "tourists come to see. Environmental damage — from over-used footpaths to polluted beaches — is another common problem. Many experts now argue that " +
        "the answer is not to reject visitors, but to promote a slower, more responsible form of travel that respects both the community and the landscape.",
      questions: [
        {
          q: "How can tourism help young people in traditional villages?",
          options: [
            "By providing free education",
            "By allowing them to find work at home",
            "By offering government grants",
            "By reducing the cost of living",
          ],
          a: 1,
        },
        {
          q: "According to the passage, tourism has helped preserve…",
          options: [
            "roads and bridges",
            "hospitals",
            "festivals and craft skills",
            "farms and fields",
          ],
          a: 2,
        },
        {
          q: "Which is NOT mentioned as a negative effect of mass tourism?",
          options: ["Crowded streets", "Litter", "Falling wages", "Higher rents"],
          a: 2,
        },
        {
          q: "Why do rising rents push out local families?",
          options: [
            "They can no longer afford to live in tourist areas",
            "They prefer to move to the countryside",
            "The government forces them to leave",
            "Their homes are used as museums",
          ],
          a: 0,
        },
        {
          q: "What do many experts now recommend?",
          options: [
            "Banning all foreign tourists",
            "Building larger hotels",
            "A slower, more responsible form of travel",
            "Charging much higher taxes on flights",
          ],
          a: 2,
        },
      ],
    },
    writing: {
      type: "discuss",
      prompt:
        "International travel has become cheaper and more common than at any time in history. Some people believe this benefits communities around the world, " +
        "while others think it does more harm than good. Discuss both views and give your own opinion. Write at least 250 words.",
    },
  },

  // --------------------------------------------------------------------
  {
    id: "technology",
    title: "Technology & Daily Life",
    difficulty: "Medium",
    theme: "Technology",
    description:
      "A radio segment on smart home devices and a passage on how social media is changing the way we form friendships.",
    durationMinutes: 25,
    listening: {
      transcript:
        "Welcome back to Tech Weekly. Today we are looking at smart home devices, which have grown from a niche interest into a mainstream market in just five " +
        "years. According to a recent industry report, roughly forty percent of households in Western Europe now own at least one smart speaker, and sales of " +
        "smart thermostats have tripled since twenty twenty two. Users tell us they enjoy the convenience — being able to switch off lights from bed, or check " +
        "who is at the front door from the office. However, the same report warned that many owners rarely change the default password on their devices, which " +
        "makes them easy targets for hackers. Privacy campaigners have also raised concerns about voice recordings being stored on distant servers, sometimes " +
        "for months at a time. Our advice is simple: enjoy the convenience, but spend ten minutes setting a strong password and reviewing your privacy " +
        "settings before you connect a new device to your home network.",
      questions: [
        {
          q: "What proportion of Western European households owns a smart speaker?",
          options: ["Around 10%", "About 25%", "Around 40%", "Over 60%"],
          a: 2,
        },
        {
          q: "Which product's sales have tripled since 2022?",
          options: [
            "Smart doorbells",
            "Smart thermostats",
            "Smart speakers",
            "Smart light bulbs",
          ],
          a: 1,
        },
        {
          q: "Which convenience is mentioned by users?",
          options: [
            "Cooking meals automatically",
            "Switching off lights from bed",
            "Driving the car remotely",
            "Watering the garden",
          ],
          a: 1,
        },
        {
          q: "Why are many devices easy targets for hackers?",
          options: [
            "They are cheaply made",
            "Users rarely change the default password",
            "They are always online",
            "They store no data",
          ],
          a: 1,
        },
        {
          q: "What does the presenter recommend before connecting a new device?",
          options: [
            "Registering it with the police",
            "Installing extra hardware",
            "Setting a strong password and reviewing privacy settings",
            "Waiting for a software update",
          ],
          a: 2,
        },
      ],
    },
    reading: {
      passage:
        "The way people form friendships has changed dramatically since the arrival of social media. In the past, most friends were people we saw every day at " +
        "school, at work, or in our neighbourhood. Today, it is common for young adults to describe close friends they have never met in person — people they " +
        "chat with online across time zones and continents. Supporters of this shift point out that social media allows shy people to find their community, " +
        "and helps those living far from family to stay connected. Long-distance friends can share photos, jokes and even grief in almost real time, something " +
        "earlier generations could never do. Critics, however, warn that online friendships can feel deeper than they really are. A stream of likes and short " +
        "messages is not the same as sitting with a friend during a difficult evening. Several recent studies have also found that heavy social media users " +
        "report feeling more lonely than lighter users, even though they interact with hundreds of people every day. Perhaps the safest conclusion is that " +
        "digital tools are not a substitute for offline friendship, but a useful extension of it — as long as they do not crowd out real conversation.",
      questions: [
        {
          q: "According to the passage, in the past friends were usually…",
          options: [
            "people from abroad",
            "family members only",
            "people we saw every day locally",
            "people we met at conferences",
          ],
          a: 2,
        },
        {
          q: "One benefit of social media friendships is that…",
          options: [
            "shy people can find their community",
            "everyone becomes more talkative in person",
            "traditional friendships disappear",
            "we no longer need family",
          ],
          a: 0,
        },
        {
          q: "Critics warn that online friendships…",
          options: [
            "are always fake",
            "can feel deeper than they really are",
            "are only for young people",
            "cost too much money",
          ],
          a: 1,
        },
        {
          q: "What have recent studies found about heavy social media users?",
          options: [
            "They report feeling more lonely",
            "They have more offline friends",
            "They sleep better",
            "They exercise more",
          ],
          a: 0,
        },
        {
          q: "The passage concludes that digital tools should be…",
          options: [
            "banned in schools",
            "a substitute for offline friendship",
            "a useful extension of offline friendship",
            "used only by professionals",
          ],
          a: 2,
        },
      ],
    },
    writing: {
      type: "discuss",
      prompt:
        "Some people say that new technology has made human relationships stronger, while others believe it has weakened them. Discuss both views and give your " +
        "own opinion. Include examples from your own experience or observation. Write at least 250 words.",
    },
  },

  // --------------------------------------------------------------------
  {
    id: "environment",
    title: "Environment & Energy",
    difficulty: "Medium",
    theme: "Environment",
    description:
      "A city recycling announcement plus a passage on renewable energy — good vocabulary for climate-related essays.",
    durationMinutes: 25,
    listening: {
      transcript:
        "Good afternoon, and thank you for joining our neighbourhood meeting. As many of you have noticed, our city's recycling system is changing from the " +
        "first of next month. From that date, we will no longer accept mixed recycling in a single bin. Instead, households will receive three coloured " +
        "containers: a green box for glass, a blue bag for paper and cardboard, and a grey box for plastic bottles and metal cans. Collections will take " +
        "place every Thursday morning, so please put your containers out before seven a.m. Food waste should now go into the small brown caddy that will be " +
        "delivered to every home over the next two weeks. Anything else — such as old clothes, batteries or electronics — should be taken to the community " +
        "recycling centre on Mill Road, which is open six days a week, from nine to five. If you have any questions after tonight, please email the council " +
        "office rather than phoning, as the phone lines are extremely busy during the transition.",
      questions: [
        {
          q: "When does the new recycling system start?",
          options: ["Next Monday", "The first of next month", "In three months", "At the end of the year"],
          a: 1,
        },
        {
          q: "Which colour container is for glass?",
          options: ["Blue bag", "Green box", "Grey box", "Brown caddy"],
          a: 1,
        },
        {
          q: "What time must containers be out on Thursday?",
          options: ["Before 6 a.m.", "Before 7 a.m.", "Before 8 a.m.", "Before 9 a.m."],
          a: 1,
        },
        {
          q: "Where should electronics be taken?",
          options: [
            "The community centre on Mill Road",
            "The council office",
            "The nearest shop",
            "A special truck on Thursday",
          ],
          a: 0,
        },
        {
          q: "How should residents contact the council with questions?",
          options: ["Phone", "Email", "In person only", "Text message"],
          a: 1,
        },
      ],
    },
    reading: {
      passage:
        "For most of the last century, the world's electricity was produced by burning fossil fuels — mainly coal, oil and gas. This was cheap and reliable, " +
        "but the environmental cost is now clear: rising carbon dioxide levels have driven up global temperatures, and air pollution from coal plants is " +
        "linked to millions of premature deaths every year. In response, governments and companies around the world are investing heavily in renewable " +
        "energy. Solar panels and wind turbines are the fastest-growing sources, and in several countries they now generate more electricity than coal. Their " +
        "biggest weakness is that they only produce power when the sun is shining or the wind is blowing, which is why huge new battery farms are being built " +
        "to store energy for calm nights. Hydroelectric dams, which were once the main form of renewable power, still supply a large share in mountainous " +
        "regions, though they can flood valuable land and disrupt fish populations. Newer options such as tidal power and green hydrogen remain expensive, but " +
        "many analysts believe they will play a growing role after 2030. What is no longer in doubt is that the century of fossil-fuel electricity is drawing " +
        "to a close.",
      questions: [
        {
          q: "What has been the main source of electricity for most of the last century?",
          options: ["Nuclear reactors", "Solar panels", "Fossil fuels", "Wind turbines"],
          a: 2,
        },
        {
          q: "Why are huge new battery farms being built?",
          options: [
            "To power electric cars only",
            "To store energy for calm or dark periods",
            "To replace hydroelectric dams",
            "To reduce the cost of solar panels",
          ],
          a: 1,
        },
        {
          q: "What is one drawback of hydroelectric dams?",
          options: [
            "They pollute the air",
            "They can flood land and disrupt fish populations",
            "They only work at night",
            "They require imported fuel",
          ],
          a: 1,
        },
        {
          q: "Which technologies does the writer describe as still expensive?",
          options: [
            "Coal and gas",
            "Wind and solar",
            "Tidal power and green hydrogen",
            "Hydroelectric dams",
          ],
          a: 2,
        },
        {
          q: "What does the writer suggest about fossil-fuel electricity?",
          options: [
            "It will remain dominant for centuries",
            "Its century of dominance is drawing to a close",
            "It is becoming cheaper every year",
            "It will be replaced only by nuclear power",
          ],
          a: 1,
        },
      ],
    },
    writing: {
      type: "problem-solution",
      prompt:
        "Human activity is causing serious environmental problems in many parts of the world. What do you consider to be the most urgent environmental " +
        "problem today, and what steps can governments and individuals take to address it? Write at least 250 words.",
    },
  },

  // --------------------------------------------------------------------
  {
    id: "education",
    title: "Modern Education",
    difficulty: "Hard",
    theme: "Education",
    description:
      "A university orientation talk with fast-paced detail, followed by a critical passage on online learning.",
    durationMinutes: 25,
    listening: {
      transcript:
        "Good morning, and welcome to Kingsford University. My name is Doctor Harper, and I coordinate the first-year experience programme. Over the next " +
        "week, you will attend several introductory sessions, but there are three practical points I want you to remember today. First, all first-year " +
        "students must register their timetable through the online portal by five p.m. this Friday. If you do not register by then, your seminar places will " +
        "be given to students on the waiting list. Second, our library, which is directly behind this building, has recently extended its opening hours: " +
        "during term time it is now open from seven in the morning until midnight, seven days a week. Third, we strongly recommend that you download the " +
        "campus safety app before the end of the day. It sends you weather warnings, updates on any late-night bus changes, and — most importantly — allows " +
        "you to share your location with a friend if you are walking home late. If you have any personal concerns about your accommodation, please book an " +
        "appointment with the student welfare office rather than raising them with your tutor.",
      questions: [
        {
          q: "By when must first-year students register their timetable?",
          options: ["Wednesday noon", "Thursday morning", "Friday, 5 p.m.", "Sunday evening"],
          a: 2,
        },
        {
          q: "How late does the library now stay open during term time?",
          options: ["Ten p.m.", "Eleven p.m.", "Midnight", "Two a.m."],
          a: 2,
        },
        {
          q: "What is the campus safety app NOT mentioned as offering?",
          options: [
            "Weather warnings",
            "Late-night bus updates",
            "Free food coupons",
            "Sharing your location with a friend",
          ],
          a: 2,
        },
        {
          q: "Where is the library located?",
          options: [
            "Directly behind this building",
            "Next to the main gate",
            "Across the river",
            "On the top floor of the science block",
          ],
          a: 0,
        },
        {
          q: "Who should students see about accommodation concerns?",
          options: [
            "Their personal tutor",
            "The student welfare office",
            "The registrar",
            "The head of security",
          ],
          a: 1,
        },
      ],
    },
    reading: {
      passage:
        "When online courses first became widely available around fifteen years ago, many observers predicted that traditional universities would soon lose " +
        "most of their students. The reality has been more complicated. On the positive side, high-quality courses from leading institutions are now available " +
        "to anyone with an internet connection, and adult learners can update their skills without leaving their jobs. Employers, too, increasingly accept " +
        "online certificates as evidence of professional development. Nevertheless, several important weaknesses have emerged. Studies consistently show that " +
        "completion rates for free online courses are low — often below ten percent — which suggests that many learners struggle without the structure and " +
        "social pressure of a physical classroom. Younger students in particular seem to benefit from the friendships, extracurricular activities and face-to-" +
        "face mentoring that only a physical campus can offer. There is also concern about equity: reliable devices, fast internet and a quiet place to work " +
        "are not equally available to everyone, and pure online delivery risks widening rather than narrowing gaps in achievement. The most promising path is " +
        "not to replace traditional universities but to blend the two, offering flexible online resources alongside carefully protected time on campus.",
      questions: [
        {
          q: "What did some observers predict about online courses fifteen years ago?",
          options: [
            "They would quickly disappear",
            "They would soon replace most of traditional universities",
            "They would only appeal to children",
            "They would remain a luxury product",
          ],
          a: 1,
        },
        {
          q: "According to the passage, adult learners benefit because they can…",
          options: [
            "attend university full-time",
            "update their skills without leaving their jobs",
            "avoid all assessments",
            "get free equipment",
          ],
          a: 1,
        },
        {
          q: "What do studies say about completion rates for free online courses?",
          options: [
            "They are usually above 80%",
            "They are around 50%",
            "They are often below 10%",
            "There is no reliable data",
          ],
          a: 2,
        },
        {
          q: "The writer suggests younger students particularly benefit from…",
          options: [
            "faster internet speeds",
            "cheaper textbooks",
            "friendships and face-to-face mentoring",
            "shorter courses",
          ],
          a: 2,
        },
        {
          q: "Which conclusion does the writer reach?",
          options: [
            "Traditional universities should be closed",
            "Online learning should be banned",
            "Blending online and campus learning is the most promising path",
            "Only rich students should study online",
          ],
          a: 2,
        },
      ],
    },
    writing: {
      type: "opinion",
      prompt:
        "Some people argue that a university degree is still the best route to a successful career, while others believe that practical, vocational " +
        "training is more useful. Discuss both views and give your own opinion. Support your answer with reasons and examples. Write at least 250 words.",
    },
  },

  // --------------------------------------------------------------------
  {
    id: "health",
    title: "Health & Well-being",
    difficulty: "Hard",
    theme: "Health",
    description:
      "A detailed nutrition workshop recording and a science-heavy passage on the effects of sleep on adult health.",
    durationMinutes: 25,
    listening: {
      transcript:
        "Welcome, everyone, to our workshop on everyday nutrition. I am Doctor Ellis from the community health service, and over the next fifty minutes I " +
        "will focus on three simple changes that research consistently links to a longer, healthier life. The first is fibre. Most adults eat only about " +
        "half of the recommended thirty grams a day; increasing your intake through fruit, beans and whole grains has been shown to lower the risk of both " +
        "heart disease and bowel cancer. The second change is limiting free sugars. These are the sugars added to processed food and drinks, not the natural " +
        "sugars found in whole fruit. The World Health Organisation now recommends that adults keep free sugars below twenty-five grams a day — roughly six " +
        "teaspoons. The third change is often overlooked: hydration. Even mild dehydration can affect concentration and mood, and older adults in particular " +
        "tend to under-drink because their sense of thirst weakens with age. If you take away only one message today, please make it this: small daily " +
        "changes, kept up for years, matter far more than any dramatic short-term diet.",
      questions: [
        {
          q: "How much fibre a day is recommended for adults?",
          options: ["10 grams", "20 grams", "30 grams", "50 grams"],
          a: 2,
        },
        {
          q: "Which diseases does higher fibre intake help reduce?",
          options: [
            "Colds and flu",
            "Heart disease and bowel cancer",
            "Diabetes and depression",
            "Asthma and allergies",
          ],
          a: 1,
        },
        {
          q: "How many grams of free sugars does the WHO recommend as a daily maximum?",
          options: ["10 grams", "25 grams", "50 grams", "100 grams"],
          a: 1,
        },
        {
          q: "Why do older adults often under-drink?",
          options: [
            "They are always busy",
            "They dislike the taste of water",
            "Their sense of thirst weakens with age",
            "They avoid public toilets",
          ],
          a: 2,
        },
        {
          q: "What is the speaker's main take-away message?",
          options: [
            "Small daily changes over years matter most",
            "Take a supplement every morning",
            "Avoid fruit and drink only water",
            "Follow a strict short-term diet",
          ],
          a: 0,
        },
      ],
    },
    reading: {
      passage:
        "For a long time, sleep was treated by medicine as a kind of unproductive down-time. In the past two decades, however, sleep research has moved " +
        "sharply to the centre of public health. Adults who regularly sleep fewer than six hours a night have been shown to face a higher risk of high blood " +
        "pressure, type-two diabetes, and even certain cancers. Sleep is not simply a period of rest: during the deeper stages, the brain clears out waste " +
        "products that accumulate during the day, and it consolidates the memories that make learning possible. This is why students who study late into the " +
        "night often perform worse than those who sleep on their material. Modern life, however, is unusually hostile to good sleep. Bright screens delay the " +
        "body's natural release of melatonin, long working hours push bedtimes later, and shift workers often struggle with permanent circadian disruption. " +
        "Some doctors argue that public health campaigns should now treat sleep as they treat diet and exercise, giving it equal weight in advice to patients. " +
        "The evidence, they say, is already strong enough to justify that shift.",
      questions: [
        {
          q: "How did medicine traditionally view sleep?",
          options: [
            "As dangerous",
            "As unproductive down-time",
            "As a form of exercise",
            "As a luxury for the rich",
          ],
          a: 1,
        },
        {
          q: "Which risk is NOT mentioned for adults sleeping fewer than six hours?",
          options: [
            "High blood pressure",
            "Type-2 diabetes",
            "Broken bones",
            "Certain cancers",
          ],
          a: 2,
        },
        {
          q: "What does the brain do during deep sleep, according to the passage?",
          options: [
            "It processes music",
            "It creates dreams only",
            "It clears out waste products and consolidates memories",
            "It stops working completely",
          ],
          a: 2,
        },
        {
          q: "Why is modern life described as hostile to good sleep?",
          options: [
            "Cheap coffee is everywhere",
            "Bright screens and long working hours",
            "Homes are too quiet",
            "Air travel is too common",
          ],
          a: 1,
        },
        {
          q: "What are some doctors now recommending?",
          options: [
            "Making sleep a public-health priority alongside diet and exercise",
            "Banning night shifts entirely",
            "Sleeping less to work more",
            "Charging people for sleep advice",
          ],
          a: 0,
        },
      ],
    },
    writing: {
      type: "opinion",
      prompt:
        "Some people believe governments should invest more money in preventing illness through public education about diet, exercise and sleep. Others " +
        "argue that this is the responsibility of individuals, not the state. Discuss both views and give your own opinion. Write at least 250 words.",
    },
  },
];

// Convenience helpers used by the picker page.
export function getMockExamById(id: string): MockExam | undefined {
  return MOCK_EXAMS.find((exam) => exam.id === id);
}

export function pickRandomMockExamId(): string {
  return MOCK_EXAMS[Math.floor(Math.random() * MOCK_EXAMS.length)].id;
}
