import type { ExamListeningTest } from "../types";

/** Original Averna Listening tests (exam-v2, 4 parts × 10 questions). */
export const LISTENING_SEED_C: ExamListeningTest[] = [
  // ===========================================================================
  // AVERNA LISTENING TEST 2 (Medium)
  // ===========================================================================
  // The runner speaks "Part N. <context>", the first reading time and "That is
  // the end of Part N." itself, so the scripts only carry the in-part
  // announcements (start of listening + the mid-part reading break).
  {
    format: "exam-v2",
    skill: "LISTENING",
    id: "averna-listening-02",
    title: "Averna Listening Test 2",
    description:
      "Full Listening test: a student phoning a letting agency about renting a flat, a ranger’s introduction to a new riverside park, two engineering students planning a presentation on renewable energy for a small island with their tutor, and a lecture on how birds find their way during migration. 4 parts, 40 questions.",
    difficulty: "Medium",
    topics: ["accommodation", "renting", "parks", "nature", "leisure", "engineering", "renewable energy", "islands", "birds", "migration"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Part 1 — Questions 1–10 (form + table completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-02-part-1",
        title: "Part 1",
        context: "You will hear a student telephoning a letting agency about renting a flat.",
        speakers: [
          { name: "Agent", gender: "female", accent: "british" },
          { name: "Daniel", gender: "male", accent: "american" },
        ],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 1 to 5." },
          { speaker: "Agent", text: "Good afternoon, Fernleigh Lettings. Sophie speaking. How can I help you?" },
          {
            speaker: "Daniel",
            text: "Oh, hi. I’m looking for a flat to rent from September, and I saw on your website that you have a few near the university. I was hoping you could tell me a bit more about them.",
          },
          {
            speaker: "Agent",
            text: "Of course. I’ll just take a few details first, and then I can check what’s available. Could I have your name, please?",
          },
          { speaker: "Daniel", text: "Sure. It’s Daniel Whitcombe." },
          { speaker: "Agent", text: "And how do you spell your surname?" },
          { speaker: "Daniel", text: "W, H, I, T, C, O, M, B, E." },
          { speaker: "Agent", text: "W, H, I, T, C, O, M, B, E. Thank you. And I take it you’re a student?" },
          {
            speaker: "Daniel",
            text: "That’s right. I’m from Chicago, and I’m coming over to do a master’s degree at Kelsford University.",
          },
          {
            speaker: "Agent",
            text: "Lovely. And what will you be studying? Before we can offer anyone a tenancy, we need a letter from their department, so I’ll make a note of it now.",
          },
          {
            speaker: "Daniel",
            text: "It’s geology. My first degree was in physics, actually, but I took a couple of geology classes in my final year, and I was hooked.",
          },
          { speaker: "Agent", text: "Geology. Right. And will you be living on your own?" },
          {
            speaker: "Daniel",
            text: "No, I’ll be sharing with a friend from the same course, so we’re looking for somewhere with two bedrooms.",
          },
          {
            speaker: "Agent",
            text: "Okay. And what sort of budget do you have in mind? Our student flats are all advertised per person per week.",
          },
          {
            speaker: "Daniel",
            text: "We’d said no more than eighty-five pounds each. Oh, hang on, that’s out of date. My friend’s just got a part-time job in the university library, so last night we agreed we could go up to ninety-five.",
          },
          {
            speaker: "Agent",
            text: "So, ninety-five pounds each per week. That gives us a few more options. Now, do you need the flat to be furnished?",
          },
          { speaker: "Daniel", text: "Yes, definitely. I’m only bringing two suitcases." },
          {
            speaker: "Agent",
            text: "Some of our flats are part-furnished. That usually means there are beds and a sofa, but not much else.",
          },
          {
            speaker: "Daniel",
            text: "Hmm. We’d need desks and a kitchen table at the very least, so I think it would have to be fully furnished.",
          },
          {
            speaker: "Agent",
            text: "Fully furnished. And is there anything else that’s essential? A lot of people ask about parking.",
          },
          {
            speaker: "Daniel",
            text: "Well, neither of us has a car, so parking doesn’t matter. But we both cycle everywhere, so we’d need somewhere safe to keep our bikes. Not just the hallway, if possible. My friend had his bike stolen from outside his building last year.",
          },
          { speaker: "Agent", text: "Secure storage for two bikes. I’ll put that down as essential.", pauseAfter: 2 },
          {
            speaker: "Narrator",
            text: "Before you hear the rest of the conversation, you have some time to look at questions 6 to 10.",
            pauseAfter: 30,
          },
          { speaker: "Narrator", text: "Now listen and answer questions 6 to 10." },
          {
            speaker: "Agent",
            text: "Right, I’ve got three flats on our books that match what you’re looking for. The first one is on Wharf Road. It’s on the second floor of an old warehouse that’s been converted into flats, about fifteen minutes’ walk from the university, and the rent is eighty-nine pounds each per week.",
          },
          { speaker: "Daniel", text: "That sounds good. What’s it like?" },
          {
            speaker: "Agent",
            text: "It’s very stylish. The living room has huge windows that look straight out over the canal. People sometimes expect to see the river from there, but that’s on the other side of the building. Still, the canal is lovely, especially with all the old boats moored along it.",
          },
          { speaker: "Daniel", text: "And is there a catch?" },
          {
            speaker: "Agent",
            text: "Well, Wharf Road itself is very quiet, so traffic isn’t a problem. But the flat is directly above a bakery, and they start work at about four in the morning. The last tenants said the noise woke them up most days.",
          },
          { speaker: "Daniel", text: "I’m a really light sleeper, so that might not work for me. What’s the second one?" },
          { speaker: "Agent", text: "That’s on Brecken Street. That’s B, R, E, C, K, E, N." },
          { speaker: "Daniel", text: "B, R, E, C, K, E, N. I don’t think I know it." },
          {
            speaker: "Agent",
            text: "It’s a quiet street just behind the main hospital. The flat is the ground floor of a Victorian house. The landlord was asking ninety-eight pounds each, but it’s been empty since June, so he’s just brought it down to ninety-two.",
          },
          { speaker: "Daniel", text: "Ninety-two. That’s within our budget, anyway." },
          {
            speaker: "Agent",
            text: "And the best thing for you is the garden at the back. There’s a big wooden shed with a lock on it, so you could keep both your bikes in there.",
          },
          { speaker: "Daniel", text: "Perfect. Is there anything wrong with it?" },
          {
            speaker: "Agent",
            text: "The bedrooms are a good size, but the kitchen is very small. There’s really only room for one person to cook at a time.",
          },
          { speaker: "Daniel", text: "I think we can live with that. And the third one?" },
          {
            speaker: "Agent",
            text: "The third is in Maple Court, which is a new block on the edge of town. It’s the cheapest of the three, at eighty-five pounds each, and the internet is included in the rent. You’d have to pay for your own gas and electricity, though.",
          },
          { speaker: "Daniel", text: "How far is it from the university?" },
          {
            speaker: "Agent",
            text: "That’s the main drawback. It’s about twenty-five minutes on the bus, and probably half an hour by bike, mostly uphill.",
          },
          { speaker: "Daniel", text: "Hmm. I think Brecken Street sounds best. Could we come and see it?" },
          {
            speaker: "Agent",
            text: "Of course. I could meet you there on Thursday at half past five, if that suits you.",
          },
          { speaker: "Daniel", text: "Thursday’s great. Thanks so much for your help." },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the form below.",
            wordLimit: 1,
            allowNumber: true,
            title: "Fernleigh Lettings – Tenant Enquiry Form",
            template: [
              "# Personal details",
              "- Name: Daniel [[1]]",
              "- Course: master’s degree in [[2]] at Kelsford University",
              "# Requirements",
              "- Moving in: September",
              "- Two bedrooms (sharing with a friend)",
              "- Maximum rent: £[[3]] per person per week",
              "- Must be fully [[4]]",
              "- Needs secure storage for two [[5]]",
            ].join("\n"),
            questions: [
              {
                n: 1,
                answer: ["Whitcombe"],
                explanation: "Daniel spells his surname, “W, H, I, T, C, O, M, B, E,” and the agent repeats it back to him.",
              },
              {
                n: 2,
                answer: ["geology"],
                explanation: "His first degree was in physics, but the master’s he is starting is in geology: “It’s geology.”",
              },
              {
                n: 3,
                answer: ["95", "ninety-five"],
                explanation:
                  "Eighty-five pounds is “out of date”; now that his friend has a job, they “could go up to ninety-five.”",
              },
              {
                n: 4,
                answer: ["furnished"],
                explanation:
                  "Part-furnished flats only have beds and a sofa, and they need desks and a table, so “it would have to be fully furnished.”",
              },
              {
                n: 5,
                answer: ["bikes", "bicycles"],
                explanation:
                  "Parking doesn’t matter because neither has a car, but they both cycle and need “somewhere safe to keep our bikes.”",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the table below.",
            wordLimit: 1,
            allowNumber: true,
            title: "Flats available",
            template: [
              "| Address | Rent per person per week | Advantages | Disadvantages |",
              "| Wharf Road | £89 | living-room windows look out over the [[6]] | directly above a [[7]], so noisy early in the morning |",
              "| [[8]] Street | £[[9]] | locked shed in the garden for bikes | very small kitchen |",
              "| Maple Court | £85 | [[10]] included in the rent | 25 minutes from the university by bus |",
            ].join("\n"),
            questions: [
              {
                n: 6,
                answer: ["canal"],
                explanation:
                  "The river is on the other side of the building; the living-room windows “look straight out over the canal.”",
              },
              {
                n: 7,
                answer: ["bakery"],
                explanation:
                  "Traffic isn’t a problem on Wharf Road, but “the flat is directly above a bakery” that starts work at four in the morning.",
              },
              {
                n: 8,
                answer: ["Brecken"],
                explanation: "The agent spells the street name: “Brecken Street. That’s B, R, E, C, K, E, N.”",
              },
              {
                n: 9,
                answer: ["92", "ninety-two"],
                explanation:
                  "Ninety-eight pounds was the old asking price; the flat has been empty, so the landlord has “just brought it down to ninety-two.”",
              },
              {
                n: 10,
                answer: ["internet"],
                explanation:
                  "Gas and electricity are paid separately, but at Maple Court “the internet is included in the rent.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 2 — Questions 11–20 (mcq + notes from a box + matching locations)
      // -----------------------------------------------------------------------
      {
        id: "listening-02-part-2",
        title: "Part 2",
        context: "You will hear a park ranger giving a group of visitors an introduction to a new riverside park.",
        speakers: [{ name: "Liam", gender: "male", accent: "australian" }],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 11 to 15." },
          {
            speaker: "Liam",
            text: "Good morning, everyone, and welcome to Wendmoor Riverside Park. I’m Liam, one of the three rangers here. The park only opened in April, so for most of you this will be a first visit. Before we set off, I’ll tell you a little about the park’s history and go over a few rules, and then I’ll explain where everything is.",
          },
          {
            speaker: "Liam",
            text: "So, what was here before? A lot of people assume this land has always been fields, and there were farms along this stretch of the river a few hundred years ago. Some of you may also remember the old brick factory, but that was on the far bank, where the new houses are now. For most of the last century, though, this whole site was a quarry. Sand and gravel were dug out here for building roads all over the region, and when the quarry closed, the deep pits slowly filled with water. Those are the three lakes you’ll see this morning.",
          },
          {
            speaker: "Liam",
            text: "What makes Wendmoor unusual is its design. Local residents voted on a shortlist of plans, but the winning design was drawn up by a team of landscape architects. And yes, there are solar panels on the visitor centre roof, but we still rely on mains electricity, especially in winter. No, the really unusual thing is that large parts of the park are meant to flood. When the river is high, water spills over into the low meadows beside it, and they hold it like a sponge, so less water reaches the town centre downstream. So if you find some of the lower paths closed after heavy rain, don’t worry. That’s the park doing its job.",
          },
          {
            speaker: "Liam",
            text: "Now, a few rules. Bikes are very welcome, but please only ride them on the main riverside path, which is wide enough for cyclists and walkers to share. The narrow trails around the lakes are too soft and get badly damaged. Swimming isn’t allowed anywhere in the park, I’m afraid, because the lakes are much deeper and colder than they look. You can go out on the water in a kayak, as long as you hire it from our boathouse. If you’d like to fish, you’ll need a permit, which you can buy at the visitor centre for a few pounds. As for barbecues, disposable ones burn the grass and can easily start fires, so we’ve built stone barbecue areas in the picnic meadow, and that’s the only place you can have one. And there’s no camping anywhere in the park.",
            pauseAfter: 2,
          },
          {
            speaker: "Narrator",
            text: "Before you hear the rest of the talk, you have some time to look at questions 16 to 20.",
            pauseAfter: 30,
          },
          { speaker: "Narrator", text: "Now listen and answer questions 16 to 20." },
          {
            speaker: "Liam",
            text: "Right. The maps for your leaflet are still being printed, so let me describe where the main features are. We’re standing outside the visitor centre, just inside the main entrance and next to the car park. The river runs along the northern edge of the park, and between us and the river are the three lakes. The biggest is Long Lake, which has a small island in the middle.",
          },
          {
            speaker: "Liam",
            text: "Most of our visitors come for the birds, so let’s start with the bird hide. The boardwalk starts beside the visitor centre and crosses the reed beds towards the river, and the hide is at the far end of it. People often ask why we didn’t build it on the island in Long Lake, where most of the birds nest. But that’s exactly why. The island is kept free of people, so the birds aren’t disturbed.",
          },
          {
            speaker: "Liam",
            text: "For families, there’s an adventure playground, with a climbing tower made from old tree trunks. It was originally going to be next to the car park, but parents were worried about children running out among the cars, so it was built behind the visitor centre instead, where it’s fenced in and close to the toilets.",
          },
          {
            speaker: "Liam",
            text: "I mentioned kayaks earlier. The boat hire is in the wooden boathouse on the northern shore of Long Lake. We don’t hire boats out on the river itself, because the current can be surprisingly strong, especially near the weir, so all our boats stay on the lake, where it’s much safer.",
          },
          {
            speaker: "Liam",
            text: "At the western end of the park, there’s a grassy hill. It isn’t natural. It was made from the soil that was dug out when the lakes were deepened, and we’ve sown it with wildflower seeds, so that’s where you’ll find the wildflower meadow. From June onwards it’s full of butterflies, and it has the best view in the park.",
          },
          {
            speaker: "Liam",
            text: "Finally, the outdoor classroom, where local schoolchildren come to learn about wildlife. We thought about putting it under the arches of the old railway bridge at the eastern end, because they give some shelter from the rain. But the bridge now carries the cycle route into town, and it’s far too noisy. So instead it’s between the two smaller lakes, where the children can go pond-dipping. Okay, if you’d like to follow me, we’ll start with the boardwalk.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Choose the correct letter, A, B or C.",
            questions: [
              {
                n: 11,
                text: "For most of the last century, the site of the park was used for",
                options: [
                  { key: "A", text: "farming." },
                  { key: "B", text: "quarrying." },
                  { key: "C", text: "making bricks." },
                ],
                answer: ["B"],
                explanation:
                  "The farms were centuries ago and the brick factory was on the far bank; “for most of the last century … this whole site was a quarry.”",
              },
              {
                n: 12,
                text: "What is unusual about the park’s design?",
                options: [
                  { key: "A", text: "It was drawn up by local residents." },
                  { key: "B", text: "It relies only on solar power." },
                  { key: "C", text: "Parts of it are intended to flood." },
                ],
                answer: ["C"],
                explanation:
                  "Residents only voted on a shortlist and mains electricity is still needed; “the really unusual thing is that large parts of the park are meant to flood.”",
              },
            ],
          },
          {
            kind: "gap-box",
            instructions:
              "Complete the notes below. Choose THREE answers from the box and write the correct letter, A–F, next to Questions 13–15.",
            title: "Park rules",
            options: [
              { key: "A", text: "cycling" },
              { key: "B", text: "swimming" },
              { key: "C", text: "fishing" },
              { key: "D", text: "kayaking" },
              { key: "E", text: "barbecues" },
              { key: "F", text: "camping" },
            ],
            template: [
              "- [[13]] is allowed only on the main riverside path",
              "- [[14]] is allowed only with a permit from the visitor centre",
              "- [[15]] is allowed only in the picnic meadow",
            ].join("\n"),
            questions: [
              {
                n: 13,
                answer: ["A"],
                explanation:
                  "Bikes are welcome, “but please only ride them on the main riverside path”, because the lake trails are too soft.",
              },
              {
                n: 14,
                answer: ["C"],
                explanation:
                  "To fish, “you’ll need a permit, which you can buy at the visitor centre”; kayaks are simply hired from the boathouse.",
              },
              {
                n: 15,
                answer: ["E"],
                explanation:
                  "Stone barbecue areas have been built “in the picnic meadow, and that’s the only place you can have one.” Swimming and camping are not allowed at all.",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "Where are the following features of the park? Choose FIVE answers from the box and write the correct letter, A–H, next to Questions 16–20.",
            title: "Locations",
            options: [
              { key: "A", text: "next to the car park" },
              { key: "B", text: "behind the visitor centre" },
              { key: "C", text: "at the far end of the boardwalk" },
              { key: "D", text: "on the island in Long Lake" },
              { key: "E", text: "under the old railway bridge" },
              { key: "F", text: "on the northern shore of Long Lake" },
              { key: "G", text: "on the hill at the western end of the park" },
              { key: "H", text: "between the two smaller lakes" },
            ],
            questions: [
              {
                n: 16,
                text: "the bird hide",
                answer: ["C"],
                explanation:
                  "The island is kept free of people so the nesting birds aren’t disturbed; the hide “is at the far end” of the boardwalk.",
              },
              {
                n: 17,
                text: "the adventure playground",
                answer: ["B"],
                explanation:
                  "It was going to be next to the car park, but because of the cars “it was built behind the visitor centre instead.”",
              },
              {
                n: 18,
                text: "the boat hire",
                answer: ["F"],
                explanation:
                  "Boats are kept off the river because of the current; the boat hire “is in the wooden boathouse on the northern shore of Long Lake.”",
              },
              {
                n: 19,
                text: "the wildflower meadow",
                answer: ["G"],
                explanation:
                  "The hill at the western end was sown with wildflower seeds, “so that’s where you’ll find the wildflower meadow.”",
              },
              {
                n: 20,
                text: "the outdoor classroom",
                answer: ["H"],
                explanation:
                  "The railway bridge arches were considered but are too noisy, “so instead it’s between the two smaller lakes.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 3 — Questions 21–30 (mcq + mcq-multi + matching)
      // -----------------------------------------------------------------------
      {
        id: "listening-02-part-3",
        title: "Part 3",
        context:
          "You will hear two engineering students, Isla and Theo, discussing their presentation on renewable energy for a small island community with their tutor, Doctor Kendrick.",
        speakers: [
          { name: "Dr Kendrick", gender: "male", accent: "british" },
          { name: "Isla", gender: "female", accent: "australian" },
          { name: "Theo", gender: "male", accent: "american" },
        ],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 21 to 25." },
          {
            speaker: "Dr Kendrick",
            text: "Come in, Isla, Theo. Have a seat. So, your energy presentation is two weeks away. How’s it coming along?",
          },
          {
            speaker: "Isla",
            text: "Quite well, I think. We’ve done most of the research, so now we’re working out what to put in.",
          },
          {
            speaker: "Dr Kendrick",
            text: "Good. Remind me why you chose Brannock Island. When you first mentioned it, I assumed it was because of your family, Theo.",
          },
          {
            speaker: "Theo",
            text: "Well, my aunt does live there, and she’s been great at putting us in touch with people. But that’s not really why we picked it.",
          },
          {
            speaker: "Isla",
            text: "And it certainly wasn’t because there’s lots of information about it. There’s hardly any published data, which has made things harder. The main reason is timing. The island’s community trust is holding a vote next spring on how to replace their diesel generators, so we felt our work might actually be useful to them.",
          },
          {
            speaker: "Dr Kendrick",
            text: "That’s a good reason. So, what have you found out about how the island uses its electricity?",
          },
          {
            speaker: "Theo",
            text: "We assumed demand would be highest in the summer, when the tourists arrive, and it does go up a bit in July and August. But what really surprised us was how much goes on heating. Most of the older houses have electric storage heaters, and in winter, heating accounts for more than half of all the electricity used on the island.",
          },
          { speaker: "Dr Kendrick", text: "That’s quite common on islands without a gas supply. And the fish farm?" },
          {
            speaker: "Isla",
            text: "It uses quite a lot, but that’s what we expected, and it has its own backup generator anyway.",
          },
          { speaker: "Dr Kendrick", text: "Right. Now, your wind figures. Where did they come from?" },
          {
            speaker: "Isla",
            text: "From the weather station at the harbour. There are ten years of records, so we thought that would be enough.",
          },
          {
            speaker: "Dr Kendrick",
            text: "Oh, ten years is plenty, and the station is run by the national weather service, so the readings themselves will be accurate. My concern is where it is. The harbour is in a bay surrounded by cliffs, and any turbines would go up on the hill. So your figures almost certainly underestimate the wind up there. Make that clear in the presentation.",
          },
          { speaker: "Theo", text: "Okay, we’ll add a note about that." },
          {
            speaker: "Dr Kendrick",
            text: "Now, how are you going to open the presentation? Which problems with the current supply will you focus on?",
          },
          {
            speaker: "Theo",
            text: "We did think about including the noise from the generators, because they’re right next to the harbour. But when we asked around, hardly anyone said it bothered them, so we’ve left that out.",
          },
          {
            speaker: "Isla",
            text: "The first thing we’ll focus on is cost. People on Brannock pay almost twice as much for their electricity as people on the mainland, because all the diesel has to be shipped in.",
          },
          {
            speaker: "Theo",
            text: "And the second is the deliveries themselves. The fuel comes over on the ferry, and in winter storms, sailings can be cancelled for days at a time. Last January the island came within two days of running out.",
          },
          { speaker: "Dr Kendrick", text: "What about power cuts?" },
          {
            speaker: "Isla",
            text: "There used to be a lot, but the generators were replaced five years ago, and they’re very reliable now. There was also a fuel spill in the harbour once, but that was over twenty years ago, so it isn’t really a current problem.",
            pauseAfter: 2,
          },
          {
            speaker: "Narrator",
            text: "Before you hear the rest of the discussion, you have some time to look at questions 26 to 30.",
            pauseAfter: 30,
          },
          { speaker: "Narrator", text: "Now listen and answer questions 26 to 30." },
          { speaker: "Dr Kendrick", text: "Let’s go through the options you’re going to discuss. Start with wind." },
          {
            speaker: "Theo",
            text: "Wind is the obvious one, because Brannock is one of the windiest places in the country. People sometimes worry about birds, but the hill isn’t on a major migration route, and careful siting reduces the risk a lot.",
          },
          {
            speaker: "Isla",
            text: "The real issue is that some of the families who live near the hill don’t want turbines spoiling their view. We don’t think the plan should just ignore that.",
          },
          { speaker: "Dr Kendrick", text: "Quite right. And solar?" },
          {
            speaker: "Isla",
            text: "Solar panels are much cheaper than they used to be, and you could put them on almost every roof. But Brannock is so far north that in midwinter there are only about seven hours of daylight, and that’s exactly when demand is highest. Most of their power would come in the summer.",
          },
          { speaker: "Dr Kendrick", text: "What about the tides? There’s a very strong current in the channel." },
          {
            speaker: "Theo",
            text: "Tides have one big advantage: unlike the wind, they’re completely predictable. Some islanders hoped a tidal project would bring jobs, but the maintenance would be done by specialist engineers from the mainland. The main problem, though, is that tidal turbines are still quite new. Only a few projects anywhere have been running for more than a few years, so we’d present it as something for the future.",
          },
          { speaker: "Dr Kendrick", text: "And heat pumps?" },
          {
            speaker: "Isla",
            text: "They don’t generate electricity, of course. But if they replaced the old storage heaters, the island would need far less electricity for heating, because a heat pump gives out about three times as much heat as the electricity it uses.",
          },
          {
            speaker: "Dr Kendrick",
            text: "Good. That links nicely back to your point about heating. And finally, the cable.",
          },
          {
            speaker: "Theo",
            text: "An undersea cable to the mainland would solve almost everything in one go. The island could even sell its spare wind power. But for a community of six hundred people, the cost of laying it would be enormous, so we don’t think it’s realistic.",
          },
          { speaker: "Dr Kendrick", text: "I agree. Right, let’s talk about how you’re going to divide up the speaking." },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Choose the correct letter, A, B or C.",
            questions: [
              {
                n: 21,
                text: "Why did the students choose Brannock Island for their presentation?",
                options: [
                  { key: "A", text: "Theo has relatives living there." },
                  { key: "B", text: "A lot of information about the island has been published." },
                  { key: "C", text: "The islanders will soon vote on their future energy supply." },
                ],
                answer: ["C"],
                explanation:
                  "Theo’s aunt helped but “that’s not really why”, and there is “hardly any published data”; the community trust is “holding a vote next spring” on replacing the generators.",
              },
              {
                n: 22,
                text: "What surprised the students about the island’s electricity use?",
                options: [
                  { key: "A", text: "the amount used for heating" },
                  { key: "B", text: "the increase during the tourist season" },
                  { key: "C", text: "the amount used by the fish farm" },
                ],
                answer: ["A"],
                explanation:
                  "Demand only rises “a bit” in summer and the fish farm was as expected; “what really surprised us was how much goes on heating.”",
              },
              {
                n: 23,
                text: "What is Dr Kendrick’s concern about the students’ wind data?",
                options: [
                  { key: "A", text: "It covers too short a period." },
                  { key: "B", text: "It was recorded in a sheltered place." },
                  { key: "C", text: "It comes from an unreliable source." },
                ],
                answer: ["B"],
                explanation:
                  "Ten years is “plenty” and the weather service’s readings “will be accurate”; the problem is that the harbour station is “in a bay surrounded by cliffs”, away from the windy hill.",
              },
            ],
          },
          {
            kind: "mcq-multi",
            instructions: "Choose TWO letters, A–E.",
            title: "Which TWO problems with the island’s present electricity supply will the students focus on?",
            options: [
              { key: "A", text: "noise from the generators" },
              { key: "B", text: "the high price of electricity" },
              { key: "C", text: "frequent power cuts" },
              { key: "D", text: "fuel deliveries disrupted by bad weather" },
              { key: "E", text: "pollution in the harbour" },
            ],
            questions: [
              {
                n: 24,
                answer: ["B", "D"],
                explanation:
                  "Noise was left out because hardly anyone minded it; the first focus is cost, as islanders “pay almost twice as much for their electricity”.",
              },
              {
                n: 25,
                answer: ["B", "D"],
                explanation:
                  "The second is deliveries: “in winter storms, sailings can be cancelled for days at a time.” Power cuts are rare now, and the fuel spill was over twenty years ago.",
              },
            ],
          },
          {
            kind: "matching",
            instructions:
              "What do the students say about each of the following energy options for the island? Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 26–30.",
            title: "Comments",
            options: [
              { key: "A", text: "It would be too expensive for the island." },
              { key: "B", text: "Its output would vary greatly between seasons." },
              { key: "C", text: "Some residents would object to it." },
              { key: "D", text: "The technology is not yet fully developed." },
              { key: "E", text: "It would reduce the demand for electricity." },
              { key: "F", text: "It would create jobs on the island." },
              { key: "G", text: "It would put wildlife at serious risk." },
            ],
            questions: [
              {
                n: 26,
                text: "wind turbines",
                answer: ["C"],
                explanation:
                  "The risk to birds can be reduced by careful siting; “the real issue is that some of the families who live near the hill don’t want turbines spoiling their view.”",
              },
              {
                n: 27,
                text: "solar panels",
                answer: ["B"],
                explanation:
                  "Panels are now cheap, but with only about seven hours of daylight in midwinter, “most of their power would come in the summer.”",
              },
              {
                n: 28,
                text: "tidal turbines",
                answer: ["D"],
                explanation:
                  "The maintenance jobs would go to engineers from the mainland; “the main problem … is that tidal turbines are still quite new.”",
              },
              {
                n: 29,
                text: "heat pumps",
                answer: ["E"],
                explanation:
                  "If heat pumps replaced the storage heaters, “the island would need far less electricity for heating.”",
              },
              {
                n: 30,
                text: "an undersea cable",
                answer: ["A"],
                explanation:
                  "It would solve almost everything, but “for a community of six hundred people, the cost of laying it would be enormous.”",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Part 4 — Questions 31–40 (notes completion)
      // -----------------------------------------------------------------------
      {
        id: "listening-02-part-4",
        title: "Part 4",
        context: "You will hear part of a lecture on how birds find their way during migration.",
        speakers: [{ name: "Lecturer", gender: "female", accent: "american" }],
        script: [
          { speaker: "Narrator", text: "Now listen carefully and answer questions 31 to 40." },
          {
            speaker: "Lecturer",
            text: "Good morning, everyone. Last week we looked at why birds migrate, and today I want to turn to a question that has puzzled scientists for centuries: how do they find their way? Every year, billions of birds travel between their breeding grounds and the places where they spend the winter, some of them covering many thousands of kilometres, and many return to exactly the same nesting site year after year.",
          },
          {
            speaker: "Lecturer",
            text: "One of the most remarkable facts is that in some species, young birds make their first migration alone. The adults leave several weeks earlier, so the young have no one to follow, and yet they still set off at the right time and in the right direction. So at least part of this ability must be inherited, rather than learned from other birds.",
          },
          {
            speaker: "Lecturer",
            text: "How do we study this? One simple method was developed in the nineteen-sixties. Caged birds become very restless at migration time, and they spend the night hopping and fluttering, mostly in one direction. So researchers placed a bird in a funnel-shaped cage lined with paper, with an ink pad at the bottom. Every time the bird hopped up the sloping side, it left footprints on the paper, and the next morning the researchers could see exactly which way it had been trying to go.",
          },
          {
            speaker: "Lecturer",
            text: "Experiments like these have shown that birds use several different compasses. The first is the sun. But the sun moves across the sky during the day, so a bird can only use it to find direction if it also knows the time. Birds manage this with an internal clock. We know this because when birds are kept indoors under lights that come on and go off a few hours earlier than the real sunrise and sunset, their internal clock shifts. When they’re released, they fly off in the wrong direction, by an amount that matches the time difference.",
          },
          {
            speaker: "Lecturer",
            text: "Most songbirds, however, migrate at night, and they use the stars instead. In a well-known series of experiments, young birds were raised in a planetarium, where the pattern of stars on the ceiling could be controlled. The birds didn’t memorise particular constellations. What they learned was the point in the sky around which all the stars appear to turn, which in the northern half of the world is close to the Pole Star. When the researchers made the artificial sky turn around a different star, the birds changed direction to match.",
          },
          {
            speaker: "Lecturer",
            text: "The third compass is magnetic, but it doesn’t work like the compass you’d take hiking. A compass needle points north. Birds, on the other hand, seem to sense the angle between the magnetic field lines and the ground. Near the equator, the lines run almost parallel to the ground, while towards the poles they become steeper and steeper, so the angle tells a bird whether it is heading towards a pole or towards the equator.",
          },
          {
            speaker: "Lecturer",
            text: "Exactly how birds detect the field is still debated. One long-standing idea was that tiny particles of iron in the beak acted like miniature compass needles. But when researchers looked more closely, many of the iron-rich cells turned out to belong to the immune system rather than the nervous system. So attention has shifted to the eye. It now seems likely that a protein in the eye reacts to the magnetic field when light falls on it, and some researchers think birds may actually be able to see the field.",
          },
          {
            speaker: "Lecturer",
            text: "Now, a compass tells a bird which way is which, but not where it is. For that it needs some kind of map, and a famous experiment from the nineteen-fifties shows this very clearly. Thousands of starlings were caught in the Netherlands during their autumn migration, when they normally fly south-west. They were taken by plane to Switzerland, hundreds of kilometres to the south-east, and released. The young birds, on their first migration, simply carried on flying south-west, and many ended up much too far south, in Spain. But the adults corrected their course and headed north-west, towards their usual wintering area. So experienced birds have something that first-time migrants lack: a map built up on earlier journeys.",
          },
          {
            speaker: "Lecturer",
            text: "What that map is made of is less clear. Landmarks such as coastlines and mountain ranges certainly help, especially near the end of a journey. But there is growing evidence that smell plays a part as well. Homing pigeons that have lost their sense of smell find it much harder to get home from places they don’t know, and some seabirds seem to follow smells carried on the wind to find food far out at sea.",
          },
          {
            speaker: "Lecturer",
            text: "Finally, this research matters for conservation, because human activity can interfere with these systems. Tall buildings are a particular danger for birds that fly at night, but it isn’t really their height that causes the problem. It’s artificial light, which attracts and confuses the birds, and large numbers are killed every year by flying into brightly lit windows. That’s why some cities now ask the owners of tall buildings to switch off unnecessary lights during the main migration seasons. Next week, we’ll look at how climate change is affecting the timing of migration.",
          },
        ],
        groups: [
          {
            kind: "gap",
            instructions: "Complete the notes below.",
            wordLimit: 1,
            title: "How birds find their way during migration",
            template: [
              "# An inherited ability",
              "- In some species, young birds make their first journey [[31]]",
              "# Studying direction",
              "- Caged birds become restless at migration time",
              "- In a funnel-shaped cage, a bird’s [[32]] on paper show which way it is trying to go",
              "# Compasses",
              "- Sun: birds use an internal [[33]] to allow for the sun’s movement",
              "- Stars: experiments in a [[34]] showed that young birds learn the point the stars turn around",
              "- Magnetic field: birds sense the [[35]] of the field lines, not the direction of north",
              "- Early theory: iron particles in the [[36]] act as compass needles",
              "- Current theory: a protein in the [[37]] reacts to the field when light falls on it",
              "# The map sense",
              "- Starlings moved to a new area during migration: only the [[38]] corrected their route",
              "- Homing pigeons without a sense of [[39]] find it harder to get home from unfamiliar places",
              "# A modern threat",
              "- Night-flying birds are confused by artificial [[40]], so some cities ask for it to be switched off in tall buildings",
            ].join("\n"),
            questions: [
              {
                n: 31,
                answer: ["alone"],
                explanation:
                  "The adults leave weeks earlier, so “young birds make their first migration alone”, which shows the ability is partly inherited.",
              },
              {
                n: 32,
                answer: ["footprints"],
                explanation:
                  "Each time the bird hopped up the sloping side of the funnel, “it left footprints on the paper”, showing which way it wanted to go.",
              },
              {
                n: 33,
                answer: ["clock"],
                explanation:
                  "The sun moves across the sky, so birds must also know the time: “Birds manage this with an internal clock.”",
              },
              {
                n: 34,
                answer: ["planetarium"],
                explanation:
                  "Young birds “were raised in a planetarium” and learned the point the stars turn around, not particular constellations.",
              },
              {
                n: 35,
                answer: ["angle"],
                explanation:
                  "Unlike a compass needle, which points north, birds “seem to sense the angle between the magnetic field lines and the ground.”",
              },
              {
                n: 36,
                answer: ["beak"],
                explanation:
                  "One long-standing idea was that “tiny particles of iron in the beak acted like miniature compass needles.”",
              },
              {
                n: 37,
                answer: ["eye", "eyes"],
                explanation:
                  "Many of the iron-rich cells belong to the immune system, so attention moved to the eye, where “a protein … reacts to the magnetic field when light falls on it.”",
              },
              {
                n: 38,
                answer: ["adults"],
                explanation:
                  "The young starlings carried on flying south-west, “but the adults corrected their course” towards their usual wintering area.",
              },
              {
                n: 39,
                answer: ["smell"],
                explanation:
                  "Landmarks help near the end of a journey, but “homing pigeons that have lost their sense of smell find it much harder to get home.”",
              },
              {
                n: 40,
                answer: ["light", "lights"],
                explanation:
                  "Height is not really the problem: “It’s artificial light, which attracts and confuses the birds.”",
              },
            ],
          },
        ],
      },
    ],
  },
];
