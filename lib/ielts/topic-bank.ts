/**
 * Topic bank for the admin bulk generator (lib/ielts/generate.ts).
 *
 * Every draft gets ONE topic label, stored in GeneratedTest.topic. /plan picks
 * labels that no existing row of the same module uses yet (randomised); when a
 * bank is exhausted it reuses labels with a " (variation N)" suffix, and the
 * prompt then asks for a clearly different treatment.
 *
 * All themes are school-safe (no politics, religion, violence or other
 * sensitive subjects) and are briefs only — the model writes original content.
 * Pure data + helpers (no imports), safe anywhere.
 */

import type { GenSkill } from "./generation-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Academic Reading theme: one test = three passages on three angles of the theme. */
export interface ReadingTopic {
  topic: string;
  area: string;
  /** Passage 1 (descriptive / historical), 2 (analytical / research), 3 (argumentative). */
  angles: [string, string, string];
}

/** Listening scenario set: the four situations of one test (Parts 1–4). */
export interface ListeningSet {
  topic: string;
  parts: [string, string, string, string];
}

export type Task1Chart = "bar" | "line" | "pie" | "two pies" | "pie and bar";

export interface Task1Scenario {
  topic: string;
  chart: Task1Chart;
  /** What the chart shows (who / what / where / when). */
  subject: string;
  unit: string;
  /** Plausible data ranges / categories. */
  data: string;
}

export type EssayType =
  | "Opinion"
  | "Discussion"
  | "Advantages and disadvantages"
  | "Problem and solution"
  | "Two-part question"
  | "Positive or negative development";

export interface Task2Topic {
  topic: string;
  type: EssayType;
  /** The issue the question statement should raise. */
  issue: string;
}

export interface SpeakingTheme {
  topic: string;
  /** Part 1 topics — the first is always a "who are you" topic. */
  part1: [string, string, string];
  /** Part 2 cue-card idea ("Describe …"). */
  cue: string;
  /** Part 3 discussion theme. */
  part3: string;
}

// ---------------------------------------------------------------------------
// Academic Reading — 90 themes
// ---------------------------------------------------------------------------

const r = (topic: string, area: string, a1: string, a2: string, a3: string): ReadingTopic => ({ topic, area, angles: [a1, a2, a3] });

