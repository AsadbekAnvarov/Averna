/** Structured data for an auto-rendered Task 1 visual (chart/graph). */
export type Task1ChartData =
  | { kind: "bar"; unit?: string; groups: string[]; series: { name: string; values: number[] }[] }
  | { kind: "line"; unit?: string; xLabels: string[]; series: { name: string; values: number[] }[] }
  | { kind: "pie"; unit?: string; title?: string; slices: { label: string; value: number }[] };

export interface WritingPrompt {
  id: string;
  title: string;
  prompt: string;
  type: string;
  /** Optional real image (e.g. a scanned map or process diagram). */
  imageUrl?: string;
  /** Optional structured data rendered as an SVG chart (bar/line/pie). */
  chart?: Task1ChartData[];
  sampleAnswer: string;
  usefulPhrases: string[];
  strategyEn: string;
  strategyUz: string;
}

export const WRITING_PROMPTS: Record<"task1" | "task2", WritingPrompt[]> = {
  task1: [
    {
      id: "task1-bar-enrollment",
      title: "Bar Chart: University Enrolment",
      prompt:
        "The bar chart below shows the number of students enrolled in three different courses (Business, Engineering and Arts) at a university over three years: 2019, 2021 and 2023.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.\n\nData (approx.):\n• 2019: Business 4,500 · Engineering 3,000 · Arts 2,500\n• 2021: Business 5,200 · Engineering 3,800 · Arts 2,200\n• 2023: Business 6,100 · Engineering 5,000 · Arts 1,800",
      type: "Bar Chart",
      chart: [
        {
          kind: "bar",
          unit: "students",
          groups: ["2019", "2021", "2023"],
          series: [
            { name: "Business", values: [4500, 5200, 6100] },
            { name: "Engineering", values: [3000, 3800, 5000] },
            { name: "Arts", values: [2500, 2200, 1800] },
          ],
        },
      ],
      sampleAnswer:
        "The bar chart illustrates changes in the number of students enrolled in Business, Engineering and Arts courses at a particular university in 2019, 2021 and 2023.\n\nOverall, Business remained the most popular subject throughout the period and, together with Engineering, showed steady growth, whereas the number of Arts students fell consistently.\n\nIn 2019, Business attracted around 4,500 students, well ahead of Engineering (3,000) and Arts (2,500). Over the following four years, enrolment in Business rose sharply, reaching approximately 6,100 by 2023 — an increase of roughly 35 per cent. Engineering experienced an even faster relative rise, climbing from 3,000 to 5,000 students and narrowing the gap with the leading subject.\n\nBy contrast, Arts followed the opposite trend. After a small initial fall to 2,200 students in 2021, numbers dropped further to just 1,800 in 2023, meaning that the subject lost around 28 per cent of its intake compared with 2019. As a result, Arts finished the period as by far the least popular of the three courses.",
      usefulPhrases: [
        "The bar chart illustrates / shows / compares…",
        "Overall, X remained the most popular…",
        "There was a steady / sharp / gradual increase in…",
        "By contrast, X followed the opposite trend.",
        "…an increase / decrease of roughly X per cent.",
        "The gap between X and Y narrowed / widened over the period.",
        "By 2023, the figure had reached approximately…",
      ],
      strategyEn:
        "Paragraph 1: paraphrase the question. Paragraph 2: 1–2 sentence overview (main trends, biggest/smallest). Paragraphs 3–4: detail with numbers and comparisons. Don't list every figure — group similar trends together.",
      strategyUz:
        "1-abzas: savolni oʻz soʻzlaringiz bilan qayta yozing. 2-abzas: umumiy manzarani 1–2 gapda bering (asosiy tendensiya, eng katta va eng kichik koʻrsatkichlar). 3–4-abzas: raqamlar va taqqoslashlar. Har bir raqamni sanab oʻtirmang — oʻxshash tendensiyalarni birlashtiring.",
    },
    {
      id: "task1-line-temperature",
      title: "Line Graph: City Temperatures",
      prompt:
        "The line graph below shows the average monthly temperatures (°C) in three different cities — Reykjavik, Cairo and Singapore — from January to December.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
      type: "Line Graph",
      chart: [
        {
          kind: "line",
          unit: "°C",
          xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          series: [
            { name: "Singapore", values: [27, 27, 28, 28, 28, 28, 27, 27, 27, 27, 27, 27] },
            { name: "Cairo", values: [14, 15, 18, 22, 26, 28, 29, 29, 27, 24, 19, 15] },
            { name: "Reykjavik", values: [-1, 0, 1, 3, 7, 10, 12, 12, 9, 5, 2, 0] },
          ],
        },
      ],
      sampleAnswer:
        "The line graph compares the average monthly temperatures in three cities — Reykjavik in Iceland, Cairo in Egypt and Singapore — throughout a single year.\n\nOverall, Singapore remained the hottest city and showed almost no seasonal variation, whereas Reykjavik was consistently the coldest and experienced the most dramatic change between winter and summer. Cairo lay between the two, with a clear but less extreme summer peak.\n\nSingapore's temperatures stayed close to 27 °C in every month, moving only one or two degrees above or below this figure. Cairo, in contrast, began the year at about 14 °C in January, then rose steadily to a peak of around 29 °C in July and August before falling back to 15 °C by December.\n\nReykjavik displayed the widest range. Winter temperatures hovered near freezing, dipping to about −1 °C in January, before climbing gradually to a summer high of only 13 °C in July. Even at its warmest, the Icelandic capital was more than 14 degrees cooler than either of the other two cities.",
      usefulPhrases: [
        "The line graph compares…",
        "Overall, X remained the highest / lowest…",
        "…showed almost no seasonal variation.",
        "…rose steadily to a peak of around…",
        "…before falling back to…",
        "…displayed the widest range.",
        "By comparison / In contrast, …",
      ],
      strategyEn:
        "For line graphs, describe the shape of each line: peak, trough, plateau. Group two similar lines together, then contrast with the third. Always cover the start, key change points and end.",
      strategyUz:
        "Chiziqli grafikda har bir chiziqning shakli — eng yuqori nuqta, eng past nuqta, tekislangan qism — muhim. Oʻxshash 2 ta chiziqni birlashtirib yozing, keyin uchinchisini taqqoslang. Boshlanish, oʻzgarish nuqtalari va yakuniy qiymatni albatta yoritib bering.",
    },
    {
      id: "task1-pie-energy",
      title: "Pie Charts: Household Energy Use",
      prompt:
        "The two pie charts below show how energy is used in a typical household in the United Kingdom and in Australia.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.\n\nUK: Heating 55%, Water heating 18%, Appliances & lighting 20%, Cooking 5%, Other 2%\nAustralia: Heating 24%, Water heating 30%, Appliances & lighting 34%, Cooking 6%, Other 6%",
      type: "Pie Chart",
      chart: [
        {
          kind: "pie",
          unit: "%",
          title: "United Kingdom",
          slices: [
            { label: "Heating", value: 55 },
            { label: "Water heating", value: 18 },
            { label: "Appliances & lighting", value: 20 },
            { label: "Cooking", value: 5 },
            { label: "Other", value: 2 },
          ],
        },
        {
          kind: "pie",
          unit: "%",
          title: "Australia",
          slices: [
            { label: "Heating", value: 24 },
            { label: "Water heating", value: 30 },
            { label: "Appliances & lighting", value: 34 },
            { label: "Cooking", value: 6 },
            { label: "Other", value: 6 },
          ],
        },
      ],
      sampleAnswer:
        "The two pie charts show how domestic energy is used in typical households in the United Kingdom and Australia.\n\nOverall, space heating is the single largest use of energy in the UK, while in Australian homes energy consumption is spread much more evenly across three main activities. Cooking and other minor uses account for only a small share in both countries.\n\nIn a British household, more than half of all energy (55 per cent) is spent on heating rooms, and a further 18 per cent goes on heating water. Appliances and lighting use around 20 per cent, and cooking just 5 per cent.\n\nThe Australian pattern is strikingly different. Appliances and lighting are the biggest single category at 34 per cent, followed by water heating at 30 per cent. Space heating accounts for only 24 per cent — less than half of the UK figure — reflecting Australia's much warmer climate. Cooking (6 per cent) and other uses (6 per cent) together make up a slightly larger share than in the UK, but remain minor overall.",
      usefulPhrases: [
        "The two pie charts show…",
        "Overall, X accounts for the largest share…",
        "…is spread much more evenly across…",
        "…more than half of all energy (X per cent) is spent on…",
        "The X pattern is strikingly different.",
        "…reflecting the country's warmer / colder climate.",
        "…together make up a slightly larger / smaller share than…",
      ],
      strategyEn:
        "With two pie charts, compare the same category across both, not each pie in isolation. Highlight the biggest slice in each, then anything unexpected.",
      strategyUz:
        "Ikkita doiraviy diagrammada — bir xil toifani ikki mamlakat oʻrtasida taqqoslang, har bir diagrammani alohida tavsiflashdan koʻra. Har birida eng katta ulushni koʻrsating, keyin kutilmagan farqni yoriting.",
    },
    {
      id: "task1-process-bread",
      title: "Process Diagram: Making Bread",
      prompt:
        "The diagram below shows the process by which bread is made in a small bakery.\n\nSummarise the information by selecting and reporting the main features.\n\nWrite at least 150 words.\n\nStages: 1) Mix flour, water, yeast and salt · 2) Knead dough by hand for 10 minutes · 3) Leave dough to rise for 1 hour · 4) Shape into loaves · 5) Second rise 30 minutes · 6) Bake at 220 °C for 25 minutes · 7) Cool on wire rack · 8) Package and sell.",
      type: "Process",
      sampleAnswer:
        "The diagram illustrates the eight main stages involved in making bread in a small artisan bakery, from mixing the raw ingredients to selling the finished loaves.\n\nOverall, the process is linear and takes around two hours from start to finish, with two separate periods of rising and a single baking stage.\n\nInitially, four ingredients — flour, water, yeast and salt — are combined in a large bowl to form a rough dough. This dough is then kneaded by hand for approximately ten minutes until it becomes smooth and elastic. Once kneading is complete, the dough is covered and left to rise for one hour, during which time the yeast doubles its volume.\n\nAfter this first rise, the dough is divided and shaped into individual loaves. These loaves are left to rise for a further thirty minutes before being placed in an oven pre-heated to 220 °C, where they are baked for twenty-five minutes. Finally, the freshly baked bread is cooled on a wire rack, packaged into paper bags and displayed for sale.",
      usefulPhrases: [
        "The diagram illustrates the X main stages involved in…",
        "Overall, the process is linear / cyclical and takes around…",
        "Initially, / First / To begin with, …",
        "This is then / Once … is complete, …",
        "After this, …",
        "Finally, the finished product is …",
        "…in the meantime / during which time…",
      ],
      strategyEn:
        "Use passive voice ('the dough is kneaded') and sequencing words. State the number of stages and whether the process is linear or cyclical in your overview.",
      strategyUz:
        "Jarayonlarda majhul nisbatdan foydalaning ('dough is kneaded') va ketma-ketlik soʻzlarini qoʻllang. Umumiy qismda bosqichlar sonini va jarayon chiziqlimi yoki tsiklikligini koʻrsating.",
    },
    {
      id: "task1-table-tourism",
      title: "Table: International Tourism",
      prompt:
        "The table below shows the number of international tourists (millions) visiting five countries in 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.\n\nFrance: 2010 = 77 · 2020 = 41\nSpain: 2010 = 53 · 2020 = 19\nUSA:   2010 = 60 · 2020 = 19\nChina: 2010 = 56 · 2020 = 8\nItaly: 2010 = 44 · 2020 = 25",
      type: "Table",
      sampleAnswer:
        "The table shows the number of international tourists, in millions, arriving in five leading destinations — France, Spain, the USA, China and Italy — in the years 2010 and 2020.\n\nOverall, visitor numbers fell sharply in every country between the two dates, most probably because of the global pandemic in 2020. France remained the most-visited country in both years, while China experienced the steepest decline.\n\nIn 2010, France welcomed 77 million tourists, comfortably more than any other country in the group. The USA came second with 60 million, closely followed by China (56 million) and Spain (53 million). Italy attracted the smallest number at 44 million.\n\nBy 2020, the picture had changed dramatically. France still led the group with 41 million visitors, though this was almost half its earlier figure. Italy, having fallen the least in relative terms, moved into second place with 25 million. Spain and the USA were level at 19 million each, while China collapsed from 56 to just 8 million — a fall of more than 85 per cent, and the sharpest of any country in the table.",
      usefulPhrases: [
        "The table shows / provides information about…",
        "Overall, X fell sharply in every country…",
        "…remained the most-visited / leading…",
        "…comfortably more than any other…",
        "…followed by X and Y respectively.",
        "…a fall of more than X per cent — the sharpest of any country in the table.",
        "By 2020, the picture had changed dramatically.",
      ],
      strategyEn:
        "For tables, do NOT copy every number. Choose the highest, lowest and biggest change. Group countries with similar patterns together.",
      strategyUz:
        "Jadvallarda barcha raqamlarni koʻchirmang. Eng katta, eng kichik va eng katta oʻzgarishni tanlang. Oʻxshash koʻrsatkichli mamlakatlarni birga guruhlang.",
    },
    {
      id: "task1-map-village",
      title: "Map: A Village Then and Now",
      prompt:
        "The two maps below show a small coastal village in 1980 and today.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.\n\nKey changes (1980 → today): farmland east of village → holiday resort; single road → widened highway with roundabout; small harbour → expanded marina; forest to the north → partly cleared for hotels; church and old school → unchanged.",
      type: "Map",
      sampleAnswer:
        "The two maps illustrate how a small coastal village has changed between 1980 and the present day.\n\nOverall, the village has been transformed from a quiet agricultural settlement into a busy tourist destination. Although a small historic core remains, most of the surrounding land has been developed for visitors, and transport infrastructure has expanded to match.\n\nIn 1980, the area to the east of the village was almost entirely farmland, and the harbour on the coast was small enough to hold only a few fishing boats. Access to the village was provided by a single narrow road running from the south. Dense forest covered the northern hillside.\n\nToday, the picture is very different. The eastern farmland has been replaced by a large holiday resort, and the original harbour has been extended into a modern marina capable of holding dozens of pleasure boats. The old road has been widened into a highway, which now meets a new roundabout at the village entrance. Part of the northern forest has been cleared to make room for hotels, while, in the centre, the church and old school building have been carefully preserved.",
      usefulPhrases: [
        "The two maps illustrate how X has changed between…",
        "Overall, X has been transformed from … into …",
        "…has been replaced by / converted into …",
        "…has been extended / widened / demolished …",
        "…has been carefully preserved.",
        "To the north / south / east / west, …",
        "A new … has been built / constructed / added.",
      ],
      strategyEn:
        "Compare the two maps by area (north, south, east, west, centre). Use the passive perfect for changes ('has been replaced'). Note what has stayed the same as well as what has changed.",
      strategyUz:
        "Xaritalarni yoʻnalishlar boʻyicha (shimol, janub, sharq, gʻarb, markaz) taqqoslang. Oʻzgarishlar uchun passiv perfectdan foydalaning ('has been replaced'). Oʻzgarmagan joylarni ham koʻrsating.",
    },
  ],

  task2: [
    {
      id: "task2-tech-education",
      title: "Technology and Education",
      prompt:
        "Some people believe that technology has made learning easier and more accessible, while others think it has made students lazy and less focused.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Discussion + Opinion",
      sampleAnswer:
        "Few developments have reshaped classrooms as thoroughly as digital technology. While some observers argue that laptops, smartphones and online platforms have democratised learning, others believe that they have eroded students' discipline and attention. In my view, both effects are real, but the benefits substantially outweigh the drawbacks when technology is properly guided.\n\nSupporters of educational technology point to unprecedented access to information. A student in a rural village can now watch a lecture by a leading professor, take a certified course on platforms such as Coursera, and receive instant feedback from language-learning apps. Personalised learning software can also adapt to each learner's pace, helping weaker students catch up while allowing stronger ones to move ahead. These opportunities would have been unimaginable a generation ago and undoubtedly widen access to education.\n\nHowever, critics have a legitimate concern. Smartphones are engineered to capture attention, and many students find it difficult to concentrate on a textbook when notifications constantly interrupt them. Ready access to answers online may also discourage deep thinking; a learner who copies a formula from a website does not necessarily understand it. Prolonged screen time has additionally been linked to reduced sleep and rising anxiety among teenagers.\n\nIn my opinion, these problems are real but manageable. They are best addressed by better teaching and clearer rules — for example, phone-free classrooms and assessments that reward reasoning rather than memorisation — rather than by rejecting technology itself. Used thoughtfully, digital tools bring genuine gains that outweigh their risks, provided both schools and students remain aware of the pitfalls.",
      usefulPhrases: [
        "Few developments have reshaped X as thoroughly as…",
        "While some observers argue that…, others believe that…",
        "In my view, both effects are real, but the benefits substantially outweigh…",
        "Supporters of X point to…",
        "However, critics have a legitimate concern.",
        "These problems are real but manageable.",
        "Used thoughtfully, X brings genuine gains that outweigh its risks.",
      ],
      strategyEn:
        "For 'discuss both views + opinion' essays, spend one body paragraph on each side, then a third paragraph (or a clear conclusion) with your opinion and why you hold it. Make sure your view is visible from the introduction.",
      strategyUz:
        "'Har ikkala fikrni muhokama qiling + oʻz fikrini bildiring' turidagi essede har bir tomonga bittadan abzats bering, keyin uchinchi abzatsda oʻz fikrini asoslab yozing. Sizning pozitsiyangiz kirish qismidayoq koʻrinib turishi kerak.",
    },
    {
      id: "task2-environment-international",
      title: "Environmental Problems — International Action",
      prompt:
        "Environmental problems are too big for individual countries and individual people to address. We have reached the stage where the only way to protect the environment is at an international level.\n\nTo what extent do you agree or disagree with this statement?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Opinion",
      sampleAnswer:
        "Climate change, plastic pollution and the loss of biodiversity are challenges that respect no borders. Some argue, therefore, that only international action can now make a meaningful difference. I largely agree with this view, but I would add that national governments and individual citizens still have essential roles to play.\n\nThere are strong reasons to see the global level as decisive. Greenhouse gases released in one country warm the entire planet; plastic dumped in one river ends up thousands of kilometres away in an ocean shared by all. Because pollution is transboundary, agreements such as the Paris climate accord are the only mechanism that can align the behaviour of major emitters. Without them, individual countries face a classic collective-action problem: any nation that acts alone bears the cost of change while others enjoy the benefits.\n\nHowever, treaties are worthless without domestic implementation. The most effective international agreements have succeeded precisely because national governments then passed laws to enforce them — restricting emissions, subsidising renewable energy or banning single-use plastics. In this sense, national action is not an alternative to international cooperation but a necessary consequence of it.\n\nIndividual citizens also matter, though their impact is more indirect. By choosing sustainable products, reducing meat consumption or voting for green policies, they create the political pressure that keeps environmental issues on the agenda. In democracies especially, sustained public concern is often what pushes governments to sign — and honour — international commitments.\n\nIn conclusion, the scale of today's environmental crisis certainly demands global cooperation, but real progress will only come when international agreements, national laws and everyday choices reinforce one another.",
      usefulPhrases: [
        "…challenges that respect no borders.",
        "I largely agree with this view, but I would add that…",
        "Because pollution is transboundary, …",
        "…a classic collective-action problem: any nation that acts alone…",
        "Treaties are worthless without domestic implementation.",
        "In this sense, national action is not an alternative to X but a necessary consequence of it.",
        "In conclusion, real progress will only come when X, Y and Z reinforce one another.",
      ],
      strategyEn:
        "For 'to what extent do you agree' essays, take a clear position from the start (fully agree / partly agree / disagree). 'Partly agree' is often the safest — it lets you explore both sides while still committing to a view.",
      strategyUz:
        "'Qay darajada roziligingizni bildiring' turidagi essede boshidanoq aniq pozitsiya oling (toʻliq roziman / qisman roziman / rozi emasman). 'Qisman roziman' — koʻpincha eng xavfsiz variant, chunki ikki tomonni ham koʻrsatishga imkon beradi.",
    },
    {
      id: "task2-work-life-balance",
      title: "Work-Life Balance",
      prompt:
        "Many people find it hard to balance their work with other parts of their lives.\n\nWhat are the reasons for this? How can this problem be overcome?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Problem-Solution",
      sampleAnswer:
        "In many countries, complaints about long working hours and constant email have become almost universal. There are several reasons why an acceptable balance between work and personal life is now so difficult to achieve, and both individuals and employers must adjust their behaviour if the situation is to improve.\n\nThe first reason lies in economic pressure. In cities where housing and childcare costs rise faster than wages, employees often feel they cannot afford to work fewer hours or turn down overtime. A second cause is the smartphone. Because emails and messaging apps follow us home, the boundary between the working day and the evening has become blurred. Many people find themselves answering client requests at nine in the evening, not because they must, but because everyone else does. Finally, ambitious workplace cultures — particularly in finance, law and technology — often reward those who visibly work the longest hours, even when this reduces overall productivity.\n\nSeveral practical solutions can help. At the individual level, setting simple rules — such as no work emails after 8 p.m., or two evenings per week reserved for family — creates a genuine boundary. Employers can support this by trialling four-day weeks, offering flexible schedules and, crucially, making sure that managers do not send late-night messages themselves. On a national level, some countries have introduced a legal 'right to disconnect', which allows employees to ignore work communications outside their contracted hours without fear of penalty.\n\nIf these measures were widely adopted, workers would enjoy better health and family life while employers would benefit from staff who are more focused and less likely to leave.",
      usefulPhrases: [
        "There are several reasons why…",
        "The first reason lies in…",
        "A second cause is…",
        "…the boundary between … and … has become blurred.",
        "Several practical solutions can help.",
        "At the individual level, … On a national level, …",
        "If these measures were widely adopted, X would enjoy Y while Z would benefit from…",
      ],
      strategyEn:
        "For problem-solution essays, dedicate one body paragraph to causes and another to solutions. Give at least two causes and two solutions, and match them where possible.",
      strategyUz:
        "Muammo-yechim eseida bitta abzatsni sabablarga, ikkinchisini yechimlarga bagʻishlang. Kamida ikkita sabab va ikkita yechim keltiring, iloji boʻlsa ularni bir-biriga bogʻlang.",
    },
    {
      id: "task2-city-cars",
      title: "Cars in City Centres",
      prompt:
        "Some governments are trying to reduce the number of private cars in city centres by making public transport cheaper and closing streets to traffic.\n\nDo the advantages of this approach outweigh the disadvantages?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Advantages/Disadvantages",
      sampleAnswer:
        "In cities around the world, growing concern about congestion and pollution has led governments to discourage private car use in central districts. In my view, although this policy causes some short-term inconvenience, its long-term advantages clearly outweigh the disadvantages.\n\nOn the negative side, restricting cars can create real difficulties, especially at first. Elderly people and those with mobility problems may struggle to reach shops or medical appointments without door-to-door transport. Local businesses in newly pedestrianised streets sometimes complain of lost customers, and workers who commute from areas poorly served by public transport can face longer, more expensive journeys. If cheaper buses and trains are not introduced quickly enough, the burden falls disproportionately on lower-income residents who cannot easily change where they live.\n\nHowever, the benefits are substantial and become more visible over time. Reducing private cars sharply improves air quality, which is especially important for children and the elderly. Streets closed to traffic can be reclaimed for pedestrians, cyclists and green spaces, making city centres more attractive and, contrary to the fears above, often more profitable for shops in the long run. Cities such as Copenhagen and Utrecht have shown that once safe cycling infrastructure exists, the share of daily journeys made by bicycle can rise dramatically, easing pressure on the entire transport system.\n\nOn balance, the disadvantages of restricting cars are real but temporary, provided that governments invest simultaneously in better buses, trams and cycle lanes. The gains — cleaner air, quieter streets and healthier residents — are lasting, and I therefore believe this is a policy worth pursuing.",
      usefulPhrases: [
        "In my view, although X causes some short-term inconvenience, its long-term advantages clearly outweigh…",
        "On the negative side, …",
        "…the burden falls disproportionately on lower-income residents…",
        "However, the benefits are substantial and become more visible over time.",
        "Contrary to the fears above, …",
        "On balance, the disadvantages of X are real but temporary, provided that …",
        "The gains — cleaner air, quieter streets and healthier residents — are lasting.",
      ],
      strategyEn:
        "For 'do the advantages outweigh the disadvantages?' essays, take a clear side. Write one body paragraph on the weaker side (disadvantages) and one on the stronger side (advantages), then give a nuanced conclusion.",
      strategyUz:
        "'Afzalliklari kamchiliklaridan ustunmi?' savoliga aniq javob bering. Bir abzatsda kamchiliklarni, ikkinchisida afzalliklarni koʻrsating va xulosani nuansli qiling.",
    },
    {
      id: "task2-online-shopping",
      title: "The Rise of Online Shopping",
      prompt:
        "Nowadays, more and more people prefer to shop online rather than in traditional shops.\n\nWhat are the reasons for this trend? Is this development a positive or a negative one?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Two-Part Question",
      sampleAnswer:
        "In the last decade, online retailers such as Amazon and Alibaba have transformed the way consumers buy everything from books to groceries. Several factors explain this shift, and although it brings genuine convenience, on balance I regard it as a mixed development rather than an unambiguously positive one.\n\nThe first reason for the popularity of online shopping is convenience. Customers can compare prices, read reviews and place an order at any hour without leaving their homes — a particular benefit for busy parents, elderly buyers or those living far from a city centre. Second, online stores usually offer both a wider range of products and lower prices, since they avoid the costs of city-centre rent. Third, the rapid growth of same-day delivery, especially in urban areas, has removed one of the last advantages of physical shops.\n\nHowever, this convenience carries real costs. Small independent shops in town centres have closed in large numbers, hollowing out communities that once relied on them for both goods and social contact. Every online order also generates packaging waste and, often, a delivery van journey; the environmental impact of billions of small parcels is significant. There are labour concerns as well: warehouse workers in some large online firms have reported punishing conditions.\n\nWeighing these factors, I would describe the development as neither purely positive nor purely negative. Online shopping has undoubtedly improved consumer choice, but its wider social and environmental costs should not be ignored. The best outcome will be one in which physical and online retail coexist, each pushed by regulation and competition to treat workers, customers and the environment fairly.",
      usefulPhrases: [
        "Several factors explain this shift…",
        "…a particular benefit for busy parents, elderly buyers or those living far from a city centre.",
        "…usually offer both a wider range of products and lower prices, since they avoid…",
        "However, this convenience carries real costs.",
        "…hollowing out communities that once relied on them for both goods and social contact.",
        "Weighing these factors, I would describe the development as neither purely positive nor purely negative.",
        "The best outcome will be one in which X and Y coexist…",
      ],
      strategyEn:
        "Two-part questions demand answers to BOTH parts. Devote one body paragraph to each. If asked to give an opinion, make it explicit in the introduction and reinforce it in the conclusion.",
      strategyUz:
        "Ikki qismli savolda ikkala qismga ham javob bering. Har biriga bittadan abzats. Fikringiz soʻralsa — kirish qismida aniq aytib, xulosada takrorlang.",
    },
    {
      id: "task2-university-fees",
      title: "Should University Be Free?",
      prompt:
        "Some people believe that university education should be free for all students, while others argue that students should pay for their own studies.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
      type: "Discussion + Opinion",
      sampleAnswer:
        "The rising cost of higher education has reopened an old debate: should universities be free at the point of use, or is it fair to ask students to pay? Advocates on both sides make strong arguments, but I believe a mixed system — free for those who cannot afford to pay, low-cost for others — offers the most sensible balance.\n\nThose who support free tuition argue that a university degree brings benefits to society as a whole, not just to the graduate. Doctors, engineers and teachers strengthen the economy and public services, and a country therefore has a collective interest in producing them. Charging high fees, according to this view, discourages talented students from poorer families, entrenches inequality and drives graduates towards higher-paid but less socially useful careers simply to repay their debts.\n\nOn the other side, defenders of paid tuition point out that graduates typically earn substantially more over their lifetimes than those who never went to university. It seems reasonable, they argue, that those who benefit financially should share the cost. Furthermore, if the state paid for every course, there would be less incentive for students to choose their subjects carefully or to complete them promptly. Universities themselves might become complacent, knowing that funding was guaranteed regardless of teaching quality.\n\nBoth positions contain real truth. In my view, the fairest system charges nothing to students from low-income households, offers subsidised loans repayable only when the graduate is earning above a certain threshold, and asks wealthier families to make a modest contribution. Such a model preserves both social mobility and personal responsibility, without pricing bright students out of an education that ultimately benefits everyone.",
      usefulPhrases: [
        "Advocates on both sides make strong arguments, but I believe…",
        "…brings benefits to society as a whole, not just to the graduate.",
        "Charging high fees … entrenches inequality and drives graduates towards…",
        "On the other side, defenders of X point out that…",
        "It seems reasonable, they argue, that those who benefit financially should share the cost.",
        "Both positions contain real truth.",
        "Such a model preserves both social mobility and personal responsibility, without pricing bright students out of…",
      ],
      strategyEn:
        "Structure: intro (paraphrase + opinion) → view 1 (main reasons) → view 2 (main reasons) → your view + why. Avoid sitting on the fence — even a nuanced opinion is still an opinion.",
      strategyUz:
        "Struktura: kirish (savolni qayta yozing + fikringiz) → 1-fikr (asosiy sabablar) → 2-fikr (asosiy sabablar) → sizning fikringiz + sabab. Fikrsiz qolmang — hattoki nozik pozitsiya ham pozitsiya.",
    },
  ],
};
