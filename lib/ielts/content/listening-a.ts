import type { ExamListeningTest } from "../types";

/** Original Averna Listening tests (exam-v2, 4 parts × 10 questions). */
export const LISTENING_SEED_A: ExamListeningTest[] = [
  // ===========================================================================
  // AVERNA LISTENING TEST 1 (Easy)
  // ===========================================================================
  // The runner speaks "Part N. <context>", the first reading time and "That is
  // the end of Part N." itself, so the scripts only carry the in-part
  // announcements (start of listening + the mid-part reading break).
  {
    format: "exam-v2",
    skill: "LISTENING",
    id: "averna-listening-01",
    title: "Averna Listening Test 1",
    description:
      "Full Listening test: a man phoning a sports centre to join as a member, a coordinator’s briefing for new volunteers at a town summer festival, two students discussing a campus water-saving project with their tutor, and a lecture on the history of chocolate production. 4 parts, 40 questions.",
    difficulty: "Easy",
    topics: ["sport and leisure", "membership", "festivals", "volunteering", "university life", "environment", "water", "history", "food"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Part 1 — Questions 1–10 (form + notes completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-01-part-1",
        title: "Part 1",
        context: "You will hear a man telephoning a sports centre to join as a member.",
        speakers: [
          { name: "Receptionist", gender: "female", accent: "british" },
          { name: "Owen", gender: "male", accent: "australian" },
        ],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 1 to 6." },
          { speaker: "Receptionist", text: "Good morning, Hallworth Sports Centre. How can I help you?" },
          {
            speaker: "Owen",
            text: "Oh, hi. I’d like to become a member, please. I moved to Hallworth a few weeks ago, and I’ve been meaning to call you for ages. Can I join over the phone?",
          },
          {
            speaker: "Receptionist",
            text: "Yes, of course. I can take all your details now, and then you’ll just need to come in for an induction before you start. So, can I have your name, please?",
          },
          { speaker: "Owen", text: "It’s Owen Colbeck." },
          { speaker: "Receptionist", text: "And how do you spell your surname?" },
          { speaker: "Owen", text: "C, O, L, B, E, C, K." },
          { speaker: "Receptionist", text: "C, O, L, B, E, C, K. Colbeck. Thank you. And what’s your address, Mr Colbeck?" },
          { speaker: "Owen", text: "It’s sixteen Brindle Road. That’s B, R, I, N, D, L, E." },
          { speaker: "Receptionist", text: "Sorry, was that sixteen or sixty?" },
          { speaker: "Owen", text: "Sixteen. One, six. It’s one of the new houses near the railway bridge." },
          { speaker: "Receptionist", text: "Lovely. And a contact number?" },
          { speaker: "Owen", text: "My mobile is oh seven seven double oh, nine double oh, three one two." },
          {
            speaker: "Receptionist",
            text: "Oh seven seven double oh, nine double oh, three one two. And can I ask what you do for a living? Some local employers have a discount arrangement with us, so it’s always worth checking.",
          },
          { speaker: "Owen", text: "I’m a paramedic, so I work for the ambulance service." },
          {
            speaker: "Receptionist",
            text: "A paramedic. I’m afraid the ambulance service isn’t in our scheme at the moment, but we’re adding new employers all the time, so it might be worth asking your manager about it.",
          },
          { speaker: "Owen", text: "I will, thanks." },
          { speaker: "Receptionist", text: "And how did you hear about us? Did you see our advert in the local paper?" },
          {
            speaker: "Owen",
            text: "No, I haven’t seen that. I did pick up one of your leaflets in the library, but I didn’t really do anything about it. It was a colleague of mine who persuaded me in the end. She’s been coming here for years, and she says your pool is the best in the area.",
          },
          {
            speaker: "Receptionist",
            text: "That’s good to hear. So I’ll put that you were recommended by a colleague. Now, we have three types of membership. Would you like me to explain them?",
          },
          { speaker: "Owen", text: "Yes, please." },
          {
            speaker: "Receptionist",
            text: "Well, our most popular one is Anytime membership. That gives you the gym, the pool and all our fitness classes, seven days a week, from six in the morning until ten at night, and it’s forty-four pounds a month. Then there’s Daytime membership. You get exactly the same facilities, but only from nine until four on weekdays. And if you only want to swim, there’s Swim membership, which is twenty pounds a month.",
          },
          {
            speaker: "Owen",
            text: "Well, I definitely want to use the gym as well as the pool, so not the swimming one. I work shifts, and I often have days off during the week. What happens if I want to come in at the weekend, though?",
          },
          {
            speaker: "Receptionist",
            text: "With Daytime membership, you can still come in the evenings or at weekends. You just pay three pounds each time.",
          },
          { speaker: "Owen", text: "That sounds fine. I’ll go for Daytime, then. How much is that one?" },
          {
            speaker: "Receptionist",
            text: "It’s twenty-nine pounds a month. There’s usually a joining fee of twenty-five pounds as well, but we’re not charging that to anyone who joins before the end of this month.",
          },
          { speaker: "Owen", text: "Great. Twenty-nine pounds a month is a lot less than my last gym.", pauseAfter: 2 },
          {
            speaker: "Narrator",
            text: "Before you hear the rest of the conversation, you have some time to look at questions 7 to 10.",
            pauseAfter: 30,
          },
          { speaker: "Narrator", text: "Now listen and answer questions 7 to 10." },
          {
            speaker: "Receptionist",
            text: "Now, before you can use the gym, you need to have an induction. One of our trainers will show you how to use all the equipment safely and help you to plan a programme.",
          },
          { speaker: "Owen", text: "Okay. When do you run those?" },
          { speaker: "Receptionist", text: "Every day except Sunday. Which day would suit you best?" },
          {
            speaker: "Owen",
            text: "Could I do Tuesday? Oh, wait, no, sorry. I’ve just remembered I’m on a late shift on Tuesday. Thursday would be better, if you’ve got anything in the morning.",
          },
          { speaker: "Receptionist", text: "Let me have a look. Yes, on Thursday morning there’s a space at ten o’clock." },
          { speaker: "Owen", text: "Perfect." },
          { speaker: "Receptionist", text: "Your trainer will be Ellie Pennock. Just ask for her at the front desk when you arrive." },
          { speaker: "Owen", text: "Sorry, could you spell her surname for me?" },
          { speaker: "Receptionist", text: "Of course. It’s Pennock. P, E, double N, O, C, K." },
          { speaker: "Owen", text: "Got it. And do I need to bring anything?" },
          {
            speaker: "Receptionist",
            text: "Just your sports clothes and trainers, really. We provide towels for all our members now, so you don’t need to bring one of those. You will need a padlock for the lockers, though. We used to sell them here at reception, but we stopped last year, so do remember to bring your own.",
          },
          { speaker: "Owen", text: "A padlock. I’m sure I’ve got one somewhere." },
          {
            speaker: "Receptionist",
            text: "And on the day, could you get here about ten minutes before the session starts? Actually, make that fifteen. Everyone has to fill in a health questionnaire before their induction, and it usually takes longer than people expect.",
          },
          { speaker: "Owen", text: "Fifteen minutes early. No problem. Is it easy to park?" },
          {
            speaker: "Receptionist",
            text: "Yes, the car park is free for members. It does get busy in the evenings, but you won’t have any trouble on a Thursday morning.",
          },
          { speaker: "Owen", text: "Brilliant. Thanks very much for your help." },
          { speaker: "Receptionist", text: "You’re welcome, Mr Colbeck. We’ll see you on Thursday." },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the form below.",
            wordLimit: 1,
            allowNumber: true,
            title: "Hallworth Sports Centre – New Member Form",
            template: [
              "# Personal details",
              "- Name: Owen [[1]]",
              "- Address: [[2]] Brindle Road, Hallworth",
              "- Mobile: 07700 900312",
              "- Occupation: [[3]]",
              "- Recommended by: a [[4]]",
              "# Membership",
              "- Type of membership: [[5]]",
              "- Monthly fee: £[[6]] (no joining fee this month)",
            ].join("\n"),
            questions: [
              {
                n: 1,
                answer: ["Colbeck"],
                explanation: "Owen spells his surname, “C, O, L, B, E, C, K,” and the receptionist confirms it: “Colbeck.”",
              },
              {
                n: 2,
                answer: ["16", "sixteen"],
                explanation: "The receptionist checks “sixteen or sixty?” and Owen confirms: “Sixteen. One, six.”",
              },
              {
                n: 3,
                answer: ["paramedic"],
                explanation: "Owen says, “I’m a paramedic, so I work for the ambulance service.”",
              },
              {
                n: 4,
                answer: ["colleague"],
                explanation:
                  "He hasn’t seen the newspaper advert and did nothing about the library leaflet: “It was a colleague of mine who persuaded me in the end.”",
              },
              {
                n: 5,
                answer: ["Daytime", "day-time"],
                explanation: "Owen wants the gym as well as the pool, so not Swim membership, and decides: “I’ll go for Daytime, then.”",
              },
              {
                n: 6,
                answer: ["29", "twenty-nine"],
                explanation:
                  "Forty-four pounds is the Anytime price and the twenty-five-pound joining fee is waived; Daytime is “twenty-nine pounds a month.”",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the notes below.",
            wordLimit: 1,
            allowNumber: true,
            title: "Induction",
            template: [
              "# Induction session",
              "- Day: [[7]], at 10 am",
              "- Trainer: Ellie [[8]] (ask at the front desk)",
              "# What to bring",
              "- sports clothes and trainers",
              "- a [[9]] for the lockers (towels are provided)",
              "# On the day",
              "- Arrive [[10]] minutes early to fill in a health questionnaire",
              "- Parking is free for members",
            ].join("\n"),
            questions: [
              {
                n: 7,
                answer: ["Thursday"],
                explanation: "Owen suggests Tuesday, then corrects himself because of a late shift: “Thursday would be better.”",
              },
              {
                n: 8,
                answer: ["Pennock"],
                explanation: "The receptionist spells the trainer’s surname: “Pennock. P, E, double N, O, C, K.”",
              },
              {
                n: 9,
                answer: ["padlock"],
                explanation:
                  "Towels are provided, but “You will need a padlock for the lockers,” because reception no longer sells them.",
              },
              {
                n: 10,
                answer: ["15", "fifteen"],
                explanation:
                  "Ten minutes is corrected at once: “Actually, make that fifteen,” because of the health questionnaire.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 2 — Questions 11–20 (mcq-multi + notes from a box + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-01-part-2",
        title: "Part 2",
        context: "You will hear a festival coordinator talking to a group of new volunteers about a town’s summer festival.",
        speakers: [{ name: "Neil", gender: "male", accent: "british" }],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 11 to 15." },
          {
            speaker: "Neil",
            text: "Good evening, everyone, and thanks for coming. My name’s Neil Porter, and I’m the volunteer coordinator for the Elmbury Summer Festival. Most of you are new, so tonight I’ll explain what to expect over the festival weekend and what we’ll be asking you to do.",
          },
          {
            speaker: "Neil",
            text: "This will be the festival’s fourteenth year. It started as a single afternoon of music in Elmbury Park, and it’s grown into a three-day event with something for all ages. Last year we had around twenty thousand visitors, so we really couldn’t manage without you.",
          },
          {
            speaker: "Neil",
            text: "So, what’s different this year? Well, every year people ask us for a second music stage, and we did look into it very seriously. But the park simply isn’t big enough for two stages, because the sound from one would drown out the other, so there’ll still be just the one. The craft market will be back in its usual place beside the church, so nothing’s changed there, and the opening hours are exactly the same as last year, from ten in the morning until ten at night.",
          },
          {
            speaker: "Neil",
            text: "What is new is the transport. We know a lot of our visitors come by train, and the station is quite a long walk from the park, so this year there’ll be a free bus service between the station and the main gate every twenty minutes. And the other big change is that, for the first time ever, the festival will end with a firework display over the river on the Sunday night.",
          },
          {
            speaker: "Neil",
            text: "Now, some practical information. On your first day, please go to the volunteers’ tent to collect your T-shirt and your badge. You’ll also need to sign in there at the start of every shift. In previous years, volunteers signed in at the town hall, but that’s too far from the park, so please don’t go there by mistake. The tent is right behind the bandstand, with a big yellow flag on top.",
          },
          {
            speaker: "Neil",
            text: "Anyone doing a shift of four hours or more gets a free lunch. It won’t be in the park café, I’m afraid, because that’ll be far too busy with visitors. Instead, lunch will be served in the school hall at Elmbury Primary, just across the road from the main gate. Just show your badge at the door.",
          },
          {
            speaker: "Neil",
            text: "And finally, if for any reason you can’t come to a shift, because you’re ill, for example, please let us know as early as you can. The festival office is closed at weekends, so there’s no point ringing that number. Instead, contact your team leader directly. You’ll find their phone number in your welcome email. And if you start to feel unwell while you’re actually working, go straight to the first-aid tent.",
            pauseAfter: 2,
          },
          {
            speaker: "Narrator",
            text: "Before you hear the rest of the talk, you have some time to look at questions 16 to 20.",
            pauseAfter: 30,
          },
          { speaker: "Narrator", text: "Now listen and answer questions 16 to 20." },
          {
            speaker: "Neil",
            text: "Right, let me tell you about the different areas where you might be working, and what you’ll be doing in each one.",
          },
          {
            speaker: "Neil",
            text: "We’ll start with the main gate on Station Road. The festival is free, so you won’t be selling any tickets there, and bag checks are carried out by a professional security company. What we need you to do at the gate is count the visitors as they come in. You’ll each have a small hand counter, and every hour you’ll send the total to the office. It sounds dull, but our funding from the council depends on those figures.",
          },
          {
            speaker: "Neil",
            text: "Next, the food market. The stallholders run their own stalls, so you won’t be serving food or handling any money. Instead, you’ll be standing by the waste points, helping people to put their rubbish in the right bins. Last year we recycled about half of the festival’s waste, and this year we’re aiming for three quarters, so it’s an important job.",
          },
          {
            speaker: "Neil",
            text: "Down by the river, the rowing club will be running boat trips out to the island and back. They’ll have their own members to help passengers in and out of the boats, but they’ve asked us for volunteers to sell the tickets, which cost two pounds each. All of that money goes to the rowing club, by the way, not to the festival.",
          },
          {
            speaker: "Neil",
            text: "Then there’s the children’s area, which is always the busiest part of the site. The games and activities are run by qualified play workers, so you won’t be looking after any children yourselves. What we need you for is the entrance. Every child who comes in is given a paper wristband, and you’ll write a parent’s phone number on it, so that if a child gets lost, we can contact the family straight away.",
          },
          {
            speaker: "Neil",
            text: "And last of all, there’s the car park on Mill Lane. Parking is free again this year, but we’d like volunteers to stand at the exit with collection buckets and ask drivers if they’d like to make a donation. This year, everything we collect goes to the town’s hospice.",
          },
          {
            speaker: "Neil",
            text: "One thing that none of you will be asked to do, wherever you are, is give first aid. If someone is hurt, just call the first-aid team on your radio, and they’ll be with you in minutes. Right, that’s everything from me. Does anyone have any questions?",
          },
        ],
        groups: [
          {
            kind: "mcq-multi",
            instructions: "Choose TWO letters, A–E.",
            title: "Which TWO things are new at this year’s festival?",
            options: [
              { key: "A", text: "a second music stage" },
              { key: "B", text: "a free bus service" },
              { key: "C", text: "a craft market" },
              { key: "D", text: "later opening hours" },
              { key: "E", text: "a firework display" },
            ],
            questions: [
              {
                n: 11,
                answer: ["B", "E"],
                explanation:
                  "A second stage was ruled out and the craft market and opening hours are unchanged, but “this year there’ll be a free bus service” and the festival will end with “a firework display”.",
              },
              {
                n: 12,
                answer: ["B", "E"],
                explanation:
                  "Neil names two changes only: the free bus from the station and, “for the first time ever”, fireworks over the river on the Sunday night.",
              },
            ],
          },
          {
            kind: "gap-box",
            instructions:
              "Complete the notes below. Choose THREE answers from the box and write the correct letter, A–G, next to Questions 13–15.",
            title: "Information for volunteers",
            options: [
              { key: "A", text: "town hall" },
              { key: "B", text: "team leader" },
              { key: "C", text: "volunteers’ tent" },
              { key: "D", text: "festival office" },
              { key: "E", text: "school hall" },
              { key: "F", text: "park café" },
              { key: "G", text: "first-aid tent" },
            ],
            template: [
              "- On the first day, collect a T-shirt and badge, then sign in at the [[13]] at the start of every shift",
              "- Volunteers working four hours or more get a free lunch in the [[14]]",
              "- If you cannot come to a shift, contact your [[15]] as early as possible",
            ].join("\n"),
            questions: [
              {
                n: 13,
                answer: ["C"],
                explanation:
                  "Signing in has moved from the town hall to the volunteers’ tent: “You’ll also need to sign in there at the start of every shift.”",
              },
              {
                n: 14,
                answer: ["E"],
                explanation: "Lunch is not in the park café but “in the school hall at Elmbury Primary, just across the road from the main gate.”",
              },
              {
                n: 15,
                answer: ["B"],
                explanation:
                  "The festival office is closed at weekends, so “contact your team leader directly”; the first-aid tent is only for feeling unwell during a shift.",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What will volunteers do in each of the following areas of the festival? Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 16–20.",
            title: "Volunteer tasks",
            options: [
              { key: "A", text: "counting visitors" },
              { key: "B", text: "collecting money for charity" },
              { key: "C", text: "selling tickets" },
              { key: "D", text: "helping with recycling" },
              { key: "E", text: "giving out wristbands" },
              { key: "F", text: "giving first aid" },
              { key: "G", text: "checking bags" },
            ],
            questions: [
              {
                n: 16,
                text: "the main gate",
                answer: ["A"],
                explanation:
                  "No tickets are sold and a security company checks bags; volunteers at the gate “count the visitors as they come in.”",
              },
              {
                n: 17,
                text: "the food market",
                answer: ["D"],
                explanation:
                  "Volunteers won’t serve food or handle money; they will be “helping people to put their rubbish in the right bins” to raise recycling.",
              },
              {
                n: 18,
                text: "the river",
                answer: ["C"],
                explanation:
                  "The rowing club’s own members help passengers, but “they’ve asked us for volunteers to sell the tickets.”",
              },
              {
                n: 19,
                text: "the children’s area",
                answer: ["E"],
                explanation:
                  "Play workers run the activities; volunteers at the entrance give each child “a paper wristband” with a parent’s phone number on it.",
              },
              {
                n: 20,
                text: "the car park",
                answer: ["B"],
                explanation:
                  "Parking is free, but volunteers “stand at the exit with collection buckets” to raise money for the town’s hospice.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 3 — Questions 21–30 (mcq + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-01-part-3",
        title: "Part 3",
        context:
          "You will hear two environmental science students, Hannah and Marco, discussing their campus water-saving project with their tutor, Doctor Ashworth.",
        speakers: [
          { name: "Dr Ashworth", gender: "female", accent: "british" },
          { name: "Hannah", gender: "female", accent: "australian" },
          { name: "Marco", gender: "male", accent: "american" },
        ],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 21 to 25." },
          {
            speaker: "Dr Ashworth",
            text: "Come in, Hannah, Marco. Have a seat. So, your water-saving project is nearly finished. How are you feeling about it?",
          },
          { speaker: "Hannah", text: "Pretty good, actually. We’ve collected all our data now, so it’s mainly the report that’s left." },
          {
            speaker: "Dr Ashworth",
            text: "Good. Before we get into the results, remind me why you chose the halls of residence for the project.",
          },
          { speaker: "Marco", text: "Well, we both live in halls, so it was convenient. But that wasn’t really the reason." },
          {
            speaker: "Hannah",
            text: "No. When we first went to the estates office to ask about possible topics, they told us that all the halls share a single water meter with the sports centre. So nobody had any idea how much water the students actually use. It seemed like a real gap.",
          },
          { speaker: "Dr Ashworth", text: "And the estates office were happy for you to go ahead?" },
          {
            speaker: "Marco",
            text: "Yes. It wasn’t their idea, but once we’d explained what we wanted to do, they agreed to fit separate meters in two of the halls, Linden Court and Beech House.",
          },
          { speaker: "Dr Ashworth", text: "And you began with a survey, didn’t you?" },
          {
            speaker: "Hannah",
            text: "That’s right. We had two hundred and forty replies, which was more than we’d hoped for. A lot of people seemed to think water was free, because it’s included in their rent, but we’d expected that.",
          },
          {
            speaker: "Marco",
            text: "We were also worried that people would say they couldn’t be bothered to change their habits, but in fact more than three quarters said they’d be happy to use less.",
          },
          {
            speaker: "Hannah",
            text: "What really surprised us was the showers. We’d guessed that the average shower would be around six minutes, but it turned out to be nearly eleven.",
          },
          { speaker: "Dr Ashworth", text: "That’s quite a difference. And how did the meters work out?" },
          {
            speaker: "Marco",
            text: "The meters themselves were fine. They were fitted on time, right at the start of term, and when we compared our figures with the water company’s bill, they matched almost exactly. The trouble was getting the readings. We’d assumed we’d be able to check them online, but the only display is in a locked room in the basement of each hall, so every Friday someone from the estates team had to let us in.",
          },
          {
            speaker: "Dr Ashworth",
            text: "That must have been frustrating. So what did you find in the end? How much less water did Linden Court use than Beech House?",
          },
          { speaker: "Hannah", text: "In the first month, it was about twenty per cent less, which was really exciting." },
          {
            speaker: "Marco",
            text: "But it didn’t last. People got a bit less careful after that, so over the whole ten weeks, it came to fourteen per cent.",
          },
          {
            speaker: "Dr Ashworth",
            text: "That’s still well above the university’s target of ten per cent, so it’s a good result. I do have one concern, though. Ten weeks is perfectly reasonable for a project like this, and two hundred and forty replies is a very respectable number. But Beech House has shared bathrooms on each floor, while every room in Linden Court has its own bathroom. So I’m not sure you’re really comparing like with like.",
          },
          { speaker: "Hannah", text: "We did wonder about that. They were the only two halls where the estates office could fit meters." },
          {
            speaker: "Dr Ashworth",
            text: "Then say that clearly in your report, and explain how it might have affected your results.",
            pauseAfter: 2,
          },
          {
            speaker: "Narrator",
            text: "Before you hear the rest of the discussion, you have some time to look at questions 26 to 30.",
            pauseAfter: 30,
          },
          { speaker: "Narrator", text: "Now listen and answer questions 26 to 30." },
          {
            speaker: "Dr Ashworth",
            text: "Now, let’s go through the measures you tried in Linden Court, one at a time. Start with the shower timers.",
          },
          { speaker: "Marco", text: "Those were the little sand timers that we fixed to the shower walls. They were really cheap, less than a pound each." },
          {
            speaker: "Hannah",
            text: "But people didn’t like them at all to begin with. Some said it felt like being watched, and a few were pulled off the walls in the first week. By the end of term, though, most people had got used to them.",
          },
          { speaker: "Dr Ashworth", text: "And the posters?" },
          { speaker: "Hannah", text: "We put them up in every bathroom and kitchen, with facts about how much water a running tap wastes." },
          {
            speaker: "Marco",
            text: "They got a lot of attention for the first few days. But after a couple of weeks, nobody seemed to look at them any more. We should probably have changed them every week.",
          },
          { speaker: "Dr Ashworth", text: "What about the competition?" },
          { speaker: "Marco", text: "Each floor competed to use the least water, and the winning floor got a free pizza night." },
          {
            speaker: "Hannah",
            text: "We thought it would be really hard to run, but the floor representatives did most of the work, so it was actually quite easy. And the best thing was that people on each floor started helping each other, reminding their neighbours to turn off taps and sharing tips, that kind of thing.",
          },
          { speaker: "Dr Ashworth", text: "And the new showerheads?" },
          {
            speaker: "Hannah",
            text: "Those mix air into the water, so they use much less but still feel powerful. We thought people might complain about the pressure, but nobody did.",
          },
          {
            speaker: "Marco",
            text: "And they made by far the biggest difference. Our figures suggest they were responsible for more than half of the total saving.",
          },
          { speaker: "Dr Ashworth", text: "Finally, the leak reporting." },
          {
            speaker: "Marco",
            text: "We put a QR code in every bathroom, so students could scan it with their phones to report a dripping tap or a toilet that wouldn’t stop running.",
          },
          {
            speaker: "Hannah",
            text: "Before that, people didn’t bother telling anyone, so a leak could go on for weeks. With the code, the report went straight to the maintenance team, and most leaks were fixed within two days.",
          },
          {
            speaker: "Dr Ashworth",
            text: "That’s impressive. Right, let’s think about how you’re going to present all this.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Choose the correct letter, A, B or C.",
            questions: [
              {
                n: 21,
                text: "Why did the students choose the halls of residence for their project?",
                options: [
                  { key: "A", text: "They both live in halls themselves." },
                  { key: "B", text: "The estates office suggested it." },
                  { key: "C", text: "The students’ water use had never been measured." },
                ],
                answer: ["C"],
                explanation:
                  "Living in halls was only convenient and it “wasn’t their idea”; the real reason was that “nobody had any idea how much water the students actually use.”",
              },
              {
                n: 22,
                text: "What surprised the students about the results of their survey?",
                options: [
                  { key: "A", text: "how many students thought water was free" },
                  { key: "B", text: "how long students spent in the shower" },
                  { key: "C", text: "how few students were willing to use less water" },
                ],
                answer: ["B"],
                explanation:
                  "They expected people to think water was free, and most were willing to change; “What really surprised us was the showers” — nearly eleven minutes, not six.",
              },
              {
                n: 23,
                text: "What problem did the students have with the water meters?",
                options: [
                  { key: "A", text: "It was difficult to get the readings." },
                  { key: "B", text: "The meters were fitted later than planned." },
                  { key: "C", text: "Some of the readings were inaccurate." },
                ],
                answer: ["A"],
                explanation:
                  "The meters were fitted on time and matched the bill; “The trouble was getting the readings” from a locked room in the basement.",
              },
              {
                n: 24,
                text: "Over the whole project, how much less water did Linden Court use than Beech House?",
                options: [
                  { key: "A", text: "10%" },
                  { key: "B", text: "14%" },
                  { key: "C", text: "20%" },
                ],
                answer: ["B"],
                explanation:
                  "Twenty per cent was only the first month and ten per cent is the university’s target; “over the whole ten weeks, it came to fourteen per cent.”",
              },
              {
                n: 25,
                text: "What does Dr Ashworth think is the main weakness of the project?",
                options: [
                  { key: "A", text: "The two halls are too different to compare." },
                  { key: "B", text: "The trial did not last long enough." },
                  { key: "C", text: "Too few students replied to the survey." },
                ],
                answer: ["A"],
                explanation:
                  "Ten weeks and 240 replies are fine, but one hall has shared bathrooms and the other en-suite rooms, so they are not “comparing like with like.”",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What do the students say about each of the following water-saving measures? Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 26–30.",
            title: "Comments",
            options: [
              { key: "A", text: "It saved the most water." },
              { key: "B", text: "Students soon stopped noticing it." },
              { key: "C", text: "It cost more than expected." },
              { key: "D", text: "It was unpopular at first." },
              { key: "E", text: "It helped problems to be fixed faster." },
              { key: "F", text: "It was difficult to organise." },
              { key: "G", text: "It encouraged teamwork among students." },
            ],
            questions: [
              {
                n: 26,
                text: "shower timers",
                answer: ["D"],
                explanation:
                  "The timers were cheap, but “people didn’t like them at all to begin with”, although most got used to them by the end of term.",
              },
              {
                n: 27,
                text: "posters",
                answer: ["B"],
                explanation: "They got attention for a few days, but “after a couple of weeks, nobody seemed to look at them any more.”",
              },
              {
                n: 28,
                text: "a competition between floors",
                answer: ["G"],
                explanation:
                  "It turned out to be easy to run, and “people on each floor started helping each other” to save water.",
              },
              {
                n: 29,
                text: "new showerheads",
                answer: ["A"],
                explanation:
                  "Nobody complained about the pressure, and “they made by far the biggest difference” — more than half of the total saving.",
              },
              {
                n: 30,
                text: "a leak-reporting system",
                answer: ["E"],
                explanation:
                  "Leaks used to go unreported for weeks, but with the QR code “most leaks were fixed within two days.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 4 — Questions 31–40 (notes completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-01-part-4",
        title: "Part 4",
        context: "You will hear part of a lecture on the history of chocolate production.",
        speakers: [{ name: "Lecturer", gender: "male", accent: "american" }],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 31 to 40." },
          {
            speaker: "Lecturer",
            text: "Good morning, everyone. In this series on the history of food, we’ve already looked at bread and tea, and today I’d like to turn to something that almost everyone enjoys, and that’s chocolate. In particular, I want to look at how chocolate has been produced over the centuries, because the kind of chocolate bar you might buy today is actually a fairly recent invention.",
          },
          {
            speaker: "Lecturer",
            text: "Let’s start with the plant itself. Chocolate is made from the seeds of the cacao tree, which are usually called beans. The tree only grows in hot, humid regions close to the equator, and it originally comes from the upper Amazon, in South America. For a long time, historians believed that people first used cacao in Mexico and Central America. But in recent years, archaeologists working in south-eastern Ecuador have found traces of cacao on pieces of pottery that are around five thousand three hundred years old. So it seems that people in South America were using cacao much earlier than anyone had realised.",
          },
          {
            speaker: "Lecturer",
            text: "It was in Mexico and Central America, though, that cacao became really important. The Maya, and later the Aztecs, didn’t eat chocolate in the way we do. They drank it. The beans were roasted, ground into a paste and mixed with water, and the result was a bitter drink, quite unlike the sweet hot chocolate we know today. It was often flavoured with vanilla or with flowers, and sometimes it was made hot and spicy by adding chilli. People especially valued the foam on top of the drink, and to produce it, they poured the chocolate from one container into another, holding the first one high above the second. Paintings on ancient Maya vases show people doing exactly this.",
          },
          {
            speaker: "Lecturer",
            text: "Cacao beans were valuable in another way, too. The trees couldn’t grow in the cool highlands where the Aztec capital stood, so the beans had to be brought in from warmer lowland areas, and the Aztecs used them as money. Records from the sixteenth century list the prices of everyday goods, from tomatoes to turkeys, in cacao beans.",
          },
          {
            speaker: "Lecturer",
            text: "The first Europeans to taste chocolate were Spanish explorers and soldiers in the early fifteen hundreds, and many of them didn’t like it at all. Once chocolate reached Spain, however, it was changed to suit European tastes. The Spanish drank it hot, and they added sugar, along with spices such as cinnamon, and in this form it became popular with the wealthy. During the sixteen hundreds, it spread to Italy, France and England.",
          },
          {
            speaker: "Lecturer",
            text: "In London, chocolate houses began to open in the second half of the seventeenth century. Like the coffee houses of the same period, they were fashionable places where wealthy men met to do business, discuss politics and, quite often, gamble. But chocolate remained a luxury, and not only because the beans had to be shipped across the Atlantic. In Britain, the government placed very high taxes on it, and these weren’t reduced until the middle of the nineteenth century.",
          },
          {
            speaker: "Lecturer",
            text: "Until the late seventeen hundreds, making chocolate was slow, hard work. The beans were ground by hand on a heated stone, or in mills powered by water or by animals. That began to change when manufacturers started to use steam engines to grind the beans. Far larger quantities could now be produced, and gradually the price began to fall.",
          },
          {
            speaker: "Lecturer",
            text: "The next important step came in eighteen twenty-eight, in the Netherlands, with the invention of a press that could squeeze much of the fat out of the ground beans. This fat is known as cocoa butter. What was left behind was a hard cake, which could then be ground into a fine powder. Cocoa powder mixed far more easily with water or milk than the old paste had done.",
          },
          {
            speaker: "Lecturer",
            text: "Cocoa butter turned out to be the key to the chocolate bar. In eighteen forty-seven, a company in the English city of Bristol found that if they mixed cocoa powder and sugar with melted cocoa butter, they could press the paste into a mould, where it set hard. This is generally considered to be the first chocolate bar made for eating rather than drinking.",
          },
          {
            speaker: "Lecturer",
            text: "Those early bars were rather dry and grainy, though, and two developments in Switzerland changed that. The first was milk chocolate. Adding milk had always been difficult, because the water in it made the chocolate go bad very quickly. In eighteen seventy-five, a Swiss chocolate maker solved the problem by using milk from which most of the water had been removed. Then, in eighteen seventy-nine, another Swiss manufacturer invented a machine called a conche, which stirs warm liquid chocolate for many hours, sometimes for days. This gives the chocolate a smooth texture, and the process is still used today.",
          },
          {
            speaker: "Lecturer",
            text: "Finally, it’s worth noting that most of the world’s cocoa is no longer grown in the Americas at all. Around seventy per cent of it now comes from West Africa, mostly from small family farms, and that raises some difficult questions about prices and working conditions, which we’ll look at next week.",
          },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the notes below.",
            wordLimit: 1,
            title: "The history of chocolate production",
            template: [
              "# Early history",
              "- Cacao trees first grew in the upper Amazon",
              "- Oldest evidence: traces of cacao on [[31]] from Ecuador, about 5,300 years old",
              "- The Maya and Aztecs drank cacao; the drink was bitter and sometimes made spicy with [[32]]",
              "- It was poured from a height to create [[33]]",
              "- The Aztecs used cacao beans as [[34]]",
              "# Chocolate in Europe",
              "- The Spanish drank it hot and added [[35]] and spices such as cinnamon",
              "- In London, chocolate [[36]] were fashionable meeting places",
              "- Chocolate stayed expensive in Britain because of high [[37]]",
              "# Industrial production",
              "- Late 1700s: [[38]] engines began to be used to grind the beans",
              "- 1828: a press in the Netherlands removed cocoa butter, and the rest was ground into [[39]]",
              "- 1847: the first chocolate bar for eating was made in Bristol",
              "- 1875: milk chocolate was developed in Switzerland",
              "- 1879: a machine called a conche gave chocolate a [[40]] texture",
            ].join("\n"),
            questions: [
              {
                n: 31,
                answer: ["pottery"],
                explanation:
                  "Archaeologists in south-eastern Ecuador “have found traces of cacao on pieces of pottery” about 5,300 years old.",
              },
              {
                n: 32,
                answer: ["chilli", "chili", "chillies", "chilies"],
                explanation: "Vanilla and flowers were flavourings too, but the drink “was made hot and spicy by adding chilli.”",
              },
              {
                n: 33,
                answer: ["foam"],
                explanation:
                  "People valued “the foam on top of the drink” and poured it from one container held high above another to produce it.",
              },
              {
                n: 34,
                answer: ["money"],
                explanation: "The beans had to be brought from the lowlands, and “the Aztecs used them as money.”",
              },
              {
                n: 35,
                answer: ["sugar"],
                explanation: "The Spanish drank it hot, “and they added sugar, along with spices such as cinnamon.”",
              },
              {
                n: 36,
                answer: ["houses"],
                explanation:
                  "“In London, chocolate houses began to open”, and they were “fashionable places where wealthy men met.”",
              },
              {
                n: 37,
                answer: ["taxes", "tax"],
                explanation:
                  "Shipping was not the only reason it stayed a luxury: “the government placed very high taxes on it.”",
              },
              {
                n: 38,
                answer: ["steam"],
                explanation:
                  "Grinding by hand or with water or animal power changed “when manufacturers started to use steam engines to grind the beans.”",
              },
              {
                n: 39,
                answer: ["powder"],
                explanation: "Once the cocoa butter was pressed out, the hard cake left behind “could then be ground into a fine powder.”",
              },
              {
                n: 40,
                answer: ["smooth"],
                explanation: "The conche stirs warm chocolate for hours, and “This gives the chocolate a smooth texture.”",
              },
            ],
          },
        ],
      },
    ],
  },
];