export const READING_TOPICS: ReadingTopic[] = [
  // Biology
  r("Bioluminescence", "biology", "how fireflies, fungi and deep-sea fish produce their own light", "what researchers have learned by decoding animal light signals", "whether glowing plants could one day replace some street lighting"),
  r("Animal navigation", "biology", "how migrating birds and sea turtles find their way over huge distances", "experiments that revealed magnetic and star compasses in animals", "whether artificial light and radio noise are confusing migrating animals"),
  r("The honeybee colony", "biology", "how a honeybee colony is organised and what each member does", "how scientists decoded the waggle dance and bees' collective decisions", "whether the boom in urban beekeeping helps or harms wild pollinators"),
  r("Slime moulds", "biology", "what slime moulds are and how they grow and move", "maze and network experiments showing problem solving without a brain", "what slime moulds suggest about how we define intelligence"),
  r("Octopus intelligence", "biology", "the unusual anatomy and nervous system of the octopus", "laboratory studies of octopus learning, memory and play", "whether an animal with such a different brain can be said to think"),
  r("Seed dispersal", "biology", "the ingenious ways plants send their seeds away from the parent", "field research on animals that carry and bury seeds", "the case for global seed banks as insurance for future harvests"),
  r("Fungal networks", "biology", "how fungi link the roots of trees beneath a forest floor", "experiments tracing carbon and nutrients moving between trees", "a debate over the popular idea of a cooperative 'wood-wide web'"),
  r("Camouflage in nature", "biology", "the main strategies animals use to avoid being seen", "how biologists test whether a camouflage pattern really works", "what designers and engineers can borrow from natural camouflage"),
  r("Life at hydrothermal vents", "biology", "the discovery of life around deep-sea hot springs", "how vent organisms survive without sunlight", "whether deep-sea mining can go ahead without destroying vent habitats"),
  r("Ant societies", "biology", "the division of labour inside an ant colony", "how ants find the shortest route to food without a leader", "what computer scientists and traffic planners have learned from ants"),
  // Earth science
  r("Predicting volcanic eruptions", "earth science", "the warning signs that a dormant volcano is waking up", "the instruments used to monitor volcanoes, from satellites to gas sensors", "why forecasting the timing of eruptions remains so difficult"),
  r("Ice cores", "earth science", "how scientists drill and date cores of ancient ice", "what trapped air bubbles reveal about past climates", "the race to collect ice from mountain glaciers before it melts"),
  r("Limestone caves", "earth science", "how caves and underground rivers form over millions of years", "the explorers and scientists who map cave systems", "how to balance cave tourism with the protection of fragile caves"),
  r("Soil", "earth science", "what soil is made of and how slowly it forms", "the hidden life of soil organisms and what they do for plants", "why soil erosion has been called a quiet crisis for farming"),
  r("Earthquake engineering", "earth science", "how ground shaking damages different kinds of buildings", "engineering methods that allow buildings to sway without collapsing", "whether traditional building methods deserve more attention from engineers"),
  r("Weather forecasting", "earth science", "forecasting from folklore and barometers to the first weather maps", "how satellites and supercomputers produce modern forecasts", "the limits of predictability and how forecasts should communicate uncertainty"),
  r("Tides and coastlines", "earth science", "why the sea rises and falls twice a day", "how tidal energy schemes capture the power of the tides", "whether eroding coastlines should be defended or allowed to retreat"),
  r("Meandering rivers", "earth science", "how rivers bend, loop and change course over time", "studies of floodplains and the results of river restoration projects", "the argument for letting some rivers flood naturally"),
  // Physics, chemistry, materials
  r("The science of colour", "physics and chemistry", "the search for new pigments from ancient times to the present", "how pigments and structural colour produce what we see", "whether cheap synthetic colours changed how people value colour"),
  r("Measuring time", "physics and chemistry", "sundials, water clocks and the first mechanical clocks", "how atomic clocks keep time to a billionth of a second", "why the leap second has divided scientists and engineers"),
  r("Superconductors", "physics and chemistry", "the accidental discovery of superconductivity", "the search for materials that superconduct at room temperature", "how exaggerated announcements can damage trust in science"),
  r("Batteries", "physics and chemistry", "the history of the battery from early experiments to lithium-ion", "research into alternative battery chemistries such as sodium", "whether recycling can keep pace with the demand for batteries"),
  r("Concrete", "materials", "the history of concrete from ancient harbours to modern towers", "why some ancient concrete has lasted for two thousand years", "the environmental cost of cement and the search for greener alternatives"),
  r("Natural rubber", "materials", "how rubber went from a curiosity to an essential industrial material", "how latex is collected and processed into rubber", "the environmental challenge of the world's discarded tyres"),
  r("Acoustics", "physics and chemistry", "how sound travels and how scientists measure loudness", "how acousticians design concert halls and lecture theatres", "whether cities should regulate everyday noise more strictly"),
  r("Magnets", "physics and chemistry", "from lodestones and compasses to the first electromagnets", "how powerful permanent magnets are made and used", "the problem of relying on scarce elements for modern magnets"),
  // Astronomy & space
  r("Light pollution", "astronomy", "how artificial light has changed the night sky", "research on the effects of night-time light on animals and people", "whether the dark-sky movement can succeed in growing cities"),
  r("Meteorites", "astronomy", "how meteorites are found, recognised and classified", "what meteorites reveal about the early solar system", "who should own a meteorite that falls on private land"),
  r("Space debris", "astronomy", "how the space around the earth became crowded with debris", "methods for tracking and removing debris from orbit", "whether shared international rules can prevent a debris crisis"),
  r("Telescopes", "astronomy", "the invention of the telescope and its first discoveries", "how modern observatories choose their remote locations", "the value of amateur astronomers to professional science"),
  r("Extremophiles", "astronomy", "organisms that live in boiling, frozen and acidic places", "what extremophiles suggest about possible life on other worlds", "whether the search for life beyond earth is worth its cost"),
  // History of technology
  r("Lighthouses", "history of technology", "from fire beacons to the first great lighthouses", "how the Fresnel lens transformed coastal lighting", "what was lost and gained when lighthouses became automated"),
  r("Canals", "history of technology", "the canal-building age and its impact on trade", "the engineering of locks, tunnels and aqueducts", "whether restoring old canals for leisure is worth the cost"),
  r("Refrigeration", "history of technology", "how people kept food cold before refrigerators", "the science behind mechanical refrigeration", "how the refrigerator changed shopping, cooking and diet"),
  r("Keyboards and typewriters", "history of technology", "the invention and spread of the typewriter", "why the QWERTY layout survived despite its critics", "whether handwriting still matters in a digital age"),
  r("Early photography", "history of technology", "the first photographic processes and their inventors", "how cameras became cheap enough for ordinary families", "whether photographs have ever been reliable records of reality"),
  r("Mapmaking", "history of technology", "how early mapmakers measured coastlines and mountains", "the technology behind satellite navigation", "whether relying on navigation apps weakens our sense of direction"),
  r("City water supply", "history of technology", "how ancient cities brought water to their citizens", "the development of modern water treatment", "whether water should cost more to encourage people to save it"),
  r("The lift", "history of technology", "early lifting machines and the invention of the safety brake", "how lifts made skyscrapers possible", "how lifts shape the way people use and experience tall buildings"),
  r("Textile machines", "history of technology", "spinning and weaving by hand before the machine age", "the inventions that mechanised textile production", "the environmental footprint of cheap, fast-changing fashion"),
  r("Radio", "history of technology", "the invention of radio broadcasting", "how radio reached remote and rural communities", "why radio has survived the arrival of television and the internet"),
  // Environment
  r("Urban trees", "environment", "the history of planting trees along city streets", "how researchers measure the cooling and health benefits of trees", "how cities should choose trees for the climate of the future"),
  r("Rewilding", "environment", "what rewilding means and where the idea began", "the return of large animals to managed landscapes", "the arguments for and against rewilding farmland"),
  r("Wetlands", "environment", "why wetlands were drained for centuries", "the value of wetlands for water quality, flood control and wildlife", "whether artificial wetlands can replace natural ones"),
  r("Invasive species", "environment", "how plants and animals have spread to new continents", "case studies of attempts to control invasive species", "whether every non-native species should be treated as a threat"),
  r("Seaweed", "environment", "the biology of seaweed and its traditional uses", "the rapid growth of seaweed farming around the world", "whether seaweed can make a real difference to carbon emissions"),
  r("Food waste", "environment", "where food is lost between the farm and the plate", "technologies that extend the shelf life of fresh food", "who should take responsibility for reducing food waste"),
  r("Mangrove forests", "environment", "how mangrove trees survive in salt water", "research on mangroves as coastal protection and carbon stores", "why some mangrove replanting projects succeed and others fail"),
  r("Peatlands", "environment", "how peat forms over thousands of years", "peatlands as one of the largest carbon stores on land", "whether gardeners and growers should stop using peat"),
  r("Wind power", "environment", "from traditional windmills to the first electric turbines", "how modern wind turbines are designed and tested", "the debate over building wind farms in open countryside"),
  r("Insect decline", "environment", "why insects matter to ecosystems and farming", "how scientists measure changes in insect populations", "what gardens, parks and roadsides can do for insects"),
  // Psychology
  r("How memory works", "psychology", "early ideas about memory and the first experiments", "research showing that memories are rebuilt each time they are recalled", "whether photos and videos change how we remember our own lives"),
  r("Habits", "psychology", "how habits form in the brain", "research on breaking old habits and building new ones", "whether willpower is less important than we think"),
  r("Boredom", "psychology", "what boredom is and why humans feel it", "studies linking boredom with creativity", "whether children should be allowed to be bored"),
  r("Choice and decision-making", "psychology", "how people make everyday choices", "experiments on 'choice overload' in shops and online", "whether nudging people towards better choices is acceptable"),
  r("Laughter", "psychology", "the evolution of laughter in humans and other animals", "what happens in the body and brain when we laugh", "whether laughter really deserves its reputation as a medicine"),
  r("Curiosity", "psychology", "how psychologists have defined and measured curiosity", "research showing how curiosity improves learning", "whether schools can teach children to be curious"),
  r("Music and the mind", "psychology", "theories about why humans began making music", "how music affects mood, memory and concentration", "whether music lessons make children better at other subjects"),
  r("Optimism", "psychology", "the discovery of the optimism bias", "studies of optimism, health and achievement", "whether realism is more useful than optimism"),
  r("Creativity", "psychology", "theories of where creative ideas come from", "research on brainstorming and creativity in groups", "whether creativity can be measured fairly"),
  r("Recognising faces", "psychology", "how babies learn to recognise faces", "research on 'super-recognisers' and people who struggle with faces", "why we see faces in clouds, cars and electrical sockets"),
  // Business & economics
  r("Working from home", "business", "the history of working from home before the internet", "research on the productivity of remote and hybrid workers", "what remote work means for the future of city centres"),
  r("Brand names", "business", "how companies choose and test names for new products", "the linguistics of memorable brand names", "what happens when a brand name becomes an ordinary word"),
  r("Supermarket design", "business", "how the self-service supermarket was invented", "research on how shoppers move through a store", "whether store layouts manipulate customers"),
  r("The sharing economy", "business", "the rise of platforms for sharing homes, cars and tools", "how online ratings help strangers trust each other", "the effects of sharing platforms on traditional businesses"),
  r("Family businesses", "business", "why some family firms survive for centuries", "research on handing a business to the next generation", "whether family businesses make better employers"),
  r("Crowdfunding", "business", "the origins of raising money from many small backers", "what makes some crowdfunding campaigns succeed", "the risks crowdfunding poses to backers and creators"),
  r("Overtourism", "business", "the growth of mass tourism since the jet age", "how economists measure the costs and benefits of tourism", "whether popular destinations can limit visitor numbers fairly"),
  r("Packaging", "business", "the history of packaging from clay jars to cardboard", "how packaging design influences what shoppers choose", "the move towards refillable and reusable packaging"),
  r("The science of queues", "business", "how queueing theory began with the telephone network", "how businesses manage waiting times", "why waiting often feels longer than it really is"),
  // Arts & culture
  r("Art restoration", "arts", "how attitudes to restoring old paintings have changed", "the scientific techniques used by modern restorers", "whether restorers should repaint the missing parts of a work"),
  r("Museums in the digital age", "arts", "the origins of public museums", "how museums digitise and share their collections", "whether a virtual visit can replace seeing the real object"),
  r("Murals and street art", "arts", "the long history of painting on public walls", "how cities commission and look after public murals", "whether street art belongs in galleries"),
  r("Traditional crafts", "arts", "why many traditional crafts declined in the twentieth century", "how craft skills are passed from one generation to the next", "the value of handmade objects in an age of mass production"),
  r("Film music", "arts", "how music accompanied silent films", "how composers use music to create emotion and suspense", "whether silence is underused in modern cinema"),
  r("Puppetry", "arts", "puppet traditions around the world", "the engineering behind modern puppets and animatronics", "why puppets still fascinate adult audiences"),
  r("Collecting", "arts", "the history of collecting, from cabinets of curiosities to modern collectors", "the psychology of why people collect", "whether important private collections should be open to the public"),
  r("Literary translation", "arts", "the history of translating literature", "how translators deal with humour, rhythm and wordplay", "whether machines could ever replace literary translators"),
  // Education
  r("Apprenticeships", "education", "the history of learning a trade from a master", "research on how people learn practical skills", "whether universities should teach more practical skills"),
  r("Homework", "education", "how homework became part of school life", "research on homework and achievement at different ages", "whether young children should be given homework at all"),
  r("Outdoor learning", "education", "the origins of forest schools and outdoor classrooms", "research on outdoor learning, attention and wellbeing", "why outdoor learning is difficult to introduce in every school"),
  r("Reading for pleasure", "education", "the history of books written for children", "research on reading for pleasure and later success", "whether screens can encourage children to read more"),
  r("Exams and testing", "education", "the history of written examinations", "the 'testing effect': why recalling information strengthens memory", "whether exams are the fairest way to assess students"),
  r("Online courses", "education", "the rise of open online courses", "research on why many online learners do not finish", "what the future holds for the traditional university lecture"),
  r("Learning through play", "education", "how ideas about children's play have changed", "research on play and the development of language and self-control", "whether organised activities are crowding out free play"),
  // Health & sport
  r("Teenagers and sleep", "health", "how sleep patterns change during adolescence", "research on school start times and teenage performance", "whether schools should start later in the morning"),
  r("Sitting and standing", "health", "how sitting became the normal posture for work", "research on the health effects of long periods of sitting", "whether standing desks really help"),
  r("Walking", "health", "how walking shaped human evolution", "research on the health benefits of everyday walking", "how cities can be designed to encourage walking"),
  r("Food labels", "health", "the history of nutrition information on food packets", "research on how shoppers read and use food labels", "whether simple colour-coded labels change what people buy"),
  r("Altitude training", "sport science", "why athletes began training in the mountains", "how the body adapts to thin air", "whether artificial altitude equipment gives athletes an unfair advantage"),
  r("Sports analytics", "sport science", "the first attempts to measure performance in sport with numbers", "how data now shapes training and team selection", "whether data is taking the unpredictability out of sport"),
  // Food, archaeology, language, cities
  r("Chocolate", "food and agriculture", "the history of cacao from ancient drinks to chocolate bars", "how cacao is grown, fermented and processed", "the challenges facing cacao farmers in a changing climate"),
  r("Rice", "food and agriculture", "the domestication and spread of rice", "research on new rice varieties and farming methods", "how rice farming can use less water"),
  r("Insects as food", "food and agriculture", "the place of insects in traditional diets", "how insects are farmed and processed for food", "whether consumers in more countries will accept insect protein"),
  r("Salt", "food and agriculture", "the importance of salt in trade and history", "how salt is produced from seas, lakes and mines", "the debate about how much salt people should eat"),
  r("Ancient trade routes", "archaeology", "the caravan and sea routes that linked distant civilisations", "archaeological evidence of long-distance trade", "what ancient trade can tell us about globalisation today"),
  r("Deciphering ancient scripts", "archaeology", "the first writing systems and what they were used for", "how forgotten scripts were deciphered", "why some ancient scripts may never be read"),
  r("Endangered languages", "language", "why languages disappear", "how communities have revived languages that had almost vanished", "whether technology can save endangered languages"),
  r("Ancient board games", "archaeology", "the oldest known board games", "how archaeologists reconstruct the rules of lost games", "why games matter to historians"),
  r("Timber skyscrapers", "architecture", "the return of wood as a building material", "how engineered timber is made and tested", "whether tall timber buildings are a sensible choice for cities"),
  r("Public squares", "architecture", "the history of the town square", "research on what makes a public space popular", "whether city centres should be closed to cars"),
  r("High-speed rail", "transport", "the history of high-speed trains", "the engineering that allows trains to travel safely at high speed", "whether high-speed rail is worth its enormous cost"),
];

