import type { SpeakingExamSet } from "../types";

/**
 * Original Averna Speaking tests (Parts 1–3).
 *
 * Every test follows the real format: Part 1 opens with a "who are you" topic
 * (work or studies / hometown / home / local area) and moves on to two
 * everyday topics; Part 2 is a cue card with "You should say:" points and an
 * "and explain…" closing; Part 3 discusses broader, more abstract questions
 * linked to the Part 2 theme, from easier (describe, compare) to harder
 * (evaluate, predict, society-level). All topics and questions are written
 * from scratch for Averna.
 */
export const SPEAKING_SEED: SpeakingExamSet[] = [
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-01",
    title: "Someone careful with money",
    source: "averna",
    part1: [
      {
        topic: "Work or studies",
        questions: [
          "Are you working or studying at the moment?",
          "Why did you choose that job or subject?",
          "What does a typical day look like for you?",
          "Is there anything you would like to change about your work or studies?",
        ],
      },
      {
        topic: "Music",
        questions: [
          "What kind of music do you usually listen to?",
          "Do you listen to music while you are studying or working?",
          "Did you learn to play a musical instrument when you were a child?",
          "Is there a song you have been listening to a lot recently?",
        ],
      },
      {
        topic: "The weather",
        questions: [
          "What is the weather usually like where you live?",
          "Which season do you like best? Why?",
          "Does the weather ever change your plans for the day?",
          "Would you like to live in a place with a very different climate?",
        ],
      },
    ],
    part2: {
      cue: "Describe a relative or friend of yours who is very careful with money.",
      points: [
        "who this person is",
        "how you know they are careful with money",
        "what they do to save money or spend it wisely",
      ],
      closing: "and explain what you think of their attitude to money.",
      followUp: "Do you often ask other people for advice about money?",
    },
    part3: {
      theme: "Money and saving",
      questions: [
        "Why do some people find it easier to save money than others?",
        "How are young people's spending habits different from those of their grandparents?",
        "Do you think paying by card or by phone makes people spend more than paying with cash?",
        "Should schools teach children how to manage money? What should they learn?",
        "In the future, will people have to rely more on their own savings than on the government when they are old?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-02",
    title: "A place where you often wait",
    source: "averna",
    part1: [
      {
        topic: "Your hometown",
        questions: [
          "Which town or city do you come from?",
          "Do you still live there now?",
          "What is your hometown best known for?",
          "Is it a good place for young people to live? Why or why not?",
        ],
      },
      {
        topic: "Reading",
        questions: [
          "How much time do you spend reading in a normal week?",
          "Do you prefer reading on paper or on a screen?",
          "What did you enjoy reading when you were a child?",
          "Is there a book you would like to read again?",
        ],
      },
      {
        topic: "Clothes",
        questions: [
          "What kind of clothes do you usually wear on a normal day?",
          "Do you enjoy shopping for clothes?",
          "Did you have to wear a uniform at school?",
          "Is there a colour you would never wear? Why?",
        ],
      },
    ],
    part2: {
      cue: "Describe a place where you often have to wait, such as a bus stop, a station or a waiting room.",
      points: [
        "where the place is",
        "how often you wait there and why",
        "what you usually do while you are waiting",
      ],
      closing: "and explain how you feel about spending time there.",
      followUp: "Do you often arrive early for appointments?",
    },
    part3: {
      theme: "Patience and waiting",
      questions: [
        "What kinds of things do people in your country usually have to queue for?",
        "Are people today less patient than people were in the past? Why?",
        "Some people say that waiting is good for us because it gives us time to think. Do you agree?",
        "What could public services such as hospitals or banks do to reduce waiting times?",
        "As more and more services move online, do you think queues will eventually disappear?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-03",
    title: "Something that was repaired",
    source: "averna",
    part1: [
      {
        topic: "Your home",
        questions: [
          "Do you live in a house or a flat?",
          "Which room do you spend the most time in?",
          "What would you like to change about your home?",
          "Do you think you will live in the same place five years from now?",
        ],
      },
      {
        topic: "Sleep",
        questions: [
          "How many hours do you usually sleep at night?",
          "Do you find it easy to get up in the morning?",
          "Do you ever have a nap during the day?",
          "What do you do when you can't get to sleep?",
        ],
      },
      {
        topic: "Photography",
        questions: [
          "Do you take a lot of photos?",
          "What do you usually take photos of?",
          "Do you like being in photos yourself?",
          "Do you ever print your photos, or do you keep them all on your phone?",
        ],
      },
    ],
    part2: {
      cue: "Describe something you own that was repaired instead of being thrown away.",
      points: ["what the object is", "what went wrong with it", "who repaired it and how"],
      closing: "and explain why you decided to repair it rather than replace it.",
      followUp: "Do you often try to fix things yourself?",
    },
    part3: {
      theme: "Repairing and replacing things",
      questions: [
        "What kinds of things do people in your country usually repair rather than throw away?",
        "Why do people replace phones and clothes more often than they did in the past?",
        "Should companies be made to produce goods that last longer and are easier to repair?",
        "Would it be a good idea for governments to make repairs cheaper, for example by lowering taxes on repair services?",
        "How might a stronger culture of repairing things affect the environment and the job market?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-04",
    title: "A gathering that didn't go to plan",
    source: "averna",
    part1: [
      {
        topic: "Work or studies",
        questions: [
          "What do you do? Do you have a job, or are you a student?",
          "What do you find most interesting about it?",
          "Do you work or study better in the morning or in the evening?",
          "What would you like to be doing in five years' time?",
        ],
      },
      {
        topic: "Transport",
        questions: [
          "How do you usually get to work or to your place of study?",
          "How long does that journey take?",
          "Do you prefer travelling by bus or by car? Why?",
          "Is public transport in your city easy to use?",
        ],
      },
      {
        topic: "Parks",
        questions: [
          "Is there a park near where you live?",
          "How often do you go to parks?",
          "What do people usually do in parks in your city?",
          "Did you spend much time in parks when you were a child?",
        ],
      },
    ],
    part2: {
      cue: "Describe a party or family gathering where something did not go as planned.",
      points: ["what the occasion was and where it took place", "who was there", "what went wrong"],
      closing: "and explain how people dealt with the problem.",
      followUp: "Do you often help to organise events for your family or friends?",
    },
    part3: {
      theme: "Celebrations and planning",
      questions: [
        "What kinds of family celebrations are most common in your country?",
        "Why do some people prefer small gatherings to big parties?",
        "Is it better to plan every detail of an event or to leave room for surprises?",
        "Have weddings and other celebrations become too expensive? Why do you think this has happened?",
        "How might the way people celebrate important occasions change over the next few decades?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-05",
    title: "A task nobody else wanted",
    source: "averna",
    part1: [
      {
        topic: "Your hometown",
        questions: [
          "Where did you grow up?",
          "What is the most interesting part of your hometown?",
          "How has your hometown changed since you were a child?",
          "Would you recommend your hometown to visitors? Why?",
        ],
      },
      {
        topic: "Food",
        questions: [
          "What do you usually have for breakfast?",
          "Is there any food you disliked as a child but enjoy now?",
          "Do you prefer eating at home or eating out?",
          "Do you often try food from other countries?",
        ],
      },
      {
        topic: "Social media",
        questions: [
          "Which social media apps do you use most?",
          "How much time do you spend on social media in a typical day?",
          "Do you post things yourself, or do you mostly look at other people's posts?",
          "Have you ever taken a break from social media?",
        ],
      },
    ],
    part2: {
      cue: "Describe a time when you offered to do a task that nobody else wanted to do.",
      points: [
        "what the task was",
        "when and where this happened",
        "why nobody else wanted to do it",
        "how you did it",
      ],
      closing: "and explain how you felt afterwards.",
      followUp: "Do you often volunteer to help other people?",
    },
    part3: {
      theme: "Responsibility and helping others",
      questions: [
        "Which household jobs do people usually try to avoid?",
        "Should household tasks be shared equally between everyone in a family?",
        "Why are some people more willing to volunteer than others?",
        "Should unpaid community work be a compulsory part of school life?",
        "Some people say that modern society has become more individualistic. Do you think this affects how willing people are to help others?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-06",
    title: "How an everyday product is made",
    source: "averna",
    part1: [
      {
        topic: "Your home",
        questions: [
          "Can you describe the place where you live?",
          "How long have you lived there?",
          "What is your favourite thing about your home?",
          "Does your home have a garden or a balcony?",
        ],
      },
      {
        topic: "Sport",
        questions: [
          "Do you play any sports?",
          "Which sports are popular in your country?",
          "Did you enjoy PE lessons at school?",
          "Do you prefer watching sport or playing it yourself?",
        ],
      },
      {
        topic: "Mornings",
        questions: [
          "What time do you usually get up?",
          "What is the first thing you do in the morning?",
          "How are your weekend mornings different from your weekday mornings?",
          "Would you describe yourself as a morning person?",
        ],
      },
    ],
    part2: {
      cue: "Describe a documentary or online video you watched that showed how an everyday product is made.",
      points: [
        "what the product was",
        "where and when you watched it",
        "what you learned about how it is made",
      ],
      closing: "and explain whether it changed the way you think about that product.",
      followUp: "Do you often watch documentaries?",
    },
    part3: {
      theme: "Documentaries and learning from the media",
      questions: [
        "What kinds of documentaries are popular in your country?",
        "Do people learn more from documentaries or from books? Why?",
        "Can documentaries ever be completely objective, or do they always show one point of view?",
        "Should companies be required to tell customers exactly how and where their products are made?",
        "How might online videos change the way people learn over the next twenty years?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-07",
    title: "Wildlife in an unexpected place",
    source: "averna",
    part1: [
      {
        topic: "Work or studies",
        questions: [
          "Do you have a job at the moment, or are you studying?",
          "Where do you usually do your work or studying?",
          "What do you like about the people you work or study with?",
          "Is there a skill from your work or studies that you use every day?",
        ],
      },
      {
        topic: "Friends",
        questions: [
          "Do you have a lot of friends, or just a few close ones?",
          "How did you meet your best friend?",
          "What do you usually do when you spend time together?",
          "Is it easy to make new friends as an adult?",
        ],
      },
      {
        topic: "Shopping",
        questions: [
          "Do you enjoy going shopping?",
          "Do you prefer shopping online or in shops?",
          "Is there a shop you have been going to for a long time?",
          "Do you ever buy things you don't really need?",
        ],
      },
    ],
    part2: {
      cue: "Describe a time when you saw a wild animal or bird in a place you didn't expect, such as a town or city.",
      points: ["what the animal or bird was", "where and when you saw it", "what it was doing"],
      closing: "and explain why the experience stayed in your memory.",
      followUp: "Do you often notice birds or animals where you live?",
    },
    part3: {
      theme: "Wildlife and cities",
      questions: [
        "What kinds of wild animals can people see in towns and cities in your country?",
        "Why do some wild animals move into cities?",
        "Is it a good idea for people to feed wild birds and animals? Why or why not?",
        "How can cities be designed so that people and wildlife can live side by side?",
        "Whose responsibility is it to protect wildlife: governments, businesses or ordinary people?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-08",
    title: "A skill school didn't teach",
    source: "averna",
    part1: [
      {
        topic: "The area you live in",
        questions: [
          "What is the area where you live like?",
          "What do you like most about your neighbourhood?",
          "Are there good places to eat or shop near your home?",
          "Has your area changed much since you moved there?",
        ],
      },
      {
        topic: "Holidays",
        questions: [
          "Where did you go on your last holiday?",
          "Do you prefer relaxing holidays or active ones?",
          "Who do you usually go on holiday with?",
          "Is there a place you would love to visit one day?",
        ],
      },
      {
        topic: "Technology",
        questions: [
          "Which piece of technology do you use most in a normal day?",
          "Is there any technology you find difficult to use?",
          "Do you usually buy the latest phone, or do you keep your old one for a long time?",
          "How did you use technology when you were a child?",
        ],
      },
    ],
    part2: {
      cue: "Describe a practical skill you wish you had been taught at school.",
      points: [
        "what the skill is",
        "how you learned it later, or why you still haven't learned it",
        "why you think your school didn't teach it",
      ],
      closing: "and explain how learning it earlier would have helped you.",
      followUp: "Do you often learn new skills from online videos?",
    },
    part3: {
      theme: "What schools should teach",
      questions: [
        "Which school subjects do you think are the most useful for later life?",
        "How is the education children get today different from the education their parents received?",
        "Should schools spend more time on practical skills such as cooking, first aid and basic repairs?",
        "Who should be mainly responsible for teaching young people life skills: parents or teachers?",
        "Some people think traditional exams will disappear in the future. What might replace them?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-09",
    title: "A misunderstood job",
    source: "averna",
    part1: [
      {
        topic: "Your home",
        questions: [
          "Who do you live with?",
          "What can you see from your window?",
          "Do you have a favourite piece of furniture at home?",
          "What makes a home feel comfortable to you?",
        ],
      },
      {
        topic: "Cooking",
        questions: [
          "How often do you cook?",
          "Who taught you to cook?",
          "What is the easiest dish you know how to make?",
          "Would you like to take a cooking course one day?",
        ],
      },
      {
        topic: "Languages",
        questions: [
          "Which languages can you speak?",
          "How long have you been learning English?",
          "What do you find most difficult about learning a new language?",
          "Is there another language you would like to learn?",
        ],
      },
    ],
    part2: {
      cue: "Describe a job that you think most people misunderstand.",
      points: ["what the job is", "how you know about it", "what people usually believe about it"],
      closing: "and explain what the job is really like.",
      followUp: "Do you often talk to people about their jobs?",
    },
    part3: {
      theme: "Jobs and respect",
      questions: [
        "Which jobs are most respected in your country?",
        "Why do some people choose jobs that are well paid but boring?",
        "Do films and television series give a realistic picture of jobs such as doctors or police officers?",
        "Should a person's salary depend on how useful their job is to society?",
        "How might the jobs that people respect most change as technology develops?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-10",
    title: "When the power or internet went off",
    source: "averna",
    part1: [
      {
        topic: "The area you live in",
        questions: [
          "Do you live in a busy area or a quiet one?",
          "Is it easy to get around your area?",
          "What facilities would you like to have closer to your home?",
          "Do you know many of your neighbours?",
        ],
      },
      {
        topic: "Walking",
        questions: [
          "Do you walk much in a typical day?",
          "Where do you like to go for a walk?",
          "Do you prefer walking alone or with other people?",
          "Is your city a good place for walking? Why or why not?",
        ],
      },
      {
        topic: "Films",
        questions: [
          "What kinds of films do you enjoy?",
          "Do you prefer watching films at home or at the cinema?",
          "Who do you usually watch films with?",
          "Is there a film you have watched more than once?",
        ],
      },
    ],
    part2: {
      cue: "Describe a time when the electricity or the internet stopped working where you were.",
      points: ["when and where it happened", "how long it lasted", "what you did while it was off"],
      closing: "and explain what the experience showed you about your daily life.",
      followUp: "Do you often spend a whole day without going online?",
    },
    part3: {
      theme: "Dependence on technology",
      questions: [
        "Which household machines and devices do people in your country depend on most?",
        "How were people's evenings different before everyone had the internet at home?",
        "Is it a good idea for people to spend some time without technology now and then? Why?",
        "What problems can a large power cut cause for a whole city?",
        "Is our growing dependence on technology a danger to society, or simply a sign of progress?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-11",
    title: "A fading tradition",
    source: "averna",
    part1: [
      {
        topic: "Your hometown",
        questions: [
          "Is your hometown a big city or a small town?",
          "What do people there usually do in their free time?",
          "Which part of your hometown do you like best?",
          "Do you think you will live there in the future?",
        ],
      },
      {
        topic: "Birthdays",
        questions: [
          "How do you usually celebrate your birthday?",
          "Can you remember a birthday from your childhood?",
          "Would you rather receive a present or money for your birthday?",
          "Is it important to remember other people's birthdays?",
        ],
      },
      {
        topic: "Art",
        questions: [
          "Did you enjoy drawing or painting when you were younger?",
          "Do you have any pictures or paintings on the walls at home?",
          "Have you been to an art gallery or exhibition recently?",
          "What kind of art do you like most?",
        ],
      },
    ],
    part2: {
      cue: "Describe a traditional game, craft or skill from your country that fewer people practise today.",
      points: ["what it is", "who usually practised it in the past", "how you learned about it"],
      closing: "and explain why you think fewer people practise it now.",
      followUp: "Do you often take part in traditional activities?",
    },
    part3: {
      theme: "Traditions in a changing world",
      questions: [
        "Which traditions are still important to young people in your country?",
        "Why do some traditions disappear while others survive?",
        "Do museums and festivals do enough to keep traditional skills alive?",
        "Should governments spend public money on protecting traditional culture? Why or why not?",
        "As people around the world watch the same films and use the same apps, will local cultures become more and more alike?",
      ],
    },
  },
  {
    format: "exam-v2",
    skill: "SPEAKING",
    id: "averna-speaking-12",
    title: "A building you've never been inside",
    source: "averna",
    part1: [
      {
        topic: "The area you live in",
        questions: [
          "How long have you lived in your area?",
          "What is there to do in your area in the evenings?",
          "Is there anything you dislike about your area?",
          "Would you like to move to a different area in the future?",
        ],
      },
      {
        topic: "Gifts",
        questions: [
          "Do you enjoy choosing gifts for other people?",
          "What was the last gift you gave someone?",
          "Do you prefer to give practical gifts or fun ones?",
          "Is there a gift you received a long time ago that you still keep?",
        ],
      },
      {
        topic: "Weekends",
        questions: [
          "What do you usually do at the weekend?",
          "Do you prefer busy weekends or relaxing ones?",
          "What did you do last weekend?",
          "Do you ever have to work or study at the weekend?",
        ],
      },
    ],
    part2: {
      cue: "Describe a building you often pass but have never been inside.",
      points: ["what the building is and where it is", "how often you pass it", "what you imagine it is like inside"],
      closing: "and explain why you have never gone in.",
      followUp: "Do you often notice the buildings you walk past?",
    },
    part3: {
      theme: "Buildings and public spaces",
      questions: [
        "Which buildings in your city do visitors usually want to see?",
        "Why do many modern buildings look so similar to each other?",
        "Should old buildings be preserved even when they are no longer useful?",
        "Who should decide what new buildings in a city look like: architects, the government or local residents?",
        "As more people work from home, how might cities make use of empty office buildings?",
      ],
    },
  },
];
