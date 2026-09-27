import type { ExamReadingTest } from "../types";

/** Original Averna Academic Reading tests (exam-v2, 3 passages × 40 questions). */
export const READING_SEED_B: ExamReadingTest[] = [
  // ===========================================================================
  // AVERNA ACADEMIC READING 3 (Medium)
  // ===========================================================================
  {
    format: "exam-v2",
    skill: "READING",
    id: "averna-reading-03",
    title: "Averna Academic Reading 3",
    description:
      "Full Academic Reading test: the two-hundred-year history of the bicycle, the hidden journey of microplastics through the oceans, and a critical look at the idea of decision fatigue. 3 passages, 40 questions, 60 minutes.",
    difficulty: "Medium",
    timeLimit: 60,
    topics: ["history of technology", "transport", "marine science", "pollution", "psychology", "decision-making"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Passage 1 — Questions 1–13 (matching headings, TRUE/FALSE/NOT GIVEN)
      // -----------------------------------------------------------------------
      {
        id: "passage-1",
        title: "The Long Road of the Bicycle",
        subtitle: "How an awkward novelty became one of the most widely used machines in the world",
        paragraphs: [
          {
            label: "A",
            text: "Few machines have been reinvented as often as the bicycle. Its earliest ancestor, which appeared in central Europe in the late 1810s, had no pedals, no chain and no brakes. The rider sat astride a wooden beam joined to two wheels of equal size and moved forward by striding along the ground, rather like a small child on a modern balance bike. A simple handle steered the front wheel. A popular explanation links the invention to a run of failed harvests, which made oats expensive and horses costly to keep. The historian Lotte Varga rejects this account, pointing out that the earliest surviving drawings of the machine were made at least a year before the worst of the shortages. Whatever its origins, the ‘running machine’ remained largely an amusement for fashionable young men, and several city councils soon banned riders from pavements.",
          },
          {
            label: "B",
            text: "Nearly half a century passed before anyone found a practical way to keep the rider’s feet off the ground. In the 1860s, carriage makers in France began fixing pedals directly to the front wheel, so that each turn of the pedals produced exactly one turn of the wheel. With its heavy iron frame and iron-rimmed wooden wheels, the resulting ‘velocipede’ passed every jolt on cobbled streets straight to the rider, earning it the nickname ‘boneshaker’. It nonetheless caused a sensation. Riding halls opened in several capitals, where beginners paid by the hour to wobble around under the eye of an instructor. The boom was remarkably brief. Within two years many of the halls had closed and second-hand machines were selling for a fraction of their original price.",
          },
          {
            label: "C",
            text: "The next generation of designers concentrated on speed. Because the pedals still drove the front wheel directly, the only way to cover more ground with each turn was to enlarge that wheel, and during the 1870s front wheels grew until some measured one and a half metres across. Wire spokes made these ‘high-wheelers’ far lighter than the boneshaker. The price of this speed was danger. Seated almost directly above the front wheel, the rider could be thrown head first over the handlebars by a single stone or pothole, an accident so common that riders called it a ‘header’. The machine appealed mainly to young, athletic and fairly wealthy men, many of whom joined cycling clubs. The records of one such club, in the mill town of Callowmere, list forty-one serious injuries among its ninety members in a single season.",
          },
          {
            label: "D",
            text: "The solution, which emerged in the mid-1880s, was to stop driving the front wheel altogether. The ‘safety bicycle’ used a chain to carry power from pedals mounted low in the frame to the rear wheel. Because a large front sprocket turns a small rear one several times for every revolution of the pedals, a wheel of ordinary size could now travel as far as a giant one: gearing had replaced sheer diameter. The two wheels could therefore be almost the same size, and the rider sat low enough between them for their feet to reach the ground. High-wheel enthusiasts at first mocked the newcomer as a machine for the timid, but it was easier to learn and to mount, and far less likely to throw its rider. Its basic geometry has barely changed since.",
          },
          {
            label: "E",
            text: "What the early safety bicycle lacked was comfort. Its small solid-rubber wheels transmitted every vibration from the rutted roads of the period, and long journeys were exhausting. The remedy was a tyre filled with air. Several inventors experimented with inflatable tyres at about the same time, but the idea was at first dismissed as absurd. Opinion changed after a series of races in which little-known riders on air-filled tyres comfortably beat established champions on solid ones. According to trade catalogues analysed by the historian Emil Strand, fewer than one in ten bicycles advertised in 1890 had pneumatic tyres; by 1895 the proportion exceeded ninety per cent. Because a cushion of air absorbs bumps that would otherwise slow the wheel, the new tyres made cycling faster as well as smoother.",
          },
          {
            label: "F",
            text: "Together, the safety frame and the air-filled tyre produced the first true cycling boom. Manufacturers adopted mass-production methods, and prices fell sharply: Strand calculates that a new bicycle which cost a factory worker about four months’ wages in 1890 cost roughly five weeks’ wages by 1900. Cheaper machines opened cycling to clerks, shop assistants and factory hands, who could now live further from their workplaces, and to women, for whom it offered a new degree of independence. Long skirts proved hazardous on a machine with a chain, and the resulting argument over ‘rational dress’ for female riders filled the letters pages of newspapers for years. At one textile mill in Dunmarsh, the average distance between workers’ homes and the factory gates doubled during the 1890s.",
          },
          {
            label: "G",
            text: "In much of Europe and North America, however, the bicycle’s golden age was short. As motor cars became affordable, roads were redesigned around them, suburbs spread beyond comfortable cycling distance, and the bicycle came to be regarded as a child’s toy. The decline was not universal: in parts of Asia the bicycle remained the main means of transport for working people until the 1980s. The revival began with the fuel crises of the 1970s and has gathered pace as cities search for ways to reduce congestion and pollution. Protected cycle lanes, bicycle-hire schemes and electric bicycles have attracted many new riders. In Veldhaven, where the council built 120 kilometres of separated lanes over ten years, the share of journeys made by bicycle rose from 4 to 17 per cent. Two centuries after its awkward beginnings, the bicycle is once again a serious machine.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions:
              "Reading Passage 1 has seven paragraphs, A–G. Choose the correct heading for each paragraph from the list of headings below.",
            title: "List of Headings",
            options: [
              { key: "i", text: "Cycling reaches a wider public" },
              { key: "ii", text: "Official attempts to restrict a new vehicle" },
              { key: "iii", text: "Riding without pedals" },
              { key: "iv", text: "Gears replace giant wheels" },
              { key: "v", text: "The rise of cycling as a competitive sport" },
              { key: "vi", text: "Speed at the cost of safety" },
              { key: "vii", text: "Losing ground and winning it back" },
              { key: "viii", text: "A short-lived craze" },
              { key: "ix", text: "Disagreement over who invented the bicycle" },
              { key: "x", text: "Solving the problem of a rough ride" },
            ],
            allowReuse: false,
            questions: [
              {
                n: 1,
                text: "Paragraph A",
                answer: ["iii"],
                explanation:
                  "Paragraph A: the first machine 'had no pedals, no chain and no brakes' and its rider 'moved forward by striding along the ground'. The pavement ban (ii) and the debate about why it was invented (ix) are minor details.",
              },
              {
                n: 2,
                text: "Paragraph B",
                answer: ["viii"],
                explanation:
                  "Paragraph B: the velocipede 'caused a sensation', but 'The boom was remarkably brief. Within two years many of the halls had closed'.",
              },
              {
                n: 3,
                text: "Paragraph C",
                answer: ["vi"],
                explanation:
                  "Paragraph C: bigger front wheels made the high-wheeler fast, but 'The price of this speed was danger' — riders were thrown 'head first over the handlebars'.",
              },
              {
                n: 4,
                text: "Paragraph D",
                answer: ["iv"],
                explanation:
                  "Paragraph D: with a chain and sprockets 'a wheel of ordinary size could now travel as far as a giant one: gearing had replaced sheer diameter.'",
              },
              {
                n: 5,
                text: "Paragraph E",
                answer: ["x"],
                explanation:
                  "Paragraph E: 'What the early safety bicycle lacked was comfort … The remedy was a tyre filled with air.' The races (v) are mentioned only as the reason opinion changed.",
              },
              {
                n: 6,
                text: "Paragraph F",
                answer: ["i"],
                explanation:
                  "Paragraph F: as prices fell, 'Cheaper machines opened cycling to clerks, shop assistants and factory hands … and to women'.",
              },
              {
                n: 7,
                text: "Paragraph G",
                answer: ["vii"],
                explanation:
                  "Paragraph G describes the decline ('the bicycle’s golden age was short') and then the recovery ('The revival began with the fuel crises of the 1970s and has gathered pace').",
              },
            ],
          },
          {
            kind: "tfng",
            instructions: "Do the following statements agree with the information given in Reading Passage 1?",
            questions: [
              {
                n: 8,
                text: "Lotte Varga believes the running machine was invented because horses had become expensive to keep.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph A: 'The historian Lotte Varga rejects this account, pointing out that the earliest surviving drawings of the machine were made at least a year before the worst of the shortages.'",
              },
              {
                n: 9,
                text: "Beginners at the velocipede riding halls were charged according to how long they rode.",
                answer: ["TRUE"],
                explanation: "Paragraph B: 'beginners paid by the hour to wobble around under the eye of an instructor'.",
              },
              {
                n: 10,
                text: "More than half of the members of the Callowmere cycling club were seriously injured in a single season.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph C: the club records 'list forty-one serious injuries among its ninety members in a single season' — so at most 41 of the 90 members, fewer than half, were hurt.",
              },
              {
                n: 11,
                text: "The safety bicycle was cheaper to manufacture than the high-wheeler.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph D lists the safety bicycle’s advantages ('easier to learn and to mount, and far less likely to throw its rider') but says nothing about what it cost to make compared with the high-wheeler.",
              },
              {
                n: 12,
                text: "By the middle of the 1890s, the great majority of bicycles advertised for sale had air-filled tyres.",
                answer: ["TRUE"],
                explanation:
                  "Paragraph E: 'fewer than one in ten bicycles advertised in 1890 had pneumatic tyres; by 1895 the proportion exceeded ninety per cent.'",
              },
              {
                n: 13,
                text: "Some doctors warned women that cycling could damage their health.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph F discusses women’s new independence and the argument over 'rational dress', but no medical warnings are mentioned anywhere in the passage.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 2 — Questions 14–26 (matching researchers, notes, choose TWO)
      // -----------------------------------------------------------------------
      {
        id: "passage-2",
        title: "The Plastic We Cannot See",
        subtitle: "Scientists are only beginning to trace the journey of tiny plastic particles through the oceans",
        paragraphs: [
          {
            label: "A",
            text: "When people picture plastic pollution at sea, they usually imagine drifting bottles, bags and tangled fishing nets. Yet much of the plastic in the oceans is almost invisible. Scientists use the term ‘microplastics’ for pieces smaller than five millimetres, roughly the size of a grain of rice, and the smallest particles studied are finer than a human hair. Some are manufactured at that size, such as the pellets from which plastic goods are moulded and the abrasive beads once added to facial scrubs; these are known as primary microplastics. Far more, however, are secondary microplastics, created when larger objects are gradually broken up by sunlight and waves. A plastic bottle does not disappear in the sea: it becomes brittle, cracks and sheds fragments, each of which continues to split into ever smaller pieces for decades.",
          },
          {
            label: "B",
            text: "Many of these particles begin their journey on land. In tests at the Kestrel Textile Laboratory, a single domestic wash of fleece jackets released an average of 1,900 fibres per garment, most of them too short to be caught by the filters in ordinary washing machines. Tyres are an even larger source in some regions: as they wear down, vehicles leave a fine dust of rubber and plastic on roads, which rain carries into drains and rivers. Wastewater treatment plants remove a high proportion of the particles that reach them, but this is less reassuring than it sounds. The captured plastic ends up in sewage sludge, which in many countries is spread on farmland as fertiliser and can be washed back into streams during storms.",
          },
          {
            label: "C",
            text: "Once at sea, microplastics prove surprisingly difficult to track. When the oceanographer Kasper Lindqvist compared the amount of plastic estimated to have entered the sea since the 1950s with the amount found floating in surface surveys, the figures did not add up: the floating material accounted for less than three per cent of the total. Part of the gap may be a problem of measurement. The nets towed behind research vessels usually have a mesh of about 0.33 millimetres, so the smallest particles simply pass through them. Lindqvist argues, however, that the discrepancy is far too large to be explained by sampling methods alone, and that most of the missing plastic must have left the surface altogether.",
          },
          {
            label: "D",
            text: "One route downwards was demonstrated by the marine biologist Amara Nwosu, who suspended strips of polyethylene, a plastic that normally floats, in mesh cages in a sheltered harbour. Within four to eight weeks, a coating of bacteria, algae and tiny animals had made most of the strips dense enough to sink. More unexpectedly, when Nwosu lowered sinking strips into cold, dark water, much of this coating died back and some strips floated upwards again. She concludes that particles may rise and fall several times before they finally settle, which would make their movements considerably harder to predict than existing computer models assume.",
          },
          {
            label: "E",
            text: "Wherever they are in the water, microplastics are eaten. Filter-feeding animals such as mussels and oysters strain large volumes of seawater and retain many of the particles it contains, while fish swallow fragments that resemble their natural prey. The ecologist Tomás Arrieta, who examined more than 2,000 fish landed at ports along the Atlantic coast, found plastic in about a third of them, but almost entirely in the gut rather than in the muscle that people eat. Since the gut is normally removed before fish are sold, he regards shellfish, which are eaten whole, as a more significant route by which plastic enters the human diet. Whether these particles cause harm remains uncertain: laboratory studies have produced conflicting results, often using concentrations far higher than those found in the sea.",
          },
          {
            label: "F",
            text: "The deep ocean may be where much of the plastic ends its journey. Sediment cores collected by the geologist Yuki Hanamura from the floor of a deep ocean trench contained fibres at concentrations hundreds of times higher than those typical of surface waters. The particles were not spread evenly: slow currents moving along the sea floor had swept them into drifts, much as wind piles snow against a wall. Cold regions act as another store. In the Arctic, particles become trapped in sea ice as it forms each winter and are released when it melts, so that the ice acts as a temporary reservoir which may carry plastic far from where it entered the sea.",
          },
          {
            label: "G",
            text: "Scientists agree that better data are needed, and the analytical chemist Clara Beaumont has shown how easily figures can be distorted. When she left dishes of filtered water open on laboratory benches, they collected dozens of fibres an hour from the air and from researchers’ clothing, which suggests that some earlier studies may have overestimated the number of particles in their samples. Beaumont is calling for shared standards for sampling and analysis so that results from different laboratories can be compared. Meanwhile, some practical measures are already in place. A number of countries have banned plastic microbeads in cosmetics, and several manufacturers now sell washing machines fitted with filters designed to trap fibres. Tyre dust is a harder problem, since no practical alternative to current tyre materials yet exists, while proposals to collect floating plastic with large barriers would, on Lindqvist’s figures, reach only a small fraction of the material involved.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions:
              "Look at the following statements (Questions 14–18) and the list of researchers below. Match each statement with the correct researcher, A–E.",
            title: "List of Researchers",
            options: [
              { key: "A", text: "Kasper Lindqvist" },
              { key: "B", text: "Amara Nwosu" },
              { key: "C", text: "Tomás Arrieta" },
              { key: "D", text: "Yuki Hanamura" },
              { key: "E", text: "Clara Beaumont" },
            ],
            allowReuse: true,
            questions: [
              {
                n: 14,
                text: "Plastic particles may move up and down in the water several times before they settle.",
                answer: ["B"],
                explanation:
                  "Paragraph D: Nwosu 'concludes that particles may rise and fall several times before they finally settle'.",
              },
              {
                n: 15,
                text: "Weaknesses in sampling cannot fully explain why so little plastic is found at the surface.",
                answer: ["A"],
                explanation:
                  "Paragraph C: 'Lindqvist argues, however, that the discrepancy is far too large to be explained by sampling methods alone'.",
              },
              {
                n: 16,
                text: "Shellfish are probably a greater source of plastic in the human diet than fish.",
                answer: ["C"],
                explanation:
                  "Paragraph E: Arrieta 'regards shellfish, which are eaten whole, as a more significant route by which plastic enters the human diet'.",
              },
              {
                n: 17,
                text: "Some earlier studies may have reported more particles than were really present.",
                answer: ["E"],
                explanation:
                  "Paragraph G: Beaumont’s open dishes collected fibres from the air, 'which suggests that some earlier studies may have overestimated the number of particles in their samples'.",
              },
              {
                n: 18,
                text: "Only a small proportion of the plastic that has entered the sea is floating on its surface.",
                answer: ["A"],
                explanation:
                  "Paragraph C: in Lindqvist’s comparison 'the floating material accounted for less than three per cent of the total'. Hanamura (D) compared concentrations, not total amounts.",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the notes below.",
            wordLimit: 2,
            allowNumber: true,
            title: "Microplastics in the ocean",
            template: [
              "# Types of microplastic",
              "- pieces of plastic smaller than [[19]] millimetres",
              "- secondary microplastics: formed when larger objects are broken up by sunlight and [[20]]",
              "# Sources on land",
              "- fleece jackets: most fibres released in a wash are too short to be caught by the [[21]] in washing machines",
              "- tyre dust: carried from roads into drains and rivers by [[22]]",
              "- treatment plants: the captured plastic ends up in sewage [[23]], which is spread on farmland",
              "# Measuring plastic at sea",
              "- survey nets usually have a mesh of about [[24]] millimetres, so the smallest particles are missed",
            ].join("\n"),
            questions: [
              {
                n: 19,
                answer: ["five", "5"],
                explanation: "Paragraph A: 'Scientists use the term ‘microplastics’ for pieces smaller than five millimetres'.",
              },
              {
                n: 20,
                answer: ["waves"],
                explanation:
                  "Paragraph A: secondary microplastics are 'created when larger objects are gradually broken up by sunlight and waves'.",
              },
              {
                n: 21,
                answer: ["filters"],
                explanation:
                  "Paragraph B: the fibres were 'most of them too short to be caught by the filters in ordinary washing machines'.",
              },
              {
                n: 22,
                answer: ["rain"],
                explanation: "Paragraph B: vehicles leave a fine dust on roads, 'which rain carries into drains and rivers'.",
              },
              {
                n: 23,
                answer: ["sludge"],
                explanation:
                  "Paragraph B: 'The captured plastic ends up in sewage sludge, which in many countries is spread on farmland as fertiliser'.",
              },
              {
                n: 24,
                answer: ["0.33", "0.33 mm", "0.33 millimetres", "0.33 millimeters"],
                explanation:
                  "Paragraph C: 'The nets towed behind research vessels usually have a mesh of about 0.33 millimetres, so the smallest particles simply pass through them.'",
              },
            ],
          },
          {
            kind: "mcq-multi",
            instructions: "Answer the question below.",
            title: "Which TWO measures to reduce microplastic pollution does the writer say are already in use?",
            options: [
              { key: "A", text: "bans on plastic beads in cosmetic products" },
              { key: "B", text: "taxes on clothing made from synthetic fibres" },
              { key: "C", text: "tyres made from alternative materials" },
              { key: "D", text: "washing machines with filters that trap fibres" },
              { key: "E", text: "floating barriers that collect plastic from the surface" },
            ],
            questions: [
              {
                n: 25,
                answer: ["A", "D"],
                explanation:
                  "Paragraph G: 'A number of countries have banned plastic microbeads in cosmetics' (A) and 'several manufacturers now sell washing machines fitted with filters designed to trap fibres' (D). No alternative tyre material 'yet exists' (C), the barriers are only 'proposals' (E) and taxes (B) are never mentioned.",
              },
              {
                n: 26,
                answer: ["A", "D"],
                explanation:
                  "Paragraph G: 'A number of countries have banned plastic microbeads in cosmetics' (A) and 'several manufacturers now sell washing machines fitted with filters designed to trap fibres' (D). No alternative tyre material 'yet exists' (C), the barriers are only 'proposals' (E) and taxes (B) are never mentioned.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 3 — Questions 27–40 (multiple choice, YES/NO/NOT GIVEN, word box)
      // -----------------------------------------------------------------------
      {
        id: "passage-3",
        title: "Running on Empty?",
        subtitle: "The writer questions whether ‘decision fatigue’ deserves its reputation",
        paragraphs: [
          {
            text: "Few ideas from psychology have travelled as far beyond the laboratory as ‘decision fatigue’, the claim that every choice we make draws on a finite store of mental energy, so that by the end of a long day of deciding we are prone to impulsive or lazy judgements. The notion has been enthusiastically adopted by management consultants and the authors of productivity guides; it is cited to explain why some chief executives wear the same outfit every day and why weary shoppers succumb to sweets at the checkout. Its appeal is easy to understand. It flatters our experience of tiredness, supplies a tidy mechanism for our failings and implies a simple remedy. But the popularity of an idea is no measure of its truth, and in this case I suspect that intuitive plausibility has done far more work than evidence.",
          },
          {
            text: "The theory grew out of a model of self-control proposed in the 1990s, according to which resisting temptation, making choices and suppressing emotions all draw on a single limited reservoir. In a typical early experiment, volunteers who had spent twenty minutes choosing between pairs of holiday destinations kept a hand in iced water for a shorter time than those who had simply read descriptions of the same places. Dozens of similar studies followed, and for a while the effect appeared to be one of the most robust in social psychology. Yet the experiments shared a weakness that was not widely appreciated at the time: most involved small groups of students, and journals were far more willing to publish positive results than failures to find anything.",
          },
          {
            text: "Evidence from outside the laboratory seemed to settle the matter. The most widely quoted example is an analysis of some 4,000 planning applications decided by council officials in a large city, which found that approval rates fell steadily through each working session, from roughly 60 per cent to below 20 per cent, before recovering sharply after the officials’ breaks. The pattern is striking, but it is not self-explanatory. Later scrutiny of the council’s procedures revealed that applications were not considered in random order: straightforward cases, which are usually approved, tended to be scheduled early in each session, while complex or disputed ones, which are more often refused, were left until the end. A decline in approvals may therefore say more about the queue than about the minds of those clearing it.",
          },
          {
            text: "The laboratory findings have fared no better. When a consortium of twenty-three research groups attempted to reproduce the basic effect, using a common procedure and more than 2,000 participants, the result was close to zero. Supporters of the theory responded that the tasks used had been too brief or too undemanding to exhaust anyone, and that depletion appears only under particular conditions. This may be true, but it carries a cost. A hypothesis whose defenders can specify the conditions for its success only after an experiment has failed is in danger of becoming impossible to test, and a theory that cannot fail cannot, in any useful sense, succeed.",
          },
          {
            text: "There are, in any case, more economical explanations for the lapses that decision fatigue claims to explain. Several experiments have found that apparently depleted volunteers recover immediately when offered a small payment or told that the task matters, which is hard to reconcile with the idea that a physical resource has run out. Nor has the physiological story survived: the brain’s consumption of glucose rises only marginally during demanding thought, far too little to be exhausted by an afternoon of choosing between holidays. What seems to change during a long series of decisions is not capacity but priority. The mind behaves less like a battery running down than like a manager reallocating attention, turning away from tasks that appear to offer diminishing returns.",
          },
          {
            text: "None of this is to deny that people decide badly when they are exhausted. A surgeon at the end of a twenty-hour shift or a pilot who has been awake since dawn is plainly more likely to err, and it would be perverse to pretend otherwise. But that is ordinary fatigue, produced by lack of sleep and prolonged effort of any kind, and it requires no special theory about the cost of choosing. My objection is less to the observation than to the moral that is drawn from it. By presenting poor judgement as the inevitable consequence of an individual’s depleted willpower, the popular version of the idea diverts attention from the way work is organised: from the length of shifts, the scheduling of breaks and the order in which cases are presented.",
          },
          {
            text: "It does not follow that the advice offered in its name is worthless. Reducing the number of trivial choices in a day, relying on sensible defaults and protecting time for important decisions are all reasonable habits; they save time and spare attention, whatever the truth about mental energy. Institutions, too, could learn from the planning study, if not in the way its admirers intended: randomising the order of cases and building breaks into long sessions are cheap safeguards against a variety of biases. Decision fatigue, in short, is best treated as a metaphor, occasionally illuminating and frequently misleading, rather than as a law of the mind.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Answer the questions below.",
            questions: [
              {
                n: 27,
                text: "In the first paragraph, the writer suggests that the popularity of the idea of decision fatigue",
                options: [
                  { key: "A", text: "is the result of accurate reporting of scientific research." },
                  { key: "B", text: "has been limited mainly to people working in business." },
                  { key: "C", text: "owes more to how convincing the idea seems than to evidence." },
                  { key: "D", text: "is likely to decline once its weaknesses become known." },
                ],
                answer: ["C"],
                explanation:
                  "First paragraph: 'the popularity of an idea is no measure of its truth, and in this case I suspect that intuitive plausibility has done far more work than evidence.' The idea is also applied to shoppers (so not B), and the writer makes no prediction (D).",
              },
              {
                n: 28,
                text: "According to the writer, the early experiments on self-control",
                options: [
                  { key: "A", text: "produced results that were at first considered highly reliable." },
                  { key: "B", text: "were mainly carried out with experienced decision-makers." },
                  { key: "C", text: "were criticised at the time for relying on students." },
                  { key: "D", text: "showed that making choices was more tiring than resisting temptation." },
                ],
                answer: ["A"],
                explanation:
                  "Second paragraph: 'for a while the effect appeared to be one of the most robust in social psychology'. The studies used 'small groups of students' (not B), and their weakness 'was not widely appreciated at the time' (not C).",
              },
              {
                n: 29,
                text: "What does the writer say about the study of planning applications?",
                options: [
                  { key: "A", text: "It was based on an unusually small number of decisions." },
                  { key: "B", text: "It has since been repeated in several other cities." },
                  { key: "C", text: "The officials knew that their decisions were being studied." },
                  { key: "D", text: "The pattern it found may reflect the order in which cases were dealt with." },
                ],
                answer: ["D"],
                explanation:
                  "Third paragraph: 'applications were not considered in random order … A decline in approvals may therefore say more about the queue than about the minds of those clearing it.' The study covered 'some 4,000 planning applications', so A is wrong.",
              },
              {
                n: 30,
                text: "Why does the writer mention the project involving twenty-three research groups?",
                options: [
                  { key: "A", text: "to show that the original researchers had made errors in their calculations" },
                  { key: "B", text: "to suggest that the basic effect may be far weaker than was once believed" },
                  { key: "C", text: "to criticise the tasks that the research groups chose to use" },
                  { key: "D", text: "to show that supporters of the theory have now abandoned it" },
                ],
                answer: ["B"],
                explanation:
                  "Fourth paragraph: with 'more than 2,000 participants, the result was close to zero'. It was the theory’s supporters, not the writer, who criticised the tasks (C), and they defended the theory rather than abandoning it (D).",
              },
              {
                n: 31,
                text: "What does the writer mean by comparing the mind to ‘a manager reallocating attention’?",
                options: [
                  { key: "A", text: "People consciously plan how to use their mental energy each day." },
                  { key: "B", text: "Different areas of the brain compete for a limited supply of glucose." },
                  { key: "C", text: "Apparent fatigue may reflect a change in what seems worth doing." },
                  { key: "D", text: "Decision-making skills can be improved with training." },
                ],
                answer: ["C"],
                explanation:
                  "Fifth paragraph: 'What seems to change during a long series of decisions is not capacity but priority … turning away from tasks that appear to offer diminishing returns.'",
              },
            ],
          },
          {
            kind: "ynng",
            instructions: "Do the following statements agree with the claims of the writer in Reading Passage 3?",
            questions: [
              {
                n: 32,
                text: "A theory that can explain away every failed experiment is made stronger as a result.",
                answer: ["NO"],
                explanation:
                  "Fourth paragraph: such a hypothesis 'is in danger of becoming impossible to test, and a theory that cannot fail cannot, in any useful sense, succeed.'",
              },
              {
                n: 33,
                text: "A small reward can quickly reverse the effects of apparent mental depletion.",
                answer: ["YES"],
                explanation:
                  "Fifth paragraph: 'apparently depleted volunteers recover immediately when offered a small payment or told that the task matters'.",
              },
              {
                n: 34,
                text: "Tiredness caused by long working hours has little effect on the quality of people’s decisions.",
                answer: ["NO"],
                explanation:
                  "Sixth paragraph: 'A surgeon at the end of a twenty-hour shift or a pilot who has been awake since dawn is plainly more likely to err'.",
              },
              {
                n: 35,
                text: "Most organisations that promote the idea of decision fatigue do so deliberately to avoid improving working conditions.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Sixth paragraph: the writer says the popular version 'diverts attention from the way work is organised', but never says that organisations do this on purpose or how many of them promote the idea.",
              },
              {
                n: 36,
                text: "Some of the advice associated with decision fatigue is sensible even if the theory itself is wrong.",
                answer: ["YES"],
                explanation:
                  "Last paragraph: fewer trivial choices, sensible defaults and protected time 'are all reasonable habits; they save time and spare attention, whatever the truth about mental energy.'",
              },
            ],
          },
          {
            kind: "gap-box",
            instructions: "Complete the summary using the list of words, A–I, below.",
            title: "The writer’s view of decision fatigue",
            options: [
              { key: "A", text: "evidence" },
              { key: "B", text: "priority" },
              { key: "C", text: "memory" },
              { key: "D", text: "exhaustion" },
              { key: "E", text: "reward" },
              { key: "F", text: "organisation" },
              { key: "G", text: "temptation" },
              { key: "H", text: "reservoir" },
              { key: "I", text: "glucose" },
            ],
            template:
              "The writer accepts that [[37]] can impair people’s judgement, but rejects the claim that every choice draws on a limited [[38]] of mental energy. Changes in behaviour during a long series of decisions are better explained as shifts in [[39]]. The writer also objects that, by presenting poor decisions as a personal failing, the popular version of the idea distracts attention from the [[40]] of work. Even so, some of the advice linked to the theory remains useful.",
            questions: [
              {
                n: 37,
                answer: ["D"],
                explanation: "Sixth paragraph: 'None of this is to deny that people decide badly when they are exhausted.'",
              },
              {
                n: 38,
                answer: ["H"],
                explanation:
                  "Second paragraph: the theory holds that choices 'all draw on a single limited reservoir'; the fifth paragraph rejects the idea 'that a physical resource has run out'.",
              },
              {
                n: 39,
                answer: ["B"],
                explanation: "Fifth paragraph: 'What seems to change during a long series of decisions is not capacity but priority.'",
              },
              {
                n: 40,
                answer: ["F"],
                explanation:
                  "Sixth paragraph: the popular version of the idea 'diverts attention from the way work is organised: from the length of shifts, the scheduling of breaks and the order in which cases are presented.'",
              },
            ],
          },
        ],
      },
    ],
  },
  // ===========================================================================
  // AVERNA ACADEMIC READING 4 (Hard)
  // ===========================================================================
  {
    format: "exam-v2",
    skill: "READING",
    id: "averna-reading-04",
    title: "Averna Academic Reading 4",
    description:
      "Full Academic Reading test: four thousand years of glass-making from ancient furnaces to smartphone screens, the science of rebuilding damaged coral reefs, and an argument about whether automation will destroy more jobs than it creates. 3 passages, 40 questions, 60 minutes.",
    difficulty: "Hard",
    timeLimit: 60,
    topics: ["materials science", "history of technology", "marine ecology", "conservation", "economics", "automation and work"],
    source: "averna",
    parts: [
      // -----------------------------------------------------------------------
      // Passage 1 — Questions 1–13 (matching information, TRUE/FALSE/NOT GIVEN, sentences)
      // -----------------------------------------------------------------------
      {
        id: "passage-1",
        title: "From Furnace to Touchscreen",
        subtitle: "Four thousand years of glass-making",
        paragraphs: [
          {
            label: "A",
            text: "Glass is so ordinary today that it is easy to forget how extraordinary it once seemed. The earliest objects made entirely of glass, small beads produced in western Asia more than four thousand years ago, were treated as the equals of gemstones and were buried alongside gold and lapis lazuli. The raw materials were humble: sand, which supplies silica; an alkali such as the ash of desert plants, which lowers the temperature at which silica melts; and lime, which prevents the finished glass from slowly dissolving in water. The difficulty lay in the heat. Early furnaces could not reach the temperature needed to melt the mixture completely, and chemical analysis of beads from a hillside cemetery at Karsu, carried out by the archaeometrist Selin Aydın, has shown that their glass was melted, crushed and reheated several times before it was usable.",
          },
          {
            label: "B",
            text: "For some two thousand years glass remained a luxury, shaped by winding threads of molten material around a removable core of clay or by pressing it into moulds. Then, around the first century BCE, craftsmen in the eastern Mediterranean discovered that a blob of molten glass on the end of a hollow iron pipe could be inflated like a balloon. Glassblowing transformed the industry. A skilled worker could now make a thin-walled vessel in minutes rather than days, and within a few generations glass cups, jars and bottles had become everyday objects across the Roman world. The rubbish heaps of a single workshop excavated at Aquila Nova contained fragments of more than 12,000 vessels, most of them plain containers made for storing and transporting food. Window glass appeared too, although its small, thick, greenish panes admitted light rather than offering a clear view.",
          },
          {
            label: "C",
            text: "The next great advance was in clarity. Ordinary glass is tinted green or brown by traces of iron in the sand, and for centuries truly colourless glass was almost unobtainable. By the fifteenth century, glassmakers in northern Italy had learned to produce clear glass by using carefully purified plant ash and adding small quantities of manganese, which cancels out the green tint. The secrets were closely guarded. In at least one city, skilled glassworkers were forbidden to leave without permission, and those who set up furnaces abroad could have their property confiscated. Clear glass mattered for more than elegant tableware: it made possible better spectacle lenses and, eventually, the telescopes and microscopes on which the scientific revolution depended.",
          },
          {
            label: "D",
            text: "Flat glass remained stubbornly difficult to make. One traditional method involved spinning a blown bubble of glass into a disc more than a metre across, from which small panes were cut; another required blowing a long cylinder, slitting it and flattening it while still hot. Both left the glass slightly uneven, and the large plates needed for shop windows and mirrors had to be cast on iron tables and then ground and polished for many hours, a process that consumed up to half of the glass originally poured. When the architect Henrik Solberg designed the glass-roofed market hall at Dellwyn in the 1880s, he specified 38,000 panes, each small enough to be made by the cylinder method, simply because larger sheets were too expensive.",
          },
          {
            label: "E",
            text: "The problem was finally solved in the 1950s by a technique of startling simplicity. In the float process, molten glass is poured continuously onto a bath of molten tin. Because the glass is lighter than the tin, it floats on the surface and spreads out under its own weight into a perfectly level sheet, while the heat gives both faces a brilliant finish without any grinding or polishing. Making the idea work was far from simple: the first trial line ran for fourteen months before it produced a single sheet good enough to sell, and the tin had to be shielded from oxygen to prevent it from staining the glass. Once perfected, however, the process spread rapidly, and today the great majority of the world’s flat glass is made in this way.",
          },
          {
            label: "F",
            text: "Flatness, however, is not strength. Glass is very strong when it is squeezed but weak when it is stretched, and in practice it almost always breaks at microscopic scratches and cracks on its surface, which concentrate stress at their tips. Engineers therefore strengthen glass by putting its surface under permanent compression, so that a crack must overcome this squeezing force before it can grow. In thermal toughening, a sheet is heated and its surfaces are then cooled rapidly with jets of air. Chemical strengthening achieves a similar effect by a different route: the glass is immersed in a bath of molten potassium salt, and potassium ions from the bath exchange places with the smaller sodium ions in the surface layer. Crowded into spaces intended for smaller atoms, the larger ions press against one another and create a compressed skin.",
          },
          {
            label: "G",
            text: "It is this chemical method, applied to specially formulated glasses rich in aluminium, that protects the screens of most smartphones. The demands on such glass are contradictory. A screen must be thin enough to respond to the lightest touch, yet it must survive being dropped onto concrete and resist the scratches caused by grains of sand in a pocket, and a composition that improves one property often weakens another. Laboratory tests by the materials scientist Priya Raman found that the glass which resisted scratching best was also the one most likely to shatter when dropped from waist height. The latest challenge is flexibility: glass less than a tenth of a millimetre thick can bend around a tight curve, bringing folding phones within reach. Four thousand years after the first beads, glass-making remains an unfinished craft.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions: "Reading Passage 1 has seven paragraphs, A–G. Which paragraph contains the following information?",
            options: [
              { key: "A", text: "Paragraph A" },
              { key: "B", text: "Paragraph B" },
              { key: "C", text: "Paragraph C" },
              { key: "D", text: "Paragraph D" },
              { key: "E", text: "Paragraph E" },
              { key: "F", text: "Paragraph F" },
              { key: "G", text: "Paragraph G" },
            ],
            allowReuse: true,
            questions: [
              {
                n: 1,
                text: "an explanation of how tiny surface flaws cause glass to break",
                answer: ["F"],
                explanation:
                  "Paragraph F: glass 'almost always breaks at microscopic scratches and cracks on its surface, which concentrate stress at their tips'.",
              },
              {
                n: 2,
                text: "a reference to glass objects being valued as highly as precious stones",
                answer: ["A"],
                explanation:
                  "Paragraph A: the earliest beads 'were treated as the equals of gemstones and were buried alongside gold and lapis lazuli'.",
              },
              {
                n: 3,
                text: "an example of a building design that was influenced by the cost of glass",
                answer: ["D"],
                explanation:
                  "Paragraph D: Solberg 'specified 38,000 panes, each small enough to be made by the cylinder method, simply because larger sheets were too expensive'.",
              },
              {
                n: 4,
                text: "a production method in which a large proportion of the glass was wasted",
                answer: ["D"],
                explanation:
                  "Paragraph D: plate glass was 'ground and polished for many hours, a process that consumed up to half of the glass originally poured'. The broken vessels in Paragraph B were rubbish, not material lost during manufacture.",
              },
            ],
          },
          {
            kind: "tfng",
            instructions: "Do the following statements agree with the information given in Reading Passage 1?",
            questions: [
              {
                n: 5,
                text: "Lime was added to early glass to lower the temperature at which the mixture melted.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph A: it is the alkali 'which lowers the temperature at which silica melts'; lime is used because it 'prevents the finished glass from slowly dissolving in water'.",
              },
              {
                n: 6,
                text: "Most of the vessels found at the Aquila Nova workshop were intended for practical rather than decorative use.",
                answer: ["TRUE"],
                explanation: "Paragraph B: the fragments were 'most of them plain containers made for storing and transporting food'.",
              },
              {
                n: 7,
                text: "Glassworkers who left the city without permission could be sent to prison.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph C: glassworkers who set up furnaces abroad 'could have their property confiscated', but imprisonment is never mentioned.",
              },
              {
                n: 8,
                text: "The market hall at Dellwyn was the largest glass-roofed building of its time.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Paragraph D gives the number of panes in the Dellwyn market hall (38,000) but does not compare its size with that of any other building.",
              },
              {
                n: 9,
                text: "The float process was adopted quickly once its technical problems had been overcome.",
                answer: ["TRUE"],
                explanation: "Paragraph E: after the early difficulties, 'Once perfected, however, the process spread rapidly'.",
              },
              {
                n: 10,
                text: "Priya Raman found that the glass most resistant to scratching was also the best at surviving a fall.",
                answer: ["FALSE"],
                explanation:
                  "Paragraph G: 'the glass which resisted scratching best was also the one most likely to shatter when dropped from waist height.'",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the sentences below.",
            wordLimit: 1,
            questions: [
              {
                n: 11,
                text: "Engineers make glass stronger by keeping its surface under permanent [[11]].",
                answer: ["compression"],
                explanation: "Paragraph F: 'Engineers therefore strengthen glass by putting its surface under permanent compression'.",
              },
              {
                n: 12,
                text: "In chemical strengthening, sodium ions in the surface layer are replaced by ions of [[12]] from a bath of molten salt.",
                answer: ["potassium"],
                explanation:
                  "Paragraph F: 'potassium ions from the bath exchange places with the smaller sodium ions in the surface layer'.",
              },
              {
                n: 13,
                text: "Most smartphone screens are made from specially formulated glass that is rich in [[13]].",
                answer: ["aluminium", "aluminum"],
                explanation:
                  "Paragraph G: the chemical method is 'applied to specially formulated glasses rich in aluminium', which 'protects the screens of most smartphones'.",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 2 — Questions 14–26 (matching headings, flow-chart, choose TWO)
      // -----------------------------------------------------------------------
      {
        id: "passage-2",
        title: "Gardening the Reef",
        subtitle: "Scientists and conservationists are trying to rebuild coral reefs faster than they are being destroyed",
        paragraphs: [
          {
            label: "A",
            text: "Coral reefs occupy less than one per cent of the ocean floor, yet they shelter roughly a quarter of all known marine species and protect millions of people living on tropical coasts from storm waves. They are also among the ecosystems most threatened by human activity. Pollution, overfishing and destructive practices such as blast fishing have damaged reefs for decades, but the gravest threat is now heat. When the sea stays unusually warm for several weeks, corals expel the microscopic algae that live in their tissues and supply most of their food, and turn a ghostly white. This ‘bleaching’ is not immediately fatal, but if the heat persists, the corals starve.",
          },
          {
            label: "B",
            text: "Left alone, a damaged reef can recover. Fragments of surviving coral regrow, and larvae drifting in from neighbouring reefs settle and form new colonies; for the fastest-growing species, the process typically takes ten to fifteen years. The difficulty is that reefs are no longer being left alone for long enough. At Tanaroa Atoll in the western Pacific, where monitoring began in 1998, severe bleaching struck three times between 2014 and 2022, each time before the corals had fully recovered from the previous event, and coral cover on the atoll’s outer slopes fell from 46 per cent to 11 per cent. Restoration is an attempt to speed up the natural process, giving reefs a head start between disturbances that are arriving ever more often.",
          },
          {
            label: "C",
            text: "The most widely used technique is known as coral gardening. Divers snap small fragments from healthy colonies, a procedure that rarely harms the donor, and hang them from frames of plastic pipe anchored in sheltered water, which resemble underwater washing lines or Christmas trees. Raised off the sea floor, the fragments are safe from sediment and many predators, and branching species can grow several times faster than they would on the reef. After six to twelve months they are fixed to damaged areas with cement, cable ties or steel nails. The Lumbara Reef Project, run jointly by a university and a group of fishing villages, has transplanted more than 45,000 fragments since 2016, and its nurseries have become an attraction for visiting divers, whose fees cover part of the cost.",
          },
          {
            label: "D",
            text: "Yet gardening has clear limitations. It is labour-intensive: every fragment must be cut, hung, cleaned and planted by hand, and the marine ecologist Farida Osei estimates that restoring a single hectare in this way costs between 100,000 and 400,000 dollars. Survival after transplanting varies enormously from site to site. Because nurseries are usually stocked from a small number of donor colonies, the corals planted on a reef may be almost genetically identical, and therefore equally vulnerable to the next heatwave or disease. Above all, there is the problem of scale. Osei’s review of 180 projects found that the typical project restored less than one hectare, and that fewer than a third had monitored their corals for longer than eighteen months.",
          },
          {
            label: "E",
            text: "A second approach exploits the way corals reproduce. On a few nights each year, often timed by the phase of the moon, many corals release eggs and sperm into the water at the same moment, and the resulting slicks can stretch for kilometres across the surface. Researchers now skim this spawn, fertilise it and rear the larvae for about a week in floating pools moored near the reef. The larvae are then released over damaged areas or allowed to settle on small ceramic tiles, which are later wedged into cracks in the reef. Because each spawning produces millions of genetically distinct larvae, the method can restore diversity as well as coral cover. Its weakness is survival: in trials at Karang Merah, fewer than one per cent of settled corals were still alive after a year, although the sheer numbers involved partly compensate for these losses.",
          },
          {
            label: "F",
            text: "Some reefs cannot recover even with such help, because the sea floor itself has been destroyed. Blast fishing and severe storms can reduce a reef to fields of loose rubble that shift with every swell, crushing or burying any young coral that settles there. In such places, restoration begins with engineering. At Sepora Bay, a conservation group has fixed more than 9,000 hexagonal concrete modules to the rubble, interlocking them so that they cannot roll, and has planted coral fragments on their upper surfaces. Within four years, coral cover on the treated area rose from under 5 per cent to more than 50 per cent, and surveys recorded three times as many fish as on untreated rubble nearby. The modules are expensive to make and install, but they provide what neither gardening nor seeding can: a stable place to grow.",
          },
          {
            label: "G",
            text: "The most ambitious proposals go further, aiming to help corals adapt to warmer seas rather than simply replacing those that have died. Researchers are breeding corals from parents that survived severe bleaching, in the hope of producing heat-tolerant offspring, and some have proposed moving corals from naturally hot reefs to cooler ones. The coral biologist Mateo Ibarra warns that such ‘assisted evolution’ could spread disease or reduce the genetic variety that allows reefs to cope with change. Others raise a more fundamental objection: by suggesting that reefs can be repaired, restoration may distract governments from cutting the greenhouse gas emissions that are warming the oceans in the first place. Most restoration scientists accept that their work cannot save reefs on its own. What it can do, they argue, is buy time.",
          },
        ],
        groups: [
          {
            kind: "matching",
            instructions:
              "Reading Passage 2 has seven paragraphs, A–G. Choose the correct heading for each paragraph from the list of headings below.",
            title: "List of Headings",
            options: [
              { key: "i", text: "Harnessing the reproductive cycle of corals" },
              { key: "ii", text: "The role of tourism in funding reef repair" },
              { key: "iii", text: "A valuable habitat under growing pressure" },
              { key: "iv", text: "Providing a stable foundation" },
              { key: "v", text: "Corals that thrive in warmer water" },
              { key: "vi", text: "The drawbacks of a popular method" },
              { key: "vii", text: "Why natural recovery may no longer be enough" },
              { key: "viii", text: "Buying time or avoiding the real problem?" },
              { key: "ix", text: "International rules to protect reefs" },
              { key: "x", text: "Raising young corals in underwater nurseries" },
            ],
            allowReuse: false,
            questions: [
              {
                n: 14,
                text: "Paragraph A",
                answer: ["iii"],
                explanation:
                  "Paragraph A: reefs 'shelter roughly a quarter of all known marine species' yet 'are also among the ecosystems most threatened by human activity', above all by heat.",
              },
              {
                n: 15,
                text: "Paragraph B",
                answer: ["vii"],
                explanation:
                  "Paragraph B: natural recovery 'typically takes ten to fifteen years', but 'reefs are no longer being left alone for long enough'.",
              },
              {
                n: 16,
                text: "Paragraph C",
                answer: ["x"],
                explanation:
                  "Paragraph C: in coral gardening, fragments are hung on frames 'anchored in sheltered water' and grown for 'six to twelve months' before transplanting. The divers’ fees (ii) are only a detail.",
              },
              {
                n: 17,
                text: "Paragraph D",
                answer: ["vi"],
                explanation:
                  "Paragraph D: 'Yet gardening has clear limitations' — cost, uneven survival, low genetic variety and scale. Paragraph C calls gardening 'The most widely used technique'.",
              },
              {
                n: 18,
                text: "Paragraph E",
                answer: ["i"],
                explanation: "Paragraph E: 'A second approach exploits the way corals reproduce', collecting spawn and rearing the larvae.",
              },
              {
                n: 19,
                text: "Paragraph F",
                answer: ["iv"],
                explanation:
                  "Paragraph F: on shifting rubble 'restoration begins with engineering'; the concrete modules provide 'a stable place to grow'.",
              },
              {
                n: 20,
                text: "Paragraph G",
                answer: ["viii"],
                explanation:
                  "Paragraph G: critics fear restoration 'may distract governments from cutting the greenhouse gas emissions', while scientists argue that what it can do 'is buy time'. Breeding heat-tolerant corals (v) is only one of the proposals discussed.",
              },
            ],
          },
          {
            kind: "gap",
            instructions: "Complete the flow-chart below.",
            wordLimit: 3,
            allowNumber: true,
            title: "Larval seeding",
            template: [
              "Spawn is skimmed from the [[21]] that form on the sea surface on a few nights each year.",
              "↓",
              "The eggs are fertilised and the larvae are reared for about a week in [[22]] moored near the reef.",
              "↓",
              "The larvae are released over damaged areas or settle on small [[23]], which are then wedged into cracks in the reef.",
              "↓",
              "After a year, fewer than [[24]] of the settled corals are still alive.",
            ].join("\n"),
            questions: [
              {
                n: 21,
                answer: ["slicks"],
                explanation:
                  "Paragraph E: corals release eggs and sperm at the same moment, 'and the resulting slicks can stretch for kilometres across the surface. Researchers now skim this spawn'.",
              },
              {
                n: 22,
                answer: ["(floating) pools"],
                explanation: "Paragraph E: researchers 'rear the larvae for about a week in floating pools moored near the reef'.",
              },
              {
                n: 23,
                answer: ["(ceramic) tiles"],
                explanation:
                  "Paragraph E: the larvae are 'allowed to settle on small ceramic tiles, which are later wedged into cracks in the reef'.",
              },
              {
                n: 24,
                answer: ["one per cent", "1 per cent", "1%", "one percent", "1 percent"],
                explanation:
                  "Paragraph E: 'in trials at Karang Merah, fewer than one per cent of settled corals were still alive after a year'.",
              },
            ],
          },
          {
            kind: "mcq-multi",
            instructions: "Answer the question below.",
            title: "Which TWO criticisms of reef restoration are mentioned in the passage?",
            options: [
              { key: "A", text: "It can reduce the genetic variety of the corals on a reef." },
              { key: "B", text: "It has made reefs less attractive to tourists." },
              { key: "C", text: "It may discourage efforts to cut greenhouse gas emissions." },
              { key: "D", text: "It seriously damages the colonies from which fragments are taken." },
              { key: "E", text: "It has been proved to spread disease between reefs." },
            ],
            questions: [
              {
                n: 25,
                answer: ["A", "C"],
                explanation:
                  "A: nursery corals 'may be almost genetically identical' (Paragraph D) and assisted evolution could 'reduce the genetic variety' (Paragraph G). C: restoration 'may distract governments from cutting the greenhouse gas emissions' (Paragraph G). Taking fragments 'rarely harms the donor' (D), nurseries attract divers (B), and disease is only a possible risk (E).",
              },
              {
                n: 26,
                answer: ["A", "C"],
                explanation:
                  "A: nursery corals 'may be almost genetically identical' (Paragraph D) and assisted evolution could 'reduce the genetic variety' (Paragraph G). C: restoration 'may distract governments from cutting the greenhouse gas emissions' (Paragraph G). Taking fragments 'rarely harms the donor' (D), nurseries attract divers (B), and disease is only a possible risk (E).",
              },
            ],
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Passage 3 — Questions 27–40 (multiple choice, YES/NO/NOT GIVEN, word box)
      // -----------------------------------------------------------------------
      {
        id: "passage-3",
        title: "The Machines and the Jobs",
        subtitle: "Will automation destroy more work than it creates? The writer argues that this is the wrong question",
        paragraphs: [
          {
            text: "Predictions that machines will make human labour redundant are almost as old as machines themselves. Textile workers wrecked mechanical looms in the early nineteenth century; commentators in the 1930s blamed the Depression on labour-saving inventions; and every subsequent wave of innovation, from the assembly line to the personal computer, has been accompanied by forecasts of mass joblessness. Each time, the forecasts have proved wrong, at least in aggregate: employment has grown, and in most wealthy countries a larger share of adults is in paid work today than a century ago. It is tempting to conclude that the current anxiety about artificial intelligence and robotics is merely the latest instance of a recurring false alarm. I think that conclusion is broadly correct, but for reasons that should make us considerably less comfortable than it implies.",
          },
          {
            text: "The optimistic case rests on a mechanism that is easy to state. Automation lowers the cost of producing whatever it touches, and lower costs translate into lower prices, higher profits or higher wages, usually some combination of the three. The money thus released is spent elsewhere, generating demand for goods and services that may not previously have existed. Moreover, machines rarely take over entire occupations; they perform tasks, and when routine tasks are automated, the less routine ones that remain often become more valuable. When the labour economist Ines Marchetti studied warehouses that had introduced robotic trolleys, she found that the number of staff employed to pick goods from shelves fell by a third, yet total employment at the sites rose, because faster deliveries attracted more orders and created work in maintenance, packing and customer service.",
          },
          {
            text: "The historical record, then, offers little support for the belief that technology steadily reduces the total quantity of work. But aggregates conceal as much as they reveal. The jobs a technology creates are rarely the same jobs, in the same places, filled by the same people, as those it destroys. A study by Tomasz Wierzbicki of towns that lost their principal factory to automation between 1980 and 2000 found that, ten years later, fewer than half of the displaced workers had found jobs paying as much as the ones they had lost, and that many of those over fifty never worked again. National statistics recorded a smooth transition; the people concerned experienced a catastrophe. To say that automation creates more jobs than it destroys is rather like telling a non-swimmer that a river is, on average, only a metre deep: accurate, and of no practical help.",
          },
          {
            text: "Is this time different? The strongest argument that it might be concerns the range of tasks now open to machines. Earlier waves of automation mostly replaced physical effort and routine calculation, leaving untouched the tasks that demand judgement, language and social skill, into which displaced workers could move. Software that can draft contracts, summarise medical records and answer customers’ questions encroaches on precisely those refuges. If machines become capable of most of what the average worker does, the mechanism described above could stall, because there would be fewer tasks left in which humans retained an advantage.",
          },
          {
            text: "I find this argument serious but not decisive. The capabilities of new systems are routinely overestimated in the early stages of their adoption, when demonstrations are impressive and the costs of integrating them into real organisations are not yet visible. A technology that performs a task in a laboratory may take decades to transform the industries that could use it: electric motors raised productivity in factories only after buildings, production processes and management habits had been redesigned around them, a process that took the best part of forty years. Moreover, the demand for human attention in care, education and hospitality appears almost limitless, and these are precisely the fields in which people value human presence for its own sake. A robot that can lift a frail patient is useful; few of us would wish it to be the only company that patient receives.",
          },
          {
            text: "Where I part company with the optimists is over the assumption that the transition will look after itself. The pace at which workers can retrain is constrained by age, geography and the cost of education; the pace at which technology is deployed is constrained mainly by capital, and capital moves quickly. When the gains from automation flow chiefly to the owners of machines and to the highly educated workers whose skills complement them, while the losses fall on those with the fewest resources to adapt, the result may be an economy with plenty of jobs and a growing number of people who feel, not without reason, that the jobs available to them are worse than the ones they had. That is a political problem as much as an economic one, and it is not solved by pointing to employment figures.",
          },
          {
            text: "Whether automation will destroy more jobs than it creates is therefore, in my view, the wrong question. It will almost certainly not abolish work, and it will almost certainly generate occupations that we cannot yet name. What it will also do, unless societies decide otherwise, is redistribute income and security in ways that markets alone will not correct. The useful questions concern who bears the costs of change and how quickly they can be helped to move on: the generosity of unemployment insurance, the availability of training in mid-career, and the willingness of governments to support struggling places as well as people. Machines do not decide how their gains are shared. We do.",
          },
        ],
        groups: [
          {
            kind: "mcq",
            instructions: "Answer the questions below.",
            questions: [
              {
                n: 27,
                text: "The writer refers to earlier predictions about machines in the first paragraph in order to",
                options: [
                  { key: "A", text: "argue that the present wave of automation is unlike any before." },
                  { key: "B", text: "show that fears of mass unemployment have repeatedly proved mistaken." },
                  { key: "C", text: "criticise economists for failing to foresee technological change." },
                  { key: "D", text: "suggest that workers were right to resist new machinery." },
                ],
                answer: ["B"],
                explanation:
                  "First paragraph: every wave of innovation 'has been accompanied by forecasts of mass joblessness. Each time, the forecasts have proved wrong, at least in aggregate'. Whether this time is different (A) is only discussed later.",
              },
              {
                n: 28,
                text: "What did Ines Marchetti’s study of warehouses show?",
                options: [
                  { key: "A", text: "Robots increased the workload of the remaining pickers." },
                  { key: "B", text: "Most of the pickers who lost their jobs were retrained in maintenance." },
                  { key: "C", text: "Automation reduced one type of job but increased employment overall." },
                  { key: "D", text: "Faster deliveries led to lower prices for customers." },
                ],
                answer: ["C"],
                explanation:
                  "Second paragraph: 'the number of staff employed to pick goods from shelves fell by a third, yet total employment at the sites rose'. Who filled the new jobs (B) and prices (D) are not mentioned.",
              },
              {
                n: 29,
                text: "The writer compares the effects of automation to a river that is ‘on average, only a metre deep’ in order to show that",
                options: [
                  { key: "A", text: "official employment statistics are often inaccurate." },
                  { key: "B", text: "displaced workers should have prepared themselves for change." },
                  { key: "C", text: "the effects of automation are difficult to predict." },
                  { key: "D", text: "an overall figure may hide serious harm to particular people." },
                ],
                answer: ["D"],
                explanation:
                  "Third paragraph: 'National statistics recorded a smooth transition; the people concerned experienced a catastrophe.' The average is 'accurate, and of no practical help', so A is wrong.",
              },
              {
                n: 30,
                text: "According to the writer, the strongest reason for thinking that the current wave of automation might be different is that",
                options: [
                  { key: "A", text: "it affects the kinds of tasks into which displaced workers used to move." },
                  { key: "B", text: "machines have become much cheaper than in the past." },
                  { key: "C", text: "it is taking place mainly in service industries." },
                  { key: "D", text: "workers today are less willing to change occupation." },
                ],
                answer: ["A"],
                explanation:
                  "Fourth paragraph: earlier automation left 'the tasks that demand judgement, language and social skill, into which displaced workers could move', but new software 'encroaches on precisely those refuges'.",
              },
            ],
          },
          {
            kind: "ynng",
            instructions: "Do the following statements agree with the claims of the writer in Reading Passage 3?",
            questions: [
              {
                n: 31,
                text: "New technologies tend to be regarded as more capable than they really are when they first appear.",
                answer: ["YES"],
                explanation:
                  "Fifth paragraph: 'The capabilities of new systems are routinely overestimated in the early stages of their adoption'.",
              },
              {
                n: 32,
                text: "Electric motors raised factory productivity soon after they were introduced.",
                answer: ["NO"],
                explanation:
                  "Fifth paragraph: electric motors raised productivity 'only after buildings, production processes and management habits had been redesigned around them, a process that took the best part of forty years.'",
              },
              {
                n: 33,
                text: "Jobs in care and education are better paid than jobs in manufacturing.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Fifth paragraph: the writer says demand for care, education and hospitality 'appears almost limitless', but says nothing about how well these jobs are paid compared with manufacturing.",
              },
              {
                n: 34,
                text: "Workers can usually retrain as quickly as new technology is introduced.",
                answer: ["NO"],
                explanation:
                  "Sixth paragraph: retraining 'is constrained by age, geography and the cost of education', whereas technology is constrained 'mainly by capital, and capital moves quickly'.",
              },
              {
                n: 35,
                text: "People may have good reason to feel dissatisfied even when plenty of work is available.",
                answer: ["YES"],
                explanation:
                  "Sixth paragraph: there may be 'plenty of jobs and a growing number of people who feel, not without reason, that the jobs available to them are worse than the ones they had'.",
              },
              {
                n: 36,
                text: "Policies that support struggling regions have generally been more effective than those aimed at individuals.",
                answer: ["NOT GIVEN"],
                explanation:
                  "Last paragraph: the writer wants governments 'to support struggling places as well as people', but does not compare how effective the two kinds of policy have been.",
              },
            ],
          },
          {
            kind: "gap-box",
            instructions: "Complete the summary using the list of words, A–I, below.",
            title: "The writer’s position on automation",
            options: [
              { key: "A", text: "productivity" },
              { key: "B", text: "training" },
              { key: "C", text: "distribution" },
              { key: "D", text: "wages" },
              { key: "E", text: "work" },
              { key: "F", text: "machines" },
              { key: "G", text: "experience" },
              { key: "H", text: "regulation" },
              { key: "I", text: "competition" },
            ],
            template:
              "The writer believes that automation is unlikely to reduce the total amount of [[37]], and that it will probably create new occupations. The real danger lies in the [[38]] of its costs and benefits: the gains tend to go to highly educated workers and to those who own the [[39]], while the losses fall on the people least able to adapt. The writer therefore argues that attention should turn to matters such as unemployment insurance, mid-career [[40]] and support for struggling places.",
            questions: [
              {
                n: 37,
                answer: ["E"],
                explanation:
                  "Third paragraph: history offers 'little support for the belief that technology steadily reduces the total quantity of work'; last paragraph: 'It will almost certainly not abolish work'.",
              },
              {
                n: 38,
                answer: ["C"],
                explanation:
                  "Last paragraph: automation will 'redistribute income and security in ways that markets alone will not correct', so the useful questions concern 'who bears the costs of change'.",
              },
              {
                n: 39,
                answer: ["F"],
                explanation:
                  "Sixth paragraph: 'the gains from automation flow chiefly to the owners of machines and to the highly educated workers whose skills complement them'.",
              },
              {
                n: 40,
                answer: ["B"],
                explanation: "Last paragraph: the writer points to 'the availability of training in mid-career'.",
              },
            ],
          },
        ],
      },
    ],
  },
];