// ---------------------------------------------------------------------------
// Listening — 40 scenario sets (Part 1 transaction · Part 2 social monologue ·
// Part 3 academic discussion · Part 4 lecture)
// ---------------------------------------------------------------------------

const l = (topic: string, p1: string, p2: string, p3: string, p4: string): ListeningSet => ({ topic, parts: [p1, p2, p3, p4] });

export const LISTENING_SETS: ListeningSet[] = [
  l("Cycle hire and coastal paths", "a visitor booking bicycles and a guided ride at a cycle-hire shop", "a ranger introducing a coastal nature reserve and its walking trails", "two geography students and their tutor planning a report on a coastal field trip", "a lecture on how sand dunes form and move"),
  l("Language exchange and food festival", "a student joining a language-exchange club and giving their details", "a radio presenter describing the programme of a city food festival", "two students discussing a presentation on the history of chocolate with their lecturer", "a lecture on how babies learn the sounds of their first language"),
  l("Holiday cottage and textile mill", "a caller booking a holiday cottage for a family weekend", "a guide describing a restored textile mill that is now a museum", "a student and her tutor discussing a survey on commuting habits", "a lecture on bioluminescent sea creatures"),
  l("Sports centre and community garden", "a new member joining a sports centre and choosing classes", "a volunteer coordinator describing jobs at a community garden", "three students planning a group project on packaging waste", "a lecture on the acoustics of concert halls"),
  l("House move and new library", "a customer arranging a house move with a removal company", "a librarian introducing the services of a newly renovated library", "two students and their tutor comparing sources for an essay on urban trees", "a lecture on the history of lighthouses"),
  l("Pottery course and museum placement", "an adult enrolling on an evening pottery course", "a manager describing the facilities of a new arts centre", "two students discussing their work placement at a local museum", "a lecture on how honeybees communicate"),
  l("Car hire and harbour tour", "a traveller hiring a car at an airport desk", "a heritage officer describing a walking tour of an old harbour", "two engineering students and a tutor reviewing a bridge-design assignment", "a lecture on the migration of sea turtles"),
  l("Party venue and recycling changes", "a customer booking a venue for a family celebration", "a council officer explaining changes to household recycling collections", "two students discussing research on children's reading habits", "a lecture on the history of refrigeration"),
  l("Dental practice and botanical garden", "a patient registering at a new dental practice", "a guide at a botanical garden introducing its glasshouses", "two biology students discussing an experiment on plants grown under coloured light", "a lecture on how batteries store energy"),
  l("Theatre booking and science festival", "a caller booking theatre tickets and a pre-show meal", "an organiser describing the programme of a children's science festival", "two music students and a tutor discussing a project on film soundtracks", "a lecture on the acoustics of ancient open-air theatres"),
  l("Wildlife rescue volunteers", "a person signing up as a volunteer at a wildlife rescue centre", "the centre manager explaining how injured birds and animals are cared for", "two biology students discussing fieldwork on urban foxes", "a lecture on camouflage in the animal world"),
  l("Homestay and student societies", "an international student arranging a homestay with an accommodation officer", "a student union officer describing clubs and societies at an open day", "two students and a tutor designing a questionnaire on study habits", "a lecture on the psychology of habits"),
  l("Furniture delivery and clock museum", "a customer arranging delivery and assembly of new furniture", "a museum guide describing a new gallery on the history of timekeeping", "two business students discussing a case study of a family business", "a lecture on how atomic clocks work"),
  l("Campsite and mountain trail", "a caller booking a campsite pitch and equipment hire", "a park ranger giving advice about a mountain hiking trail", "two geology students discussing a field report on limestone caves", "a lecture on how caves and underground rivers form"),
  l("Café job and town market", "a student enquiring about a part-time job at a café", "a local historian describing the history of the town market", "two students and a tutor discussing a marketing plan for a new soft drink", "a lecture on the history of tea"),
  l("Swimming lessons and leisure centre", "a parent enrolling a child in swimming lessons", "a leisure-centre manager describing refurbishment plans", "two sports-science students discussing a study of running shoes", "a lecture on how the body adapts to altitude"),
  l("Bus pass and cycle lanes", "a resident applying for a discounted bus pass", "a transport officer describing a new network of cycle lanes", "two urban-planning students discussing what makes public squares successful", "a lecture on the history of canals"),
  l("Photography workshop and gallery", "a caller booking a weekend photography workshop", "a gallery guide introducing an exhibition of early photographs", "two art-history students discussing a painting restoration project", "a lecture on early photographic processes"),
  l("Garden plot and walled garden", "a resident applying for a community garden plot", "a head gardener describing a historic walled garden", "two environmental-science students discussing a project on soil health", "a lecture on how plants disperse their seeds"),
  l("Conference registration", "a delegate registering for an academic conference", "an organiser explaining the conference venue and social programme", "two research students rehearsing a poster presentation with their supervisor", "a lecture on how weather forecasts are made"),
  l("Pet sitting and animal intelligence", "a pet owner arranging a pet-sitting service", "a vet nurse giving a talk on caring for older pets", "two psychology students discussing a study of animal intelligence", "a lecture on octopus behaviour"),
  l("Guitar lessons and summer concerts", "an adult arranging guitar lessons at a music school", "a radio host previewing a series of summer concerts in a park", "two psychology students discussing research on music and memory", "a lecture on theories of why humans make music"),
  l("English course and endangered languages", "a caller enrolling on an intensive English course", "a director welcoming new students to a language school", "two linguistics students discussing a project on an endangered language", "a lecture on how communities revive languages"),
  l("Bike service and charity ride", "a cyclist booking a bike service and repair", "a club leader describing the route of a charity bike ride", "two design students discussing ideas for a bike-sharing scheme", "a lecture on how natural rubber is produced"),
  l("Renting a flat and timber buildings", "a student enquiring about renting a flat through an agency", "a housing officer explaining how a tenants' association works", "two architecture students discussing tall timber buildings", "a lecture on how engineered timber is made"),
  l("Cookery class and food trail", "a caller booking a cookery class", "a chef describing a regional food trail", "two nutrition students discussing a survey on food labels", "a lecture on the history of the spice trade"),
  l("Kayak tour and estuary wildlife", "a tourist booking a kayak tour", "a guide describing the wildlife of a river estuary", "two students and a tutor discussing a report on wetland restoration", "a lecture on mangrove forests"),
  l("Laptop repair and online learning", "a customer booking a laptop repair", "an IT manager introducing a new online learning system to staff", "two education students and a lecturer discussing why learners drop out of online courses", "a lecture on the history of radio"),
  l("Holiday club for children", "a parent booking a place at a children's holiday club", "the club leader describing the daily programme and rules", "two education students discussing research on outdoor learning", "a lecture on play and child development"),
  l("Group rail trip and high-speed trains", "a passenger buying rail tickets for a group trip", "a station manager describing improvements to a railway station", "two business students discussing a case study of a high-speed rail line", "a lecture on the engineering of high-speed trains"),
  l("Art supplies and a public mural", "a teacher ordering art supplies for a school", "an artist talking about a public mural project", "two art students discussing the history of pigments", "a lecture on structural colour in birds and insects"),
  l("Fun run and sports data", "a runner registering for a charity fun run", "an organiser briefing volunteers on race-day arrangements", "two sports students discussing how data is used in football", "a lecture on the history of sports statistics"),
  l("Library membership and old maps", "a new resident joining a public library", "a librarian describing a local-history archive", "two history students discussing a project on old maps of their town", "a lecture on how maps were made before satellites"),
  l("School farm visit and insect farming", "a teacher booking a school visit to a farm", "a farmer describing how the farm has changed over fifty years", "two agriculture students discussing insect farming", "a lecture on the domestication of rice"),
  l("Craft fair and textile machines", "a craftsperson applying for a stall at a craft fair", "an organiser describing the history and layout of the fair", "two design students discussing a project on traditional crafts", "a lecture on the machines that transformed textile production"),
  l("Observatory evening and meteorites", "a caller booking an evening visit to an observatory", "an astronomer introducing a public stargazing event", "two physics students discussing a project on light pollution", "a lecture on meteorites"),
  l("Furniture collection and repair café", "a resident arranging the collection of old furniture for reuse", "a council officer explaining a new repair café scheme", "two students discussing a study of food waste in school canteens", "a lecture on how concrete is made and recycled"),
  l("Lakes coach tour and glaciers", "a customer booking a coach tour of a lake district", "a guide describing the history of a lakeside town", "two tourism students discussing research on visitor numbers", "a lecture on how glaciers shape landscapes"),
  l("Driving lessons and decision-making", "a learner booking a course of driving lessons", "a road-safety officer giving advice to new drivers", "two psychology students discussing research on everyday decision-making", "a lecture on the psychology of waiting in queues"),
  l("Museum membership and telescopes", "a family buying an annual museum membership", "a museum educator describing workshops for schools", "two students discussing an experiment on curiosity and learning", "a lecture on the history of the telescope"),
];

