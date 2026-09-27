import type { ExamListeningTest } from "../types";

/** Original Averna Listening tests (exam-v2, 4 parts × 10 questions). */
export const LISTENING_SEED_B: ExamListeningTest[] = [
  // ===========================================================================
  // AVERNA LISTENING TEST 3 (Medium)
  // ===========================================================================
  {
    format: "exam-v2",
    skill: "LISTENING",
    id: "averna-listening-03",
    title: "Averna Listening Test 3",
    description:
      "Full Listening test: reporting a lost bag at a railway lost-property office, a curator’s introduction to a new museum exhibition, two business students reviewing a marketing case study with their lecturer, and a lecture on the psychology of colour in product design. 4 parts, 40 questions.",
    difficulty: "Medium",
    topics: ["travel", "lost property", "museums", "marketing", "business studies", "design", "psychology"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Part 1 — Questions 1–10 (form completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-03-part-1",
        title: "Part 1",
        context: "You will hear a traveller reporting a lost bag at the lost-property office of a railway station.",
        speakers: [
          { name: "Clerk", gender: "male", accent: "british" },
          { name: "Tessa", gender: "female", accent: "australian" },
        ],
        script: [
          { speaker: "Clerk", text: "Good afternoon, lost property. How can I help you?" },
          { speaker: "Tessa", text: "Oh, hi. I really hope you can help me. I’ve lost a bag somewhere in the station, about an hour ago, I think." },
          {
            speaker: "Clerk",
            text: "I’m sorry to hear that. Nothing’s been handed in since lunchtime, but things often turn up later in the day, so the best thing is for me to fill in a report now. Then if your bag does come in, we can match it to you straight away.",
          },
          { speaker: "Tessa", text: "That’d be great, thanks." },
          { speaker: "Clerk", text: "Right, let’s start with your name." },
          { speaker: "Tessa", text: "It’s Tessa Kerrigan." },
          { speaker: "Clerk", text: "And how do you spell your surname?" },
          { speaker: "Tessa", text: "K, E, double R, I, G, A, N." },
          { speaker: "Clerk", text: "So that’s K, E, double R, I, G, A, N. Kerrigan. And Tessa is T, E, double S, A?" },
          { speaker: "Tessa", text: "That’s right." },
          { speaker: "Clerk", text: "Are you living here in Stanmoor, or just visiting?" },
          { speaker: "Tessa", text: "Just visiting. I’m over from Australia for a couple of months, travelling around the country." },
          { speaker: "Clerk", text: "And where are you staying while you’re in town?" },
          {
            speaker: "Tessa",
            text: "At a small hotel down by the river. It’s called the Kingfisher. Oh, no, sorry, that was the one in the last town I stayed in. I’ve been in so many hotels this month. Here I’m at the Kestrel.",
          },
          {
            speaker: "Clerk",
            text: "The Kestrel Hotel. I know it, it’s the one beside the old bridge. And how long will you be here? We keep items for three months, but if you’re leaving soon, we’d need to get the bag back to you quickly.",
          },
          {
            speaker: "Tessa",
            text: "Well, I was supposed to be leaving on Friday, but I like the city so much that I’ve booked another night. So now I leave on Saturday morning.",
          },
          { speaker: "Clerk", text: "Saturday. I’ll make a note of that. Now, tell me about your journey. Which train were you on?" },
          { speaker: "Tessa", text: "The one from Ferrisham. It got in at about half past one." },
          {
            speaker: "Clerk",
            text: "And do you think you might have left the bag on the train? If so, it will have gone on to the depot, and they send everything over to us the following morning.",
          },
          {
            speaker: "Tessa",
            text: "No, I definitely had it when I got off, because I remember how heavy it was on the stairs. At first I thought I might have put it down in the ticket hall while I was checking the departures board. But then I remembered. I stopped at the coffee kiosk next to platform two, and I put the bag on the ground while I looked for my purse. I think I just picked up my coffee and walked off without it.",
          },
          {
            speaker: "Clerk",
            text: "That happens more often than you’d think. The kiosk staff usually bring things over at the end of their shift, so there’s a good chance it’ll turn up. Now, I need a description. What kind of bag is it?",
          },
          { speaker: "Tessa", text: "It’s a rucksack. Not a huge one." },
          { speaker: "Clerk", text: "Do you know roughly how tall it is?" },
          {
            speaker: "Tessa",
            text: "Let me think. About fifty centimetres? No, actually, I measured it before my flight because of the airline rules. It was exactly forty centimetres.",
          },
          { speaker: "Clerk", text: "Forty. And what colour is it?" },
          {
            speaker: "Tessa",
            text: "Dark green. A lot of people think it’s black when they see it indoors, but it’s definitely green. And there’s a thin grey stripe down each side.",
          },
          { speaker: "Clerk", text: "And what’s it made of? Nylon? Leather?" },
          { speaker: "Tessa", text: "The straps and the bottom are leather, but the main part of the bag is canvas." },
          { speaker: "Clerk", text: "Is there anything that would make it easy to recognise? A name label, perhaps?" },
          {
            speaker: "Tessa",
            text: "There used to be a label with my address on it, but it fell off somewhere in Sydney. There is a little plastic penguin hanging from the zip, though. My niece gave it to me, so I’d really love to get that back.",
          },
          {
            speaker: "Clerk",
            text: "A penguin. That’s actually very useful, because most of the bags that come in here look almost the same. And what was inside it?",
          },
          {
            speaker: "Tessa",
            text: "Well, luckily my passport and my phone are in my jacket pocket. In the bag there’s a pair of binoculars, which are the most valuable thing, a paperback novel and a woollen scarf.",
          },
          { speaker: "Clerk", text: "Binoculars, a novel and a scarf. Anything else?" },
          { speaker: "Tessa", text: "A bottle of water, but I’m not worried about that." },
          {
            speaker: "Clerk",
            text: "Okay. Now, if the bag is handed in, you can either collect it from this office, or we can send it to your hotel by courier.",
          },
          { speaker: "Tessa", text: "The courier sounds easier. Is there a charge for that?" },
          {
            speaker: "Clerk",
            text: "There is, I’m afraid. It used to be ten pounds, but it went up at the start of the year, so it’s twelve pounds now. That does include insurance, though.",
          },
          { speaker: "Tessa", text: "That’s fine. Twelve pounds is nothing compared with the cost of new binoculars." },
          { speaker: "Clerk", text: "Exactly. Right, I’ve got everything I need. We’ll ring the hotel as soon as we hear anything." },
          { speaker: "Tessa", text: "Thank you so much." },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the form below.",
            wordLimit: 1,
            allowNumber: true,
            title: "Stanmoor Central Station – Lost Property Report",
            template: [
              "# Traveller",
              "- Name: Tessa [[1]]",
              "- Staying at: the [[2]] Hotel, beside the old bridge",
              "- Leaving Stanmoor on: [[3]] morning",
              "# Journey",
              "- Arrived on the train from Ferrisham at about 1.30 pm",
              "- Bag probably left beside the coffee [[4]] next to platform 2",
              "# Description of bag",
              "- Type: rucksack",
              "- Height: [[5]] cm",
              "- Colour: dark [[6]], with a thin grey stripe on each side",
              "- Main material: [[7]]",
              "- Special feature: a small plastic [[8]] hanging from the zip",
              "# Contents",
              "- a pair of [[9]]",
              "- a paperback novel and a woollen scarf",
              "# Return of bag",
              "- Delivery to the hotel by courier costs £[[10]], including insurance",
            ].join("\n"),
            questions: [
              {
                n: 1,
                answer: ["Kerrigan"],
                explanation: "Tessa spells her surname: “K, E, double R, I, G, A, N.” The clerk confirms: “Kerrigan.”",
              },
              {
                n: 2,
                answer: ["Kestrel"],
                explanation: "She first says the Kingfisher, then corrects herself: “that was the one in the last town … Here I’m at the Kestrel.”",
              },
              {
                n: 3,
                answer: ["Saturday"],
                explanation: "Friday was the original plan: “I was supposed to be leaving on Friday … So now I leave on Saturday morning.”",
              },
              {
                n: 4,
                answer: ["kiosk"],
                explanation: "She rules out the train and the ticket hall: “I stopped at the coffee kiosk next to platform two, and I put the bag on the ground.”",
              },
              {
                n: 5,
                answer: ["40", "forty"],
                explanation: "Fifty is only a guess: “About fifty centimetres? No, actually … It was exactly forty centimetres.”",
              },
              {
                n: 6,
                answer: ["green"],
                explanation: "“Dark green. A lot of people think it’s black when they see it indoors, but it’s definitely green.”",
              },
              {
                n: 7,
                answer: ["canvas"],
                explanation: "Leather is only used for the straps and bottom: “the main part of the bag is canvas.”",
              },
              {
                n: 8,
                answer: ["penguin"],
                explanation: "The address label fell off, but “There is a little plastic penguin hanging from the zip.”",
              },
              {
                n: 9,
                answer: ["binoculars"],
                explanation: "Her passport and phone are in her jacket; “In the bag there’s a pair of binoculars, which are the most valuable thing.”",
              },
              {
                n: 10,
                answer: ["12", "twelve"],
                explanation: "Ten pounds was last year’s price: “It used to be ten pounds, but it went up … so it’s twelve pounds now.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 2 — Questions 11–20 (mcq + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-03-part-2",
        title: "Part 2",
        context: "You will hear a museum curator talking to a group of visitors about a new exhibition.",
        speakers: [{ name: "Lauren", gender: "female", accent: "american" }],
        script: [
          {
            speaker: "Lauren",
            text: "Good morning, everyone, and welcome to the Corland Museum. My name’s Lauren, and I’m one of the curators here. Before you go in and explore our new exhibition, Paper Worlds, I’d like to tell you a little about it and explain how the rooms are laid out.",
          },
          {
            speaker: "Lauren",
            text: "First, a bit of background. Because the old paper mill up the river has lent us so many objects, people often assume the exhibition was their idea. And it’s true that a teacher from one of the local primary schools helped us to design the activities for children. But the original suggestion came from one of our volunteers, a retired printer called Frank Ashby, who has spent forty years collecting paper items. It was really his enthusiasm that persuaded us to go ahead.",
          },
          {
            speaker: "Lauren",
            text: "So what makes Paper Worlds different from our previous exhibitions? Well, mainly the way it’s been built. Almost everything you’ll see, from the display stands to the walls between the rooms, and even the benches, is made from recycled cardboard and paper. We did discuss getting rid of glass cases altogether, so that you could get really close to the objects, but some of the older pieces are too delicate, so a few cases have had to stay. We’d also hoped to have every label printed in three languages, but for the moment they’re in English only, although translations are available on the audio guide.",
          },
          {
            speaker: "Lauren",
            text: "As for how long the exhibition will be here, we originally planned to close it in September, at the end of the summer holidays. Then there was some talk of keeping it open until Christmas. In the end, thanks to a generous grant from the city council, it will stay open until next April, when work starts on our new wing.",
          },
          {
            speaker: "Lauren",
            text: "Now, a couple of practical points. The papermaking workshop is extremely popular, and we can only take twelve people in each session, so if you’d like to have a go, please reserve a place at the front desk as early as you can. You don’t need to arrive early to beat the crowds at weekends, because we now stay open until seven o’clock on Saturdays and Sundays. And please don’t use the side entrance on Mill Street, because it’s closed while the steps are being repaired.",
          },
          {
            speaker: "Lauren",
            text: "Finally, the museum shop. Members still get their usual discount of ten per cent, so nothing has changed there. What is new is a range of notebooks and greetings cards produced by local artists, using paper from our own workshop. We’re also expecting a selection of children’s books about printing, but those won’t be in until next month.",
            pauseAfter: 2,
          },
          {
            speaker: "Lauren",
            text: "Right, let me take you through the rooms. You’ll start in the Entrance Hall, and when you walk in, make sure you look up. Hanging from the ceiling is an enormous paper whale, nearly twelve metres long, surrounded by hundreds of folded paper birds. They were all made by students from the art college. Some of you may remember that we used to show films in the Entrance Hall, but that’s no longer the case.",
          },
          {
            speaker: "Lauren",
            text: "From there you go through to the Long Gallery, which is really the heart of the exhibition. We’d hoped to display the oldest item in our whole collection in here, a farm record book that’s over four hundred years old, but it’s too fragile to be moved, so you’ll only see a photograph of it. What you will see is a collection of more than three hundred letters written by people from this town, some to relatives who’d emigrated, and others sent home by sailors and soldiers. Most of them have never been on public display before.",
          },
          {
            speaker: "Lauren",
            text: "At the far end of the gallery, a staircase takes you up to the Tower Room. There’s a small model of the old mill up there, but it’s in a glass case, so I’m afraid you can’t touch it. The main attraction in the Tower Room is a film, about fifteen minutes long, which tells the story of papermaking in this valley. It starts every half hour.",
          },
          {
            speaker: "Lauren",
            text: "When you come back down, follow the signs to the Basement. That’s where you’ll find the printing press that Frank restored. It’s more than a hundred years old, and because it’s so heavy, only members of staff are allowed to operate it, but they give demonstrations twice a day. The Basement is also where the workshop takes place, so that’s where you can make a sheet of paper of your own to take home.",
          },
          {
            speaker: "Lauren",
            text: "The last room is the Garden Room, which some of you will remember as our old café. It now holds a display all about forgery, so you’ll see fake banknotes, false identity papers and even a letter that was supposed to have been written by a famous explorer, until experts proved it wasn’t genuine. The café, by the way, has moved upstairs to the top floor. Okay, if you’d like to follow me, we’ll begin in the Entrance Hall.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Choose the correct letter, A, B or C.",
            questions: [
              {
                n: 11,
                text: "Whose idea was the Paper Worlds exhibition?",
                options: [
                  { key: "A", text: "the owners of a paper mill" },
                  { key: "B", text: "a local schoolteacher" },
                  { key: "C", text: "a museum volunteer" },
                ],
                answer: ["C"],
                explanation:
                  "The mill lent objects and a teacher helped with the children’s activities, but “the original suggestion came from one of our volunteers, a retired printer called Frank Ashby.”",
              },
              {
                n: 12,
                text: "What is unusual about the exhibition?",
                options: [
                  { key: "A", text: "None of the objects are kept in glass cases." },
                  { key: "B", text: "All the labels are written in three languages." },
                  { key: "C", text: "Most of its structures are made from recycled materials." },
                ],
                answer: ["C"],
                explanation:
                  "“Almost everything you’ll see, from the display stands to the walls … is made from recycled cardboard and paper.” Some glass cases stayed, and labels are in English only.",
              },
              {
                n: 13,
                text: "When will the exhibition close?",
                options: [
                  { key: "A", text: "in the autumn" },
                  { key: "B", text: "at the end of the year" },
                  { key: "C", text: "in the spring" },
                ],
                answer: ["C"],
                explanation:
                  "September and Christmas were earlier plans: “In the end … it will stay open until next April.”",
              },
              {
                n: 14,
                text: "What does Lauren advise visitors to do?",
                options: [
                  { key: "A", text: "reserve a place in the workshop early" },
                  { key: "B", text: "arrive early at weekends" },
                  { key: "C", text: "use the entrance on Mill Street" },
                ],
                answer: ["A"],
                explanation:
                  "“If you’d like to have a go, please reserve a place at the front desk as early as you can.” Visitors don’t need to arrive early, and the Mill Street entrance is closed.",
              },
              {
                n: 15,
                text: "What is new in the museum shop?",
                options: [
                  { key: "A", text: "products made by local artists" },
                  { key: "B", text: "a discount for museum members" },
                  { key: "C", text: "books for children" },
                ],
                answer: ["A"],
                explanation:
                  "The members’ discount is unchanged and the children’s books arrive next month; “What is new is a range of notebooks and greetings cards produced by local artists.”",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What can visitors see or do in each of the following rooms? Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 16–20.",
            title: "Exhibits and activities",
            options: [
              { key: "A", text: "equipment that visitors can use" },
              { key: "B", text: "objects that were made to deceive people" },
              { key: "C", text: "a film about a local industry" },
              { key: "D", text: "the oldest item the museum owns" },
              { key: "E", text: "a chance to make something to take home" },
              { key: "F", text: "messages written by local people" },
              { key: "G", text: "large artworks made by students" },
            ],
            questions: [
              {
                n: 16,
                text: "the Entrance Hall",
                answer: ["G"],
                explanation:
                  "“Hanging from the ceiling is an enormous paper whale … They were all made by students from the art college.” Films are no longer shown there.",
              },
              {
                n: 17,
                text: "the Long Gallery",
                answer: ["F"],
                explanation:
                  "The oldest item is too fragile to be moved; instead there is “a collection of more than three hundred letters written by people from this town.”",
              },
              {
                n: 18,
                text: "the Tower Room",
                answer: ["C"],
                explanation:
                  "The model is behind glass; “The main attraction in the Tower Room is a film … which tells the story of papermaking in this valley.”",
              },
              {
                n: 19,
                text: "the Basement",
                answer: ["E"],
                explanation:
                  "Only staff may operate the printing press, but it is “where you can make a sheet of paper of your own to take home.”",
              },
              {
                n: 20,
                text: "the Garden Room",
                answer: ["B"],
                explanation:
                  "“A display all about forgery … fake banknotes, false identity papers and even a letter” that “wasn’t genuine”.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 3 — Questions 21–30 (mcq + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-03-part-3",
        title: "Part 3",
        context: "You will hear two business students, Nadia and Tom, discussing a marketing case study with their lecturer, Doctor Hollis.",
        speakers: [
          { name: "Dr Hollis", gender: "male", accent: "american" },
          { name: "Nadia", gender: "female", accent: "british" },
          { name: "Tom", gender: "male", accent: "australian" },
        ],
        script: [
          { speaker: "Dr Hollis", text: "Come in, both of you, and have a seat. So, you’ve had a week with the Pellow’s case study. How’s it going?" },
          { speaker: "Nadia", text: "Pretty well, I think. We’ve both read all the material, and we’ve started planning the presentation." },
          { speaker: "Tom", text: "Can I ask something first, though? Why did you choose this company? It’s tiny compared with the ones in our textbook." },
          {
            speaker: "Dr Hollis",
            text: "That’s partly the point. A lot of students assume I picked it because the factory is just down the road, and I admit that made it easy to arrange an interview with the owners. But the real reason is that it’s one of the few cases I know where a firm got almost everything wrong at first and then managed to turn things around. You learn far more from that than from a story of steady success.",
          },
          {
            speaker: "Nadia",
            text: "That makes sense. What surprised me was how quickly things went wrong when they first went into the supermarkets. I’d assumed the problem would be the price, because they were charging nearly twice as much as the big brands.",
          },
          { speaker: "Tom", text: "So did I." },
          {
            speaker: "Nadia",
            text: "But the figures show that the customers who bought it didn’t mind paying more. The real shock was that within two months, three of the four supermarket chains had moved it down to the bottom of their freezers, where hardly anyone noticed it.",
          },
          { speaker: "Dr Hollis", text: "And why do you think that happened?" },
          {
            speaker: "Tom",
            text: "Well, the supermarkets blamed slow sales, obviously. But I think the real problem was the new packaging. They’d replaced the old seaside picture with a very plain, modern design, and I don’t think people recognised it as Pellow’s any more. Even loyal customers walked straight past it.",
          },
          { speaker: "Nadia", text: "There was also that complaint about the tubs being too tall for some freezers." },
          {
            speaker: "Tom",
            text: "That was just one shop, though. And yes, the new tubs cost more to make, but that only affected profits. It doesn’t explain why sales dropped.",
          },
          { speaker: "Dr Hollis", text: "Good. Now, the flavour competition. What did you make of that?" },
          {
            speaker: "Nadia",
            text: "I thought it was clever. They asked customers online to vote for a new flavour, and the winner, honey and ginger, is still their best seller.",
          },
          {
            speaker: "Dr Hollis",
            text: "It is. But I’d like you to notice something else. The competition cost almost nothing. It got a little coverage in the local press, which was nice, but more importantly, it gave the company more than forty thousand email addresses. Most students focus on the flavour itself, but that list was the real prize, because it meant Pellow’s could talk to its buyers directly, without paying for advertising.",
          },
          {
            speaker: "Tom",
            text: "So what do you think was their best decision overall? I’d have said cutting the price of the family-size tubs.",
          },
          {
            speaker: "Nadia",
            text: "Really? That only brought them back to where they were before. For me, the turning point was going back to the original seaside design. Sales went up by a third in the first month after that.",
          },
          { speaker: "Tom", text: "Actually, you’re right. The price cut came later, and the figures hardly moved." },
          { speaker: "Dr Hollis", text: "I’d agree with that.", pauseAfter: 2 },
          {
            speaker: "Dr Hollis",
            text: "Now, in your presentation, I’d like you to evaluate each of the marketing methods they tried. Have you started on that?",
          },
          { speaker: "Nadia", text: "We have. There are five. The first was the radio advertising in their first year." },
          {
            speaker: "Tom",
            text: "I thought that was a waste of money, but when we looked at the figures, the adverts actually paid for themselves.",
          },
          {
            speaker: "Nadia",
            text: "The problem was who heard them. They were on a station whose listeners are mostly retired, and Pellow’s was trying to reach families with young children.",
          },
          {
            speaker: "Tom",
            text: "Then there were the free samples they gave out at railway stations, something like twenty thousand small tubs in one summer.",
          },
          { speaker: "Dr Hollis", text: "And did that work?" },
          {
            speaker: "Nadia",
            text: "That’s the thing. Nobody knows. They never asked customers where they’d heard of the brand, so there’s no way of linking the samples to any sales at all.",
          },
          { speaker: "Tom", text: "The loyalty card was next. Customers got a stamp for every tub and a free one after ten." },
          {
            speaker: "Nadia",
            text: "And it was working. More people were signing up every month. But the owners dropped it after just six weeks, because they thought it was creating too much work for the shop staff.",
          },
          {
            speaker: "Tom",
            text: "Which was a mistake, I think. Other companies have found these schemes need at least a year to show results.",
          },
          { speaker: "Dr Hollis", text: "What about the cinema partnership?" },
          { speaker: "Tom", text: "That’s my favourite. They sold their ice cream in a small chain of independent cinemas." },
          {
            speaker: "Nadia",
            text: "The owners expected to make a small loss on it, just to get the name known, but it turned out to be one of their biggest sources of income that year.",
          },
          { speaker: "Dr Hollis", text: "Did any of their competitors try the same thing?" },
          { speaker: "Tom", text: "Not as far as we know." },
          {
            speaker: "Nadia",
            text: "And finally, there was the celebrity chef they paid to appear in their television adverts.",
          },
          {
            speaker: "Tom",
            text: "That one really backfired. A few weeks after the adverts started, he was in the newspapers for all the wrong reasons, and people began to connect Pellow’s with the bad publicity. It took the company months to recover.",
          },
          {
            speaker: "Dr Hollis",
            text: "Good. That gives you a clear structure for the presentation. Now, let’s talk about how you’re going to divide up the time.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Choose the correct letter, A, B or C.",
            questions: [
              {
                n: 21,
                text: "Why did Dr Hollis choose the Pellow’s case study?",
                options: [
                  { key: "A", text: "The company is based near the university." },
                  { key: "B", text: "The company recovered from its early mistakes." },
                  { key: "C", text: "The owners were willing to be interviewed." },
                ],
                answer: ["B"],
                explanation:
                  "The location and the interview only made things easier; “the real reason is that … a firm got almost everything wrong at first and then managed to turn things around.”",
              },
              {
                n: 22,
                text: "What surprised Nadia about the company’s first supermarket launch?",
                options: [
                  { key: "A", text: "how much more it charged than other brands" },
                  { key: "B", text: "how few shoppers were prepared to pay a high price" },
                  { key: "C", text: "how soon the product was given a worse position in shops" },
                ],
                answer: ["C"],
                explanation:
                  "Customers didn’t mind the price; “The real shock was that within two months, three of the four supermarket chains had moved it down to the bottom of their freezers.”",
              },
              {
                n: 23,
                text: "According to Tom, what was the main problem with the new packaging?",
                options: [
                  { key: "A", text: "It was expensive to produce." },
                  { key: "B", text: "It did not fit into some freezers." },
                  { key: "C", text: "Regular buyers did not recognise it." },
                ],
                answer: ["C"],
                explanation:
                  "“I don’t think people recognised it as Pellow’s any more. Even loyal customers walked straight past it.” The freezer complaint was “just one shop” and the cost “only affected profits”.",
              },
              {
                n: 24,
                text: "According to Dr Hollis, what was the most valuable result of the flavour competition?",
                options: [
                  { key: "A", text: "a flavour that became the company’s best seller" },
                  { key: "B", text: "a way to contact its customers directly" },
                  { key: "C", text: "articles about the company in local newspapers" },
                ],
                answer: ["B"],
                explanation:
                  "“Most students focus on the flavour itself, but that list was the real prize, because it meant Pellow’s could talk to its buyers directly.”",
              },
              {
                n: 25,
                text: "The students agree that the company’s most successful decision was",
                options: [
                  { key: "A", text: "reducing the price of its largest tubs." },
                  { key: "B", text: "returning to its original packaging." },
                  { key: "C", text: "introducing a flavour chosen by customers." },
                ],
                answer: ["B"],
                explanation:
                  "Nadia: “the turning point was going back to the original seaside design.” Tom changes his mind: “Actually, you’re right. The price cut came later, and the figures hardly moved.”",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What do the students say about each of the following marketing methods? Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 26–30.",
            title: "Comments",
            options: [
              { key: "A", text: "It was more successful than expected." },
              { key: "B", text: "It reached the wrong type of customer." },
              { key: "C", text: "Its effect could not be measured." },
              { key: "D", text: "It was abandoned too early." },
              { key: "E", text: "It harmed the company’s reputation." },
              { key: "F", text: "It cost more than it earned." },
              { key: "G", text: "It was copied by competitors." },
            ],
            questions: [
              {
                n: 26,
                text: "radio advertising",
                answer: ["B"],
                explanation:
                  "The adverts “actually paid for themselves”, but the listeners “are mostly retired, and Pellow’s was trying to reach families with young children.”",
              },
              {
                n: 27,
                text: "free samples",
                answer: ["C"],
                explanation:
                  "“Nobody knows … there’s no way of linking the samples to any sales at all.”",
              },
              {
                n: 28,
                text: "a loyalty card",
                answer: ["D"],
                explanation:
                  "“The owners dropped it after just six weeks … Other companies have found these schemes need at least a year to show results.”",
              },
              {
                n: 29,
                text: "a cinema partnership",
                answer: ["A"],
                explanation:
                  "“The owners expected to make a small loss on it … but it turned out to be one of their biggest sources of income.” No competitors copied it “as far as we know”.",
              },
              {
                n: 30,
                text: "adverts with a celebrity chef",
                answer: ["E"],
                explanation:
                  "“People began to connect Pellow’s with the bad publicity. It took the company months to recover.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 4 — Questions 31–40 (notes completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-03-part-4",
        title: "Part 4",
        context: "You will hear part of a lecture on the psychology of colour in product design.",
        speakers: [{ name: "Lecturer", gender: "female", accent: "british" }],
        script: [
          {
            speaker: "Lecturer",
            text: "Good morning, everyone. In today’s session on product design, I want to look at colour. I don’t mean how to choose colours that look attractive, which you’ll cover in your studio classes, but how colour changes what people believe about a product, often before they’ve even touched it.",
          },
          {
            speaker: "Lecturer",
            text: "Let’s begin with first impressions. When shoppers see an unfamiliar product, they form a judgement about it remarkably quickly, usually within a few seconds. And studies of those first judgements keep finding that colour has more influence than shape and, perhaps more surprisingly, more influence than price. So a designer who leaves colour until the very end of the process, as a kind of finishing touch, is making a serious mistake.",
          },
          {
            speaker: "Lecturer",
            text: "One of the clearest effects is on perceived weight. You might expect dark colours to make objects look smaller, but in fact their effect on apparent size is tiny. What dark colours really change is how heavy something seems. A manufacturer of camping equipment once asked customers to compare two folding chairs that were identical apart from their colour. The navy chair was consistently described as heavier than the pale yellow one, even though they weighed exactly the same. That’s why, for products where lightness is a selling point, such as suitcases and bicycles, designers tend to choose pale shades, whereas for loudspeakers, where people associate weight with quality, darker finishes are more common.",
          },
          {
            speaker: "Lecturer",
            text: "Colour can even change the way food tastes. In one experiment, volunteers were given exactly the same vegetable soup, served in bowls of different colours. Those who ate from red bowls described the soup as saltier, while a blue bowl made the same soup seem rather bland. Food companies have certainly taken note of findings like this.",
          },
          {
            speaker: "Lecturer",
            text: "Now, the meanings attached to colours are not universal, and that matters for any company selling abroad. White, for instance, suggests cleanliness and simplicity in much of Europe, which is partly why it’s so popular for kitchen appliances. But in parts of East Asia, white is traditionally associated with mourning, so a range of white gift products could send quite the wrong message.",
          },
          {
            speaker: "Lecturer",
            text: "Meanings also change over time. Green has become so closely linked with protecting the environment that it can actually work against a product. When one cleaning brand switched to green bottles, many customers assumed the product had become less effective, even though the formula hadn’t changed at all. The price stayed the same, so it wasn’t that people thought it was cheaper. They simply believed it wouldn’t clean as well, and the company had to print a message on the label explaining that nothing had changed.",
          },
          {
            speaker: "Lecturer",
            text: "Next, a practical issue that designers ignore far too often, and that’s colour blindness. Roughly one man in twelve has some difficulty telling certain colours apart, most commonly red and green. That’s a real problem for devices that use a red light to show that a battery is low and a green one to show it’s fully charged. Some manufacturers add a sound as well, but users tend to find that irritating, and most of them switch it off. The better solution is to add a symbol next to the light, so that the information doesn’t depend on colour alone.",
          },
          {
            speaker: "Lecturer",
            text: "Online shopping has created a newer challenge. A colour that looks one way in a shop can look quite different on a phone screen, depending on the settings and the lighting. One clothing retailer found that a colour that didn’t match the photograph was the most common reason customers gave for returns, and because returns are so expensive to deal with, many retailers now photograph every product under several kinds of light.",
          },
          {
            speaker: "Lecturer",
            text: "Then there are trends. Large companies pay colour forecasters to predict which shades will be popular two or three years ahead, which is roughly how long it takes to bring a new product to market. Forecasters look at fashion and film, of course, but one of their most reliable signals is the economy. In uncertain times, people buying expensive items such as cars and sofas tend to choose neutral colours, like grey and beige, which feel safer and are easier to sell later on. When people feel more confident, brighter colours come back.",
          },
          {
            speaker: "Lecturer",
            text: "Finally, age. As we get older, the lens of the eye gradually turns yellow, which makes it harder to tell dark blue from black, for example. So when you design for older users, the important thing isn’t any particular colour. It’s strong contrast between the parts of a product that people need to see, such as the buttons, and the surfaces around them. Next week, we’ll look at some products that get this right, and some that get it badly wrong.",
          },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the notes below.",
            wordLimit: 1,
            title: "The psychology of colour in product design",
            template: [
              "# First impressions",
              "- Shoppers judge an unfamiliar product within a few seconds",
              "- Colour has more influence on this judgement than shape or [[31]]",
              "# Weight",
              "- Dark colours make objects seem [[32]]",
              "- Pale shades are chosen where lightness matters, e.g. for suitcases and [[33]]",
              "# Taste",
              "- Identical soup was described as [[34]] when eaten from a red bowl",
              "# Meaning",
              "- White suggests cleanliness in much of Europe, but is traditionally linked with [[35]] in parts of East Asia",
              "- Green bottles made shoppers believe a cleaning product was less [[36]]",
              "# Practical problems",
              "- Colour blindness: put a [[37]] next to indicator lights",
              "- Online shopping: colours that differ from photographs are a major cause of [[38]]",
              "# Trends",
              "- In uncertain economic times, buyers of expensive items choose [[39]] colours",
              "# Older users",
              "- The lens of the eye yellows with age, so strong [[40]] matters more than any particular colour",
            ].join("\n"),
            questions: [
              {
                n: 31,
                answer: ["price"],
                explanation: "“Colour has more influence than shape and, perhaps more surprisingly, more influence than price.”",
              },
              {
                n: 32,
                answer: ["heavier"],
                explanation:
                  "The effect on size is “tiny”; “What dark colours really change is how heavy something seems … The navy chair was consistently described as heavier.”",
              },
              {
                n: 33,
                answer: ["bicycles"],
                explanation:
                  "“For products where lightness is a selling point, such as suitcases and bicycles, designers tend to choose pale shades.”",
              },
              {
                n: 34,
                answer: ["saltier"],
                explanation:
                  "“Those who ate from red bowls described the soup as saltier, while a blue bowl made the same soup seem rather bland.”",
              },
              {
                n: 35,
                answer: ["mourning"],
                explanation: "“In parts of East Asia, white is traditionally associated with mourning.”",
              },
              {
                n: 36,
                answer: ["effective"],
                explanation:
                  "“Many customers assumed the product had become less effective … it wasn’t that people thought it was cheaper.”",
              },
              {
                n: 37,
                answer: ["symbol"],
                explanation: "A sound is rejected as irritating: “The better solution is to add a symbol next to the light.”",
              },
              {
                n: 38,
                answer: ["returns"],
                explanation:
                  "“A colour that didn’t match the photograph was the most common reason customers gave for returns.”",
              },
              {
                n: 39,
                answer: ["neutral"],
                explanation:
                  "“In uncertain times, people buying expensive items such as cars and sofas tend to choose neutral colours, like grey and beige.” Brighter colours return only when people feel confident.",
              },
              {
                n: 40,
                answer: ["contrast"],
                explanation: "“The important thing isn’t any particular colour. It’s strong contrast between the parts of a product that people need to see.”",
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================================================================
  // AVERNA LISTENING TEST 4 (Hard)
  // ===========================================================================
  {
    format: "exam-v2",
    skill: "LISTENING",
    id: "averna-listening-04",
    title: "Averna Listening Test 4",
    description:
      "Full Listening test: booking a hotel meeting room for a small conference, an HR manager’s introduction to a workplace wellbeing programme, architecture students reviewing a sustainable-housing design with their tutor, and a lecture on how ancient road builders made roads that lasted. 4 parts, 40 questions.",
    difficulty: "Hard",
    topics: ["hotels", "events", "workplace", "health and wellbeing", "architecture", "sustainability", "history", "engineering"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Part 1 — Questions 1–10 (table completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-04-part-1",
        title: "Part 1",
        context: "You will hear a woman telephoning a hotel to book a room for a small conference.",
        speakers: [
          { name: "Receptionist", gender: "male", accent: "british" },
          { name: "Joanna", gender: "female", accent: "american" },
        ],
        script: [
          { speaker: "Receptionist", text: "Good morning, Wrenfield Hotel, events desk. Martin speaking. How can I help?" },
          {
            speaker: "Joanna",
            text: "Oh, hi. My name’s Joanna Reyes. I’m organising a one-day conference for a regional beekeeping association, and I’d like some information about your meeting rooms.",
          },
          { speaker: "Receptionist", text: "Of course. When were you thinking of holding it?" },
          {
            speaker: "Joanna",
            text: "On Saturday the fourteenth of June. We normally get about thirty people, but it could be closer to forty this year, because we’re planning a visit to some hives in the afternoon, and that always attracts more members.",
          },
          {
            speaker: "Receptionist",
            text: "Right. Well, the fourteenth is still free in all three of our conference rooms, so let me tell you about each one. The biggest is the Orchard Room, on the ground floor. For a lecture-style event, with rows of chairs, it holds up to sixty. But if you want people sitting at tables, which most conferences prefer, the maximum is forty-five.",
          },
          { speaker: "Joanna", text: "Tables, definitely. People like to take notes. And how do you charge for the rooms?" },
          {
            speaker: "Receptionist",
            text: "We have a day rate per delegate, which covers the room hire, tea and coffee, and a buffet lunch. For the Orchard Room that’s thirty-nine pounds per person. Oh, sorry, I’m looking at last year’s price list. It’s forty-two pounds now.",
          },
          { speaker: "Joanna", text: "Forty-two. Okay. What’s the room like?" },
          {
            speaker: "Receptionist",
            text: "It’s lovely and bright. There are glass doors along one side that open straight onto the garden, so people can go outside during the breaks. That’s very popular in the summer.",
          },
          { speaker: "Joanna", text: "That sounds ideal. Is there anything I should know about it? Any drawbacks?" },
          {
            speaker: "Receptionist",
            text: "Well, the one thing people sometimes mention is noise. It’s not the car park, because that’s on the other side of the building. It’s that the room is right next to the kitchen, so towards the end of the morning you can hear the staff getting lunch ready.",
          },
          { speaker: "Joanna", text: "I see. And the other rooms?" },
          {
            speaker: "Receptionist",
            text: "The Mercer Suite is on the first floor, and it’s our most modern room. It seats thirty-two at tables, and the rate is thirty-six pounds per person. We used to have a projector in there, but last year we replaced it with a large built-in screen, so speakers can just plug in a laptop. There’s a sound system too, so you wouldn’t need to hire any equipment.",
          },
          { speaker: "Joanna", text: "Thirty-two might be a bit tight for us. Is it a pleasant room to spend the day in?" },
          {
            speaker: "Receptionist",
            text: "It’s very comfortable, and it’s air-conditioned. The only thing is that it doesn’t have any windows, and some groups find that quite tiring over a whole day.",
          },
          { speaker: "Joanna", text: "Yes, I can imagine. And the third one?" },
          {
            speaker: "Receptionist",
            text: "That’s the Boathouse. It also takes forty at tables, and it’s the cheapest of the three. The normal rate is thirty-four pounds, but we’re running a summer discount at the moment, which brings it down to thirty-one pounds per person.",
          },
          { speaker: "Joanna", text: "Thirty-one. That’s good value. Where is it exactly?" },
          {
            speaker: "Receptionist",
            text: "It’s a separate building about five minutes’ walk from the main hotel, right on the edge of the lake. It was built about a hundred and fifty years ago, and although the floor is new, you can still see the original wooden beams in the ceiling. Photographers love it.",
          },
          { speaker: "Joanna", text: "It sounds charming. Is there a catch?" },
          {
            speaker: "Receptionist",
            text: "Access, I’m afraid. There’s a ramp at the entrance, but the meeting room is on the upper floor, and there’s no lift, so it isn’t suitable for anyone who can’t manage stairs. And lunch is served back in the main hotel, so everyone has to walk over.",
          },
          {
            speaker: "Joanna",
            text: "Some of our members are quite elderly, so I think that rules it out. I’ll go for the Orchard Room, I think. Could you hold it for me?",
          },
          {
            speaker: "Receptionist",
            text: "Certainly. I can keep it for you provisionally until the end of next week, and after that we’d need a deposit to confirm the booking.",
          },
          { speaker: "Joanna", text: "That’s fine. I’ll talk to the committee and call you back by Friday." },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the table below.",
            wordLimit: 1,
            allowNumber: true,
            title: "Wrenfield Hotel – conference rooms",
            template: [
              "| Room | Seats at tables | Day rate per person | Advantages | Disadvantages |",
              "| Orchard Room | [[1]] | £[[2]] | glass doors open onto the [[3]] | next to the [[4]], so can be noisy before lunch |",
              "| Mercer Suite | 32 | £36 | large built-in [[5]] and a sound system | no [[6]] |",
              "| Boathouse | 40 | £[[7]] with summer discount | on the edge of the [[8]]; original wooden [[9]] | no [[10]] to the upper floor; lunch served in the main hotel |",
            ].join("\n"),
            questions: [
              {
                n: 1,
                answer: ["45", "forty-five"],
                explanation: "Sixty is for rows of chairs: “if you want people sitting at tables … the maximum is forty-five.”",
              },
              {
                n: 2,
                answer: ["42", "forty-two"],
                explanation: "Thirty-nine pounds was last year’s price: “I’m looking at last year’s price list. It’s forty-two pounds now.”",
              },
              {
                n: 3,
                answer: ["garden"],
                explanation: "“There are glass doors along one side that open straight onto the garden.”",
              },
              {
                n: 4,
                answer: ["kitchen"],
                explanation: "“It’s not the car park … It’s that the room is right next to the kitchen.”",
              },
              {
                n: 5,
                answer: ["screen"],
                explanation: "The projector has gone: “last year we replaced it with a large built-in screen.”",
              },
              {
                n: 6,
                answer: ["windows"],
                explanation: "“The only thing is that it doesn’t have any windows.”",
              },
              {
                n: 7,
                answer: ["31", "thirty-one"],
                explanation: "Thirty-four is the normal rate: “a summer discount … brings it down to thirty-one pounds per person.”",
              },
              {
                n: 8,
                answer: ["lake"],
                explanation: "“It’s a separate building … right on the edge of the lake.”",
              },
              {
                n: 9,
                answer: ["beams"],
                explanation: "The floor is new, but “you can still see the original wooden beams in the ceiling.”",
              },
              {
                n: 10,
                answer: ["lift"],
                explanation: "There is a ramp at the entrance, but “the meeting room is on the upper floor, and there’s no lift.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 2 — Questions 11–20 (mcq-multi ×2 + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-04-part-2",
        title: "Part 2",
        context: "You will hear a human resources manager talking to a group of new employees about the company’s wellbeing programme.",
        speakers: [{ name: "Graham", gender: "male", accent: "australian" }],
        script: [
          {
            speaker: "Graham",
            text: "Good morning, everyone, and welcome to Brightline. I’m Graham Webb from the human resources team, and I’ve got about fifteen minutes this morning to tell you about our wellbeing programme, which we call Balance. You’ll get all of this in writing as well, so there’s no need to take detailed notes.",
          },
          {
            speaker: "Graham",
            text: "Balance started three years ago, after a staff survey showed that a lot of people were struggling with stress and long hours. So, has it worked? Well, not in every way we’d hoped. We expected it to improve our customer satisfaction scores, but those have stayed more or less the same. We also thought people would end up working less overtime, and so far that hasn’t really happened either. But the number of days lost to illness has fallen by almost a fifth, and fewer people are leaving us. In fact, staff turnover is the lowest it’s been for ten years. We’ve also had a big rise in job applications, although to be honest, I think that’s mainly because of our move to this new building rather than anything to do with Balance.",
          },
          {
            speaker: "Graham",
            text: "Now, what do we ask of you as new starters? You’ll hear about quite a few things in your first weeks, and not all of them are compulsory, so let me be clear. You’ll be sent an online health questionnaire. Filling it in is entirely up to you, and your answers are confidential. You’ll also see posters about first-aid training. We’re always glad to have volunteers, but nobody is required to go on the course.",
          },
          {
            speaker: "Graham",
            text: "What you must do in your first month is have your workstation assessed. Someone from the facilities team will check that your desk, chair and screen are set up correctly, and you’ll need to book that yourself through the staff website. The other requirement is to meet your wellbeing mentor. Every new employee is paired with a colleague from a different department, and I’d ask you to have your first meeting with them within four weeks. Oh, and you’ll hear people talking about the step-counting app. You only need to download that if you want to join one of the walking challenges.",
            pauseAfter: 2,
          },
          {
            speaker: "Graham",
            text: "Right, let me run through some of the activities and facilities on offer. First, yoga. We hold sessions on Tuesdays and Thursdays at half past seven in the morning, so they finish well before the working day starts. They’re suitable for complete beginners, and although they’re popular, the studio is big, so there’s no need to book. Just turn up.",
          },
          {
            speaker: "Graham",
            text: "Then there’s the quiet room on the third floor. It’s somewhere you can go if you need a few minutes away from your desk, and phones and laptops aren’t allowed. At the moment there’s only one, here at head office. Staff at the warehouse have asked for one too, and we’re looking into it, but there’s no date yet.",
          },
          {
            speaker: "Graham",
            text: "Once a month, an independent adviser comes in to give advice on money matters, such as pensions and mortgages. The sessions are one-to-one and last half an hour, so you’ll need to reserve a slot on the staff website beforehand, and they do tend to go quickly.",
          },
          {
            speaker: "Graham",
            text: "Next, the cycling scheme. You can get a new bike and safety equipment through the company. Brightline covers half the cost, and the rest is taken from your salary in small amounts over a year. Last year the scheme was full within a week, but this year there’s no limit on numbers, so you won’t miss out.",
          },
          {
            speaker: "Graham",
            text: "Then there’s the running club. People often think HR organises it, but in fact it was started by two engineers from the design team, and they still arrange everything themselves, the routes, the races, even the club shirts. They meet on Wednesdays after work, and everyone’s welcome, whatever your speed.",
          },
          {
            speaker: "Graham",
            text: "And finally, health checks. We’re arranging for a nurse to come in and offer checks on things like blood pressure and cholesterol. We’d hoped to start them this autumn, but the contract has taken longer than expected, so they won’t begin until the new year, probably in January. I’ll send round an email when the dates are confirmed. Okay, that’s everything from me. Does anyone have any questions?",
          },
        ],
        groups: [
          {
            kind: "mcq-multi",
            instructions: "Choose TWO letters, A–E.",
            title: "Which TWO improvements has the Balance programme led to so far?",
            options: [
              { key: "A", text: "less sickness absence" },
              { key: "B", text: "more satisfied customers" },
              { key: "C", text: "fewer hours of overtime" },
              { key: "D", text: "better staff retention" },
              { key: "E", text: "more people applying for jobs" },
            ],
            questions: [
              {
                n: 11,
                answer: ["A", "D"],
                explanation:
                  "“The number of days lost to illness has fallen by almost a fifth, and fewer people are leaving us.” Customer scores and overtime haven’t changed, and the rise in applications is put down to the new building.",
              },
              {
                n: 12,
                answer: ["A", "D"],
                explanation:
                  "“Staff turnover is the lowest it’s been for ten years” and sick days have fallen — the only two results Graham credits to Balance.",
              },
            ],
          },
          {
            kind: "mcq-multi",
            instructions: "Choose TWO letters, A–E.",
            title: "Which TWO things must new employees do during their first month?",
            options: [
              { key: "A", text: "fill in a health questionnaire" },
              { key: "B", text: "go on a first-aid course" },
              { key: "C", text: "arrange a check of their desk equipment" },
              { key: "D", text: "download a step-counting app" },
              { key: "E", text: "meet a colleague from another department" },
            ],
            questions: [
              {
                n: 13,
                answer: ["C", "E"],
                explanation:
                  "“What you must do in your first month is have your workstation assessed … The other requirement is to meet your wellbeing mentor … a colleague from a different department.”",
              },
              {
                n: 14,
                answer: ["C", "E"],
                explanation:
                  "The questionnaire is “entirely up to you”, “nobody is required to go on the course”, and the app is only for the walking challenges.",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What does Graham say about each of the following? Choose SIX answers from the box and write the correct letter, A–H, next to Questions 15–20.",
            title: "Comments",
            options: [
              { key: "A", text: "You need to book a place in advance." },
              { key: "B", text: "It is currently full." },
              { key: "C", text: "Staff pay part of the cost." },
              { key: "D", text: "It takes place before work starts." },
              { key: "E", text: "It is organised by employees themselves." },
              { key: "F", text: "It will not start until next year." },
              { key: "G", text: "It is only available at head office." },
              { key: "H", text: "It is only for experienced participants." },
            ],
            questions: [
              {
                n: 15,
                text: "yoga sessions",
                answer: ["D"],
                explanation:
                  "The sessions are at half past seven in the morning, “so they finish well before the working day starts.” There is “no need to book”, and they suit beginners.",
              },
              {
                n: 16,
                text: "the quiet room",
                answer: ["G"],
                explanation:
                  "“At the moment there’s only one, here at head office.” A second one at the warehouse has no date yet.",
              },
              {
                n: 17,
                text: "financial advice",
                answer: ["A"],
                explanation: "“You’ll need to reserve a slot on the staff website beforehand, and they do tend to go quickly.”",
              },
              {
                n: 18,
                text: "the cycling scheme",
                answer: ["C"],
                explanation:
                  "“Brightline covers half the cost, and the rest is taken from your salary.” It was full last year, but “this year there’s no limit on numbers.”",
              },
              {
                n: 19,
                text: "the running club",
                answer: ["E"],
                explanation:
                  "“It was started by two engineers from the design team, and they still arrange everything themselves.”",
              },
              {
                n: 20,
                text: "health checks",
                answer: ["F"],
                explanation:
                  "The autumn start was delayed: “they won’t begin until the new year, probably in January.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 3 — Questions 21–30 (mcq + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-04-part-3",
        title: "Part 3",
        context:
          "You will hear two architecture students, Leila and Sam, discussing a sustainable-housing design assignment with their tutor, Doctor Brennan.",
        speakers: [
          { name: "Dr Brennan", gender: "male", accent: "australian" },
          { name: "Leila", gender: "female", accent: "american" },
          { name: "Sam", gender: "male", accent: "british" },
        ],
        script: [
          {
            speaker: "Dr Brennan",
            text: "Hi, Leila. Hi, Sam. Come on in. So, this is our last tutorial before the interim review. Remind me where you’ve got to with the housing project.",
          },
          {
            speaker: "Sam",
            text: "Okay. So the brief, as you know, is six affordable homes on the old bus depot site on Carver Street, and they have to be as close to zero carbon as possible once people are living in them.",
          },
          { speaker: "Dr Brennan", text: "And your first proposal was a single terrace running along the street, wasn’t it?" },
          {
            speaker: "Leila",
            text: "That’s right. We’ve kept it as one terrace, and there are still six homes. But we’ve turned the whole thing round, so that the main windows face south rather than east. The living rooms get far more sun that way, especially in winter.",
          },
          {
            speaker: "Dr Brennan",
            text: "Good, that’ll make a big difference to the heating. And what happened to the straw-bale walls you were so keen on?",
          },
          {
            speaker: "Sam",
            text: "We’ve dropped them, reluctantly. Everyone assumes the problem with straw is fire, but the regulations are actually fine with it as long as it’s plastered properly. And we found a farm that could supply the bales only twenty miles away. The real issue is thickness. The walls would have to be more than half a metre thick, and on a site as narrow as this one, we’d lose far too much floor space.",
          },
          { speaker: "Dr Brennan", text: "Fair enough. Now, I see you’ve put a rainwater tank under each back garden." },
          { speaker: "Leila", text: "Yes, to collect water for flushing toilets and for the washing machines." },
          {
            speaker: "Dr Brennan",
            text: "My worry isn’t the cost, because tanks are quite cheap these days, and they’re not particularly complicated to use either. It’s that six separate systems means six pumps that can break down, and people in affordable housing may not have the money or the time to get them repaired. One larger tank shared by all six homes, and looked after by the housing association, would be far more reliable.",
          },
          { speaker: "Sam", text: "That’s a good point. We hadn’t really thought about who would look after them." },
          { speaker: "Leila", text: "We also did the survey you suggested, with the people living in the flats next to the site." },
          { speaker: "Dr Brennan", text: "Oh, good. How did that go?" },
          {
            speaker: "Leila",
            text: "Well, we expected a poor response, and that’s what we got, about thirty per cent. And, as we’d predicted, quite a few families said they’d like bigger gardens. But what really surprised us was that the thing most people asked for was more storage, especially for things like prams and bikes.",
          },
          { speaker: "Dr Brennan", text: "That’s really valuable. So, what are you planning to do before the review?" },
          { speaker: "Sam", text: "We were going to build a physical model this week." },
          {
            speaker: "Dr Brennan",
            text: "I’d leave that for now. It takes ages, and it’s too early. Your plans are fine as they are, too. What the panel will ask about first is energy, so the most useful thing you can do is calculate how much energy each home will need for heating. Get those figures done before anything else.",
            pauseAfter: 2,
          },
          { speaker: "Dr Brennan", text: "Let’s go through the features on your drawings, then. Start with the green roof." },
          {
            speaker: "Leila",
            text: "We’d planned to cover the whole roof of the terrace with plants, but the structural engineer said the weight of the wet soil would mean a much heavier frame.",
          },
          {
            speaker: "Sam",
            text: "We did look at replacing it with a cheaper gravel roof, but then we’d lose the insulation and the benefit for wildlife. So we’re keeping it, but only over the kitchens at the back, which is about a third of the original area.",
          },
          { speaker: "Dr Brennan", text: "Sensible. And the wind turbine?" },
          {
            speaker: "Leila",
            text: "That’s gone. We read that small turbines on buildings in towns produce hardly any electricity, because the wind is so disturbed by everything around them. It just wasn’t worth including.",
          },
          { speaker: "Dr Brennan", text: "Agreed. What about heating? You’ve got a heat pump in each house." },
          {
            speaker: "Sam",
            text: "That’s the one we’re least sure about. Six small air-source pumps would be simple, but one shared ground-source system might be more efficient. We don’t know enough to decide, so we’re going to talk to someone in the engineering department before the review.",
          },
          {
            speaker: "Dr Brennan",
            text: "Good idea. Doctor Farrow would be the person to ask. Now, the bicycle store.",
          },
          {
            speaker: "Leila",
            text: "At the moment it’s at the back of the site, but the survey made us realise that people won’t walk all the way round the terrace with a bike. So we’re putting it at the front, right next to the street entrance.",
          },
          { speaker: "Dr Brennan", text: "And the shared garden?" },
          {
            speaker: "Sam",
            text: "We’ve drawn it as a vegetable garden, but we’re not sure that’s what people want. Some families might prefer a play area for children. So we’re going to add a question about it when we go back to the neighbours next week.",
          },
          { speaker: "Dr Brennan", text: "Excellent. I think you’re in good shape for the review." },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Choose the correct letter, A, B or C.",
            questions: [
              {
                n: 21,
                text: "What change have the students made to their original proposal?",
                options: [
                  { key: "A", text: "They have reduced the number of homes." },
                  { key: "B", text: "They have changed the direction the homes face." },
                  { key: "C", text: "They have replaced the terrace with separate houses." },
                ],
                answer: ["B"],
                explanation:
                  "“We’ve kept it as one terrace, and there are still six homes. But we’ve turned the whole thing round, so that the main windows face south rather than east.”",
              },
              {
                n: 22,
                text: "Why did the students decide not to use straw-bale walls?",
                options: [
                  { key: "A", text: "They would not meet fire safety rules." },
                  { key: "B", text: "The bales would have to be transported a long way." },
                  { key: "C", text: "They would take up too much of the site." },
                ],
                answer: ["C"],
                explanation:
                  "Fire rules and supply are not problems: “The real issue is thickness … on a site as narrow as this one, we’d lose far too much floor space.”",
              },
              {
                n: 23,
                text: "What is Dr Brennan’s main concern about the rainwater tanks?",
                options: [
                  { key: "A", text: "They would be expensive to install." },
                  { key: "B", text: "They would be difficult for residents to use." },
                  { key: "C", text: "Residents might not be able to keep them working." },
                ],
                answer: ["C"],
                explanation:
                  "“My worry isn’t the cost … six separate systems means six pumps that can break down, and people … may not have the money or the time to get them repaired.”",
              },
              {
                n: 24,
                text: "What surprised the students about the results of their survey?",
                options: [
                  { key: "A", text: "the small number of people who replied" },
                  { key: "B", text: "the number of families who wanted larger gardens" },
                  { key: "C", text: "the importance people gave to storage space" },
                ],
                answer: ["C"],
                explanation:
                  "The poor response and the wish for bigger gardens were both expected; “what really surprised us was that the thing most people asked for was more storage.”",
              },
              {
                n: 25,
                text: "What does Dr Brennan advise the students to do before the review?",
                options: [
                  { key: "A", text: "make a model of the design" },
                  { key: "B", text: "make changes to their plans" },
                  { key: "C", text: "calculate the homes’ heating needs" },
                ],
                answer: ["C"],
                explanation:
                  "The model can wait and the plans are fine: “the most useful thing you can do is calculate how much energy each home will need for heating.”",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What do the students decide to do about each of the following features of their design? Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 26–30.",
            title: "Decisions",
            options: [
              { key: "A", text: "keep it as it is" },
              { key: "B", text: "remove it from the design" },
              { key: "C", text: "reduce its size" },
              { key: "D", text: "move it to a different position" },
              { key: "E", text: "replace it with a cheaper alternative" },
              { key: "F", text: "get expert advice about it" },
              { key: "G", text: "ask local people for their views" },
            ],
            questions: [
              {
                n: 26,
                text: "the green roof",
                answer: ["C"],
                explanation:
                  "A cheaper gravel roof is rejected; “we’re keeping it, but only over the kitchens at the back, which is about a third of the original area.”",
              },
              {
                n: 27,
                text: "the wind turbine",
                answer: ["B"],
                explanation: "“That’s gone … It just wasn’t worth including.”",
              },
              {
                n: 28,
                text: "the heat pumps",
                answer: ["F"],
                explanation:
                  "“We don’t know enough to decide, so we’re going to talk to someone in the engineering department before the review.”",
              },
              {
                n: 29,
                text: "the bicycle store",
                answer: ["D"],
                explanation: "“At the moment it’s at the back of the site … So we’re putting it at the front, right next to the street entrance.”",
              },
              {
                n: 30,
                text: "the shared garden",
                answer: ["G"],
                explanation:
                  "“We’re going to add a question about it when we go back to the neighbours next week.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 4 — Questions 31–40 (notes + flow-chart completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-04-part-4",
        title: "Part 4",
        context: "You will hear part of a lecture on how ancient road builders made roads that lasted.",
        speakers: [{ name: "Lecturer", gender: "male", accent: "american" }],
        script: [
          {
            speaker: "Lecturer",
            text: "Good afternoon, everyone. Today’s topic is one that interests historians and civil engineers alike. How did ancient road builders, working without any modern machinery, manage to construct roads that in some cases are still in use two thousand years later?",
          },
          {
            speaker: "Lecturer",
            text: "If you ask people what destroys a road, most of them will say heavy traffic. And weight certainly does cause damage. But the engineers of the ancient world understood that the greatest threat of all was water. Water softens the ground underneath a road, so that the surface sinks and cracks, and in cold climates it freezes inside the road and forces the stones apart. In fact, almost every technique we’ll look at today is really about keeping water out.",
          },
          {
            speaker: "Lecturer",
            text: "The Romans dealt with this problem in several ways. Their major roads were usually built on a raised bank of earth, so that they stood above the surrounding land and stayed dry even when the fields on either side were flooded. The surface itself was slightly curved, higher in the centre than at the edges, so that rain ran off to both sides, where it was carried away by ditches dug alongside the road.",
          },
          {
            speaker: "Lecturer",
            text: "The Romans were by no means the first great road builders, though. Long before them, the Persian Empire maintained what’s known as the Royal Road, which ran for more than two and a half thousand kilometres. Its surface was fairly basic, mostly packed earth, with stone in some places. What made it remarkable was the organisation. There were relay stations all along the route, roughly a day’s ride apart, where royal messengers could rest and change horses, so that a message could cross the empire in a fraction of the time a traveller on foot would need.",
          },
          {
            speaker: "Lecturer",
            text: "On the other side of the world, the Inca built a network of more than thirty thousand kilometres of roads, much of it through the Andes mountains. The Inca had no wheeled vehicles. Goods were carried by people and by llamas, and this affected the design. On the steepest slopes, instead of winding the road back and forth, as you would have to for carts, the builders often simply cut steps into the mountainside, and some of these are still used by walkers today. Where a road met a deep river gorge, they built suspension bridges from thick ropes woven out of grass. Those bridges wore out quickly, so local communities were responsible for replacing them every year, and one of them, in Peru, is still rebuilt by hand in exactly this way.",
            pauseAfter: 2,
          },
          {
            speaker: "Lecturer",
            text: "Now let’s go back to the Romans and look, step by step, at how one of their major roads was actually built. The first stage was surveying. Some historians believe that over long distances, surveyors lit fires on hilltops to help them keep the route straight. But on the ground, the line itself was marked out with a series of wooden poles, which the builders then followed.",
          },
          {
            speaker: "Lecturer",
            text: "Next, workers dug a trench along the whole route. How deep it went depended on the soil. They kept digging until they reached firm ground, which might be less than a metre down, or a great deal deeper in marshy areas. The trench was then filled in layers. At the bottom went large flat stones, which spread the weight of the traffic. On top of those came a layer of smaller broken stones held together with lime, which worked rather like modern cement. On minor roads, builders sometimes used clay instead, but on the major routes it was lime.",
          },
          {
            speaker: "Lecturer",
            text: "Above that went a layer of fine gravel and sand, pressed down hard to make a smooth, solid bed. And then came the surface. Less important roads were simply finished with compacted gravel, but on the main roads, the surface was made of large slabs of hard stone, often volcanic rock, cut so that they fitted together with hardly any gaps. Kerbstones were set along both edges to hold everything in place.",
          },
          {
            speaker: "Lecturer",
            text: "Finally, once the road was complete, stone pillars called milestones were put up along it at intervals of one Roman mile, which is roughly one and a half kilometres, so that travellers always knew how far they had come and how far they still had to go. What’s striking is that the basic principles, a firm foundation, layers of different materials and, above all, good drainage, are still the basis of road engineering today.",
          },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the notes below.",
            wordLimit: 1,
            title: "Ancient road building",
            template: [
              "# The main threat",
              "- Heavy traffic causes some damage, but the greatest threat is [[31]]",
              "# Roman drainage",
              "- Major roads built on a raised bank of earth",
              "- Curved surface: rain runs off into [[32]] alongside the road",
              "# The Persian Royal Road",
              "- Over 2,500 km long; surface mostly packed earth",
              "- At relay stations, royal messengers could rest and change [[33]]",
              "# Inca roads",
              "- No wheeled vehicles, so builders cut [[34]] into the steepest slopes",
              "- Suspension bridges made from ropes of woven [[35]], replaced every year",
            ].join("\n"),
            questions: [
              {
                n: 31,
                answer: ["water"],
                explanation:
                  "“Most of them will say heavy traffic … But the engineers of the ancient world understood that the greatest threat of all was water.”",
              },
              {
                n: 32,
                answer: ["ditches"],
                explanation: "“Rain ran off to both sides, where it was carried away by ditches dug alongside the road.”",
              },
              {
                n: 33,
                answer: ["horses"],
                explanation: "“There were relay stations … where royal messengers could rest and change horses.”",
              },
              {
                n: 34,
                answer: ["steps"],
                explanation:
                  "Instead of winding the road back and forth, “the builders often simply cut steps into the mountainside.”",
              },
              {
                n: 35,
                answer: ["grass"],
                explanation:
                  "“They built suspension bridges from thick ropes woven out of grass … local communities were responsible for replacing them every year.”",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the flow-chart below.",
            wordLimit: 1,
            title: "Building a major Roman road",
            template: [
              "Surveyors mark out the line of the road with wooden [[36]]",
              "↓",
              "Workers dig a trench until they reach [[37]] ground",
              "↓",
              "Bottom layer: large flat stones to spread the weight",
              "↓",
              "Next layer: smaller broken stones held together with [[38]]",
              "↓",
              "Fine gravel and sand are pressed down hard",
              "↓",
              "Surface: tightly fitted [[39]] of hard stone, with kerbstones along both edges",
              "↓",
              "Stone pillars called [[40]] are set up every Roman mile",
            ].join("\n"),
            questions: [
              {
                n: 36,
                answer: ["poles"],
                explanation:
                  "Fires on hilltops may have helped over long distances, but “on the ground, the line itself was marked out with a series of wooden poles.”",
              },
              {
                n: 37,
                answer: ["firm"],
                explanation: "“They kept digging until they reached firm ground, which might be less than a metre down.”",
              },
              {
                n: 38,
                answer: ["lime"],
                explanation:
                  "Clay was only used on minor roads: “a layer of smaller broken stones held together with lime … on the major routes it was lime.”",
              },
              {
                n: 39,
                answer: ["slabs"],
                explanation:
                  "Gravel was for less important roads; “on the main roads, the surface was made of large slabs of hard stone.”",
              },
              {
                n: 40,
                answer: ["milestones"],
                explanation: "“Stone pillars called milestones were put up along it at intervals of one Roman mile.”",
              },
            ],
          },
        ],
      },
    ],
  },
];
