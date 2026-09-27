import type { ExamReadingTest } from "../types";

/** Original Averna Academic Reading tests (exam-v2, 3 passages × 40 questions). */
export const READING_SEED_A: ExamReadingTest[] = [
  // ===========================================================================
  // Averna Academic Reading 1 (Medium)
  // ===========================================================================
  {
    format: "exam-v2",
    skill: "READING",
    id: "averna-reading-01",
    title: "Averna Academic Reading 1",
    description:
      "A full Academic Reading test: the history of vertical farming, what speaking two languages does to the brain, and a debate on whether historic shipwrecks should be raised.",
    difficulty: "Medium",
    timeLimit: 60,
    topics: ["agriculture", "technology", "language", "neuroscience", "archaeology", "heritage"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Passage 1 — Questions 1–13
      // -----------------------------------------------------------------------
      {
        id: "passage-1",
        title: "The Rise of the Vertical Farm",
        subtitle: "How growing crops in stacked layers indoors moved from an engineer’s dream to a commercial industry",
        paragraphs: [
          {
            label: "A",
            text: "For most of human history, the quantity of food a community could grow has been limited by the area of fertile land within its reach. Vertical farming attempts to escape that limit by cultivating crops in stacked layers inside buildings, where light, temperature, humidity and nutrients are regulated by machines rather than left to the weather. A single converted warehouse may contain twelve or more tiers of lettuce, herbs and seedlings, each illuminated by its own panel of lamps. Advocates argue that such farms can operate in the centre of cities, close to the consumers who buy their produce, and that harvests are no longer at the mercy of drought, frost or flood. Sceptics respond that the approach is costly and consumes vast amounts of electricity. Both positions have a longer history than is often supposed.",
          },
          {
            label: "B",
            text: "The notion of a multi-storey farm first appeared not in agriculture but in engineering. In 1909 the Italian-born engineer Aurelio Cassani published drawings for what he called a ‘garden tower’: a fifteen-storey steel frame with a field of vegetables on every floor and glass walls to admit the sun. Cassani intended the design as a remedy for the crowded, unhealthy cities of his day, and he calculated that a single tower could feed around two thousand residents. It was never built. Later critics identified a fundamental flaw in the scheme: daylight entering through the walls would have penetrated only a few metres, leaving the crops in the centre of each floor in near darkness. For the next half-century, similar proposals appeared regularly in magazines and exhibitions, and all of them foundered on the same problem.",
          },
          {
            label: "C",
            text: "Artificial lighting seemed to offer a way forward, but for decades it created almost as many difficulties as it solved. In the 1950s and 1960s researchers grew plants under fluorescent tubes and, later, high-pressure sodium lamps. A much-publicised trial at the Keller Agricultural Institute in 1967 produced healthy lettuce in a windowless basement, yet the electricity consumed was worth roughly six times as much as the crop. Sodium lamps were brighter, but they radiated so much heat that they had to be mounted well above the plants to avoid scorching the leaves. Each growing layer therefore required a considerable amount of vertical space, and only two or three tiers could be fitted into a room of normal height. Indoor cultivation remained confined to research stations and a handful of specialist flower growers.",
          },
          {
            label: "D",
            text: "The decisive change came with the light-emitting diode, or LED. Early LEDs were dim and expensive, but steady improvements in the 1990s and 2000s made them far brighter and dramatically cheaper; one industry survey estimates that the cost of a given quantity of LED light fell by around 85 per cent between 2008 and 2018. Equally important, LEDs emit relatively little heat towards the plants, so they can be positioned just centimetres from the leaves. Tiers could now be stacked closely together, multiplying the growing area within a building. LEDs can also be designed to produce particular wavelengths. Because plants rely mainly on red and blue light for photosynthesis, growers no longer had to pay for colours their crops could not use, and some began adjusting the mixture of colours to alter the flavour of their produce.",
          },
          {
            label: "E",
            text: "The first businesses to exploit the new lighting were small and cautious. In 2006 Marta Lindqvist, a former telecommunications engineer, converted a disused cold-storage depot in the harbour district of Karsholm into a farm producing microgreens: tiny, intensely flavoured seedlings for which restaurants were prepared to pay high prices. Because her produce travelled only a few kilometres, it reached kitchens within hours of harvest. Over the following decade larger operations appeared, particularly in densely populated places that imported most of their vegetables. Some city authorities, anxious about their dependence on distant suppliers, offered growers low-rent premises or grants. By the late 2010s the biggest facilities were supplying supermarkets with bagged salad leaves, and indoor-grown produce was no longer a novelty reserved for wealthy diners.",
          },
          {
            label: "F",
            text: "Inside a modern facility, most crops are grown hydroponically, with their roots immersed in water containing dissolved nutrients; a smaller number of farms use aeroponics, in which bare roots hang in the air and are sprayed with a fine nutrient mist. In either system, water that the plants do not absorb is collected, filtered and returned to the crops, so that a typical farm uses less than a tenth of the water needed to grow the same weight of lettuce in a field. Growing rooms are sealed, and staff change into clean overalls before entering, much as surgeons do before an operation. Consequently, insects and fungal diseases rarely gain access, and many farms use no pesticides at all. In the most automated buildings, robots carry trays from the germination area to the harvesting line.",
          },
          {
            label: "G",
            text: "Despite these advantages, the industry faces serious constraints. Lighting and climate control account for the largest share of running costs, and when electricity prices rose steeply in the early 2020s several well-funded companies closed or were sold. The economics also work for only a narrow range of crops. Leafy greens are ideal: they grow quickly, consist mostly of water, and almost the entire plant can be sold. Staple crops such as wheat and rice are another matter, since they need far more light to mature and much of each plant is inedible straw. The agricultural economist Tomas Reyer has calculated that indoor wheat would cost over twenty times as much to produce as field-grown grain. Most analysts therefore expect vertical farms to complement conventional agriculture rather than replace it.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions:
              "Reading Passage 1 has seven paragraphs, A–G. Choose the correct heading for each paragraph from the list of headings below.",
            title: "List of Headings",
            allowReuse: false,
            options: [
              { key: "i", text: "The first experiments with growing plants in water" },
              { key: "ii", text: "Why some crops remain unsuited to indoor production" },
              { key: "iii", text: "Early artificial lighting and its drawbacks" },
              { key: "iv", text: "Competing views of an alternative way to grow food" },
              { key: "v", text: "Public resistance to food produced without soil" },
              { key: "vi", text: "A technological advance that made stacking practical" },
              { key: "vii", text: "Resource savings in a sealed environment" },
              { key: "viii", text: "An ambitious plan defeated by a basic obstacle" },
              { key: "ix", text: "The role of robots in reducing labour costs" },
              { key: "x", text: "From a specialist product to everyday groceries" },
            ],
            questions: [
              {
                n: 1,
                text: "Paragraph A",
                answer: ["iv"],
                explanation:
                  "Paragraph A sets what ‘advocates argue’ (farms in city centres, safe from drought, frost or flood) against how ‘sceptics respond’ (costly, high electricity use): two competing views of vertical farming.",
              },
              {
                n: 2,
                text: "Paragraph B",
                answer: ["viii"],
                explanation:
                  "Paragraph B: Cassani’s ‘garden tower’ had ‘a fundamental flaw’ (daylight ‘would have penetrated only a few metres’), and later proposals ‘all … foundered on the same problem’.",
              },
              {
                n: 3,
                text: "Paragraph C",
                answer: ["iii"],
                explanation:
                  "Paragraph C: artificial lighting ‘created almost as many difficulties as it solved’: electricity ‘worth roughly six times as much as the crop’ and sodium lamps that gave off too much heat.",
              },
              {
                n: 4,
                text: "Paragraph D",
                answer: ["vi"],
                explanation:
                  "Paragraph D: LEDs became cheaper and emit little heat towards the plants, so ‘tiers could now be stacked closely together’.",
              },
              {
                n: 5,
                text: "Paragraph E",
                answer: ["x"],
                explanation:
                  "Paragraph E traces the move from microgreens sold to restaurants at ‘high prices’ to ‘supplying supermarkets with bagged salad leaves’, so the produce was ‘no longer a novelty’.",
              },
              {
                n: 6,
                text: "Paragraph F",
                answer: ["vii"],
                explanation:
                  "Paragraph F: recycled water means a farm ‘uses less than a tenth of the water’ of a field, and sealed growing rooms keep out insects and disease, so ‘many farms use no pesticides at all’. Robots are only a minor detail.",
              },
              {
                n: 7,
                text: "Paragraph G",
                answer: ["ii"],
                explanation:
                  "Paragraph G: ‘the economics also work for only a narrow range of crops’; staple crops need ‘far more light’, and indoor wheat would cost ‘over twenty times as much’.",
              },
            ],
          },
          {
            kind: "tfng",
            instructions: "Do the following statements agree with the information given in Reading Passage 1?",
            questions: [
              {
                n: 8,
                text: "Cassani estimated that one garden tower could provide food for a few hundred people.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph B: Cassani ‘calculated that a single tower could feed around two thousand residents’, not a few hundred.",
              },
              {
                n: 9,
                text: "The heat produced by sodium lamps limited the number of growing layers that could fit into a room.",
                answer: ["TRUE"],
                explanation:
                  "Paragraph C: sodium lamps ‘radiated so much heat that they had to be mounted well above the plants’, so ‘only two or three tiers could be fitted into a room of normal height’.",
              },
              {
                n: 10,
                text: "The cost of LED light fell more rapidly after 2018 than in the previous ten years.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph D only gives the fall for 2008–2018 (‘around 85 per cent’). Nothing is said about prices after 2018.",
              },
              {
                n: 11,
                text: "Lindqvist’s first farm was housed in a building originally designed for growing plants.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph E: Lindqvist ‘converted a disused cold-storage depot’, a building made for storing chilled goods, not for growing plants.",
              },
              {
                n: 12,
                text: "Concern about relying on distant suppliers led some city authorities to support indoor growers.",
                answer: ["TRUE"],
                explanation:
                  "Paragraph E: ‘Some city authorities, anxious about their dependence on distant suppliers, offered growers low-rent premises or grants.’",
              },
              {
                n: 13,
                text: "Aeroponic systems use less water than hydroponic systems.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph F says that ‘in either system’ unused water is recycled, and compares indoor farms with fields. It never compares aeroponic and hydroponic water use.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 2 — Questions 14–26
      // -----------------------------------------------------------------------
      {
        id: "passage-2",
        title: "The Bilingual Brain",
        subtitle: "After a century of research, scientists still disagree about what speaking two languages does to the mind",
        paragraphs: [
          {
            label: "A",
            text: "For much of the early twentieth century, educators in many countries regarded bilingualism as a handicap. Children raised with two languages, it was argued, would master neither, and the effort of keeping them apart would leave less mental capacity for other kinds of learning. Research appeared to support this view: a series of studies conducted between 1910 and 1940 found that bilingual children scored lower on intelligence tests than their monolingual classmates. Later scholars identified serious weaknesses in this work. The bilingual children were frequently tested in their weaker language, and many came from poor immigrant families, whereas their monolingual peers tended to be more prosperous. Once such factors were taken into account, the apparent disadvantage largely vanished, and researchers began to ask a very different question: might two languages actually benefit the mind?",
          },
          {
            label: "B",
            text: "Part of the answer lies in what happens inside a bilingual speaker’s head during an ordinary conversation. It might be assumed that a person speaking Swedish simply switches off their Finnish, much as one might turn off a radio. Experimental evidence suggests otherwise. At the University of Harrowden, the psycholinguist Ines Valtonen asked Finnish–Swedish bilinguals to name pictures in Finnish while a recorded voice read out Swedish words through headphones. Whenever a Swedish word happened to begin with the same sounds as the Finnish name of the picture, participants took noticeably longer to respond. Valtonen concluded that both languages remain active at all times, competing for selection, and that bilingual speakers must continually suppress the one they are not using.",
          },
          {
            label: "C",
            text: "This constant need for suppression inspired an influential hypothesis. If bilinguals spend their lives selecting one language and inhibiting another, the mental systems that control attention, known collectively as executive functions, might receive a form of daily exercise. During the 1990s and early 2000s a string of laboratory studies seemed to confirm the idea. In one frequently cited experiment, Marcus Hale found that bilingual adults were quicker than monolinguals at a card-sorting task in which the rule changed without warning from sorting by colour to sorting by shape. Other researchers reported that bilinguals were better at ignoring irrelevant information on a screen. The findings attracted wide publicity, and the notion that a second language makes people more efficient thinkers became popular far beyond academic circles.",
          },
          {
            label: "D",
            text: "Some of the most striking claims concerned old age. In 2009 the neurologist Tomasz Olender examined the records of 412 patients at a memory clinic in the city of Wrenfield and found that those who had used two languages throughout their adult lives had been diagnosed with dementia, on average, three years later than those who spoke only one. Olender stressed that bilingualism did not protect anyone from the disease itself. Scans showed that the bilingual patients’ brains had suffered just as much physical damage as those of the other patients; they appeared, rather, to have continued functioning normally for longer before their symptoms became obvious. He suggested that a lifetime of managing two languages might add to what neurologists call ‘cognitive reserve’, the brain’s capacity to compensate for decline.",
          },
          {
            label: "E",
            text: "By the 2010s, however, the picture had become considerably less clear. Larger studies, some involving several thousand participants tested online, frequently found no difference between bilinguals and monolinguals on measures of executive control. Critics noted that many of the earlier experiments had involved fewer than forty people, so that chance variations could easily have produced apparently impressive results. There were also concerns about which findings reached print. When Carmen Aldana surveyed ninety laboratories that had investigated the question, she discovered that roughly half had completed at least one study showing no bilingual advantage that was never submitted to a journal, often because the researchers assumed editors would regard a negative result as uninteresting.",
          },
          {
            label: "F",
            text: "Defenders of the original hypothesis argue that such findings do not necessarily disprove it. Bilingualism, they point out, is not a single condition but a spectrum of experience. A child who grows up speaking two languages every day differs greatly from an adult who studied a language at school and seldom uses it. Valtonen’s later research suggests that how people use their languages may matter more than how many they know. Bilinguals who keep each language for a separate setting, one at home and another at work, for instance, showed different patterns of brain activity from those who switch back and forth within a single conversation. If studies group all these people together, a genuine effect in one group may be masked by its absence in another.",
          },
          {
            label: "G",
            text: "Brain imaging has added a further dimension to the debate. Priya Raghunathan scanned sixty adults before and after a nine-month intensive language course and recorded measurable increases in the density of grey matter in regions associated with memory and speech. Yet Raghunathan herself warns against treating such changes as proof of superiority. Similar growth, she notes, has been observed in people learning to juggle or to play a musical instrument; the brain reshapes itself in response to almost any demanding activity that is sustained over time. For her, the chief benefits of speaking two languages are the obvious ones: the ability to communicate with more people and to participate in more than one culture. Whether bilingualism also sharpens the mind remains, for the present, an open question.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions:
              "Look at the following statements (Questions 14–19) and the list of researchers below. Match each statement with the correct researcher, A–E.",
            title: "List of Researchers",
            allowReuse: true,
            options: [
              { key: "A", text: "Ines Valtonen" },
              { key: "B", text: "Marcus Hale" },
              { key: "C", text: "Tomasz Olender" },
              { key: "D", text: "Carmen Aldana" },
              { key: "E", text: "Priya Raghunathan" },
            ],
            questions: [
              {
                n: 14,
                text: "Studies that failed to support a popular theory often remained unpublished.",
                answer: ["D"],
                explanation:
                  "Paragraph E: Aldana found that roughly half of the laboratories had a study ‘showing no bilingual advantage that was never submitted to a journal’.",
              },
              {
                n: 15,
                text: "The way people use their languages may be more important than the number of languages they speak.",
                answer: ["A"],
                explanation:
                  "Paragraph F: ‘Valtonen’s later research suggests that how people use their languages may matter more than how many they know.’",
              },
              {
                n: 16,
                text: "Bilingual people adapted more quickly when the rules of a task were changed unexpectedly.",
                answer: ["B"],
                explanation:
                  "Paragraph C: Hale found bilingual adults ‘quicker than monolinguals at a card-sorting task in which the rule changed without warning’.",
              },
              {
                n: 17,
                text: "Bilingual people may continue to function normally despite physical damage to the brain.",
                answer: ["C"],
                explanation:
                  "Paragraph D: Olender’s bilingual patients had ‘just as much physical damage’ but ‘continued functioning normally for longer before their symptoms became obvious’.",
              },
              {
                n: 18,
                text: "Physical changes in the brain can result from many kinds of learning, not only from learning languages.",
                answer: ["E"],
                explanation:
                  "Paragraph G: Raghunathan notes that similar growth ‘has been observed in people learning to juggle or to play a musical instrument’.",
              },
              {
                n: 19,
                text: "The language a bilingual person is not using at a given moment remains active and has to be held back.",
                answer: ["A"],
                explanation:
                  "Paragraph B: Valtonen concluded that ‘both languages remain active at all times’ and that speakers ‘must continually suppress the one they are not using’.",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the summary below.",
            wordLimit: 2,
            title: "Changing views of bilingualism",
            template:
              "In the early twentieth century, many educators believed that children brought up with two languages would fail to [[20]] either of them. Studies carried out at the time found that bilingual children achieved lower scores in [[21]], but these children were often assessed in their [[22]] and tended to come from poorer families than their classmates.\nLater, researchers proposed that the need to keep one language suppressed might give the brain’s executive functions a kind of [[23]]. Laboratory studies suggested that bilinguals were better at ignoring [[24]], and the idea soon became popular with the general public.",
            questions: [
              {
                n: 20,
                answer: ["master"],
                explanation: "Paragraph A: children raised with two languages ‘would master neither’.",
              },
              {
                n: 21,
                answer: ["intelligence tests"],
                explanation: "Paragraph A: bilingual children ‘scored lower on intelligence tests than their monolingual classmates’.",
              },
              {
                n: 22,
                answer: ["weaker language"],
                explanation: "Paragraph A: ‘The bilingual children were frequently tested in their weaker language.’",
              },
              {
                n: 23,
                answer: ["(daily) exercise"],
                explanation: "Paragraph C: executive functions ‘might receive a form of daily exercise’.",
              },
              {
                n: 24,
                answer: ["irrelevant information"],
                explanation: "Paragraph C: ‘bilinguals were better at ignoring irrelevant information on a screen’.",
              },
            ],
          },
          {
            kind: "mcq-multi",
            instructions: "Answer the question below.",
            title:
              "Which TWO of the following are mentioned as possible reasons why research into the bilingual advantage has produced conflicting results?",
            options: [
              { key: "A", text: "Many early experiments were carried out with small numbers of people." },
              { key: "B", text: "Online testing produced less accurate results than laboratory testing." },
              { key: "C", text: "People described as bilingual differ widely in their experience of language." },
              { key: "D", text: "Journal editors refused to publish studies that supported the hypothesis." },
              { key: "E", text: "Bilingual participants were often tested in their weaker language." },
            ],
            questions: [
              {
                n: 25,
                answer: ["A", "C"],
                explanation:
                  "A — Paragraph E: many earlier experiments ‘had involved fewer than forty people’, so chance could explain the results. C — Paragraph F: bilingualism is ‘a spectrum of experience’, and grouping everyone together can mask a genuine effect. (B and D are not stated; E refers to the intelligence tests of 1910–1940 in Paragraph A.)",
              },
              {
                n: 26,
                answer: ["A", "C"],
                explanation:
                  "A — Paragraph E: many earlier experiments ‘had involved fewer than forty people’, so chance could explain the results. C — Paragraph F: bilingualism is ‘a spectrum of experience’, and grouping everyone together can mask a genuine effect. (B and D are not stated; E refers to the intelligence tests of 1910–1940 in Paragraph A.)",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 3 — Questions 27–40
      // -----------------------------------------------------------------------
      {
        id: "passage-3",
        title: "Raising the Past",
        subtitle:
          "Should historic shipwrecks be brought to the surface or left where they lie? A maritime historian argues that the answer is less obvious than current thinking suggests.",
        paragraphs: [
          {
            text: "When the hull of the sixteenth-century merchant ship Halcyon broke the surface of Storhavn harbour in 1974, watched by a crowd of some forty thousand people, it seemed to many observers that marine archaeology had achieved its greatest triumph. The ship had lain in soft mud for more than four centuries, and its timbers, its cargo and the personal belongings of its crew offered an unparalleled view of trade and daily life in the age of sail. Half a century later, the vessel remains the centrepiece of a museum that receives nearly a million visitors a year. Yet if the same wreck were discovered today, it is quite possible that it would never be raised at all. Among specialists, opinion has shifted decisively in favour of leaving wrecks where they are found, a shift which, in my view, has been accepted with too little scrutiny.",
          },
          {
            text: "The reasons for this change of heart are not difficult to understand. Waterlogged wood that has survived for centuries on the seabed begins to deteriorate within days of being exposed to the air. As water evaporates from its cells, the timber shrinks, splits and eventually crumbles. Preventing this requires years of treatment, during which the wood is sprayed or soaked with a wax-like chemical that gradually takes the place of the water. The Halcyon was sprayed continuously for twenty-six years, and its museum must still keep the temperature and humidity of its main hall within narrow limits to prevent fresh damage. Such commitments never end. An institution that raises a ship is, in effect, accepting responsibility for it in perpetuity, and several smaller museums that raised vessels in the 1970s and 1980s have since struggled to pay for their care.",
          },
          {
            text: "Advocates of preservation in place argue that the seabed is itself the best museum. Buried in sediment that contains little oxygen, organic materials such as wood, leather and rope are protected from the bacteria and marine creatures that would otherwise consume them. Leaving a wreck undisturbed also preserves its context: the precise position of every object, which may reveal as much as the objects themselves. Excavation, as archaeologists are fond of reminding their students, is a form of destruction, since the relationships between finds can be recorded only once, at the moment they are dismantled. Moreover, methods of investigation are improving rapidly, and a wreck left alone today may be studied far more effectively by the next generation of researchers.",
          },
          {
            text: "These are serious arguments, but they rest on an assumption that is increasingly difficult to defend: that the seabed is a stable environment in which a buried wreck will remain safe indefinitely. Recent surveys suggest otherwise. When archaeologists revisited forty-two recorded wreck sites off the coast of Keldermouth in 2019, they found that eleven had been seriously damaged since their previous inspection a decade earlier, chiefly by storms that had stripped away protective sediment and by fishing boats dragging heavy nets across the bottom. Rising sea temperatures, meanwhile, are allowing wood-boring shipworm to colonise waters that were once too cold for it. For wrecks in such locations, ‘preservation in place’ may amount to little more than a decision to watch them disappear.",
          },
          {
            text: "There is also the question of who benefits. A wreck left on the seabed can be visited only by divers, and usually only by experienced divers with costly equipment; the few sites equipped with underwater trails and information panels attract, at best, a few thousand visitors a year. A raised ship, by contrast, can be seen by schoolchildren, the elderly and people with disabilities. It is sometimes suggested that virtual tours based on detailed three-dimensional scans can offer the same experience to anyone with a computer. I am unconvinced. Such reconstructions are invaluable tools for research, but they cannot reproduce the effect of standing beside the actual timbers of a vessel that sank centuries before one’s great-grandparents were born.",
          },
          {
            text: "A further objection concerns the dead. Many wrecks contain human remains, and some people regard any attempt to raise them as the violation of what are, in effect, graves. For ships lost within living memory, whose victims have surviving relatives, this seems to me a decisive consideration, and such wrecks should be left undisturbed. The argument is harder to sustain for a vessel that sank four hundred years ago. The crew of the Halcyon are commemorated in its museum with considerable dignity, and the analysis of their bones has revealed a great deal about their diet, their health and the injuries they suffered, knowledge which arguably restores to them a history that would otherwise have been lost.",
          },
          {
            text: "I should stress that none of this amounts to a defence of commercial salvage. Companies that recover artefacts from wrecks in order to sell them treat the past as a quarry, scattering collections that ought to be studied together; whatever promises they make about public display, their activities should remain prohibited.",
          },
          {
            text: "Nor does it mean that every wreck should be brought to the surface; the expense alone would make that impossible. What it does mean is that the presumption in favour of preservation in place should be treated as a starting point for discussion rather than as a rule. Each wreck ought to be assessed according to the threats it faces, its historical significance and the capacity of a suitable institution to care for it. Where a site is stable and well protected, it can safely remain on the seabed. Where it is being eroded, however, the choice is not between raising a wreck and preserving it, but between raising it and losing it.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Answer the questions below.",
            questions: [
              {
                n: 27,
                text: "What does the writer suggest about the Halcyon in the first paragraph?",
                options: [
                  { key: "A", text: "Its recovery was criticised by archaeologists at the time." },
                  { key: "B", text: "It might not be recovered if it were found today." },
                  { key: "C", text: "Its museum has had difficulty attracting visitors." },
                  { key: "D", text: "It was the oldest vessel ever raised from the seabed." },
                ],
                answer: ["B"],
                explanation:
                  "Paragraph 1: ‘if the same wreck were discovered today, it is quite possible that it would never be raised at all.’ (The museum receives ‘nearly a million visitors a year’, so C is wrong; A and D are not mentioned.)",
              },
              {
                n: 28,
                text: "According to the writer, what is the main long-term difficulty for a museum that raises a ship?",
                options: [
                  { key: "A", text: "The chemicals used in conservation can harm the wood." },
                  { key: "B", text: "The timbers begin to crumble again after about twenty-six years." },
                  { key: "C", text: "Visitors find the conditions in the display hall uncomfortable." },
                  { key: "D", text: "The ship will need costly care for an unlimited period." },
                ],
                answer: ["D"],
                explanation:
                  "Paragraph 2: ‘Such commitments never end’; a museum accepts responsibility for the ship ‘in perpetuity’, and some smaller museums ‘have since struggled to pay for their care’. (Twenty-six years is how long the Halcyon was sprayed, so B is wrong.)",
              },
              {
                n: 29,
                text: "Why do supporters of preservation in place regard excavation as ‘a form of destruction’?",
                options: [
                  { key: "A", text: "The arrangement of the finds can be recorded only a single time." },
                  { key: "B", text: "Objects are frequently broken as they are lifted to the surface." },
                  { key: "C", text: "Removing sediment exposes the rest of the wreck to bacteria." },
                  { key: "D", text: "Modern methods of investigation damage organic materials." },
                ],
                answer: ["A"],
                explanation:
                  "Paragraph 3: excavation is destructive ‘since the relationships between finds can be recorded only once, at the moment they are dismantled.’",
              },
              {
                n: 30,
                text: "The writer refers to the survey of wrecks off Keldermouth in order to",
                options: [
                  { key: "A", text: "show that fishing is now the most serious threat to wrecks." },
                  { key: "B", text: "demonstrate the value of inspecting wreck sites regularly." },
                  { key: "C", text: "question the belief that wrecks are safe on the seabed." },
                  { key: "D", text: "explain how shipworm has spread into colder waters." },
                ],
                answer: ["C"],
                explanation:
                  "Paragraph 4: the survey is evidence against the assumption ‘that the seabed is a stable environment in which a buried wreck will remain safe indefinitely’. (The damage was caused ‘chiefly by storms … and by fishing boats’, so fishing is not singled out as the worst threat.)",
              },
              {
                n: 31,
                text: "What is the writer’s opinion of virtual tours of wrecks?",
                options: [
                  { key: "A", text: "They are likely to attract more visitors than a raised ship." },
                  { key: "B", text: "They are too expensive for most museums to produce." },
                  { key: "C", text: "They should replace underwater trails for divers." },
                  { key: "D", text: "They help researchers but are no substitute for seeing a real ship." },
                ],
                answer: ["D"],
                explanation:
                  "Paragraph 5: ‘Such reconstructions are invaluable tools for research, but they cannot reproduce the effect of standing beside the actual timbers’.",
              },
            ],
          },
          {
            kind: "ynng",
            instructions: "Do the following statements agree with the claims of the writer in Reading Passage 3?",
            questions: [
              {
                n: 32,
                text: "The preference for leaving wrecks on the seabed has been adopted without sufficient critical examination.",
                answer: ["YES"],
                explanation:
                  "Paragraph 1: the shift towards leaving wrecks where they are found ‘in my view, has been accepted with too little scrutiny.’",
              },
              {
                n: 33,
                text: "Smaller museums that have raised ships should receive financial support from the state.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph 2 says that several smaller museums ‘have since struggled to pay for their care’, but the writer never says who should pay or whether the state should help.",
              },
              {
                n: 34,
                text: "Wrecks whose victims still have living relatives should not be raised.",
                answer: ["YES"],
                explanation:
                  "Paragraph 6: for ships ‘whose victims have surviving relatives, this seems to me a decisive consideration, and such wrecks should be left undisturbed.’",
              },
              {
                n: 35,
                text: "Studying the remains of the Halcyon’s crew showed a lack of respect for them.",
                answer: ["NO"],
                explanation:
                  "Paragraph 6: the crew ‘are commemorated … with considerable dignity’, and the study of their bones ‘arguably restores to them a history that would otherwise have been lost.’",
              },
              {
                n: 36,
                text: "Commercial salvage of historic wrecks can be acceptable if the recovered objects are displayed to the public.",
                answer: ["NO"],
                explanation:
                  "Paragraph 7: ‘whatever promises they make about public display, their activities should remain prohibited.’",
              },
            ],
          },
          {
            kind: "gap-box",
            instructions: "Complete the summary using the list of words and phrases, A–I, below.",
            title: "The writer’s conclusion",
            options: [
              { key: "A", text: "public opposition" },
              { key: "B", text: "dangers" },
              { key: "C", text: "final decision" },
              { key: "D", text: "cost" },
              { key: "E", text: "permission" },
              { key: "F", text: "point of departure" },
              { key: "G", text: "ability" },
              { key: "H", text: "visitors" },
              { key: "I", text: "legal requirement" },
            ],
            template:
              "The writer accepts that it would be impossible to raise every wreck, if only because of the [[37]] involved. However, the presumption in favour of preservation in place should be seen as a [[38]] rather than as a fixed rule. Each case ought to be judged on the [[39]] to which the wreck is exposed, on its historical importance and on whether an institution has the [[40]] to look after it. Where a site is being eroded, leaving the wreck in place effectively means accepting that it will be lost.",
            questions: [
              {
                n: 37,
                answer: ["D"],
                explanation: "Final paragraph: raising every wreck is ruled out because ‘the expense alone would make that impossible’.",
              },
              {
                n: 38,
                answer: ["F"],
                explanation:
                  "Final paragraph: the presumption ‘should be treated as a starting point for discussion rather than as a rule’.",
              },
              {
                n: 39,
                answer: ["B"],
                explanation: "Final paragraph: each wreck should be assessed ‘according to the threats it faces’.",
              },
              {
                n: 40,
                answer: ["G"],
                explanation:
                  "Final paragraph: the decision depends on ‘the capacity of a suitable institution to care for it’. Capacity means ability, not permission.",
              },
            ],
          },
        ],
      },
    ],
  },
  // ===========================================================================
  // Averna Academic Reading 2 (Hard)
  // ===========================================================================
  {
    format: "exam-v2",
    skill: "READING",
    id: "averna-reading-02",
    title: "Averna Academic Reading 2",
    description:
      "A full Academic Reading test: four decades of a dryland tree-planting programme, comparative research on how animals sleep, and an argument about whether multitasking is a myth.",
    difficulty: "Hard",
    timeLimit: 60,
    topics: ["environment", "forestry", "biology", "animal behaviour", "psychology", "work"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Passage 1 — Questions 1–13
      // -----------------------------------------------------------------------
      {
        id: "passage-1",
        title: "Holding Back the Sand",
        subtitle: "Four decades of planting on the Oruvan Plateau have taught foresters hard lessons about growing trees in dry lands",
        paragraphs: [
          {
            label: "A",
            text: "In the spring of 1978, a series of dust storms swept across the Oruvan Plateau with such force that the airport serving the capital, Dervona, was closed for eleven days. The storms were not a natural misfortune alone. During the previous three decades, a rapidly growing population had ploughed up much of the plateau’s native grassland and doubled the number of sheep and goats grazing what remained, leaving the light soils exposed to the wind. Within a year the government had announced its response: the Oruvan Shelterbelt Programme, a band of trees up to fifteen kilometres wide that would stretch for 2,800 kilometres along the southern margin of the plateau, where sand from the desert beyond was advancing on farmland. Its planners set a target of 1.2 billion trees by the year 2000.",
          },
          {
            label: "B",
            text: "The early years of the programme were characterised by speed and scale. Planting was carried out by state brigades, often made up of students on compulsory summer service, and in the remotest districts seed was scattered from light aircraft. Most of the belt, however, consisted of straight rows of fast-growing poplar clones imported from the wetter north of the country, watered by pumps drawing on underground aquifers. Brigades were judged by the number of seedlings they put in the ground, and survival was rarely checked. By 1990 officials were reporting that more than 700 million trees had been planted, and photographs of the ranks of young poplars became a familiar feature of national publicity.",
          },
          {
            label: "C",
            text: "The reality proved less impressive. An independent audit commissioned in 1994 estimated that only 18 per cent of the trees planted since 1979 were still alive. Many seedlings had been put into soil too dry to sustain them; others had been eaten by livestock that no one had been employed to keep away. The poplars that did survive brought problems of their own. Because each tree transpires large volumes of water, the plantations drew heavily on the aquifers, and in some districts the water table fell by as much as six metres, leaving village wells dry. Then, between 1997 and 1999, a wood-boring beetle spread through the uniform stands of poplar, killing an estimated forty million trees in three summers. Genetically identical and planted in unbroken lines, the clones offered the insect an uninterrupted feast.",
          },
          {
            label: "D",
            text: "In 2001 the government invited a panel led by the ecologist Maren Oduya to review the programme. Its report argued that the plateau had never supported continuous forest and that attempting to impose one was futile. Instead, it recommended planting native species, chiefly drought-tolerant shrubs and small trees, in scattered patches that mimicked the plateau’s original savanna. To capture the brief but intense rains, workers now dig ‘half-moons’: semicircular earth banks, open on the uphill side, that trap runoff and allow it to soak into the soil around a seedling. Pits are enriched with manure, planting is timed to coincide with the start of the rainy season, and seedlings receive water only in their first year, after which they must survive on rainfall alone.",
          },
          {
            label: "E",
            text: "Equally significant were changes in who looked after the trees. Under the reforms, households in villages along the belt could obtain thirty-year rights to a plot, together with anything it produced: fodder cut from shrubs, fruit, and firewood from prunings. In return, they agreed to protect the plot from grazing animals. Crucially, payment was no longer made for each seedling planted but for each tree still alive after three years. Villages also negotiated rotation schemes under which herds were kept off newly planted areas for five years. By 2012, a survey of 900 plots found that 64 per cent of trees planted under the new arrangements had survived, more than three times the proportion recorded by the 1994 audit.",
          },
          {
            label: "F",
            text: "Perhaps the most unexpected lesson came from the farmers themselves. Many of the native shrubs that appeared to have been destroyed decades earlier had, in fact, retained living root systems beneath the surface, and each spring they sent up clusters of shoots that were promptly eaten by goats. Farmers in the district of Tolvek found that if they protected these stumps, selected the strongest two or three shoots and pruned away the rest, the shrubs recovered to a height of two metres within four years, far faster than seedlings raised in a nursery. The technique, known locally as ‘waking the roots’, costs roughly a tenth as much per hectare as conventional planting, and it has since spread to more than 3,000 villages.",
          },
          {
            label: "G",
            text: "Whether the belt has achieved its original purpose is harder to establish. Records from Dervona show that the number of days affected by severe dust fell from an average of twenty-three a year in the 1980s to nine in the 2010s. Yet rainfall on the plateau was unusually high during the latter decade, and the area under the plough had also shrunk as rural families moved to the cities, so the trees can claim only part of the credit. Some hydrologists warn, too, that even native plantations may lower water tables if they are established too densely. The programme’s current plan acknowledges these uncertainties. It no longer speaks of a wall of trees, but of restoring a working landscape in which grazing, farming and woodland coexist.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions: "Reading Passage 1 has seven paragraphs, A–G. Which paragraph contains the following information?",
            allowReuse: true,
            options: [
              { key: "A", text: "Paragraph A" },
              { key: "B", text: "Paragraph B" },
              { key: "C", text: "Paragraph C" },
              { key: "D", text: "Paragraph D" },
              { key: "E", text: "Paragraph E" },
              { key: "F", text: "Paragraph F" },
              { key: "G", text: "Paragraph G" },
            ],
            questions: [
              {
                n: 1,
                text: "a change in the basis on which participants were paid",
                answer: ["E"],
                explanation:
                  "Paragraph E: ‘payment was no longer made for each seedling planted but for each tree still alive after three years.’",
              },
              {
                n: 2,
                text: "an explanation of why an insect was able to cause such widespread damage",
                answer: ["C"],
                explanation:
                  "Paragraph C: ‘Genetically identical and planted in unbroken lines, the clones offered the insect an uninterrupted feast.’",
              },
              {
                n: 3,
                text: "a reference to developments unrelated to tree planting that may have helped to reduce a problem",
                answer: ["G"],
                explanation:
                  "Paragraph G: fewer dust days may be partly due to unusually high rainfall and the shrinking ‘area under the plough … as rural families moved to the cities’, so ‘the trees can claim only part of the credit.’",
              },
              {
                n: 4,
                text: "an account of how human activity left a region exposed to erosion by the wind",
                answer: ["A"],
                explanation:
                  "Paragraph A: people ‘ploughed up much of the plateau’s native grassland and doubled the number of sheep and goats … leaving the light soils exposed to the wind.’",
              },
            ],
          },
          {
            kind: "tfng",
            instructions: "Do the following statements agree with the information given in Reading Passage 1?",
            questions: [
              {
                n: 5,
                text: "The programme’s planners originally aimed to plant more than a billion trees within ten years.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph A: the programme began in 1979 and the target was ‘1.2 billion trees by the year 2000’, about twenty years later, not ten.",
              },
              {
                n: 6,
                text: "In some parts of the belt, seed was distributed from the air.",
                answer: ["TRUE"],
                explanation: "Paragraph B: ‘in the remotest districts seed was scattered from light aircraft.’",
              },
              {
                n: 7,
                text: "The wood-boring beetle also caused serious damage to native shrubs.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph C says only that the beetle ‘spread through the uniform stands of poplar’, killing about forty million trees. Nothing is said about its effect on native shrubs.",
              },
              {
                n: 8,
                text: "Under the revised approach, young plants are watered during their first three years.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph D: ‘seedlings receive water only in their first year, after which they must survive on rainfall alone.’ (Three years is the survival check for payment in Paragraph E.)",
              },
              {
                n: 9,
                text: "Encouraging surviving roots to regrow has proved more economical than planting nursery-grown seedlings.",
                answer: ["TRUE"],
                explanation:
                  "Paragraph F: ‘waking the roots’ ‘costs roughly a tenth as much per hectare as conventional planting’.",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the table below.",
            wordLimit: 2,
            allowNumber: true,
            title: "The Oruvan Shelterbelt Programme",
            template:
              "| Period | Approach | Results |\n| 1979–1990 | state brigades plant straight rows of fast-growing [[10]] watered from aquifers | survival rarely checked; over 700 million trees reported planted |\n| 1994 audit | assessment of all trees planted since 1979 | only [[11]] of trees still alive; water table down by as much as [[12]] in some districts |\n| From 2001 | native species planted in [[13]] that mimic the original savanna; ‘half-moons’ trap runoff | 64 per cent of new trees surviving by 2012 |",
            questions: [
              {
                n: 10,
                answer: ["poplar clones", "poplars", "poplar"],
                explanation: "Paragraph B: ‘straight rows of fast-growing poplar clones imported from the wetter north’.",
              },
              {
                n: 11,
                answer: ["18 per cent", "18%", "18 percent"],
                explanation: "Paragraph C: the 1994 audit ‘estimated that only 18 per cent of the trees planted since 1979 were still alive.’",
              },
              {
                n: 12,
                answer: ["six metres", "6 metres", "6 m", "6m", "six meters", "6 meters"],
                explanation: "Paragraph C: ‘in some districts the water table fell by as much as six metres, leaving village wells dry.’",
              },
              {
                n: 13,
                answer: ["(scattered) patches"],
                explanation:
                  "Paragraph D: native species were planted ‘in scattered patches that mimicked the plateau’s original savanna.’",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 2 — Questions 14–26
      // -----------------------------------------------------------------------
      {
        id: "passage-2",
        title: "The Many Ways of Sleeping",
        subtitle: "Comparative research is revealing how widely sleep varies across the animal kingdom, and why it persists despite its dangers",
        paragraphs: [
          {
            label: "A",
            text: "From an evolutionary point of view, sleep is a puzzle. An animal that is asleep cannot feed, mate or watch for predators, and for species that are hunted, the risks of losing awareness would seem considerable. Yet no animal with a reasonably complex nervous system has been found to do without sleep altogether. What does vary, to a remarkable degree, is how much sleep animals take and in what form. Some bats spend nearly twenty hours a day asleep, while certain large grazing mammals manage on less than four. Comparing these patterns has become one of the most productive ways of approaching an old question: what is sleep actually for?",
          },
          {
            label: "B",
            text: "The first systematic attempt to explain these differences was made in the 1980s by the zoologist Hanna Reiss, who compiled published measurements for 146 species of mammal. Her analysis revealed two strong patterns. Animals that are hunted by others generally sleep less than predators, and species that feed on grass and leaves sleep less than those that eat meat or insects. Reiss argued that both patterns reflect a trade-off. Plant food is plentiful but poor in energy, so grazers must spend many hours eating, and an animal exposed on open ground cannot afford long periods of unconsciousness. A lion, by contrast, may obtain several days’ energy from a single meal and has little to fear from other animals, so it can sleep for much of the day.",
          },
          {
            label: "C",
            text: "Reiss’s data, however, came almost entirely from animals in laboratories and zoos, and later researchers questioned whether captive animals sleep normally. In 2011 Tobias Kern fitted miniature recording devices to wild and captive members of the same species of fruit bat. The wild bats slept for about four hours less per day than their captive relatives, a difference Kern attributed chiefly to constant disturbance in their crowded roosts. His findings suggest that many published figures reflect how much animals are capable of sleeping in safe, undisturbed conditions rather than how much they sleep in their natural surroundings. Measuring sleep in the wild nonetheless remains technically demanding, and reliable data exist for only a small proportion of species.",
          },
          {
            label: "D",
            text: "Some animals have solved the problem of vigilance more radically. In dolphins, seals and many birds, one half of the brain can sleep while the other remains awake, a state known as unihemispheric sleep, and the eye linked to the waking half usually stays open. Keiko Arata investigated how alert such animals really are by playing faint sounds to resting bottlenose dolphins through underwater speakers placed on either side of their pool. Sounds on the side of the open eye produced responses almost as quickly as in fully awake animals, whereas responses to sounds on the opposite side were about three times slower. For an air-breathing mammal that must surface regularly and cannot rest on the seabed, Arata argues, sleeping with half the brain is not a curiosity but a necessity.",
          },
          {
            label: "E",
            text: "If sleep serves the needs of complex brains, it is less obvious why it should occur in animals with very simple nervous systems, yet sleep-like states are increasingly being found in such creatures. Researchers generally accept that an animal is sleeping, rather than merely resting, if three conditions are met: it becomes less responsive to its surroundings, it can be roused quickly by a strong enough stimulus, and it compensates for lost sleep by sleeping more afterwards. In 2016 Rui Carvalho showed that a species of sea star, which has no brain but only a ring of nerves around its mouth, satisfies all three. When he kept the animals active through the night by nudging them with a soft brush whenever they became still, they spent almost twice as long in their resting posture the following day.",
          },
          {
            label: "F",
            text: "Such discoveries have sharpened the debate about the original function of sleep. Adaeze Okonkwo argues that it first evolved as a way of saving energy at times when activity was unprofitable, such as the hours of darkness for an animal that finds its food by sight. On this view, the more elaborate functions associated with sleep in mammals and birds, including the strengthening of memories, were added later, once a regular period of inactivity already existed. Many researchers are unconvinced. They point out that the energy saved by sleeping, as opposed to resting quietly while awake, is surprisingly small, and they favour explanations based on the needs of nerve cells, which may require regular periods of reduced activity in order to repair themselves and clear away chemical waste.",
          },
          {
            label: "G",
            text: "Further evidence that sleep responds to local conditions comes from Ingrid Solberg, who compared two populations of the same species of wood mouse: one on a small island free of predators, the other on the nearby mainland, where owls and foxes are common. The island mice slept for around two hours longer each day, chose more exposed resting places and were slower to wake when a recording of an owl’s call was played. Solberg concludes that the amount of sleep an animal takes is not fixed by its physiology but continually adjusted to the balance between the benefits of sleep and the risks of taking it. If she is right, the variety of sleep across the animal kingdom is less a puzzle to be explained away than evidence of how finely each species has tuned a universal need to its own way of life.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions:
              "Look at the following statements (Questions 14–19) and the list of scientists below. Match each statement with the correct scientist, A–E.",
            title: "List of Scientists",
            allowReuse: true,
            options: [
              { key: "A", text: "Hanna Reiss" },
              { key: "B", text: "Tobias Kern" },
              { key: "C", text: "Keiko Arata" },
              { key: "D", text: "Adaeze Okonkwo" },
              { key: "E", text: "Ingrid Solberg" },
            ],
            questions: [
              {
                n: 14,
                text: "Figures obtained from captive animals may exaggerate how much animals sleep naturally.",
                answer: ["B"],
                explanation:
                  "Paragraph C: Kern’s wild bats slept about four hours less than captive ones, suggesting published figures reflect sleep ‘in safe, undisturbed conditions rather than … in their natural surroundings.’",
              },
              {
                n: 15,
                text: "Species that are preyed upon sleep less than the species that hunt them.",
                answer: ["A"],
                explanation: "Paragraph B: Reiss found that ‘animals that are hunted by others generally sleep less than predators’.",
              },
              {
                n: 16,
                text: "A sleeping animal may be able to respond rapidly to events on one side of it.",
                answer: ["C"],
                explanation:
                  "Paragraph D: in Arata’s study, ‘sounds on the side of the open eye produced responses almost as quickly as in fully awake animals’.",
              },
              {
                n: 17,
                text: "Sleep may first have evolved as a means of saving energy.",
                answer: ["D"],
                explanation: "Paragraph F: ‘Adaeze Okonkwo argues that it first evolved as a way of saving energy at times when activity was unprofitable’.",
              },
              {
                n: 18,
                text: "Animals continually adjust how much they sleep to balance its advantages against its dangers.",
                answer: ["E"],
                explanation:
                  "Paragraph G: Solberg concludes that sleep is ‘continually adjusted to the balance between the benefits of sleep and the risks of taking it.’",
              },
              {
                n: 19,
                text: "Grazing animals sleep relatively little partly because their diet obliges them to feed for many hours.",
                answer: ["A"],
                explanation:
                  "Paragraph B: Reiss argued that plant food is ‘poor in energy, so grazers must spend many hours eating’.",
              },
            ],
          },
          {
            kind: "gap-box",
            instructions: "Complete the summary using the list of words and phrases, A–I, below.",
            title: "Sleep across the animal kingdom",
            options: [
              { key: "A", text: "heat" },
              { key: "B", text: "neurons" },
              { key: "C", text: "air" },
              { key: "D", text: "insect-eaters" },
              { key: "E", text: "threats" },
              { key: "F", text: "food" },
              { key: "G", text: "waste products" },
              { key: "H", text: "plant-eaters" },
              { key: "I", text: "muscles" },
            ],
            template:
              "Although sleep prevents animals from feeding or watching for [[20]], no animal with a reasonably complex nervous system is known to do without it. The amount of sleep varies greatly: some bats sleep for nearly twenty hours a day, whereas certain large [[21]] need less than four. Some animals, including dolphins, can rest one half of the brain while the other half stays awake, an ability that is essential for mammals that must regularly come up for [[22]]. The original purpose of sleep is still disputed; many researchers believe that it allows [[23]] to recover and to get rid of [[24]].",
            questions: [
              {
                n: 20,
                answer: ["E"],
                explanation: "Paragraph A: an animal that is asleep cannot ‘watch for predators’, i.e. threats.",
              },
              {
                n: 21,
                answer: ["H"],
                explanation: "Paragraph A: ‘certain large grazing mammals manage on less than four’ hours.",
              },
              {
                n: 22,
                answer: ["C"],
                explanation: "Paragraph D: half-brain sleep is a necessity for ‘an air-breathing mammal that must surface regularly’.",
              },
              {
                n: 23,
                answer: ["B"],
                explanation: "Paragraph F: many researchers favour explanations based on ‘the needs of nerve cells’ (neurons), which may need rest ‘to repair themselves’.",
              },
              {
                n: 24,
                answer: ["G"],
                explanation: "Paragraph F: nerve cells may need periods of reduced activity to ‘clear away chemical waste’.",
              },
            ],
          },
          {
            kind: "mcq-multi",
            instructions: "Answer the question below.",
            title: "Which TWO of the following are mentioned as signs that an animal is sleeping rather than simply resting?",
            options: [
              { key: "A", text: "It responds less to what is happening around it." },
              { key: "B", text: "Its eyes are completely closed." },
              { key: "C", text: "Its body temperature falls." },
              { key: "D", text: "It rests for longer after being kept awake." },
              { key: "E", text: "Its brain produces a characteristic pattern of electrical activity." },
            ],
            questions: [
              {
                n: 25,
                answer: ["A", "D"],
                explanation:
                  "Paragraph E lists the accepted conditions: the animal ‘becomes less responsive to its surroundings’ (A), can be roused quickly, and ‘compensates for lost sleep by sleeping more afterwards’ (D). Closed eyes, body temperature and brain activity are not given as criteria; in unihemispheric sleep one eye ‘usually stays open’ (Paragraph D).",
              },
              {
                n: 26,
                answer: ["A", "D"],
                explanation:
                  "Paragraph E lists the accepted conditions: the animal ‘becomes less responsive to its surroundings’ (A), can be roused quickly, and ‘compensates for lost sleep by sleeping more afterwards’ (D). Closed eyes, body temperature and brain activity are not given as criteria; in unihemispheric sleep one eye ‘usually stays open’ (Paragraph D).",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 3 — Questions 27–40
      // -----------------------------------------------------------------------
      {
        id: "passage-3",
        title: "Divided Attention",
        subtitle: "A cognitive scientist examines what the evidence really says about doing several things at once",
        paragraphs: [
          {
            text: "Few ideas in popular psychology have been repeated as confidently in recent years as the claim that multitasking is a myth. The brain, we are told, cannot genuinely do two things at once; what feels like simultaneous activity is merely attention flickering between tasks, at considerable cost to both. As a summary of a substantial body of laboratory research, this is not wholly mistaken. As a description of human capacities, however, it is an overstatement, and one that obscures a more interesting question: when, and why, does dividing our attention do harm?",
          },
          {
            text: "Consider first what people can undoubtedly do simultaneously. Most adults can walk along a crowded pavement while holding a conversation, and an experienced pianist can play a familiar piece while chatting. What such cases share is that at least one activity has become automatic: it has been practised so thoroughly that it no longer draws on the limited, deliberate form of attention that psychologists call executive control. Difficulty arises when two tasks both require that control, as when someone composes a message while following a telephone call. Performance on at least one then invariably suffers, and it is in this narrower sense that the ‘myth’ has a genuine basis.",
          },
          {
            text: "What passes for multitasking in such circumstances is really switching, and switching is never free. In a series of experiments in the 1990s, the psychologist Elspeth Marlow asked volunteers to alternate between two simple judgements: whether a pictured object was larger than a shoebox, and whether a printed word contained more than two syllables. Even when the sequence of tasks was entirely predictable, responses made immediately after a switch were markedly slower and less accurate than those in which the same task was repeated. The penalty grew with the complexity of the rules that had to be recalled, and although practice reduced it, no amount of training removed it altogether. Marlow interpreted the cost as the time the mind needs to dismantle one set of goals and assemble another.",
          },
          {
            text: "Measured in fractions of a second, such costs may seem trivial; accumulated over a working day, they are not. When Marlow’s methods were later adapted to office work, employees who alternated between two report-writing assignments took around a third longer to finish them than colleagues who completed one before beginning the other, and made nearly twice as many factual errors. Interruptions from outside are more damaging still, because the worker must not only resume the original task but first reconstruct where it had been left. Thoughts about an unfinished task also tend to linger after a person has moved on, so that the new activity receives only part of their attention.",
          },
          {
            text: "Most striking of all is how poorly people judge their own abilities. In a study led by Jonas Brandt, participants rated their skill at multitasking and then proofread a document while answering spoken arithmetic questions. Those who rated themselves most highly tended to perform worst, and the people who reported multitasking most in daily life were, on average, among the least able to ignore irrelevant information. It is tempting to conclude that habitual multitasking erodes concentration. The evidence does not yet justify that inference: it is at least as plausible that people who are easily distracted are drawn to juggling several activities in the first place. Only studies that follow the same individuals over many years could separate cause from effect, and few such studies exist.",
          },
          {
            text: "If individuals misjudge the costs of switching, organisations frequently compound the error. Many workplaces reward the appearance of responsiveness: the employee who answers messages within minutes is regarded as committed, while one who disappears for three hours to finish a report risks being thought unavailable. Activity is thus mistaken for productivity, and a constant stream of messages is taken as evidence of diligence rather than an obstacle to it. It has become fashionable to blame smartphones and messaging software for this state of affairs and to prescribe periods of ‘digital detox’. In my view, this misplaces the problem. The devices can be switched off; what prevents people from doing so is an expectation, seldom stated but widely enforced, that every message deserves an immediate reply.",
          },
          {
            text: "There is encouraging evidence that such expectations can be altered. When the engineering consultancy Halden & Rowe introduced two ‘quiet mornings’ a week, during which staff were not expected to respond to internal messages, the proportion of project deadlines it met rose by a fifth over the following year, although working hours were unchanged.",
          },
          {
            text: "None of this implies that switching should always be avoided. Anyone who has abandoned a stubborn problem, only to find the solution arriving unbidden while doing something else, will recognise that a change of activity can be fruitful. Experiments bear this out: volunteers who were stuck on a word puzzle and were moved to an unrelated task for a few minutes solved more puzzles on their return than those who persisted without a break. The crucial distinction, I would argue, lies between switching that is chosen at a natural pause in the work and switching imposed by an interruption that arrives at an arbitrary moment. The former can refresh thinking; the latter merely fragments it.",
          },
          {
            text: "The popular slogan, then, is right about the costs and wrong about their source. We are not incapable of doing two things at once; we are incapable of doing two demanding things at once without paying for it. The real myth is not multitasking itself but the belief that it costs nothing, a belief sustained less by individual vanity than by working cultures that treat attention as if it were infinitely divisible.",
          },
        ],
        groups: [
          {
            kind: "ynng",
            instructions: "Do the following statements agree with the claims of the writer in Reading Passage 3?",
            questions: [
              {
                n: 27,
                text: "The popular claim that people cannot do two things at once overstates the case.",
                answer: ["YES"],
                explanation:
                  "Paragraph 1: ‘As a description of human capacities, however, it is an overstatement’; final paragraph: ‘We are not incapable of doing two things at once’.",
              },
              {
                n: 28,
                text: "Office workers who alternated between two assignments worked more slowly but made fewer mistakes.",
                answer: ["NO"],
                explanation:
                  "Paragraph 4: they ‘took around a third longer to finish them … and made nearly twice as many factual errors.’",
              },
              {
                n: 29,
                text: "Marlow’s findings were initially rejected by other psychologists.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph 3 describes Marlow’s experiments and how she interpreted them, and Paragraph 4 says her methods were ‘later adapted to office work’. Nothing is said about how other psychologists first received her findings.",
              },
              {
                n: 30,
                text: "Research has established that frequent multitasking damages people’s ability to concentrate.",
                answer: ["NO"],
                explanation:
                  "Paragraph 5: ‘The evidence does not yet justify that inference’; distractible people may simply be ‘drawn to juggling several activities in the first place.’",
              },
              {
                n: 31,
                text: "Employers should be legally required to limit the number of messages they send to staff.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraphs 6–7 say that workplace expectations of instant replies are the problem and can be changed, but the writer never mentions laws or legal limits.",
              },
              {
                n: 32,
                text: "Moving to a different activity at a natural break in work can benefit a person’s thinking.",
                answer: ["YES"],
                explanation:
                  "Paragraph 8: switching ‘chosen at a natural pause in the work … can refresh thinking’.",
              },
            ],
          },
          {
            kind: "mcq",
            instructions: "Answer the questions below.",
            questions: [
              {
                n: 33,
                text: "Why does the writer mention an experienced pianist playing a familiar piece?",
                options: [
                  { key: "A", text: "to show that musical training improves concentration" },
                  { key: "B", text: "to illustrate that a thoroughly practised activity can be combined with another" },
                  { key: "C", text: "to suggest that experts in any field are better at multitasking" },
                  { key: "D", text: "to argue that two demanding tasks can be combined with enough effort" },
                ],
                answer: ["B"],
                explanation:
                  "Paragraph 2: in such cases ‘at least one activity has become automatic: it has been practised so thoroughly that it no longer draws on’ executive control. Two demanding tasks, by contrast, always interfere (D is wrong).",
              },
              {
                n: 34,
                text: "What did Marlow’s experiments demonstrate?",
                options: [
                  { key: "A", text: "Switching was costly only when volunteers could not predict the next task." },
                  { key: "B", text: "Judging pictures was more difficult than judging words." },
                  { key: "C", text: "Responses were impaired immediately after a change of task." },
                  { key: "D", text: "With enough practice, volunteers eventually switched without any cost." },
                ],
                answer: ["C"],
                explanation:
                  "Paragraph 3: ‘responses made immediately after a switch were markedly slower and less accurate’, even when the order was ‘entirely predictable’ (not A), and ‘no amount of training removed it altogether’ (not D).",
              },
              {
                n: 35,
                text: "What does the writer criticise about many workplaces?",
                options: [
                  { key: "A", text: "They set deadlines that cannot realistically be met." },
                  { key: "B", text: "They require staff to work longer hours than in the past." },
                  { key: "C", text: "They fail to provide staff with suitable technology." },
                  { key: "D", text: "They regard quick replies to messages as a sign of commitment." },
                ],
                answer: ["D"],
                explanation:
                  "Paragraph 6: ‘the employee who answers messages within minutes is regarded as committed’, so ‘activity is thus mistaken for productivity.’",
              },
              {
                n: 36,
                text: "What is the writer’s main conclusion?",
                options: [
                  { key: "A", text: "What is mistaken is the widespread assumption that dividing attention is free." },
                  { key: "B", text: "Individuals are chiefly to blame for overestimating their abilities." },
                  { key: "C", text: "Multitasking is a skill that most people can develop with practice." },
                  { key: "D", text: "People should avoid changing from one task to another wherever possible." },
                ],
                answer: ["A"],
                explanation:
                  "Final paragraph: ‘The real myth is not multitasking itself but the belief that it costs nothing’. That belief comes ‘less by individual vanity than by working cultures’ (not B), and Paragraph 8 rejects D.",
              },
            ],
          },
          {
            kind: "matching",
            instructions: "Complete each sentence with the correct ending, A–G, below.",
            allowReuse: false,
            options: [
              { key: "A", text: "led to more deadlines being met without longer working hours." },
              { key: "B", text: "tend to perform worse than people with less confidence." },
              { key: "C", text: "increases as the rules involved become more complex." },
              { key: "D", text: "must first work out where they had stopped." },
              { key: "E", text: "disappears entirely after sufficient training." },
              { key: "F", text: "are usually younger than those who avoid it." },
              { key: "G", text: "caused staff to spend more time on internal messages." },
            ],
            questions: [
              {
                n: 37,
                text: "People who consider themselves highly skilled at multitasking",
                answer: ["B"],
                explanation: "Paragraph 5: in Brandt’s study, ‘those who rated themselves most highly tended to perform worst’.",
              },
              {
                n: 38,
                text: "The penalty for switching between tasks",
                answer: ["C"],
                explanation:
                  "Paragraph 3: ‘The penalty grew with the complexity of the rules that had to be recalled’. It does not disappear with training (‘no amount of training removed it altogether’), so E is wrong.",
              },
              {
                n: 39,
                text: "Interruptions from outside are especially harmful because workers",
                answer: ["D"],
                explanation:
                  "Paragraph 4: the worker ‘must not only resume the original task but first reconstruct where it had been left.’",
              },
              {
                n: 40,
                text: "At Halden & Rowe, reducing the expectation of instant replies",
                answer: ["A"],
                explanation:
                  "Paragraph 7: after the ‘quiet mornings’ were introduced, ‘the proportion of project deadlines it met rose by a fifth … although working hours were unchanged.’",
              },
            ],
          },
        ],
      },
    ],
  },
];