// ---------------------------------------------------------------------------
// Writing Task 1 — 30 chart scenarios
// ---------------------------------------------------------------------------

const t1 = (topic: string, chart: Task1Chart, subject: string, unit: string, data: string): Task1Scenario => ({ topic, chart, subject, unit, data });

export const TASK1_SCENARIOS: Task1Scenario[] = [
  t1("Bar chart: museum visitors", "bar", "the number of visitors to four types of museum (art, science, history and transport) in one city in 2015, 2020 and 2025", "thousand visitors", "values between about 20 and 400"),
  t1("Bar chart: household devices", "bar", "the percentage of households owning four electronic devices in three countries in 2024", "%", "values between about 20 and 98"),
  t1("Bar chart: seasonal rainfall", "bar", "average monthly rainfall in summer and in winter in five cities", "mm", "values between about 5 and 300"),
  t1("Bar chart: university subjects", "bar", "the number of students choosing five university subjects in 2010 and 2025", "students", "values between about 300 and 5,000"),
  t1("Bar chart: renewable energy", "bar", "electricity produced from four renewable sources in three regions of one country", "gigawatt hours", "values between about 50 and 2,000"),
  t1("Bar chart: market fruit prices", "bar", "the average price of four kinds of fruit in three seasons at a city market", "dollars per kilogram", "values between about 1 and 12"),
  t1("Bar chart: travel to work", "bar", "the percentage of workers using five ways of travelling to work in two cities", "%", "values between about 2 and 55"),
  t1("Bar chart: book sales by format", "bar", "sales of printed books, e-books and audiobooks in four categories at one publisher in 2024", "thousand copies", "values between about 5 and 300"),
  t1("Bar chart: water use at home", "bar", "average daily water use per person for five purposes in two countries", "litres", "values between about 5 and 150"),
  t1("Bar chart: leisure by age", "bar", "the average number of hours per week that four age groups spent on reading, gaming and sport", "hours per week", "values between about 1 and 15"),
  t1("Line graph: public transport journeys", "line", "the number of journeys made by bus, tram and metro in one city between 2000 and 2025", "million journeys", "values between about 10 and 120, six time points"),
  t1("Line graph: ice-cream sales", "line", "monthly sales of three kinds of ice cream at one company over a year", "thousand units", "values between about 5 and 90, twelve months"),
  t1("Line graph: internet access", "line", "the percentage of homes with internet access in four countries between 1998 and 2023", "%", "values between about 2 and 98, six time points"),
  t1("Line graph: international students", "line", "the number of international students at three universities between 2010 and 2024", "students", "values between about 500 and 6,000, eight time points"),
  t1("Line graph: library visitors by hour", "line", "the number of visitors to a public library at different times of day on weekdays and at weekends", "visitors", "values between about 0 and 250, hourly from 9 am to 8 pm"),
  t1("Line graph: seabird colonies", "line", "the number of breeding pairs of three seabird species on an island between 1990 and 2025", "breeding pairs", "values between about 100 and 4,000, eight time points"),
  t1("Line graph: household waste", "line", "the amount of household waste recycled, composted and sent to landfill in one city between 2005 and 2025", "thousand tonnes", "values between about 10 and 300, five time points"),
  t1("Line graph: cinema and streaming", "line", "cinema tickets sold and streaming subscriptions in one country between 2012 and 2024", "million", "values between about 1 and 60, seven time points"),
  t1("Line graph: coffee consumption", "line", "coffee consumption per person in four countries between 2000 and 2020", "kg per person", "values between about 1 and 10, five time points"),
  t1("Line graph: electricity demand in a day", "line", "electricity demand in one city over a typical day in summer and in winter", "megawatts", "values between about 200 and 1,200, every three hours"),
  t1("Pie charts: university spending", "two pies", "how a university spent its budget in 2005 and in 2025", "%", "5–6 categories such as teaching staff, research, buildings, student services, IT"),
  t1("Pie charts: electricity sources", "two pies", "the sources of electricity in one country in 2000 and in 2025", "%", "5–6 sources such as coal, gas, nuclear, wind, solar, hydro"),
  t1("Pie charts: household spending", "two pies", "how an average household spent its income in 1985 and in 2025", "%", "6 categories such as housing, food, transport, leisure, clothing, other"),
  t1("Pie charts: household rubbish", "two pies", "the types of waste produced by households in one city in 2010 and in 2025", "%", "5–6 types such as food, paper, plastic, glass, metal, other"),
  t1("Pie charts: news sources by age", "two pies", "the main sources of news for people aged 18–30 and people over 60 in one country", "%", "5 sources such as television, websites, social media, radio, newspapers"),
  t1("Pie chart: a school day", "pie", "how pupils at one secondary school spent a typical school day", "%", "5–6 activities such as lessons, homework, breaks, sport, clubs, travel"),
  t1("Pie chart: restaurant orders", "pie", "how customers ordered from a restaurant chain in one year", "%", "5 channels such as in person, phone, own app, delivery platforms, website"),
  t1("Pie chart: park visits", "pie", "the main reasons visitors gave for visiting a national park", "%", "5–6 reasons such as walking, wildlife, cycling, picnics, photography, other"),
  t1("Pie and bar chart: city visitors", "pie and bar", "the main purpose of visits to one city in 2024 (pie chart) and the average amount each type of visitor spent per day (bar chart)", "% (pie) and dollars per day (bar)", "4–5 purposes such as holiday, business, visiting friends, study, other"),
  t1("Pie and bar chart: commuting", "pie and bar", "how employees of a large company travelled to work (pie chart) and their average journey time by type of transport (bar chart)", "% (pie) and minutes (bar)", "4–5 types such as car, bus, train, bicycle, walking"),
];

