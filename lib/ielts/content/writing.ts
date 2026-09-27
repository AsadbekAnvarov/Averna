import type { WritingPrompt } from "../../writing-data";

/** Joins model-answer paragraphs with the blank line the UI expects. */
const paras = (...p: string[]): string => p.join("\n\n");

const SUMMARISE = "Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
const REASONS = "Give reasons for your answer and include any relevant examples from your own knowledge or experience.";

/**
 * Original Averna Writing tasks (added to the built-in prompts).
 * All topics, wording and chart data are invented for Averna.
 */
export const WRITING_SEED: { task1: WritingPrompt[]; task2: WritingPrompt[] } = {
  task1: [
    {
      id: "averna-t1-01",
      title: "Bar Chart: Leisure Time by Age Group",
      type: "Bar chart",
      prompt: paras(
        "The bar chart below shows the average number of hours per week that people in four age groups spent watching television, using social media and exercising in one country in 2024.",
        SUMMARISE
      ),
      chart: [
        {
          kind: "bar",
          unit: "hours per week",
          groups: ["16–24", "25–39", "40–59", "60+"],
          series: [
            { name: "Watching television", values: [6, 9, 13, 19] },
            { name: "Using social media", values: [17, 11, 6, 3] },
            { name: "Exercising", values: [6, 4, 3, 5] },
          ],
        },
      ],
      sampleAnswer: paras(
        "The bar chart compares how many hours a week people in four age groups in one country spent watching television, using social media and exercising in 2024.",
        "Overall, age made a striking difference to how people used their free time. Television viewing rose steadily from the youngest group to the oldest, whereas time on social media fell just as consistently, so the two ends of the age range showed almost opposite habits. By comparison, the time devoted to exercise was low and fairly stable across all four groups.",
        "Among 16- to 24-year-olds, social media was by far the most popular activity, occupying around 17 hours a week, almost three times as long as they spent either watching television or exercising (6 hours each). In the 25–39 group, the gap narrowed considerably, with social media (11 hours) only slightly ahead of television (9 hours).",
        "From the age of 40, the pattern was reversed. People aged 40–59 watched television for about 13 hours a week, more than twice as long as they spent on social media (6 hours), and the over-60s spent 19 hours in front of the television but just 3 hours on social media, even less than the 5 hours they spent exercising. Exercise itself dipped from 6 hours among the youngest group to a low of 3 hours among 40- to 59-year-olds, before recovering slightly in the oldest group."
      ),
      usefulPhrases: [
        "The bar chart compares how many hours a week … spent …",
        "Overall, age made a striking difference to …",
        "…rose steadily from the youngest group to the oldest, whereas … fell just as consistently.",
        "…almost three times as long as they spent …",
        "From the age of 40, the pattern was reversed.",
        "…dipped to a low of … before recovering slightly …",
      ],
      strategyEn:
        "When a bar chart compares groups such as age bands, look for a pattern that runs across all of them: here, two activities move in opposite directions as people get older. Put that contrast in your overview, then describe the younger and older groups in separate paragraphs with carefully selected figures.",
      strategyUz:
        "Ustunli diagramma (bar chart) yosh guruhlari kabi toifalarni taqqoslaganda, barcha guruhlar boʻylab davom etadigan qonuniyatni qidiring: bu yerda yosh oshgani sari ikki faoliyat qarama-qarshi yoʻnalishda oʻzgaradi. Shu qarama-qarshilikni umumiy xulosaga (overview) kiriting, soʻng yoshroq va kattaroq guruhlarni alohida abzaslarda puxta tanlangan raqamlar bilan tasvirlang.",
    },
    {
      id: "averna-t1-02",
      title: "Bar Chart: Household Recycling Rates",
      type: "Bar chart",
      prompt: paras(
        "The bar chart below shows the percentage of five types of household waste that were recycled in a European city in 2012, 2018 and 2024.",
        SUMMARISE
      ),
      chart: [
        {
          kind: "bar",
          unit: "%",
          groups: ["Paper", "Glass", "Metal cans", "Plastic", "Food waste"],
          series: [
            { name: "2012", values: [48, 55, 38, 12, 3] },
            { name: "2018", values: [61, 63, 45, 24, 15] },
            { name: "2024", values: [72, 68, 53, 41, 34] },
          ],
        },
      ],
      sampleAnswer: paras(
        "The bar chart shows what proportion of five categories of household waste, namely paper, glass, metal cans, plastic and food waste, was recycled in a European city in 2012, 2018 and 2024.",
        "Overall, recycling rates improved for every type of waste over the twelve-year period. Paper and glass were consistently the most widely recycled materials, while plastic and food waste, despite starting from a very low base, recorded by far the most dramatic growth.",
        "In 2012, glass had the highest recycling rate at 55%, slightly ahead of paper (48%), with metal cans some way behind at 38%. Paper then rose more quickly than glass, and by 2024 it had taken first place with 72%, while the figure for glass climbed more modestly to 68%. The rate for metal cans also increased steadily, reaching just over half (53%) by the end of the period.",
        "The most striking changes, however, concerned the two least recycled categories. Only 12% of plastic waste was recycled in 2012, but this proportion doubled by 2018 and reached 41% in 2024. Food waste showed an even more remarkable rise: from a mere 3% at the start of the period, it jumped to 15% in 2018 and 34% in 2024, more than eleven times its original level. Even so, both materials were still recycled less than any of the other three in the final year."
      ),
      usefulPhrases: [
        "The bar chart shows what proportion of … was recycled in …",
        "…despite starting from a very low base, …",
        "…recorded by far the most dramatic growth.",
        "…by 2024 it had taken first place with …",
        "…this proportion doubled by …",
        "…more than eleven times its original level.",
      ],
      strategyEn:
        "With three years and five categories, don't describe the chart year by year. Group the categories that behave alike, such as the high recyclers and the fast risers, and make the time comparison inside each paragraph, highlighting any change in ranking.",
      strategyUz:
        "Uch yil va beshta toifa boʻlsa, diagrammani yilma-yil tasvirlamang. Oʻxshash oʻzgargan toifalarni birlashtiring (masalan, eng koʻp qayta ishlanadiganlar va eng tez oʻsganlar) va har bir abzas ichida yillarni taqqoslang, oʻrinlar almashgan holatlarni alohida taʼkidlang.",
    },
    {
      id: "averna-t1-03",
      title: "Line Graph: Visitors to Three Attractions",
      type: "Line graph",
      prompt: paras(
        "The line graph below shows the number of visitors to a castle, an aquarium and a science museum in one coastal town between 2010 and 2024.",
        SUMMARISE
      ),
      chart: [
        {
          kind: "line",
          unit: "thousand visitors",
          xLabels: ["2010", "2012", "2014", "2016", "2018", "2020", "2022", "2024"],
          series: [
            { name: "Castle", values: [200, 190, 175, 160, 150, 145, 190, 230] },
            { name: "Aquarium", values: [90, 110, 130, 150, 165, 170, 172, 175] },
            { name: "Science museum", values: [60, 65, 70, 95, 130, 150, 185, 205] },
          ],
        },
      ],
      sampleAnswer: paras(
        "The line graph illustrates how many people visited three attractions in a coastal town, namely a castle, an aquarium and a science museum, between 2010 and 2024.",
        "Overall, all three attractions were busier at the end of the period than at the start, although they followed quite different paths. The castle lost visitors for a decade before recovering strongly to finish in first place, while the science museum showed the most spectacular growth.",
        "In 2010, the castle was the town's most popular attraction, with 200,000 visitors, compared with 90,000 for the aquarium and just 60,000 for the science museum. Over the next ten years, however, the castle's figures fell steadily to a low of 145,000 in 2020. The aquarium, meanwhile, grew consistently and overtook the castle in around 2017, before its visitor numbers levelled off at roughly 170,000 to 175,000 from 2020 onwards.",
        "The science museum saw only modest increases until 2014, when it received 70,000 visitors, but its popularity then rose rapidly. By 2020 it had overtaken the castle, and it passed the aquarium shortly afterwards, reaching 205,000 by 2024, more than three times its original total. The castle, too, enjoyed a remarkable revival after 2020, climbing to 230,000 visitors in 2024, the highest figure recorded by any of the attractions during the period."
      ),
      usefulPhrases: [
        "…although they followed quite different paths.",
        "…lost visitors for a decade before recovering strongly to …",
        "…fell steadily to a low of … in …",
        "…overtook … in around 2017, before its numbers levelled off at …",
        "…enjoyed a remarkable revival after …",
        "…the highest figure recorded by any of the … during the period.",
      ],
      strategyEn:
        "When lines cross several times, the overview should say which line finished on top and which changed most, not describe every crossing point. In the body, follow one or two lines at a time and give crossings approximate dates, such as 'in around 2017', rather than inventing exact years.",
      strategyUz:
        "Chiziqlar bir necha marta kesishsa, umumiy xulosada har bir kesishuvni emas, balki oxirida qaysi chiziq yuqorida boʻlgani va qaysi biri eng koʻp oʻzgarganini ayting. Asosiy qismda bir vaqtning oʻzida bir-ikkita chiziqni kuzatib boring va kesishuvlar uchun aniq yilni oʻylab topmasdan, 'in around 2017' kabi taxminiy vaqtni koʻrsating.",
    },
    {
      id: "averna-t1-04",
      title: "Line Graph: Cash, Card and Mobile Payments",
      type: "Line graph",
      prompt: paras(
        "The graph below shows the proportion of everyday purchases in one country that were paid for in cash, by bank card and by mobile phone between 2004 and 2024.",
        SUMMARISE
      ),
      chart: [
        {
          kind: "line",
          unit: "% of purchases",
          xLabels: ["2004", "2008", "2012", "2016", "2020", "2024"],
          series: [
            { name: "Cash", values: [80, 71, 59, 45, 28, 18] },
            { name: "Bank card", values: [20, 28, 38, 47, 53, 48] },
            { name: "Mobile phone", values: [0, 1, 3, 8, 19, 34] },
          ],
        },
      ],
      sampleAnswer: paras(
        "The line graph shows how the share of everyday purchases paid for in cash, by bank card and by mobile phone changed in one country over the twenty years from 2004 to 2024.",
        "Overall, cash went from being the dominant method of payment to the least common one, while cards and, more recently, mobile phones took its place. By the end of the period, cards were still the most popular option, although their share had begun to fall as mobile payments surged.",
        "In 2004, four out of five purchases (80%) were made with cash, and the remaining fifth were paid for by card, as mobile payments were not yet in use. Over the following years, the use of cash declined steadily, and cards finally overtook it shortly before 2016, when they accounted for 47% of transactions compared with 45% for cash. Card payments peaked at 53% in 2020 before dipping slightly to 48% in 2024.",
        "Mobile phone payments grew very slowly at first, representing only 3% of purchases in 2012 and 8% in 2016. After that, however, they took off, rising to 19% in 2020 and 34% in 2024. As a result, phones had overtaken cash by the end of the period, when cash accounted for just 18% of purchases, less than a quarter of its level two decades earlier."
      ),
      usefulPhrases: [
        "…went from being the dominant method of payment to the least common one…",
        "…four out of five purchases (80%) were made with…",
        "…finally overtook it shortly before 2016, when…",
        "…peaked at … in 2020 before dipping slightly to …",
        "…grew very slowly at first. After that, however, they took off…",
        "…less than a quarter of its level two decades earlier.",
      ],
      strategyEn:
        "When the lines show percentages of one whole, one method can only grow at another's expense, so describe the changes as a shift in shares. Use fractions such as 'four out of five' or 'a fifth' alongside percentages to vary your language.",
      strategyUz:
        "Chiziqlar bitta butunning foizlarini koʻrsatsa, bir usul faqat boshqasi hisobiga oʻsishi mumkin, shuning uchun oʻzgarishlarni ulushlarning siljishi sifatida tasvirlang. Tilni rang-barang qilish uchun foizlar bilan birga 'four out of five' yoki 'a fifth' kabi kasrlardan ham foydalaning.",
    },
    {
      id: "averna-t1-05",
      title: "Pie Charts: A Student's Monthly Budget",
      type: "Pie chart",
      prompt: paras(
        "The pie charts below show how the monthly spending of a typical university student in one city was divided between six categories in 2004 and 2024.",
        SUMMARISE
      ),
      chart: [
        {
          kind: "pie",
          unit: "%",
          title: "2004",
          slices: [
            { label: "Rent", value: 35 },
            { label: "Food", value: 25 },
            { label: "Transport", value: 10 },
            { label: "Books and study materials", value: 12 },
            { label: "Leisure", value: 13 },
            { label: "Phone and internet", value: 5 },
          ],
        },
        {
          kind: "pie",
          unit: "%",
          title: "2024",
          slices: [
            { label: "Rent", value: 48 },
            { label: "Food", value: 20 },
            { label: "Transport", value: 8 },
            { label: "Books and study materials", value: 4 },
            { label: "Leisure", value: 11 },
            { label: "Phone and internet", value: 9 },
          ],
        },
      ],
      sampleAnswer: paras(
        "The two pie charts compare how a typical university student in one city divided their monthly spending between six categories in 2004 and 2024.",
        "Overall, rent was the largest expense in both years, and its share grew so much that by 2024 it consumed almost half of a student's budget. Consequently, almost every other category took up a smaller proportion of spending, the one notable exception being phone and internet costs.",
        "Rent accounted for just over a third (35%) of students' monthly outgoings in 2004, but this figure had risen to 48% twenty years later, making it more than twice as large as any other item. Phone and internet bills, although still a relatively minor expense, also became more significant, almost doubling from 5% to 9% of the total.",
        "All the remaining categories shrank. Food, the second-largest item in both years, fell from a quarter of the budget to a fifth, while the shares for leisure and transport declined more modestly, from 13% to 11% and from 10% to 8% respectively. The most dramatic drop concerned books and study materials. Having represented 12% of spending in 2004, a similar share to leisure, they made up only 4% in 2024, just a third of their earlier level."
      ),
      usefulPhrases: [
        "The two pie charts compare how … divided … between …",
        "…its share grew so much that by 2024 it consumed almost half of…",
        "…the one notable exception being…",
        "…accounted for just over a third (35%) of…",
        "…fell from a quarter of the budget to a fifth…",
        "…from 13% to 11% and from 10% to 8% respectively.",
      ],
      strategyEn:
        "For two pie charts from different years, compare each category across the years instead of describing one pie and then the other. Group the categories that grew and those that shrank, and start with the biggest slice and the biggest change.",
      strategyUz:
        "Turli yillarga oid ikkita doiraviy diagrammada avval bittasini, keyin ikkinchisini tasvirlamang — har bir toifani yillar boʻyicha taqqoslang. Oʻsgan va qisqargan toifalarni alohida guruhlang hamda eng katta ulush va eng katta oʻzgarishdan boshlang.",
    },
    {
      id: "averna-t1-06",
      title: "Pie and Bar Chart: International Visitors",
      type: "Pie chart and bar chart",
      prompt: paras(
        "The pie chart below shows the main reasons why international visitors travelled to one country in 2023, and the bar chart compares how much visitors in four of these groups spent per day, on average, in 2019 and 2023.",
        SUMMARISE
      ),
      chart: [
        {
          kind: "pie",
          unit: "%",
          title: "Main purpose of visit, 2023",
          slices: [
            { label: "Holiday", value: 46 },
            { label: "Visiting friends/family", value: 22 },
            { label: "Business", value: 17 },
            { label: "Study", value: 9 },
            { label: "Other", value: 6 },
          ],
        },
        {
          kind: "bar",
          unit: "US$ per visitor per day",
          groups: ["Holiday", "Friends/family", "Business", "Study"],
          series: [
            { name: "2019", values: [118, 52, 210, 40] },
            { name: "2023", values: [135, 58, 188, 47] },
          ],
        },
      ],
      sampleAnswer: paras(
        "The pie chart shows the main reasons why international visitors travelled to one country in 2023, while the bar chart compares the average amount that visitors in four of these groups spent per day in 2019 and 2023.",
        "Overall, holidaymakers made up by far the largest group of visitors, but business travellers were the biggest spenders, despite being the only group whose daily spending fell between the two years.",
        "According to the pie chart, almost half of all visitors (46%) came on holiday in 2023. Visiting friends or family was the second most common reason for travelling, at 22%, followed by business trips (17%) and study (9%), while the remaining 6% came for other purposes.",
        "Turning to spending, business visitors spent the most per day in both years, although their average fell from $210 in 2019 to $188 in 2023. Holidaymakers came second, and in contrast to business travellers, their daily spending rose, from $118 to $135. The two remaining groups spent far less. Those visiting friends or family increased their spending only slightly, from $52 to $58 a day, and students remained the most economical visitors, even though their average rose from $40 to $47. As a result, in 2023 a business visitor typically spent four times as much each day as a student."
      ),
      usefulPhrases: [
        "The pie chart shows …, while the bar chart compares …",
        "…made up by far the largest group of…",
        "…despite being the only group whose … fell…",
        "According to the pie chart, almost half of all…",
        "Turning to spending, …",
        "…spent four times as much each day as…",
      ],
      strategyEn:
        "When a task combines two different charts, describe each one clearly but link them in your overview; here, the largest group is not the one that spends the most. Use a signposting phrase such as 'Turning to…' when you move from one chart to the other.",
      strategyUz:
        "Topshiriqda ikki xil diagramma berilgan boʻlsa, har birini aniq tasvirlang, lekin umumiy xulosada ularni bir-biriga bogʻlang — bu yerda eng katta guruh eng koʻp pul sarflaydigan guruh emas. Bir diagrammadan ikkinchisiga oʻtayotganda 'Turning to…' kabi bogʻlovchi iboradan foydalaning.",
    },
  ],

  task2: [
    {
      id: "averna-t2-01",
      title: "Solar Panels on Every New Home",
      type: "Opinion",
      prompt: paras(
        "Some people believe that every new house and flat should be required by law to have solar panels and other energy-saving features, even though this would make new homes more expensive to buy.",
        "To what extent do you agree or disagree?",
        REASONS
      ),
      sampleAnswer: paras(
        "As governments search for ways to cut carbon emissions, housing has come under growing scrutiny, since heating, cooling and lighting homes account for a large share of the energy every country uses. Some argue that all new homes should therefore be legally obliged to include solar panels and similar features, whatever the effect on prices. I agree with this proposal in principle, provided that the extra cost is not simply passed on to the buyers who can least afford it.",
        "The strongest argument for such a law is that it tackles the problem at the cheapest possible moment. Installing panels, insulation and efficient windows while a building is under construction costs far less than adding them decades later, and most homes will stand for fifty years or more. A house built to high standards today will therefore produce lower emissions for half a century. Moreover, the owners benefit directly: lower electricity and heating bills can, over time, more than repay the higher purchase price, which makes an energy-efficient home a sound investment rather than a luxury.",
        "Nevertheless, the concern about affordability is a serious one. In many cities, young people already struggle to buy their first home, and even a modest rise in prices could push ownership further out of reach. It would be unjust if a policy designed to protect the planet mainly benefited wealthier households, while lower-income families remained in older, poorly insulated flats with high energy bills.",
        "For this reason, I believe the requirement should be combined with financial support. Governments could offer lower taxes or cheaper mortgages on energy-efficient homes, and they could expect developers to absorb part of the cost, since large construction firms can reduce it considerably by buying equipment in bulk. In this way, the long-term savings would be shared fairly instead of becoming a barrier for first-time buyers.",
        "In conclusion, making solar panels and energy-saving features compulsory in new homes is a sensible and forward-looking measure, as long as it is accompanied by policies that protect first-time buyers from the higher prices it might otherwise cause."
      ),
      usefulPhrases: [
        "…has come under growing scrutiny, since …",
        "I agree with this proposal in principle, provided that …",
        "The strongest argument for such a law is that …",
        "…a sound investment rather than a luxury.",
        "Nevertheless, the concern about … is a serious one.",
        "…as long as it is accompanied by policies that …",
      ],
      strategyEn:
        "In a 'to what extent' essay, a qualified position such as 'I agree, provided that…' works well, but state it clearly in the introduction and repeat it in the conclusion. Give each body paragraph one job: the main reason for your view, the strongest objection, and how that objection can be answered.",
      strategyUz:
        "'To what extent' turidagi esseda 'I agree, provided that…' kabi shartli pozitsiya yaxshi ishlaydi, ammo uni kirish qismida aniq ayting va xulosada takrorlang. Har bir asosiy abzasga bitta vazifa bering: fikringizning asosiy sababi, eng kuchli eʼtiroz va bu eʼtirozga qanday javob berish mumkinligi.",
    },
    {
      id: "averna-t2-02",
      title: "A Daily Tax on Tourists",
      type: "Discussion",
      prompt: paras(
        "Some people think that visitors to popular tourist cities should pay a special daily tax to help protect those cities, while others believe that such a tax would discourage tourism and damage the local economy.",
        "Discuss both views and give your own opinion.",
        REASONS
      ),
      sampleAnswer: paras(
        "Every summer, the most famous historic cities fill with far more visitors than their narrow streets and ancient buildings were designed to hold. One proposed response is a daily charge for tourists, although opponents warn that it could drive visitors, and their money, elsewhere. While both positions have merit, I believe that a modest tax, clearly spent on the city itself, is fair and ultimately benefits tourists as well as residents.",
        "Those in favour of a tourist tax argue that visitors impose real costs on the places they enjoy. Large crowds increase the need for street cleaning, policing, public toilets and the repair of monuments, yet these services are largely funded by local taxpayers, many of whom never profit from tourism. A small daily fee would shift part of this burden onto the people who create it. In addition, a charge could help to spread visitors more evenly through the year if it were higher in the peak months and lower in quieter seasons.",
        "On the other hand, critics point out that tourism supports countless jobs in hotels, restaurants, shops and transport. Travellers on a tight budget, such as students and young families, may choose a cheaper destination if the total cost of their holiday rises, and the small businesses that depend on them could suffer. There is also a risk that the money raised will disappear into general government spending rather than being used to improve the city.",
        "In my view, these objections are reasons to design the tax carefully rather than to reject it. A charge of a few dollars a day is unlikely to deter someone who has already paid for flights and accommodation, particularly if the revenue is visibly spent on cleaner streets, better public transport and restored landmarks. In that case, visitors themselves enjoy a better experience in return for their contribution.",
        "In conclusion, although concerns about the local economy are understandable, a moderate tourist tax that is openly reinvested in the city seems to me the fairest way to protect popular destinations for future visitors and residents alike."
      ),
      usefulPhrases: [
        "While both positions have merit, I believe that …",
        "Those in favour of … argue that …",
        "…would shift part of this burden onto the people who create it.",
        "On the other hand, critics point out that …",
        "…these objections are reasons to design … carefully rather than to reject it.",
        "…for future visitors and residents alike.",
      ],
      strategyEn:
        "In a 'discuss both views' essay, present each view fairly in its own paragraph, even the one you disagree with, using neutral reporting language such as 'critics point out that…'. Make your own opinion clear in the introduction and develop it in a separate paragraph before the conclusion.",
      strategyUz:
        "'Discuss both views' turidagi esseda har bir fikrni, hatto siz qoʻshilmaydiganini ham, alohida abzasda xolis bayon qiling va 'critics point out that…' kabi betaraf iboralardan foydalaning. Oʻz fikringizni kirish qismida aniq bildiring va xulosadan oldin alohida abzasda rivojlantiring.",
    },
    {
      id: "averna-t2-03",
      title: "The Four-Day School Week",
      type: "Advantages and disadvantages",
      prompt: paras(
        "In some countries, schools are considering a four-day week, with longer school days from Monday to Thursday and no lessons on Fridays.",
        "Do the advantages of this change outweigh the disadvantages?",
        REASONS
      ),
      sampleAnswer: paras(
        "The traditional five-day school week has remained largely unchanged for generations, but a number of education authorities are now debating whether to compress it into four longer days. Although this reform offers some attractive benefits, particularly for teachers and school budgets, I believe that its disadvantages for pupils and their families are more significant.",
        "Supporters of the four-day week can point to several advantages. Schools would save money on heating, electricity and transport for one day in five, and these savings could be spent on books or equipment. A long weekend might also make teaching a more attractive profession at a time when many countries are struggling to recruit staff, and teachers could use the free day for planning and training. In addition, older students would gain a full day each week for independent study, sport or part-time work.",
        "However, these benefits come at a considerable cost. Longer school days are exhausting, especially for younger children, whose concentration tends to fall sharply in the late afternoon, so an extra hour of lessons at that time may add very little real learning. The free Friday also creates a serious problem for working parents, who would have to find and pay for childcare, and families on low incomes would be hit hardest. Furthermore, for some children school is the place where they receive a healthy meal and adult supervision, so losing a day of school means losing both.",
        "When these points are weighed against each other, the drawbacks appear more serious because they fall on the most vulnerable people: young children and poorer families. The savings for schools, by contrast, are relatively small and could be achieved in other ways, such as improving the energy efficiency of school buildings.",
        "In conclusion, while a four-day week may appeal to teachers and budget-conscious authorities, I believe that its disadvantages clearly outweigh its advantages, and that a traditional week with better-organised days would serve pupils far better."
      ),
      usefulPhrases: [
        "…has remained largely unchanged for generations, but …",
        "Although this reform offers some attractive benefits, I believe that …",
        "Supporters of … can point to several advantages.",
        "However, these benefits come at a considerable cost.",
        "…families on low incomes would be hit hardest.",
        "When these points are weighed against each other, …",
      ],
      strategyEn:
        "For 'do the advantages outweigh the disadvantages?', you must reach a verdict, not just list points. Explain why one side weighs more, for example because it affects more people or more vulnerable people, and make the same verdict clear in both the introduction and the conclusion.",
      strategyUz:
        "'Do the advantages outweigh the disadvantages?' savolida shunchaki fikrlarni sanab oʻtish yetarli emas — aniq hukm chiqarishingiz kerak. Nima uchun bir tomon ogʻirroq ekanini tushuntiring (masalan, u koʻproq odamga yoki himoyaga muhtoj odamlarga taʼsir qiladi) va bu hukmni kirish qismida ham, xulosada ham aniq ifodalang.",
    },
    {
      id: "averna-t2-04",
      title: "Noise in Cities",
      type: "Problem and solution",
      prompt: paras(
        "In many cities, noise levels have risen sharply in recent years.",
        "What are the main causes of this problem, and what measures could be taken to reduce it?",
        REASONS
      ),
      sampleAnswer: paras(
        "For many city dwellers, silence has become a rare luxury. The constant roar of traffic, the drilling of construction sites and music from late-night venues now form the everyday background to urban life. This essay will examine the main reasons for rising noise levels and suggest how city authorities and builders could make cities quieter.",
        "The most obvious cause is the growth of road traffic. As cities expand, more cars, motorbikes and delivery vans travel through residential streets, and the popularity of online shopping means that vans now stop outside almost every building daily. A second cause is the pace of construction: in fast-growing cities, new apartment blocks and roads are built continuously, and much of this work involves heavy machinery that runs from early in the morning. Finally, people now live much more closely together. Modern flats are often built quickly with thin walls and floors, so noise from neighbours, bars and restaurants travels easily into people's homes.",
        "Several measures could reduce the problem. Traffic noise can be tackled by lowering speed limits in residential areas, laying quieter road surfaces and encouraging electric buses and cars, which are far quieter at low speeds. Construction work should be restricted to reasonable hours, with meaningful fines for companies that break the rules. In addition, building regulations could require better sound insulation in new flats, while city planners could keep late-night entertainment in clearly defined districts, away from streets where families live.",
        "It is also worth recognising that noise is a public health issue rather than a mere annoyance. Long-term exposure has been linked to poor sleep, stress and difficulty concentrating, so local authorities should measure noise as carefully as they measure air pollution and publish the results, allowing residents to hold them to account.",
        "In conclusion, urban noise is largely a consequence of heavy traffic, constant building work and crowded housing. A combination of quieter transport, stricter rules on construction and better-designed buildings could give city residents back some of the peace they have lost."
      ),
      usefulPhrases: [
        "…has become a rare luxury.",
        "This essay will examine the main reasons for … and suggest how …",
        "The most obvious cause is …",
        "A second cause is the pace of …",
        "Several measures could reduce the problem.",
        "…a public health issue rather than a mere annoyance.",
      ],
      strategyEn:
        "In a causes-and-solutions essay, give two or three clear causes in one paragraph and matching solutions in the next, so that each solution answers a cause you have already explained. Specific measures, such as lower speed limits or fixed hours for building work, score higher than vague ideas like 'the government should do something'.",
      strategyUz:
        "Sabab va yechim turidagi esseda bir abzasda ikki-uchta aniq sabab keltiring, keyingisida esa ularga mos yechimlarni bering — shunda har bir yechim oldin tushuntirilgan sababga javob boʻladi. 'The government should do something' kabi umumiy gaplardan koʻra, tezlik chegarasini pasaytirish yoki qurilish ishlari uchun qatʼiy soatlar belgilash kabi aniq choralar yuqoriroq baholanadi.",
    },
    {
      id: "averna-t2-05",
      title: "Changing Career in Mid-Life",
      type: "Two-part question",
      prompt: paras(
        "These days, a growing number of people decide to start a completely different career in their forties or fifties.",
        "Why do people make this decision? What difficulties might they face?",
        REASONS
      ),
      sampleAnswer: paras(
        "The idea of a single job for life is increasingly outdated. Today it is not unusual to meet a former accountant retraining as a nurse, or an engineer who has opened a bakery at the age of fifty. This essay will explain what motivates such mid-life career changes and consider the obstacles that the people who make them are likely to meet.",
        "One major reason is that people are living and working for longer. Someone who has spent twenty years in one profession may realise that they still have another two decades of working life ahead of them, which is long enough to build a second career. Another motivation is the search for meaning. Many people choose their first job at eighteen or twenty-one, often under pressure from their parents or for financial reasons, and only later discover what they genuinely care about. Finally, economic change forces some workers to move on: when factories close or tasks are automated, retraining may be the only realistic option.",
        "However, starting again in mid-life is rarely easy. The most immediate difficulty is financial. Retraining can take several years, during which a person may earn little or nothing while still paying a mortgage or supporting children. Older career changers may also face prejudice from employers, who sometimes assume that they will be slower to learn or less willing to accept a junior position. There is a psychological challenge, too: after years of being an experienced expert, it can be humbling to become the least knowledgeable person in the room.",
        "In conclusion, people change careers later in life because they have more working years ahead of them, want more fulfilling work or have been pushed out of declining industries. Although money worries, age discrimination and the loss of status can make the transition hard, careful planning and a willingness to learn mean that many people find their second career more rewarding than their first."
      ),
      usefulPhrases: [
        "The idea of … is increasingly outdated.",
        "This essay will explain what motivates … and consider the obstacles …",
        "One major reason is that …",
        "Another motivation is the search for meaning.",
        "However, starting again in mid-life is rarely easy.",
        "…it can be humbling to become the least knowledgeable person in the room.",
      ],
      strategyEn:
        "A direct two-part question asks two separate things, so give each question its own body paragraph and answer it with two or three developed reasons. You do not need a personal opinion unless the question asks for one, but your conclusion should briefly answer both questions.",
      strategyUz:
        "Ikki qismli toʻgʻridan-toʻgʻri savolda ikki xil narsa soʻraladi, shuning uchun har bir savolga alohida asosiy abzas ajrating va unga ikki-uchta rivojlantirilgan sabab bilan javob bering. Savolda soʻralmasa, shaxsiy fikr bildirish shart emas, lekin xulosada ikkala savolga ham qisqacha javob bering.",
    },
    {
      id: "averna-t2-06",
      title: "Tracking Health with Apps",
      type: "Positive or negative development",
      prompt: paras(
        "More and more people now use smartwatches and mobile apps to record how much they sleep, exercise and eat.",
        "Is this a positive or negative development?",
        REASONS
      ),
      sampleAnswer: paras(
        "Only a decade ago, counting daily steps or measuring the quality of one's sleep required specialist equipment. Today, millions of people wear a device on their wrist that records these details automatically, and apps can analyse almost every meal. Although this trend raises legitimate concerns about privacy and obsession, I regard it as a largely positive development.",
        "The main benefit is that personal data makes healthy behaviour visible. Most people overestimate how active they are and underestimate how much they eat, and a simple step counter or food diary can reveal the truth within days. Seeing progress recorded in numbers is also highly motivating. A person who knows that they walked 4,000 steps yesterday is more likely to aim for 6,000 today, and small daily improvements of this kind can have a significant effect on long-term health. Some devices can even warn their owners about an irregular heartbeat, prompting them to see a doctor before a problem becomes serious.",
        "Nevertheless, there are genuine drawbacks. The information these devices collect is extremely personal, and users often have little idea whether it is being shared with advertisers or insurance companies. Constant self-monitoring can also become unhealthy in itself. Some users become anxious when their sleep score is low or feel guilty after missing a daily target, and for people with a history of eating disorders, calorie-counting apps may be actively harmful.",
        "In my view, however, these risks can be managed. Stronger data protection laws would make companies responsible for how they store and share health information, and users can choose to treat their devices as a helpful guide rather than a strict judge. The problems, in other words, lie in how the technology is used, not in the technology itself.",
        "In conclusion, tracking sleep, exercise and diet encourages people to take responsibility for their own health, and I therefore believe that this is a positive development overall, provided that personal data is properly protected and the numbers are kept in perspective."
      ),
      usefulPhrases: [
        "Only a decade ago, … required specialist equipment.",
        "Although this trend raises legitimate concerns about …, I regard it as a largely positive development.",
        "The main benefit is that …",
        "…can have a significant effect on long-term health.",
        "Nevertheless, there are genuine drawbacks.",
        "The problems, in other words, lie in how the technology is used, not in the technology itself.",
      ],
      strategyEn:
        "For a 'positive or negative development' question, decide which way you lean and say so in the introduction; 'largely positive' or 'mostly negative' is clearer than a neutral answer. Acknowledge the other side in one paragraph, then explain why it does not change your overall judgement.",
      strategyUz:
        "'Positive or negative development' savolida qaysi tomonga moyil ekaningizni hal qiling va buni kirish qismidayoq ayting — 'largely positive' yoki 'mostly negative' kabi javob betaraf javobdan koʻra aniqroq. Bir abzasda qarama-qarshi tomonni ham tan oling, soʻng nima uchun u umumiy xulosangizni oʻzgartirmasligini tushuntiring.",
    },
  ],
};
