export type QuestionType = "multiple-choice" | "true-false-not-given" | "sentence-completion";

export interface ReadingQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: number | string;
  /** Short 1-2 sentence explanation shown on the result page after submission. */
  explanation?: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  text: string;
  questions: ReadingQuestion[];
}

export interface ReadingTest {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  passages: ReadingPassage[];
}

export const READING_TESTS: Record<string, ReadingTest> = {
  "academic-1": {
    id: "academic-1",
    title: "Academic Reading Test 1",
    description: "Technology and Innovation",
    timeLimit: 60,
    passages: [
      {
        id: "passage-1",
        title: "The History of Artificial Intelligence",
        text: `Artificial Intelligence (AI) has evolved dramatically since its inception in the mid-20th century. The term "artificial intelligence" was first coined by John McCarthy in 1956 at the Dartmouth Conference, where he and other pioneers gathered to discuss the possibility of creating machines that could simulate human intelligence.

The early years of AI research were marked by both optimism and significant challenges. In the 1960s and 1970s, researchers developed programs that could solve algebra problems, prove theorems, and understand natural language to a limited extent. However, these systems were often brittle and could only handle problems in narrow domains. Government funding, particularly from the United States military, poured into projects that promised human-like reasoning within a decade — a promise that quickly proved unrealistic.

The 1980s saw the rise of expert systems, which used rule-based approaches to encode human expertise in specific fields such as medicine and engineering. While these systems achieved some commercial success, they were expensive to develop and maintain. Every new problem required painstaking effort by knowledge engineers who had to interview experts and translate their reasoning into thousands of if-then rules. This bottleneck, combined with the systems' inability to handle situations outside their programming, led to what became known as the "AI winter" — a period of reduced funding and interest in AI research that stretched from the late 1980s into the mid-1990s.

The resurgence of AI in the 21st century has been driven largely by advances in machine learning, particularly deep learning. Rather than being explicitly programmed with rules, these techniques allow computers to learn patterns from vast amounts of data. Three factors made this possible: the accumulation of enormous digital datasets, dramatic increases in computer processing power, and refinements to older mathematical models called neural networks. Today, AI systems can recognise speech, translate languages, identify objects in images, and even compete at the highest levels in complex games like chess and Go.

Despite these impressive achievements, current AI systems still lack many capabilities that humans take for granted, such as common sense reasoning, genuine understanding, and the ability to learn from small amounts of data. A child can learn to recognise a giraffe after seeing one picture; most AI systems require thousands. Researchers continue to work on these challenges, aiming to develop more general and flexible AI systems that might one day match — or exceed — the breadth of human intelligence.`,
        questions: [
          { id: "q1", type: "multiple-choice", question: "Who first coined the term 'artificial intelligence'?", options: ["Alan Turing", "John McCarthy", "The US military", "A group at Stanford"], correctAnswer: 1, explanation: "The passage: 'The term artificial intelligence was first coined by John McCarthy in 1956 at the Dartmouth Conference.'" },
          { id: "q2", type: "multiple-choice", question: "According to the passage, what was one main cause of the 'AI winter'?", options: ["A worldwide shortage of computers", "Governments banning AI research", "The high cost and limited flexibility of expert systems", "Deep learning replacing older methods"], correctAnswer: 2, explanation: "Expert systems were 'expensive to develop and maintain' and had an 'inability to handle situations outside their programming' — together causing the AI winter." },
          { id: "q3", type: "multiple-choice", question: "Which THREE factors together enabled the AI resurgence in the 21st century?", options: ["Faster software, cheaper hardware, and simpler algorithms", "Big datasets, better processing power, and refined neural networks", "Government funding, expert systems, and machine learning", "Rule-based approaches, cloud computing, and open-source code"], correctAnswer: 1, explanation: "Named directly: 'the accumulation of enormous digital datasets, dramatic increases in computer processing power, and refinements to older mathematical models called neural networks'." },
          { id: "q4", type: "true-false-not-given", question: "Early AI programs could only solve problems in specific, narrow areas.", correctAnswer: "true", explanation: "TRUE. Early AI systems 'could only handle problems in narrow domains'." },
          { id: "q5", type: "true-false-not-given", question: "Expert systems were cheap to develop and maintain.", correctAnswer: "false", explanation: "FALSE. Expert systems 'were expensive to develop and maintain' — the opposite of cheap." },
          { id: "q6", type: "true-false-not-given", question: "The AI winter began in the early 1970s.", correctAnswer: "false", explanation: "FALSE. The AI winter 'stretched from the late 1980s into the mid-1990s' — not the 1970s." },
          { id: "q7", type: "true-false-not-given", question: "Modern AI systems can learn new categories from just a few examples as easily as humans do.", correctAnswer: "false", explanation: "FALSE. The passage contrasts: a child learns from one picture, but 'most AI systems require thousands'." },
          { id: "q8", type: "true-false-not-given", question: "Deep learning was invented after the year 2010.", correctAnswer: "not-given", explanation: "NOT GIVEN. The passage credits deep learning for the resurgence but never gives its invention date." },
          { id: "q9", type: "sentence-completion", question: "Current AI systems still lack ___________ that humans possess naturally.", correctAnswer: "common sense reasoning", explanation: "'common sense reasoning' — the first item in the list of what AI still lacks." },
          { id: "q10", type: "sentence-completion", question: "The 1956 conference at ___________ marked the beginning of AI as a field.", correctAnswer: "Dartmouth", explanation: "'Dartmouth' — 'the Dartmouth Conference' is named as the 1956 birthplace of the field." },
        ],
      },
      {
        id: "passage-2",
        title: "The Rise of Social Media",
        text: `Fewer than twenty years ago, most people had never heard of a "social network." Today, more than half of the world's population uses at least one social media platform, and the way we share news, form friendships, and even conduct business has been transformed. The rapid ascent of these platforms — from Friendster and MySpace in the early 2000s to Facebook, Instagram, TikTok and X today — represents one of the fastest social changes in modern history.

The appeal of social media lies in its ability to satisfy several human needs at once. It allows us to maintain connections with distant friends and family, to receive validation through likes and comments, and to gather information faster than any traditional news source could deliver it. Businesses quickly recognised its commercial potential: instead of paying for expensive television advertisements, small companies could reach thousands of potential customers directly. Political movements, too, have used social media to organise protests, spread messages and, in some countries, to challenge established governments.

However, these benefits have come with costs that are only now becoming clear. Researchers have linked heavy social media use, particularly among teenagers, to rising rates of anxiety, sleep disruption and body-image concerns. Some studies suggest that the constant comparison with the curated online lives of others creates a persistent sense of inadequacy. Others point to the fact that platforms are deliberately designed to be addictive: notifications, endless scrolling and personalised recommendations all aim to keep users on the app for as long as possible, because attention translates directly into advertising revenue.

Another concern is the spread of misinformation. Because posts that provoke strong emotions travel further and faster than dry factual reporting, social media algorithms tend to amplify sensational content, whether accurate or not. False stories about elections, vaccines and climate change have all spread widely, sometimes with serious real-world consequences. In response, some platforms have introduced fact-checking labels, while several governments have proposed new laws to hold companies accountable for the content they distribute.

The debate over the future of social media is intensifying. Some argue for stricter regulation and even breaking up the largest companies, on the grounds that their influence is now too great. Others believe that heavy-handed rules would damage free speech and stifle innovation. What seems clear is that the platforms are here to stay in some form — but the shape they eventually take will depend on decisions made by users, governments and technology companies over the coming decade.`,
        questions: [
          { id: "q11", type: "multiple-choice", question: "According to the passage, one reason social media appeals to users is that it…", options: ["is always more accurate than traditional news.", "satisfies several human needs simultaneously.", "replaces face-to-face friendships entirely.", "is completely free of advertising."], correctAnswer: 1, explanation: "Social media 'satisfies several human needs at once' — connection, validation, and information." },
          { id: "q12", type: "multiple-choice", question: "Why do social media algorithms tend to amplify sensational content?", options: ["Because governments require it.", "Because emotional posts travel further and hold user attention.", "Because users prefer reading longer factual articles.", "Because platforms cannot control what they show."], correctAnswer: 1, explanation: "'Posts that provoke strong emotions travel further and faster', and attention 'translates directly into advertising revenue'." },
          { id: "q13", type: "multiple-choice", question: "Which of the following is NOT mentioned in the passage as an effect of heavy social media use?", options: ["Anxiety", "Body-image concerns", "Physical strength", "Sleep disruption"], correctAnswer: 2, explanation: "'Physical strength' is not listed. The passage names anxiety, sleep disruption and body-image concerns only." },
          { id: "q14", type: "true-false-not-given", question: "Most of the world's population now uses at least one social media platform.", correctAnswer: "true", explanation: "TRUE. 'more than half of the world's population uses at least one social media platform'." },
          { id: "q15", type: "true-false-not-given", question: "Traditional television advertising is always cheaper than social media advertising.", correctAnswer: "false", explanation: "FALSE. The passage describes television advertising as 'expensive', so it is not always cheaper." },
          { id: "q16", type: "true-false-not-given", question: "TikTok has more users than Facebook.", correctAnswer: "not-given", explanation: "NOT GIVEN. Both platforms are mentioned but never compared by user count." },
          { id: "q17", type: "true-false-not-given", question: "Fact-checking labels have completely stopped the spread of misinformation.", correctAnswer: "not-given", explanation: "NOT GIVEN. Fact-checking labels are described as a response, but their effectiveness is not stated." },
          { id: "q18", type: "sentence-completion", question: "Platforms are designed to be ___________, using notifications and endless scrolling to keep users engaged.", correctAnswer: "addictive", explanation: "'addictive' — 'platforms are deliberately designed to be addictive: notifications, endless scrolling and personalised recommendations'." },
          { id: "q19", type: "sentence-completion", question: "For platforms, user attention translates directly into ___________ revenue.", correctAnswer: "advertising", explanation: "'advertising' — 'attention translates directly into advertising revenue'." },
          { id: "q20", type: "sentence-completion", question: "Some critics call for breaking up the largest companies because their ___________ is now too great.", correctAnswer: "influence", explanation: "'influence' — the reason critics call to break up big platforms is that 'their influence is now too great'." },
        ],
      },
      {
        id: "passage-3",
        title: "Self-Driving Cars: Promise and Reality",
        text: `The idea of a car that drives itself was, until recently, the stuff of science fiction. Yet in the past decade, billions of dollars have been invested in autonomous vehicle technology, and prototype cars have driven millions of kilometres on public roads. Supporters argue that self-driving cars could dramatically reduce road deaths, ease traffic congestion and give greater independence to the elderly and disabled. Critics counter that the technology is being deployed faster than regulators, engineers or society are ready for.

Modern self-driving cars combine several technologies. Cameras, radar and a laser-based system called LIDAR create a detailed picture of the surroundings; computers running machine-learning algorithms interpret this data and decide when to accelerate, brake or turn. On motorways, where the environment is relatively predictable, these systems already work reasonably well. Several manufacturers now offer cars capable of handling long highway drives with minimal driver input.

The real challenge lies in urban driving. Streets are full of unexpected events: a pedestrian may step out from behind a parked truck, a cyclist may swerve to avoid a pothole, a child's ball may roll into the road. Human drivers handle these situations through experience, common sense and the ability to make eye contact with other road users. Machines, in contrast, must be trained on huge datasets and still struggle in situations they have not encountered before. Several fatal accidents involving self-driving prototypes have already occurred, most famously in Arizona in 2018, when a test vehicle failed to recognise a woman crossing the street at night.

Beyond the technical challenges, questions about legal responsibility remain unresolved. If a self-driving car causes an accident, who is at fault — the passenger, the manufacturer, or the software developer? Insurance companies, courts and legislators are only beginning to answer these questions. Ethical dilemmas are also unavoidable: in a situation where a crash is unavoidable, how should a computer choose whom to protect? Programmers may effectively be writing rules that decide life and death.

Despite these obstacles, most experts believe that some form of driverless transport is inevitable. Trucks moving goods along motorways, taxis operating in fenced-off districts and shuttle buses on university campuses are all likely to become common in the next ten years. However, the vision of ordinary cars driving anywhere without human supervision is probably several decades away, and may never quite arrive.`,
        questions: [
          { id: "q21", type: "multiple-choice", question: "According to the passage, self-driving cars currently work best in which environment?", options: ["Busy city centres", "Motorways", "Country lanes", "Car parks"], correctAnswer: 1, explanation: "Motorways. 'On motorways, where the environment is relatively predictable, these systems already work reasonably well'." },
          { id: "q22", type: "multiple-choice", question: "What is LIDAR?", options: ["A satellite navigation system", "A radar-based sensor", "A laser-based sensor", "A rule-based algorithm"], correctAnswer: 2, explanation: "A laser-based sensor. Directly named: 'a laser-based system called LIDAR'." },
          { id: "q23", type: "multiple-choice", question: "Why is urban driving particularly difficult for self-driving cars?", options: ["Because cameras don't work in cities.", "Because cities have too many traffic lights.", "Because streets are full of unexpected events.", "Because urban roads are always narrower."], correctAnswer: 2, explanation: "'Streets are full of unexpected events' — pedestrians, cyclists, balls rolling into the road." },
          { id: "q24", type: "true-false-not-given", question: "Self-driving cars have already caused fatal accidents.", correctAnswer: "true", explanation: "TRUE. 'Several fatal accidents involving self-driving prototypes have already occurred'." },
          { id: "q25", type: "true-false-not-given", question: "Insurance and legal responsibility issues have been fully resolved.", correctAnswer: "false", explanation: "FALSE. 'Insurance companies, courts and legislators are only beginning to answer these questions'." },
          { id: "q26", type: "true-false-not-given", question: "Most experts believe fully autonomous cars will be common in the next five years.", correctAnswer: "false", explanation: "FALSE. Fully autonomous ordinary cars are 'probably several decades away, and may never quite arrive'." },
          { id: "q27", type: "true-false-not-given", question: "Self-driving trucks on motorways are likely to become common within a decade.", correctAnswer: "true", explanation: "TRUE. Trucks on motorways are 'likely to become common in the next ten years'." },
          { id: "q28", type: "sentence-completion", question: "A fatal accident with a test self-driving vehicle occurred in ___________ in 2018.", correctAnswer: "Arizona", explanation: "'Arizona' — the 2018 fatal test crash where a vehicle 'failed to recognise a woman crossing the street at night'." },
          { id: "q29", type: "sentence-completion", question: "In an unavoidable crash, programmers may effectively be writing rules that decide ___________.", correctAnswer: "life and death", explanation: "'life and death' — 'Programmers may effectively be writing rules that decide life and death'." },
          { id: "q30", type: "sentence-completion", question: "Human drivers handle unexpected events through experience, common sense and the ability to make ___________ with other road users.", correctAnswer: "eye contact", explanation: "'eye contact' — 'the ability to make eye contact with other road users'." },
        ],
      },
    ],
  },

  "academic-2": {
    id: "academic-2",
    title: "Academic Reading Test 2",
    description: "Environment and Climate",
    timeLimit: 60,
    passages: [
      {
        id: "passage-1",
        title: "Renewable Energy Technologies",
        text: `The transition to renewable energy sources represents one of the most important technological shifts of the 21st century. Solar, wind and hydroelectric power are becoming increasingly competitive with fossil fuels, driven by technological improvements and economies of scale. In several countries, renewables now supply more than a quarter of all electricity, and the trajectory suggests that share will continue to rise sharply.

Solar photovoltaic technology has seen dramatic cost reductions over the past decade. The price of solar panels has dropped by more than 90 per cent since 2010, making solar energy one of the cheapest sources of electricity in many parts of the world. Advances in panel efficiency and energy storage systems continue to improve the viability of solar power, and rooftop installations on ordinary homes are now common in countries as varied as Germany, Australia and Vietnam.

Wind energy has also experienced remarkable growth. Modern wind turbines are significantly larger and more efficient than their predecessors, with some offshore turbines now standing over 200 metres tall. These massive structures can generate enough electricity to power thousands of homes, even in areas with only moderate wind speeds. Offshore wind farms, though more expensive to build than onshore ones, benefit from stronger and more consistent winds at sea.

However, renewable energy faces genuine challenges. The intermittent nature of solar and wind power — the sun does not always shine and the wind does not always blow — requires either large-scale energy storage or backup power sources capable of ramping up on demand. Battery technology is improving rapidly, but grid-scale storage remains expensive. Additionally, the manufacturing of renewable energy equipment has its own environmental impacts, including the mining of rare earth elements and, in the case of solar panels, the difficulty of recycling old units at the end of their working life.

Critics of the pace of the energy transition point out that fossil fuels still supply the majority of global energy and that construction of new renewable capacity, though rapid, is not yet fast enough to meet international climate targets. Supporters reply that costs continue to fall and that once a country begins the shift in earnest, progress tends to accelerate rather than slow. Most independent analysts now agree that renewables will dominate new electricity generation within twenty years, though replacing existing coal and gas plants will take much longer.`,
        questions: [
          { id: "q1", type: "multiple-choice", question: "What has driven renewable energy to become competitive with fossil fuels?", options: ["Government regulations only", "Technological improvements and economies of scale", "Decreased demand for energy", "Higher fossil fuel taxes"], correctAnswer: 1 },
          { id: "q2", type: "multiple-choice", question: "According to the passage, offshore wind farms have which advantage over onshore ones?", options: ["They are cheaper to build.", "They benefit from stronger, more consistent winds.", "They need no maintenance.", "They produce less noise pollution."], correctAnswer: 1 },
          { id: "q3", type: "multiple-choice", question: "Which of the following is described as a challenge for renewables?", options: ["Rising costs of solar panels", "Recycling old solar units", "Lack of any storage technology", "Public opposition to wind turbines"], correctAnswer: 1 },
          { id: "q4", type: "true-false-not-given", question: "Solar panel prices have decreased by more than 90% since 2010.", correctAnswer: "true" },
          { id: "q5", type: "true-false-not-given", question: "Modern offshore wind turbines can be over 200 metres in height.", correctAnswer: "true" },
          { id: "q6", type: "true-false-not-given", question: "Large-scale grid energy storage is now cheap for all countries.", correctAnswer: "false" },
          { id: "q7", type: "true-false-not-given", question: "Fossil fuels no longer supply the majority of global energy.", correctAnswer: "false" },
          { id: "q8", type: "sentence-completion", question: "One environmental concern with renewable energy equipment is the mining of ___________ elements.", correctAnswer: "rare earth" },
          { id: "q9", type: "sentence-completion", question: "Most independent analysts agree that renewables will dominate new electricity generation within ___________ years.", correctAnswer: "twenty" },
          { id: "q10", type: "sentence-completion", question: "The problem that the sun does not always shine and the wind does not always blow is called the ___________ nature of these sources.", correctAnswer: "intermittent" },
        ],
      },
      {
        id: "passage-2",
        title: "The Amazon Rainforest at a Turning Point",
        text: `The Amazon rainforest, often called the "lungs of the planet", covers an area roughly the size of the continental United States and contains more than ten per cent of all known species on Earth. It also plays a crucial role in regulating global weather, storing an estimated 150 billion tonnes of carbon and generating much of the rainfall that waters agricultural regions thousands of kilometres away. In recent decades, however, this vast ecosystem has come under unprecedented pressure.

The most direct threat comes from deforestation. Farmers, ranchers and loggers clear forest to make way for cattle, soya beans and timber; in some years, an area larger than Belgium is lost. Although Brazil, which contains most of the Amazon, has laws restricting such activity, enforcement has been inconsistent, and satellite imagery consistently shows rates of forest loss rising and falling in step with government policy. When enforcement weakens, the pace of destruction accelerates within months.

Climate change adds a second, less visible pressure. As global temperatures rise, dry seasons in parts of the Amazon are becoming longer and hotter. Trees that have thrived for centuries in a humid climate find their roots unable to reach water, and forest fires — historically rare in the Amazon — have become a familiar sight. Some of these fires are deliberately started by farmers, but many spread naturally through drying vegetation once they begin.

Scientists warn that the combined effect of deforestation and climate change may be pushing the Amazon towards a "tipping point". This is the moment at which so much forest has been lost, or so much moisture removed from the atmosphere, that the remaining forest can no longer sustain itself. Beyond that point, large parts of the ecosystem could gradually convert to a much drier, savanna-like landscape. Once the shift begins, it would be extremely difficult to reverse, and the carbon stored in the trees would be released back into the atmosphere.

Efforts to protect the Amazon are underway, though experts disagree on their adequacy. Indigenous peoples, who manage large areas of the forest, have proved among the most effective guardians; deforestation rates on their lands are consistently lower than in surrounding regions. International agreements aim to reduce demand for products linked to forest clearing, and some countries have paid Brazil to protect standing forest. Whether these measures will prove enough to prevent a tipping point being reached is one of the defining environmental questions of the coming decade.`,
        questions: [
          { id: "q11", type: "multiple-choice", question: "What is the main direct threat to the Amazon rainforest, according to the passage?", options: ["Rising sea levels", "Deforestation for agriculture and logging", "Tourism", "Insect infestations"], correctAnswer: 1 },
          { id: "q12", type: "multiple-choice", question: "What is described as a 'tipping point' for the Amazon?", options: ["The moment when all deforestation stops.", "The point at which the remaining forest can no longer sustain itself.", "The election of a new Brazilian government.", "The completion of international agreements."], correctAnswer: 1 },
          { id: "q13", type: "multiple-choice", question: "Which group has been especially effective at protecting the forest?", options: ["Loggers", "Foreign tourists", "Indigenous peoples", "Cattle ranchers"], correctAnswer: 2 },
          { id: "q14", type: "true-false-not-given", question: "The Amazon covers an area roughly the size of the continental United States.", correctAnswer: "true" },
          { id: "q15", type: "true-false-not-given", question: "Brazilian laws have completely stopped illegal deforestation.", correctAnswer: "false" },
          { id: "q16", type: "true-false-not-given", question: "Forest fires have historically been common in the Amazon.", correctAnswer: "false" },
          { id: "q17", type: "true-false-not-given", question: "All fires in the Amazon are started deliberately by farmers.", correctAnswer: "false" },
          { id: "q18", type: "true-false-not-given", question: "The Amazon is the largest rainforest in the world.", correctAnswer: "not-given" },
          { id: "q19", type: "sentence-completion", question: "The Amazon stores an estimated ___________ tonnes of carbon.", correctAnswer: "150 billion" },
          { id: "q20", type: "sentence-completion", question: "Beyond the tipping point, large parts of the Amazon could convert to a ___________ landscape.", correctAnswer: "savanna-like" },
        ],
      },
      {
        id: "passage-3",
        title: "Plastic Pollution in the Oceans",
        text: `Every year, an estimated eight million tonnes of plastic waste enter the world's oceans, adding to the more than 150 million tonnes already circulating there. Some of this waste is highly visible — discarded fishing nets, drink bottles, and plastic bags drifting on the surface — but much of it exists as tiny fragments known as microplastics, smaller than five millimetres across. These microplastics have now been found from the depths of the Mariana Trench to the ice of the Arctic, and inside the bodies of hundreds of marine species.

The sources of ocean plastic are varied. Some enters directly, as rubbish blown from beaches or dumped from ships. Much of it, however, is carried down rivers from inland cities. A handful of rivers — several in Asia and Africa — are responsible for a disproportionate share of the total, largely because they pass through densely populated areas with limited waste-management infrastructure. Improving rubbish collection in these regions could sharply reduce the flow of plastic to the sea.

The consequences for marine life are severe. Larger animals such as turtles, seabirds and whales can become entangled in discarded fishing gear or mistake plastic bags for jellyfish and other prey. Once ingested, plastic can block the digestive system, leading to starvation. Microplastics, meanwhile, act as tiny sponges for the toxic chemicals that pollute seawater, concentrating those chemicals in the tissues of the fish and shellfish that eat them. Because humans in turn eat those fish, microplastics have now been detected in human blood, though the long-term health effects remain uncertain.

Reducing plastic pollution requires action at every stage of the supply chain. Some governments have banned single-use items such as plastic bags, straws and cutlery, with mixed results. Manufacturers are being pushed to design products that are easier to recycle, and to use recycled material in new packaging. Chemists are developing biodegradable alternatives to conventional plastics, though these are not yet cheap enough to replace the vast quantities of ordinary plastic produced each year.

Cleaning up the plastic that has already reached the ocean is far harder. Ambitious engineering projects to skim rubbish from the surface have collected only a small fraction of the total. Most experts agree that preventing plastic from entering the sea in the first place is far more effective — and far cheaper — than trying to remove it once it is there.`,
        questions: [
          { id: "q21", type: "multiple-choice", question: "According to the passage, roughly how much plastic waste enters the oceans each year?", options: ["Eight hundred thousand tonnes", "Eight million tonnes", "Eighty million tonnes", "One hundred and fifty million tonnes"], correctAnswer: 1 },
          { id: "q22", type: "multiple-choice", question: "Which source is described as contributing a disproportionate share of ocean plastic?", options: ["Cruise ships", "A handful of rivers in Asia and Africa", "Beach tourism", "Deep-sea fishing"], correctAnswer: 1 },
          { id: "q23", type: "multiple-choice", question: "Why are microplastics particularly harmful?", options: ["They emit toxic gas.", "They dissolve into pure poison.", "They act as sponges for toxic chemicals and enter the food chain.", "They cause the sea to warm up."], correctAnswer: 2 },
          { id: "q24", type: "true-false-not-given", question: "Microplastics have been found inside human blood.", correctAnswer: "true" },
          { id: "q25", type: "true-false-not-given", question: "Cleaning up plastic already in the ocean is easier than preventing new plastic from entering it.", correctAnswer: "false" },
          { id: "q26", type: "true-false-not-given", question: "Biodegradable plastics are already cheap enough to replace conventional plastics on a large scale.", correctAnswer: "false" },
          { id: "q27", type: "true-false-not-given", question: "Plastic pollution has affected wildlife in the Arctic.", correctAnswer: "true" },
          { id: "q28", type: "sentence-completion", question: "Microplastics are pieces of plastic smaller than ___________ millimetres across.", correctAnswer: "five" },
          { id: "q29", type: "sentence-completion", question: "Sea turtles sometimes mistake plastic bags for ___________.", correctAnswer: "jellyfish" },
          { id: "q30", type: "sentence-completion", question: "Improving ___________ in densely populated regions could sharply reduce plastic flowing to the sea.", correctAnswer: "rubbish collection" },
        ],
      },
    ],
  },

  "academic-3": {
    id: "academic-3",
    title: "Academic Reading Test 3",
    description: "History and Culture",
    timeLimit: 60,
    passages: [
      {
        id: "passage-1",
        title: "The Silk Road: A Highway of Ideas",
        text: `For more than fifteen hundred years, the network of trade routes known collectively as the Silk Road linked China with the Mediterranean world. Named in the nineteenth century by a German geographer, the Silk Road was never a single road but a shifting web of paths across mountains, deserts and grasslands. Its most famous cargo was Chinese silk, which was so highly valued in Rome that emperors passed laws restricting its use. In exchange, the West sent glassware, gold, wool and horses.

Yet the goods carried along the Silk Road were only part of its importance. Ideas, religions, technologies and diseases travelled the same paths. Buddhism, which originated in India, spread eastward through Central Asia and reached China during the first century of the common era. Papermaking, invented in China, made the opposite journey and reached the Middle East in the eighth century, transforming record-keeping and, eventually, scholarship in Europe. Astronomical knowledge, mathematical concepts and even artistic styles passed back and forth in ways that historians are still uncovering.

The traders themselves were rarely people who travelled the whole distance. A merchant might carry goods from one oasis city to the next, sell them, buy something else, and turn back. Over hundreds of such short journeys, silks made in one continent could end up in the wardrobe of a queen on another. The great oasis cities — Samarkand, Bukhara, Kashgar and others — grew wealthy on the taxes and services demanded from passing caravans, and became famed for their libraries, markets and mosques.

The Silk Road was not, however, always safe. Deserts such as the Taklamakan and Gobi claimed the lives of travellers who ran out of water, and bandits regularly attacked caravans in remote passes. Powerful empires sometimes protected the routes and sometimes closed them. When the Mongol Empire united much of the region in the thirteenth century, trade briefly flourished as never before. Marco Polo travelled to the court of Kublai Khan during this period and wrote a famous account of what he saw.

The gradual decline of the overland routes had several causes. New sea routes discovered by European explorers in the fifteenth and sixteenth centuries offered cheaper and safer transport for bulky goods. Political fragmentation in Central Asia disrupted the old caravan networks. Perhaps most damagingly, the same paths that had carried ideas also carried disease: the plague pandemic of the fourteenth century, which killed as many as a third of the people of Europe, is now widely believed to have travelled westward from Asia along the Silk Road itself.`,
        questions: [
          { id: "q1", type: "multiple-choice", question: "According to the passage, which of the following was NOT a Silk Road export from the West?", options: ["Glassware", "Wool", "Silk", "Horses"], correctAnswer: 2 },
          { id: "q2", type: "multiple-choice", question: "How did most merchants operate along the Silk Road?", options: ["They travelled the entire distance from China to Rome.", "They carried goods only between neighbouring cities.", "They avoided oasis cities.", "They worked for a single government."], correctAnswer: 1 },
          { id: "q3", type: "multiple-choice", question: "What role did the Mongol Empire play in Silk Road trade?", options: ["It closed all the routes.", "It briefly caused unprecedented flourishing.", "It banned foreign merchants.", "It moved trade entirely to the sea."], correctAnswer: 1 },
          { id: "q4", type: "true-false-not-given", question: "The term 'Silk Road' was invented in the nineteenth century.", correctAnswer: "true" },
          { id: "q5", type: "true-false-not-given", question: "Buddhism travelled from China to India along the Silk Road.", correctAnswer: "false" },
          { id: "q6", type: "true-false-not-given", question: "Papermaking reached the Middle East before the year 700.", correctAnswer: "false" },
          { id: "q7", type: "true-false-not-given", question: "Marco Polo's account of his travels is considered entirely inaccurate.", correctAnswer: "not-given" },
          { id: "q8", type: "sentence-completion", question: "The fourteenth-century pandemic is now widely believed to have travelled westward from Asia along the ___________.", correctAnswer: "Silk Road" },
          { id: "q9", type: "sentence-completion", question: "Oasis cities such as Samarkand and ___________ grew wealthy on taxes from passing caravans.", correctAnswer: "Bukhara" },
          { id: "q10", type: "sentence-completion", question: "Chinese silk was so valued in Rome that ___________ passed laws restricting its use.", correctAnswer: "emperors" },
        ],
      },
      {
        id: "passage-2",
        title: "Ancient Egyptian Medicine",
        text: `The medicine practised in ancient Egypt more than three thousand years ago was, for its time, remarkably advanced. Physicians recognised a wide range of illnesses, kept written case notes and used a mixture of practical remedies and religious rituals to treat their patients. Much of what we know about this tradition comes from a small number of surviving papyri — long documents written on the fibrous inner bark of a reed — the most famous of which are the Edwin Smith and Ebers papyri, both copied around 1500 BCE from earlier originals.

Egyptian doctors were often specialists. There were physicians for the eyes, teeth and stomach, and others who treated the wounds of soldiers. The Edwin Smith papyrus, thought to have been used by military doctors, describes forty-eight cases of trauma injuries in a strikingly modern format: title, examination, diagnosis, treatment and prognosis. For each injury, the doctor is told whether it is "an ailment I will treat", "an ailment I will contend with", or "an ailment not to be treated" — a frank recognition that some conditions were beyond the medicine of the day.

Treatments combined careful observation with the herbal knowledge accumulated over generations. Honey, which we now know has genuine antibacterial properties, was applied to open wounds. Willow bark, the ancient ancestor of aspirin, was used to reduce pain and fever. Onions and garlic, both mild antiseptics, appear in many prescriptions. At the same time, magical spells and offerings to the gods were often prescribed alongside these practical remedies. To the Egyptians, illness could result from natural causes such as bad food or injury, or from supernatural ones such as the anger of a god or the presence of an evil spirit; the treatment addressed whichever cause the doctor identified.

Surgery, though limited by the absence of effective anaesthesia and modern sterilisation, was performed for a range of conditions. Broken bones were set in splints made from wood padded with linen, and evidence from mummies suggests some of these fractures healed cleanly. Dentists filled cavities with a mixture that included honey and various minerals, and skilled artisans made false teeth held in place with fine gold wire.

Egyptian medicine also had blind spots. The role of the heart was correctly identified as central, but the Egyptians believed it was also the seat of thought and emotion, and paid comparatively little attention to the brain. Diseases we now know to be caused by microorganisms were often attributed to unseen spirits. Yet for all their misconceptions, Egyptian physicians achieved a level of practical success that was widely admired: doctors from other Mediterranean societies travelled to Egypt to study, and Egyptian medical knowledge influenced Greek and later European practice for centuries.`,
        questions: [
          { id: "q11", type: "multiple-choice", question: "How is the Edwin Smith papyrus described in the passage?", options: ["A poetry collection", "A record of forty-eight trauma cases", "A history of the pharaohs", "A list of magical spells"], correctAnswer: 1 },
          { id: "q12", type: "multiple-choice", question: "Which substance mentioned in the passage was an early form of aspirin?", options: ["Honey", "Garlic", "Willow bark", "Onions"], correctAnswer: 2 },
          { id: "q13", type: "multiple-choice", question: "According to the passage, Egyptians believed the heart was…", options: ["Only for pumping blood.", "The seat of thought and emotion.", "Less important than the brain.", "Divided into four chambers."], correctAnswer: 1 },
          { id: "q14", type: "true-false-not-given", question: "Egyptian doctors sometimes admitted that certain conditions were untreatable.", correctAnswer: "true" },
          { id: "q15", type: "true-false-not-given", question: "Egyptian medicine used only religious rituals and no practical remedies.", correctAnswer: "false" },
          { id: "q16", type: "true-false-not-given", question: "Egyptian physicians used effective anaesthesia during surgery.", correctAnswer: "false" },
          { id: "q17", type: "true-false-not-given", question: "The Ebers papyrus is longer than the Edwin Smith papyrus.", correctAnswer: "not-given" },
          { id: "q18", type: "sentence-completion", question: "The Edwin Smith and Ebers papyri were both copied around ___________ BCE.", correctAnswer: "1500" },
          { id: "q19", type: "sentence-completion", question: "Egyptian dentists made false teeth held in place with fine ___________ wire.", correctAnswer: "gold" },
          { id: "q20", type: "sentence-completion", question: "Doctors from other ___________ societies travelled to Egypt to study.", correctAnswer: "Mediterranean" },
        ],
      },
      {
        id: "passage-3",
        title: "The Development of Written Language",
        text: `Writing is such a familiar part of modern life that it is easy to forget how recent and unusual an invention it is. Human beings have been speaking for perhaps a hundred thousand years, but writing is only about five thousand years old. Of the thousands of languages spoken today, only a minority have ever been written down in their own script, and independent invention of writing appears to have happened just three or four times in human history — in Mesopotamia, in Egypt, in China, and probably in Central America. Every other writing system, from the Roman alphabet used to write this passage to the many varieties of Arabic script, is descended from one of these originals.

The earliest writing was almost certainly practical rather than artistic. In Mesopotamia, small clay tokens had for thousands of years been used to represent quantities of grain, sheep or other goods. Eventually, someone had the idea of pressing the tokens into a lump of soft clay to record a transaction, and then, later still, of simply drawing the shapes of the tokens directly onto the clay. From these accountancy records emerged, over centuries, the wedge-shaped script we call cuneiform. At first cuneiform could only represent nouns, but scribes gradually added signs for verbs, then for grammatical endings, and eventually for the sounds of the spoken language.

The step from picture-writing to sound-writing was crucial. When each symbol stands only for a thing, the number of symbols must grow with every new word — Chinese, which retains a strongly picture-based writing system, uses several thousand distinct characters. Once symbols can be used to represent sounds, a much smaller set of signs can capture any word in the language. This insight was refined by the Phoenicians, whose alphabet of about twenty-two signs was borrowed and adapted by the Greeks, who added vowels, and passed via the Romans to become the basis of most European writing.

Writing changed societies profoundly. It made possible large administrations, permanent laws, and the accurate transmission of stories and religious texts across generations. It allowed knowledge to accumulate: a scholar could stand, in the phrase of Isaac Newton, "on the shoulders of giants" who had recorded their thoughts long before. It also created new social divisions. In every early literate society, only a small elite could read and write, and that elite tended to be male, powerful and well-off. General literacy — the idea that ordinary people should be able to read — is a startlingly recent development, achieved in most of the world only in the past two centuries.

Even today, more than seven hundred million adults cannot read a simple sentence in any language, and hundreds of small languages are still spoken but not written. Whether these languages will survive without a written form is one of the questions currently occupying linguists and educators around the world.`,
        questions: [
          { id: "q21", type: "multiple-choice", question: "According to the passage, roughly how many times has writing been independently invented?", options: ["Only once", "Three or four times", "Ten times", "Hundreds of times"], correctAnswer: 1 },
          { id: "q22", type: "multiple-choice", question: "Where did the earliest form of cuneiform develop?", options: ["Egypt", "China", "Mesopotamia", "Central America"], correctAnswer: 2 },
          { id: "q23", type: "multiple-choice", question: "Why was moving from pictures to sound symbols so important?", options: ["Because pictures were harder to draw.", "Because a small set of symbols could represent any word.", "Because pictures could not be understood by anyone.", "Because sound symbols were prettier."], correctAnswer: 1 },
          { id: "q24", type: "true-false-not-given", question: "Human beings have spoken for far longer than they have written.", correctAnswer: "true" },
          { id: "q25", type: "true-false-not-given", question: "Every writing system in use today was invented completely independently.", correctAnswer: "false" },
          { id: "q26", type: "true-false-not-given", question: "In early literate societies, everyone could usually read and write.", correctAnswer: "false" },
          { id: "q27", type: "true-false-not-given", question: "General literacy was widespread by the year 1500.", correctAnswer: "false" },
          { id: "q28", type: "sentence-completion", question: "The Phoenicians used an alphabet of about ___________ signs.", correctAnswer: "twenty-two" },
          { id: "q29", type: "sentence-completion", question: "The ___________ borrowed the Phoenician alphabet and added vowels.", correctAnswer: "Greeks" },
          { id: "q30", type: "sentence-completion", question: "Isaac Newton described a scholar as standing on the shoulders of ___________.", correctAnswer: "giants" },
        ],
      },
    ],
  },
};