// ---------------------------------------------------------------------------
// Writing Task 2 — 40 essay topics
// ---------------------------------------------------------------------------

const t2 = (topic: string, type: EssayType, issue: string): Task2Topic => ({ topic, type, issue });

export const TASK2_TOPICS: Task2Topic[] = [
  t2("Free entry to museums", "Opinion", "whether all museums and galleries should be free for everyone"),
  t2("Cooking lessons at school", "Opinion", "whether every child should be taught to cook at school"),
  t2("Teaching handwriting", "Opinion", "whether schools should stop teaching handwriting now that most writing is typed"),
  t2("Work experience at university", "Opinion", "whether every university course should include a period of work experience"),
  t2("Car-free city centres", "Opinion", "whether private cars should be banned from city centres"),
  t2("Compulsory school sport", "Opinion", "whether sport should be compulsory until the end of secondary school"),
  t2("Flexible working hours", "Opinion", "whether employers should allow staff to choose their own working hours"),
  t2("Online reviews", "Opinion", "whether online reviews by customers are more useful than the opinions of experts"),
  t2("Starting school", "Discussion", "whether children should start formal schooling at an early age or later, after more time for play"),
  t2("Spending on space exploration", "Discussion", "whether money spent on space exploration would be better spent on problems on earth"),
  t2("Zoos", "Discussion", "whether zoos protect endangered animals or are an outdated form of entertainment"),
  t2("Living near work", "Discussion", "whether people should choose a home close to their workplace or accept a long journey to live somewhere they prefer"),
  t2("Part-time jobs for teenagers", "Discussion", "whether secondary-school students should have part-time jobs"),
  t2("Renting or buying a home", "Discussion", "whether it is better to rent a home or to buy one"),
  t2("Tourism in small communities", "Discussion", "whether tourism helps or harms small traditional communities"),
  t2("Repairing or replacing", "Discussion", "whether people should be encouraged to repair broken goods rather than buy new ones"),
  t2("Studying abroad", "Advantages and disadvantages", "more young people choosing to complete their whole degree in another country"),
  t2("Robots in the home", "Advantages and disadvantages", "robots and smart devices doing more household tasks"),
  t2("Early foreign-language learning", "Advantages and disadvantages", "children beginning to learn a foreign language in their first year of primary school"),
  t2("Shopping online", "Advantages and disadvantages", "people buying most of their goods online instead of in local shops"),
  t2("Life in a megacity", "Advantages and disadvantages", "more and more people living in cities with over ten million inhabitants"),
  t2("Tablets instead of textbooks", "Advantages and disadvantages", "schools replacing printed textbooks with tablets"),
  t2("A cashless society", "Advantages and disadvantages", "cash disappearing as almost all payments become digital"),
  t2("Gap years", "Advantages and disadvantages", "young people taking a year off between school and university"),
  t2("Traffic congestion", "Problem and solution", "worsening traffic congestion in fast-growing cities"),
  t2("Children spending less time outdoors", "Problem and solution", "children spending much less time playing outdoors than in the past"),
  t2("The decline of local shops", "Problem and solution", "small independent shops closing in town centres"),
  t2("Food waste at home", "Problem and solution", "households throwing away large amounts of edible food"),
  t2("Loneliness in older age", "Problem and solution", "more older people living alone and feeling isolated"),
  t2("Litter in public places", "Problem and solution", "litter in parks, streets and on beaches"),
  t2("A shortage of skilled trades", "Problem and solution", "a shortage of skilled tradespeople such as plumbers and electricians"),
  t2("Young people reading less", "Problem and solution", "young people reading fewer books for pleasure"),
  t2("Why people collect things", "Two-part question", "why many people collect objects such as stamps, coins or toys, and whether this is a worthwhile hobby"),
  t2("The wish to be famous", "Two-part question", "why so many young people want to become famous, and whether this is a positive or negative trend"),
  t2("Moving to the countryside", "Two-part question", "why some people move from cities to the countryside, and what problems they may face"),
  t2("Disappearing traditional skills", "Two-part question", "why some traditional skills and crafts are disappearing, and how they could be kept alive"),
  t2("Neighbours", "Two-part question", "why many people today do not know their neighbours, and whether this matters"),
  t2("Working from home", "Positive or negative development", "more people working from home for most of the week"),
  t2("Children with smartphones", "Positive or negative development", "children being given their own smartphone at a younger age"),
  t2("Translation apps", "Positive or negative development", "travellers relying on translation apps instead of learning some of the local language"),
];

// ---------------------------------------------------------------------------
// Speaking — 40 themes
// ---------------------------------------------------------------------------

const s = (topic: string, part1: [string, string, string], cue: string, part3: string): SpeakingTheme => ({ topic, part1, cue, part3 });

export const SPEAKING_THEMES: SpeakingTheme[] = [
  s("A piece of useful advice", ["Work or studies", "Breakfast", "Bicycles"], "a piece of advice you received that turned out to be very useful", "Advice and decision-making"),
  s("A place with a beautiful view", ["Your hometown", "Taking photos", "Windows"], "a place you have visited that had a beautiful view", "Tourism and the natural world"),
  s("Something a child taught you", ["Your home", "Toys", "Birthdays"], "a time when a child taught you something", "Children and learning"),
  s("A handmade gift", ["Your local area", "Gifts", "Handwriting"], "a handmade gift that you gave or received", "Gifts and consumer culture"),
  s("A long walk", ["Work or studies", "Walking", "Maps"], "a long walk that you enjoyed", "Exercise and city life"),
  s("A neighbour you know well", ["Your home", "Neighbours", "Noise"], "a neighbour you know well", "Communities"),
  s("A favourite café", ["Your hometown", "Cooking", "Snacks"], "a café or restaurant you often go to", "Eating out and food culture"),
  s("A very busy day", ["Work or studies", "Weekends", "Making plans"], "a time when you had a lot to do in a short time", "Time management"),
  s("A useful piece of technology", ["Your local area", "Computers", "Emails"], "a piece of technology (not a phone) that you find useful", "Technology in daily life"),
  s("A historic place", ["Your hometown", "History", "Museums"], "a historic building or place you have visited", "Heritage and preservation"),
  s("A skill from an older person", ["Your home", "Hobbies", "Tools"], "a skill you learned from an older person", "Generations and skills"),
  s("A memorable bus or train journey", ["Work or studies", "Public transport", "Travelling alone"], "a memorable journey you made by bus or train", "Transport and travel"),
  s("A book to recommend", ["Your local area", "Reading", "Libraries"], "a book you would recommend to a friend", "Reading habits"),
  s("A change of opinion", ["Your hometown", "Shopping", "Newspapers and magazines"], "a time when you changed your opinion about something", "Opinions and persuasion"),
  s("A new outdoor activity", ["Your home", "Parks", "Picnics"], "an outdoor activity you tried for the first time", "Leisure and nature"),
  s("Someone good at their job", ["Work or studies", "Uniforms", "Getting up early"], "someone you know who is very good at their job", "Work and careers"),
  s("A local festival", ["Your hometown", "Festivals", "Dancing"], "a local festival you enjoy, such as a food, music or harvest festival", "Traditions and culture"),
  s("Something you want to learn", ["Your local area", "Learning languages", "Science"], "something you would like to learn in the future", "Lifelong learning"),
  s("Helping a stranger", ["Your home", "Helping others", "Smiling"], "a time when you helped someone you did not know", "Kindness and society"),
  s("A river, lake or beach", ["Your hometown", "Swimming", "Boats"], "a river, lake or beach you like to visit", "Water and the environment"),
  s("A useful app", ["Work or studies", "Apps", "Mobile phones"], "an app that you find very useful", "Digital life"),
  s("Arriving late", ["Your local area", "Being on time", "Alarm clocks"], "a time when you arrived late for something important", "Time and punctuality"),
  s("A sports event", ["Your home", "Sport", "Teams"], "a sports event you watched, either live or on screen", "Sport and society"),
  s("A special photograph", ["Your hometown", "Photos", "Memories"], "a photograph that means a lot to you", "Memories and technology"),
  s("A modern building", ["Your local area", "Buildings", "Shops"], "a modern building in your town or city", "Cities and architecture"),
  s("A song with memories", ["Work or studies", "Singing", "Concerts"], "a song that brings back memories for you", "Music and culture"),
  s("A goal you achieved", ["Your home", "Goals", "Morning routines"], "a goal you worked hard to achieve", "Ambition and success"),
  s("A science lesson", ["Your hometown", "Science", "Mathematics"], "a science lesson or experiment you remember from school", "Science education"),
  s("A small local business", ["Your local area", "Markets", "Advertisements"], "a small business in your area that you like", "Business and shopping"),
  s("A crowded place", ["Your home", "Crowds", "Queuing"], "a time when you were in a very crowded place", "Population and public spaces"),
  s("A culture you would like to know", ["Work or studies", "Foreign food", "Travel"], "a country whose culture you would like to learn more about", "Cultural exchange"),
  s("A garden or park", ["Your hometown", "Plants", "Flowers"], "a garden or park you enjoy visiting", "Green spaces in cities"),
  s("An online course or video", ["Your local area", "Online learning", "Video calls"], "an online course or video that helped you learn something", "Education and technology"),
  s("A job for the future", ["Your home", "Jobs", "Childhood"], "a job you would like to do in the future", "Work and the future"),
  s("A quiet place", ["Your hometown", "Relaxing", "Silence"], "a quiet place where you like to spend time", "Noise and modern life"),
  s("A meal you cooked", ["Work or studies", "Cooking", "Kitchens"], "a meal you cooked for other people", "Food and family life"),
  s("An important decision", ["Your local area", "Making choices", "Advice"], "an important decision you made with help from other people", "Decisions and responsibility"),
  s("A trip that changed plans", ["Your home", "Holidays", "Packing"], "a trip that did not go as planned", "Travel and tourism"),
  s("A talented person", ["Your hometown", "Talents", "Art"], "a talented person you know", "Talent and hard work"),
  s("A message that made you happy", ["Work or studies", "Messages", "Letters"], "a message or letter that made you happy", "Communication"),
];

// ---------------------------------------------------------------------------
// Lookup + picking
// ---------------------------------------------------------------------------

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

const VARIATION_RE = /^(.*?)\s*\(variation\s+(\d+)\)\s*$/i;

/** "Bioluminescence (variation 3)" → { base: "Bioluminescence", variation: 3 }. */
export function parseTopic(label: string): { base: string; variation: number } {
  const m = VARIATION_RE.exec(label ?? "");
  if (!m) return { base: (label ?? "").trim(), variation: 1 };
  return { base: m[1].trim(), variation: Math.max(1, Number(m[2]) || 1) };
}

export function withVariation(base: string, variation: number): string {
  return variation > 1 ? `${base} (variation ${variation})` : base;
}

/** Topic labels available for a skill. */
export function topicLabels(skill: GenSkill): string[] {
  switch (skill) {
    case "READING":
      return READING_TOPICS.map((t) => t.topic);
    case "LISTENING":
      return LISTENING_SETS.map((t) => t.topic);
    case "WRITING_TASK1":
      return TASK1_SCENARIOS.map((t) => t.topic);
    case "WRITING_TASK2":
      return TASK2_TOPICS.map((t) => t.topic);
    case "SPEAKING":
      return SPEAKING_THEMES.map((t) => t.topic);
  }
}

function find<T extends { topic: string }>(list: T[], label: string): T | null {
  const base = norm(parseTopic(label).base);
  return list.find((t) => norm(t.topic) === base) ?? null;
}

export const findReadingTopic = (label: string): ReadingTopic | null => find(READING_TOPICS, label);
export const findListeningSet = (label: string): ListeningSet | null => find(LISTENING_SETS, label);
export const findTask1Scenario = (label: string): Task1Scenario | null => find(TASK1_SCENARIOS, label);
export const findTask2Topic = (label: string): Task2Topic | null => find(TASK2_TOPICS, label);
export const findSpeakingTheme = (label: string): SpeakingTheme | null => find(SPEAKING_THEMES, label);

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `count` topic labels for new drafts. Labels already present in
 * `usedTopics` (the topic column of existing rows of the same module, with or
 * without a variation suffix) are skipped; once every label is used, labels
 * are reused — least-used first — as "<label> (variation N)".
 */
export function pickTopics(
  skill: GenSkill,
  count: number,
  usedTopics: (string | null | undefined)[],
  random: () => number = Math.random
): string[] {
  const labels = topicLabels(skill);
  const used = new Map<string, number>(); // normalised base label → highest variation in use
  for (const t of usedTopics) {
    if (!t) continue;
    const { base, variation } = parseTopic(t);
    const key = norm(base);
    used.set(key, Math.max(used.get(key) ?? 0, variation));
  }
  const out: string[] = [];
  for (const label of shuffle(labels.filter((x) => !used.has(norm(x))), random)) {
    if (out.length >= count) break;
    out.push(label);
    used.set(norm(label), 1);
  }
  while (out.length < count && labels.length) {
    const pool = shuffle(labels, random).sort((a, b) => (used.get(norm(a)) ?? 0) - (used.get(norm(b)) ?? 0));
    for (const label of pool) {
      if (out.length >= count) break;
      const next = (used.get(norm(label)) ?? 0) + 1;
      out.push(withVariation(label, next));
      used.set(norm(label), next);
    }
  }
  return out;
}
