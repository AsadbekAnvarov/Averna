# Requirements Document

## Introduction

Владелец Averna попросил о трёх вещах:

1. Добавить новые тесты Reading (папка `C:\Users\asadb\Downloads\Telegram Desktop\New Reading`) и Listening (папка `…\New Listening`) в обычную практику Reading / Listening «в стиле Averna, как остальные тесты» и в MOCK exam «в том же формате, что и остальные MOCK-тесты».
2. Вернуть Articles на видное место, в том числе в левое меню (каталог), «как раньше, чтобы быстро находили».
3. Сделать Listening как Reading: ученик проходит весь тест (Full test) или заходит в каждую часть отдельно. Владелец называет части «Task 1, Task 2»; в Listening это Parts 1–4.

Документ описывает, что должно получиться. Как это устроить технически, решает этап дизайна.

### Что лежит в исходных папках

**New Reading: 8 HTML-файлов, 88–100 KB каждый.** Это Volume 10, Tests 1–8. Каждый файл является самостоятельной страницей с одним встроенным скриптом. Ключ ответов лежит в литерале `correctAnswers` (40 номеров, у части ответов массив альтернатив, например `["GENERAL RELATIVITY","RELATIVITY"]`). Часть данных вопросов (утверждения для matching, варианты MCQ, банк слов) хранится в литералах скрипта, остальное в разметке. В каждом файле 3 passage и 40 вопросов (1–13, 14–26, 27–40), таймер 60:00. Картинок и объяснений к ответам нет. В шапке есть ссылка на Telegram @IELTS_Volume.

| Файл | Passages |
|---|---|
| `Volume 10 Test 1 reading.html` | The Formation of Continents and the Evolution of Species · Demystifying Yawn · Incorrect Terminology in Science |
| `Volume 10 test 2 reading.html` | A Brief History of Glassmaking · The return of the black-footed ferret · Rights for apes |
| `Volume 10 test 3 reading.html` | Sleep Study on Modern-Day Hunter-Gatherers Dispels Popular Notions · Bristlecone Pines · Loss of Rare Languages |
| `Volume 10 test 4 reading.html` | The Impact of the Potato · Solving the Problem of Waste Disposal · How to Clean a Beach |
| `Volume 10 test 5 reading.html` | Tunnelling Under the Thames · The Origin and Development of Applause · The Antikythera Mechanism |
| `Volume 10 test 6 reading.html` | Antonio Stradivari - Violin Maker Supreme · Antarctic Architecture: Halley VI · Lawrence Johnston and Hidcote Garden |
| `vol 10 test 7 reading.html` | Minds of their own · American businesses aim to support employees and their families · Literacy and Rural Communities in Australia |
| `Volume 10 test 8 reading.html` | The Life of Louis Braille · Storytelling, from prehistoric caves to modern cinemas · Reducing exposure to indoor air pollution in developing countries |

Типы вопросов: TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, MCQ, «Choose TWO/THREE letters», matching information (абзацы), matching headings, matching features (люди, даты), sentence endings, заполнение summary / notes / sentences, summary с банком слов. Все они укладываются в существующие типы групп Averna.

Особенности источника:
- В Test 2 банк слов для вопросов 27–31 объявлен как «A–J», но буквы I в нём нет (9 слов).
- В Test 5 абзацы Passage 2 пронумерованы цифрами 1–7 (для matching headings), абзацы Passage 3 помечены буквами A–G.

**New Listening: 6 HTML-файлов, 21–46 MB каждый.** Это Volume 10, Tests 1–6. Тестов 7–8 в папке нет. В каждом файле одна цельная запись на все 4 части, 40 вопросов (по 10 на часть), ключ `correctAnswers` с альтернативами (например `["8","eight"]`), транскрипт и таймер 30:00. В тестах 3–6 есть ещё `textAnswerRules` (лимиты слов и чисел) и по 40 окон «где звучит ответ» (`data-audio-start` / `data-audio-end`, в секундах). Отдельных отметок начала частей нет ни в одном файле. Записи измерены по MP3-кадрам при осмотре, без изменения файлов:

| Файл | Как встроена запись | MP3 | Длительность | Темы частей | Картинки | Окна ответов |
|---|---|---|---|---|---|---|
| `Volume 10 listening test 1.html` (33.4 MB) | data URI base64 | 23.8 MB, 128 kbps, 44.1 kHz | 25:59 | Volunteering at Mountain Festival · Bay Life Sea Trips · Dissertation on learners' vocabulary notebooks · Construction Materials | нет | нет (в транскрипте метки `[Q1 → morning]`) |
| `Volume 10 test 2 listening.html` (36.0 MB) | data URI base64 | 24.6 MB, VBR, 48 kHz | 27:13 | Instructions for a New Store Assistant · College Cycling Holiday · Student–Tutor Assignment Feedback · Extinction of Species | PNG плана магазина ≈1.1 MB (Q1–3) | нет (в транскрипте `<mark data-questions>`) |
| `Volume 10 test 3 listening.html` (46.1 MB) | упакованный gzip, `utf8-seven-bit` | 41.1 MB, 192 kbps, 48 kHz | 29:54 | Barrington Historical Buildings Tours · Buying Holiday Accommodation · Autonomous Underwater Vehicles · Life on the International Space Station | PNG карты ≈0.3 MB (Q16–20) | 40 |
| `Volume 10 test 4 listening.html` (29.0 MB) | упакованный gzip | 24.6 MB, VBR, 48 kHz | 25:21 | Campground Information · Bankside Cultural Complex · Lesson Plans · Maori Middens | PNG карты ≈0.2 MB (Q15–20) | 40 |
| `Volume 10 test 5 listening.html` (27.1 MB) | упакованный gzip | 23.8 MB, VBR, 48 kHz | 28:24 | Activities for Lily · Reading support for blind people · Career Planning Module · Preparing an Environmental Report | нет | 40 |
| `Volume 10 test 6 listening.html` (21.3 MB) | упакованный gzip | 18.2 MB, VBR, 48 kHz | 25:29 | Amateur Dramatic Society · Boats in Victoria · Education House · History of Paint | PNG схемы ≈0.2 MB (Q21–26) | 40 |

Всего ≈156 MB аудио и ≈1.8 MB картинок. Ключи ответов есть во всех 14 файлах.

### Как это устроено в Averna сейчас

- Все тесты Reading и Listening хранятся в формате `exam-v2` (`lib/ielts/types.ts`) и проходят через каталог `lib/ielts/catalog.ts`. Настоящие CDI-тесты (метка «Averna CDI», `source: "imported"`) лежат в базе как строки `GeneratedTest`. Их загружает проверяемый манифест-импорт `scripts/import-cdi-manifest.cjs`: сначала строки создаются неопубликованными, публикация идёт отдельным шагом (`docs/cdi-materials-import.md`). У Listening CDI-тестов одна цельная запись (`recordingMode: "whole"`, строка `ListeningAudio` с `partIndex = -1`, отпечаток `wholeRecordingHash`).
- Reading уже умеет «весь тест или один passage» (`?part=0…2`, карточка «Passages · practise one at a time»).
- Listening умеет проходить части отдельно только для тестов, у которых по записи на каждую часть. Для цельных записей параметр `?part` игнорируется, а карточка пишет «Separate part playback is unavailable until recording boundaries are verified». Поэтому все настоящие CDI-тесты Listening сейчас идут только целиком. Мини-задания (идея 10) и подбор практики по типу вопроса (идея 5) считают такие тесты неделимыми. Офлайн-пакеты (идея 7) не сохраняют цельные записи, а «Hear it» для них не работает: нет разметки времени.
- Mock (`cd-v1`) случайно выбирает работу, которую ученик ещё не решал: полный Reading (3 части, 40 вопросов) и полный Listening (4 части, 40 вопросов) с готовой записью.
- Articles ушли из левого меню в коммите `6adf11a` (идея 9, упрощённая навигация). До этого в разделе «Practice» был пункт «Articles» (`/article`, иконка Newspaper). Сейчас вход есть через плитку в Learning Center, карточку на дашборде и поиск в ⌘K, где команда скрыта до ввода запроса (`searchOnly`). На `/article` в меню подсвечивается «Reading». Состав меню закрепляют тесты `tests/navigation-structure.test.ts` (5 разделов, не больше 16 пунктов) и `tests/articles-catalog.test.ts`.
- Репозиторий `github.com/AsadbekAnvarov/Averna` публичный. По `docs/cdi-materials-import.md` исходники, ключи, манифест и загрузки хранятся вне публичного репозитория.

### Принятые решения и допущения

1. Исходные HTML-файлы и их скрипты не попадают в приложение и не выполняются. Содержимое переводится в `exam-v2` и показывается существующими раннерами, карточками, страницами результатов и интерфейсом Mock CDI. Это и есть «стиль Averna». Элементы интерфейса источника (таймер, заметки, переключатель темы, ссылка @IELTS_Volume) не переносятся.
2. Новые работы получают `source: "imported"` и метку «Averna CDI», как остальные CDI-тесты.
3. Идентификаторы: `cdi-v10-reading-01` … `cdi-v10-reading-08` и `cdi-v10-listening-01` … `cdi-v10-listening-06`. Названия: «Volume 10 · Reading Test N» и «Volume 10 · Listening Test N». Сложность «Medium», потому что источник её не указывает.
4. Ключи и транскрипты попадают в базу через существующий манифест-импорт (сначала неопубликованными). Код импортёра лежит в репозитории, а манифест и исходники нет. Записи и картинки размещаются на HTTPS-хостинге вне функции Vercel и вне git. Конкретный хостинг (Vercel Blob или GitHub Pages `averna-cdi-audio`) выбирает этап дизайна.
5. Оценка одной части Listening работает по тем же правилам, что и один passage Reading: результат «x из 10», точность и оценочный балл (Estimated_Band), пересчитанный на 40 вопросов и подписанный «Est. band». Band_Forecast сохраняет текущее правило (учитываются попытки от 10 вопросов). Mock остаётся только полным.
6. Границ частей в источниках нет. Импортёр предлагает кандидатов, преподаватель или администратор подтверждает их на слух. Пока все 4 границы не подтверждены, тест идёт только целиком, как сейчас. Правило действует и для новых, и для уже существующих CDI-тестов с цельной записью.
7. Пункт «Articles» возвращается в раздел «Skills» сразу после «Reading». Раньше он стоял в «Practice», но статьи ближе к чтению. В меню станет 17 пунктов, и тесты навигации обновляются под новые числа осознанно.
8. У Recording_Host бюджет объёма 1 GB. Перед загрузкой Content_Importer складывает уже занятый объём и объём новых записей и картинок (≈158 MB) и не начинает загрузку, если сумма больше 1 GB или занятый объём узнать не удалось (Requirement 20.7).
9. Ключи 14 настоящих работ хранятся вне публичного репозитория. Поэтому проверка «ключ → ответы → 40 из 40» для них выполняется в пробном запуске Content_Importer, и работа с результатом меньше 40 из 40 исключается из манифеста. `npx vitest --run` проверяет Content_Importer на синтетических Source_Paper из репозитория, без текстов passage, ключей и транскриптов New_Paper (Requirement 22.2, 22.5, 22.6).
10. Интерфейс Audio_Manager узбекский, поэтому единственная строка записи New_Listening_Paper подписана «Toʻliq yozuv» (полная запись) (Requirement 5.8).

### Открытые вопросы к владельцу

- Совпадают ли названия «Volume 10 · … Test N» и сложность «Medium» с тем, как названы уже загруженные CDI-тесты?
- Нужно ли где-то указывать источник @IELTS_Volume? В документе принято «нет»: ссылка и упоминание не переносятся (Requirement 18.5, 18.7).
- Какой хостинг аудио использовать: Vercel Blob или GitHub Pages `averna-cdi-audio`?
- Можно ли для тестов 3–6 принять автоматически найденные границы без прослушивания? В документе принято «нельзя».
- Сейчас преподаватель может задать домашнее задание «Part N» по тесту с цельной записью, но ученику открывается весь тест. Исправлять такие уже выданные задания или оставить как есть? В документе принято «оставить как есть» (Requirement 16.1), а новые такие задания отклоняются (Requirement 15.9).
- Тестов Listening 7–8 нет в папке: так и задумано?
- Test 2 Reading: показывать банк слов как в источнике (без буквы I)? В документе принято «как в источнике» (Requirement 1.9).

Работа пойдёт одним или несколькими коммитами в новой ветке поверх `feat/elegance-roadmap` (PR #135). На текст требований это не влияет.

## Glossary

- **Averna**: платформа подготовки к IELTS (Next.js 15.5, Prisma/Postgres, next-auth v5), репозиторий `c:\Users\asadb\.kiro\Averna`.
- **Source_Paper**: один исходный HTML-файл теста из папок New Reading / New Listening.
- **New_Reading_Paper**: одна из 8 работ Reading, полученных из Source_Paper папки New Reading.
- **New_Listening_Paper**: одна из 6 работ Listening, полученных из Source_Paper папки New Listening.
- **New_Paper**: New_Reading_Paper или New_Listening_Paper.
- **Content_Importer**: офлайн-инструмент, который переводит Source_Paper в работы `exam-v2`, извлекает записи и картинки, строит отчёт и манифест. Запускается вручную, в работе приложения не участвует.
- **Exam_Catalog**: каталог работ Reading/Listening (`lib/ielts/catalog.ts` и связанные модули): списки, сводки, поиск работы по id, отдача работы в браузер без ключей.
- **Exam_Grader**: существующая серверная проверка объективных ответов и сохранение результата (`lib/ielts/grading.ts`, `submitObjectiveExam`).
- **Reading_Library**: страница `/learning/reading` с карточками работ.
- **Listening_Library**: страница `/learning/listening` с карточками работ.
- **Reading_Runner**: экран прохождения Reading (`components/exam/reading-exam-runner.tsx`).
- **Listening_Runner**: экран прохождения Listening (`components/exam/listening-exam-runner.tsx`).
- **Result_Page**: страница результата `/learning/reading/result/[id]` или `/learning/listening/result/[id]`.
- **Mock_Exam**: индивидуальный компьютерный Mock (`cd-v1`, `/learning/mock-exam`, `lib/ielts/mock.ts`, `lib/ielts/mock-library.ts`, интерфейс `mock-cdi-interface.tsx` / `mock-cdi.css`).
- **Group_Mock**: групповой Mock под руководством преподавателя (`lib/group-mock/**`).
- **Recording_Host**: HTTPS-хранилище записей и картинок New_Paper вне функции Vercel.
- **Audio_Manager**: инструмент записей Listening для администратора и преподавателя (`/admin/listening-audio`, `/teacher/listening-audio`, `components/admin/listening-audio-manager.tsx`). Интерфейс на узбекском.
- **Whole_Recording**: одна исходная запись на все 4 части работы Listening (`recordingMode: "whole"`).
- **Part_Segment**: отрезок `[startMs, endMs)` Whole_Recording, который относится к одной части (Part 1–4).
- **Verified_Segments**: состояние работы, в котором все 4 Part_Segment подтверждены Staff_Member.
- **Splittable_Paper**: работа Listening, части которой можно проходить отдельно: либо у каждой части своя запись (как сейчас), либо Whole_Recording с Verified_Segments.
- **Evidence_Window**: отрезок записи из Source_Paper, где звучит ответ на конкретный вопрос (тесты Listening 3–6).
- **Estimated_Band**: балл, пересчитанный на 40 вопросов по существующему правилу `lib/ielts/bands.ts` и подписанный «Est. band».
- **Band_Forecast**: прогноз балла (`lib/forecast/band-forecast.ts`).
- **Evidence_View**: блок разбора ответа на Result_Page (идея 5): для Listening кнопки «Hear it» и «Show in transcript», для Reading кнопка «Show in text».
- **Mini_Task**: мини-задание от преподавателя по ошибкам (`lib/teacher/mini-task.ts`, идея 10).
- **Practice_Picker**: подбор части для практики по типу вопроса (`lib/review/practice-by-type.ts`, идея 5).
- **Homework_Library**: выбор работы и её части при создании домашнего задания (`lib/homework/library*.ts`, `components/teacher/homework-library-picker.tsx`).
- **Offline_Library**: офлайн-пакеты и страница `/offline` (идея 7).
- **L1_Hints**: подсказки к инструкциям на узбекском и русском (`lib/l1/hints.ts`, идея 8).
- **Student_Sidebar**: левое меню ученика (`STUDENT_NAV` в `components/layout/portal-navigation.ts`, показывается `app-sidebar.tsx`, в том числе в выдвижном меню на телефоне).
- **Phone_Tab_Bar**: нижняя панель вкладок ученика на телефоне (`STUDENT_TABS`).
- **Command_Palette**: палитра команд ⌘K (`components/command-palette.tsx`).
- **Learning_Hub**: страница `/learning` (Learning Center).
- **Student_Dashboard**: дашборд ученика с карточкой Articles (`components/dashboard/daily-article.tsx`).
- **Navigation_Tests**: `tests/navigation-structure.test.ts`, `tests/portal-navigation.test.ts`, `tests/articles-catalog.test.ts`.
- **Size_Gate**: проверка размера функций `node scripts/function-size.mjs --max-mb 60 --max-configs 1`. Сейчас ≈43.7 MB.
- **Staff_Member**: пользователь с ролью ADMIN или TEACHER.
- **Owner**: владелец Averna. Подтверждает публикацию и записи в производственную базу.

## Requirements

### Requirement 1: Конвертация новых тестов Reading

**User Story:** Как владелец Averna, я хочу перевести 8 тестов из папки New Reading в формат экзаменов Averna без потери текста и ключей, чтобы ученики решали их в том же интерфейсе, что и остальные тесты.

#### Acceptance Criteria

1. WHEN Content_Importer получает папку New Reading, THE Content_Importer SHALL создать для каждого из 8 Source_Paper одну New_Reading_Paper в формате `exam-v2` с 3 частями и вопросами 1–13, 14–26 и 27–40, названием «Volume 10 · Reading Test N», сложностью «Medium», лимитом времени 60 минут и `source: "imported"`, где N — номер теста из имени файла (например, 7 для `vol 10 test 7 reading.html`).
2. THE Content_Importer SHALL извлекать тексты, вопросы, варианты и ключи только из разметки и литералов скрипта Source_Paper, не выполняя скрипт Source_Paper и не добавляя содержимого, которого нет в источнике: объяснения к ответам у всех 40 вопросов остаются пустыми.
3. THE Content_Importer SHALL переносить заголовок и текст каждого passage так, чтобы после раскодирования HTML-сущностей и удаления тегов разметки последовательность непробельных символов совпадала с исходным passage, а число, порядок и метки абзацев совпадали с Source_Paper (например, A–I; в Passage 2 теста 5 — 1–7, в Passage 3 теста 5 — A–G).
4. THE Content_Importer SHALL сопоставлять каждую группу вопросов Source_Paper (блок «Questions N–M» источника) ровно с одним существующим типом группы по виду задания: TRUE/FALSE/NOT GIVEN → `tfng`; YES/NO/NOT GIVEN → `ynng`; MCQ с одним ответом → `mcq`; «Choose TWO/THREE letters» → `mcq-multi`; matching information, matching headings, matching features и sentence endings → `matching`; заполнение summary / notes / sentences без банка слов → `gap`; summary с банком слов → `gap-box`.
5. THE Content_Importer SHALL переносить все альтернативы ключа Source_Paper (например `["GENERAL RELATIVITY","RELATIVITY"]`) в список принятых ответов вопроса с тем же номером, а для группы `mcq-multi` объединять буквы ключа всех её номеров (например, 14–15) в один набор, общий для каждого номера группы, с числом букв, равным числу вопросов группы.
6. WHEN ключ ответов Source_Paper отправлен как ответы ученика на соответствующую New_Reading_Paper (для каждого вопроса — любая одна из альтернатив его ключа, для группы `mcq-multi` — все буквы ключа группы в любом порядке), THE Exam_Grader SHALL засчитать 40 верных ответов из 40.
7. WHEN Content_Importer повторно запускается на Source_Paper с теми же байтами, THE Content_Importer SHALL выдавать побайтно идентичные работы и манифест независимо от даты и времени запуска и от порядка файлов в папке.
8. THE Content_Importer SHALL записывать в каждую New_Reading_Paper имя исходного файла без изменения регистра и пробелов (например, `Volume 10 test 2 reading.html`) и SHA-256 байтов Source_Paper в виде 64 шестнадцатеричных символов в нижнем регистре.
9. IF в Source_Paper объявленный диапазон букв или меток не совпадает с фактическим списком вариантов или абзацев (например, банк слов теста 2 для вопросов 27–31 объявлен как A–J, но в нём 9 слов и нет буквы I), THEN THE Content_Importer SHALL сохранить буквы и тексты вариантов как в источнике, без перебуквовки и без добавления недостающих вариантов, и записать в отчёт импорта предупреждение с именем файла и номерами вопросов.
10. IF New_Reading_Paper не проходит `validateReadingTest` с требованием полного теста (3 части, 40 уникальных номеров), THEN THE Content_Importer SHALL исключить эту работу из манифеста, записать ошибки проверки вместе с именем файла в отчёт импорта и продолжить обработку остальных Source_Paper.
11. IF в Source_Paper нет литерала `correctAnswers`, ключ содержит не ровно 40 номеров 1–40, у вопроса из разметки нет ключа или группу вопросов нельзя сопоставить ни с одним типом из критерия 4, THEN THE Content_Importer SHALL не создавать New_Reading_Paper для этого файла, записать в отчёт импорта ошибку с именем файла и номерами затронутых вопросов и продолжить обработку остальных Source_Paper.
12. THE Content_Importer SHALL переносить в каждую группу инструкцию с той же последовательностью непробельных символов, что в Source_Paper, лимит слов источника вместе с допуском числа (например, «NO MORE THAN TWO WORDS AND/OR A NUMBER»), общий список вариантов с ключами источника (буквы или римские цифры) и разрешение выбирать один вариант несколько раз, если инструкция Source_Paper это допускает (например, «You may use any letter more than once»).

### Requirement 2: Новые тесты Reading в обычной практике

**User Story:** Как ученик, я хочу видеть новые тесты Reading в библиотеке рядом с остальными тестами Averna CDI и решать их целиком или по одному passage, чтобы тренироваться так же, как на других тестах.

#### Acceptance Criteria

1. WHEN Owner публикует New_Reading_Paper, THE Reading_Library SHALL не позже чем через 300 секунд показывать карточку этой работы среди полных тестов с названием «Volume 10 · Reading Test N», меткой «Averna CDI», меткой сложности «Medium», строкой «40 questions · 60 min» и кнопкой «Start full test» (после публикации всех 8 работ на странице 8 таких карточек).
2. THE Reading_Library SHALL располагать карточки по существующему правилу сортировки каталога: полные тесты перед короткой практикой, внутри полных тестов работы Averna CDI перед остальными, внутри работ Averna CDI в естественном порядке названий без учёта регистра с числовым сравнением чисел (Test 2 перед Test 10), так что New_Reading_Paper идут по возрастанию номера от Test 1 до Test 8.
3. THE Reading_Library SHALL показывать на карточке каждой New_Reading_Paper ровно 3 строки «Reading Passage 1» … «Reading Passage 3», каждая с названием passage из Source_Paper, диапазоном вопросов («Questions 1–13», «Questions 14–26», «Questions 27–40»), временем «20 min» и ссылкой «Open this passage only» на `/learning/reading/<id>?part=0`, `?part=1` и `?part=2` соответственно.
4. WHEN ученик открывает New_Reading_Paper без параметра `part` или с параметром `part`, значение которого не является целым числом от 0 до 2 (например `part=3`, `part=-1`, `part=abc`), THE Reading_Runner SHALL показать полный тест: все 3 passage, вопросы 1–40 и таймер с отсчётом от 60:00.
5. WHEN ученик открывает New_Reading_Paper с параметром `part=i`, где i является целым числом от 0 до 2 (в том числе по ссылке домашнего задания «Passage i+1»), THE Reading_Runner SHALL показать только passage i+1 с вопросами этого passage под исходными номерами (1–13, 14–26 или 27–40) и таймер с отсчётом от 20:00.
6. WHEN ученик отправляет ответы на New_Reading_Paper, THE Result_Page SHALL показать число верных ответов из числа вопросов попытки (40 для полного теста; 13, 13 или 14 для passage 1, 2 или 3, пустые ответы считаются неверными), точность в процентах с округлением до целого, балл с подписью «Band» по таблице Academic Reading для 40 вопросов или с подписью «Est. band» (Estimated_Band) для одного passage, а в разборе под каждым неверным или пустым ответом кнопку «Show in text», которая выделяет фрагмент passage; если существующий поиск фрагмента не нашёл фрагмент для вопроса, кнопка у этого вопроса не показывается.
7. THE Homework_Library SHALL предлагать преподавателю для каждой New_Reading_Paper 4 варианта: «Full test» (40 вопросов, 60 min) и «Passage 1», «Passage 2», «Passage 3» (13, 13 и 14 вопросов, по 20 min).
8. THE Exam_Catalog SHALL передавать New_Reading_Paper в Reading_Runner без ключей ответов, без списков принятых альтернатив и без объяснений к ответам, как в полном режиме, так и в режиме одного passage.
9. IF New_Reading_Paper не опубликована, THEN THE Averna SHALL не показывать её карточку в Reading_Library и Homework_Library, а при открытии `/learning/reading/<id>` перенаправлять ученика на `/learning/reading` без показа содержимого работы.
10. IF таймер Reading_Runner дошёл до 0:00 до отправки ответов на New_Reading_Paper, THEN THE Reading_Runner SHALL заблокировать ввод ответов и отправить сохранённые ответы автоматически, без окна проверки перед отправкой.
11. IF отправка ответов на New_Reading_Paper не удалась (нет сети или истекла сессия), THEN THE Reading_Runner SHALL показать сообщение об ошибке с кнопкой повторной отправки, сохранить введённые ответы в браузере и при повторной отправке той же попытки создать не больше одного результата.

### Requirement 3: Новые тесты Reading в Mock exam

**User Story:** Как ученик, я хочу получать новые тесты Reading в Mock exam в том же формате, что и остальные Mock-тесты, чтобы пробный экзамен был разнообразнее.

#### Acceptance Criteria

1. THE Mock_Exam SHALL включать в набор Reading-работ для нового Mock каждую опубликованную New_Reading_Paper, у которой ровно 3 части и 40 уникальных целых номеров вопросов от 1 до 40, не позже чем через 300 секунд после публикации (время кэша каталога).
2. WHEN ученик начинает новый Mock, THE Mock_Exam SHALL выбрать Reading-работу случайно среди подходящих по критерию 1 New_Reading_Paper и существующих полных Reading-работ, которые ученик ещё не решал, а если таких нет, то случайно среди всех подходящих работ (решённой считается работа, по которой у ученика есть сохранённый результат практики целиком или по любому её passage `<id>#p<N>`, либо работа, выданная ему в предыдущей попытке Mock_Exam или Group_Mock).
3. WHILE идёт Reading-секция Mock с New_Reading_Paper, THE Mock_Exam SHALL показывать в существующем интерфейсе Mock CDI все 3 passage с метками абзацев источника (в том числе цифры 1–7 в Passage 2 теста 5), поле ответа для каждого из 40 вопросов всех типов групп работы (`tfng`, `ynng`, `mcq`, `mcq-multi`, `matching`, `gap`, `gap-box`), таймер 60 минут от начала секции, состояние автосохранения черновика и кнопку отправки, как для остальных работ, и не передавать ключи ответов в браузер.
4. WHEN преподаватель создаёт или запускает сессию Group_Mock, THE Group_Mock SHALL включать в пул Reading-работ сессии каждую New_Reading_Paper, подходящую по критерию 1, и учитывать её при подсчёте вместимости сессии (наименьшее из чисел готовых работ Listening, Reading, Writing Task 1 и Task 2, но не больше 30 участников).
5. THE Mock_Exam SHALL выдавать New_Reading_Paper только целиком (все 3 passage, 40 вопросов), без выбора отдельного passage, и сохранять результат секции для всей работы с ключом содержимого `<id>` без суффикса `#p<N>`.
6. IF New_Reading_Paper не опубликована или не проходит проверку структуры из критерия 1 (другое число частей, число вопросов не равно 40, повтор номера, номер вне 1–40), THEN THE Mock_Exam SHALL исключить её из выбора Reading-работ и из подсчёта готовых Reading-работ, по которому Mock_Exam решает, можно ли начать Mock, а остальные работы выдавать без изменений.
7. WHEN ученик отправляет Reading-секцию Mock с New_Reading_Paper или 60 минут секции истекают, THE Mock_Exam SHALL оценить 40 ответов через Exam_Grader с учётом всех альтернатив ключа и показать Band по таблице Academic Reading для 40 вопросов, а ответы, присланные позже чем через 5 секунд после окончания 60 минут, не принимать и оценивать последний автосохранённый черновик.
8. IF New_Reading_Paper снята с публикации после того, как Mock_Exam или Group_Mock выдал её в попытку ученика, THEN THE Mock_Exam SHALL дать ученику закончить и отправить Reading-секцию этой попытки с той же работой, сохранить черновик ответов и результат и не выдавать эту работу в новые попытки.

### Requirement 4: Конвертация новых тестов Listening

**User Story:** Как владелец Averna, я хочу перевести 6 тестов из папки New Listening в формат экзаменов Averna с ключами, транскриптами и картинками, чтобы ученики слушали их в интерфейсе Averna.

#### Acceptance Criteria

1. WHEN Content_Importer получает папку New Listening, THE Content_Importer SHALL создать ровно 6 New_Listening_Paper, по одной на каждый Source_Paper тестов 1–6, без заготовок для отсутствующих тестов 7–8. Каждая работа имеет формат `exam-v2`, режим Whole_Recording, название «Volume 10 · Listening Test N», сложность «Medium», `source: "imported"` и 4 части «Part 1» … «Part 4» с вопросами 1–10, 11–20, 21–30, 31–40 и темой части из Source_Paper (например, «Volunteering at Mountain Festival» для Part 1 теста 1).
2. THE Content_Importer SHALL извлекать вопросы, варианты, ключи и транскрипт из разметки и литералов скрипта Source_Paper, не выполняя скрипты Source_Paper, и сопоставлять каждую группу вопросов ровно с одним существующим типом группы (`tfng`, `ynng`, `mcq`, `mcq-multi`, `matching`, `gap`, `gap-box`). Для каждой группы переносятся инструкция, общий список вариантов, лимит слов и разрешение числа: в тестах 3–6 из `textAnswerRules`, в тестах 1–2 из текста инструкции группы (например, «ONE WORD AND/OR A NUMBER»).
3. THE Content_Importer SHALL переносить все альтернативы ключа Source_Paper в том же написании и порядке (например `["8","eight"]`, `["0.8",".8","nought point eight","point eight"]`) в список принятых ответов вопроса с тем же номером, а для групп «Choose TWO/THREE letters» записывать на каждый вопрос группы полный набор правильных букв этой группы.
4. WHEN ключ ответов Source_Paper отправлен как ответы ученика на соответствующую New_Listening_Paper, THE Exam_Grader SHALL засчитать 40 верных ответов из 40 для каждой из 6 работ в двух вариантах отправки: с первой альтернативой каждого ответа и с последней.
5. THE Content_Importer SHALL делить транскрипт Source_Paper на 4 части так, чтобы каждый фрагмент, привязанный к вопросу n, попал в часть с вопросом n. Реплики и имена говорящих переносятся так, чтобы последовательность непробельных символов каждой реплики (без отметок ответов) совпадала с источником. Отметки ответов источника (`[Qn → …]` в тесте 1, `data-questions` в тестах 2–6) сохраняются как привязка фрагмента транскрипта к номеру вопроса и не входят в текст реплики.
6. WHERE Source_Paper содержит Evidence_Window для вопроса (тесты 3–6, по 40 окон на тест), THE Content_Importer SHALL сохранять начало и конец Evidence_Window для этого номера вопроса в целых миллисекундах (значение источника в секундах × 1000 с округлением до ближайшего целого) и не создавать Evidence_Window для вопросов, у которых его нет в источнике (все вопросы тестов 1–2).
7. WHERE группа вопросов Source_Paper содержит встроенное изображение (план в тесте 2 для Q1–3, карта в тесте 3 для Q16–20, карта в тесте 4 для Q15–20, схема в тесте 6 для Q21–26), THE Content_Importer SHALL извлекать изображение в отдельный PNG-файл, побайтно совпадающий с декодированными встроенными данными, и записывать в группу HTTPS-адрес на Recording_Host и непустой альтернативный текст длиной до 200 символов. Альтернативный текст берётся из атрибута alt источника, а если он пуст или отсутствует, составляется на английском из вида изображения и диапазона вопросов (например, «Map for Questions 16–20»).
8. THE Content_Importer SHALL записывать в каждую New_Listening_Paper имя исходного файла и SHA-256 байтов Source_Paper (64 шестнадцатеричных символа в нижнем регистре).
9. WHEN та же версия Content_Importer повторно запускается на тех же Source_Paper, THE Content_Importer SHALL выдавать побайтно идентичные работы, файлы записей, файлы изображений и манифест.
10. IF New_Listening_Paper не проходит `validateListeningTest` с требованием полного теста (4 части по 10 вопросов, сквозная нумерация с 1, положительная измеренная длительность и SHA-256 записи), THEN THE Content_Importer SHALL исключить эту работу из манифеста, записать в отчёт импорта имя файла и все ошибки проверки и продолжить обработку остальных Source_Paper.
11. IF Source_Paper не удаётся разобрать без выполнения скрипта (нет литерала `correctAnswers`, ключ содержит не ровно 40 номеров 1–40, у вопроса нет ключа или ключ относится к номеру без вопроса), THEN THE Content_Importer SHALL исключить эту работу из манифеста, записать в отчёт импорта имя файла и номера затронутых вопросов и продолжить обработку остальных Source_Paper.
12. IF Source_Paper содержит внутреннее несоответствие (например, лимит слов или чисел в `textAnswerRules` расходится с инструкцией группы или у вопроса нет отметки ответа в транскрипте), THEN THE Content_Importer SHALL сохранить содержимое как в источнике и записать в отчёт импорта предупреждение с именем файла и номерами вопросов.
13. IF у Evidence_Window начало меньше 0, начало не меньше конца или конец больше измеренной длительности Whole_Recording, THEN THE Content_Importer SHALL не сохранять это Evidence_Window, оставить работу в манифесте и записать в отчёт импорта предупреждение с именем файла и номером вопроса.

### Requirement 5: Извлечение, проверка и размещение записей

**User Story:** Как владелец Averna, я хочу, чтобы оригинальные записи новых тестов играли без изменений и не утяжеляли приложение, чтобы ученики слышали настоящий экзамен, а развёртывание оставалось в лимитах.

#### Acceptance Criteria

1. WHEN Content_Importer обрабатывает Source_Paper папки New Listening, THE Content_Importer SHALL извлекать MP3 из data URI base64 (тесты 1–2) или из упакованного gzip-блока `embeddedAudioData` в кодировке `utf8-seven-bit` (тесты 3–6) и сохранять извлечённые байты без перекодирования и без изменения байтов как один MP3-файл на каждую New_Listening_Paper.
2. IF data URI теста 1–2 не декодируется из base64, gzip-блок теста 3–6 не распаковывается, размер распакованной записи теста 3–6 отличается от `data-original-bytes` или запись не разбирается как последовательность кадров MPEG Layer III с общей длительностью больше 0 мс, THEN THE Content_Importer SHALL исключить эту New_Listening_Paper из манифеста, не загружать её запись и изображения на Recording_Host, записать в отчёт импорта ошибку с именем Source_Paper и причиной и продолжить обработку остальных Source_Paper.
3. THE Content_Importer SHALL записывать в New_Listening_Paper SHA-256 извлечённого файла записи и длительность в миллисекундах, которая отличается от суммы длительностей всех MP3-кадров файла не больше чем на 100 мс (для 6 работ ожидаются 25:59, 27:13, 29:54, 25:21, 28:24 и 25:29 с допуском ±1 с).
4. THE Recording_Host SHALL отдавать каждую запись и каждое изображение New_Paper по адресу, начинающемуся с `https://`, и отвечать на Range-запрос любого диапазона внутри файла статусом 206 с байтами запрошенного диапазона.
5. THE Averna SHALL размещать файлы записей и изображений New_Paper только на Recording_Host, так что ни один такой файл (сравнение по SHA-256) не входит в файлы функций Vercel после `next build`, в `.next/static` и в git-историю репозитория.
6. WHEN Owner применяет манифест с New_Listening_Paper, THE Exam_Catalog SHALL связать работу с её записью как Whole_Recording по существующему правилу: ровно одна строка `ListeningAudio` с `partIndex = -1` на все 4 части, со статусом ready, HTTPS-адресом файла на Recording_Host, размером файла в байтах, длительностью из критерия 3 и отпечатком `wholeRecordingHash` этой работы.
7. IF у New_Listening_Paper нет строки Whole_Recording со статусом ready, адрес записи не начинается с `https://`, длительность не больше 0 мс, отпечаток не совпадает с `wholeRecordingHash` работы или файл записи не загружается с Recording_Host, THEN THE Listening_Runner SHALL показать существующее сообщение о недоступной записи, не воспроизводить голос браузера или сгенерированную речь и не стирать уже введённые ответы ученика.
8. THE Audio_Manager SHALL показывать каждую New_Listening_Paper с меткой «Averna CDI» и ровно одной строкой записи с подписью «Toʻliq yozuv», статусом, длительностью и размером файла, без кнопок «Yaratish» и «Qayta yaratish», и не добавлять эту работу в очередь «Hammasini yaratish».
9. IF загрузка файла записи или изображения на Recording_Host не завершилась или SHA-256 файла, скачанного обратно по его HTTPS-адресу, отличается от SHA-256 извлечённого файла, THEN THE Content_Importer SHALL исключить работу из манифеста и записать в отчёт импорта ошибку с именем файла и причиной.
10. WHEN Content_Importer повторно размещает файл, SHA-256 которого совпадает с файлом этой работы, уже размещённым на Recording_Host, THE Content_Importer SHALL использовать прежний HTTPS-адрес без повторной загрузки, чтобы манифест оставался побайтно идентичным (Requirement 4.9).
11. THE Recording_Host SHALL разрешать через CORS чтение каждой записи и каждого изображения New_Paper, в том числе Range-запросами, со страниц производственного адреса Averna.

### Requirement 6: Новые тесты Listening в обычной практике

**User Story:** Как ученик, я хочу проходить новые тесты Listening в библиотеке Averna с оригинальной записью, чтобы тренироваться на реальных экзаменационных материалах.

#### Acceptance Criteria

1. WHEN New_Listening_Paper опубликована и её Whole_Recording готова (статус ready, адрес HTTPS, положительная длительность, совпадающий отпечаток), THE Listening_Library SHALL не позже чем через 300 секунд показать эту работу в разделе полных тестов с меткой «Averna CDI», 4 частями, 40 вопросами и временем в минутах, равным длительности записи по MP3-кадрам (Requirement 5.3) плюс 2 минуты с округлением вверх до целой минуты (при измеренных длительностях это 28, 30, 32, 28, 31 и 28 min для тестов 1–6).
2. WHEN ученик открывает New_Listening_Paper без параметра `part` и нажимает «Start», THE Listening_Runner SHALL воспроизводить Whole_Recording с позиции 0 мс, показывать 40 вопросов с исходными номерами 1–40, разделённых на Parts 1–4 по 10 вопросов, и при переключении между Parts 1–4 менять только показанные вопросы: запись не останавливается и не переходит на другую позицию, введённые ответы сохраняются.
3. WHILE ученик проходит New_Listening_Paper в режиме практики, THE Listening_Runner SHALL давать существующие элементы практики: паузу и продолжение с той же позиции, перемотку на 10 секунд назад и вперёд в пределах от 0 до длительности записи, перемотку по полосе прогресса и выбор скорости 0.75×, 0.9×, 1×, 1.1× и 1.25× без изменения позиции записи.
4. WHERE группа вопросов New_Listening_Paper содержит изображение (тест 2: вопросы 1–3, тест 3: 16–20, тест 4: 15–20, тест 6: 21–26), THE Listening_Runner SHALL показывать изображение в блоке этой группы над её первым вопросом, с непустым альтернативным текстом и шириной не больше ширины области вопросов, а если изображение не загрузилось, показывать на его месте альтернативный текст и оставлять вопросы группы доступными для ответа.
5. WHEN ответы полного теста New_Listening_Paper отправлены и результат сохранён, THE Result_Page SHALL показать число верных ответов из 40, Band по существующей таблице Listening для 40 вопросов с подписью «Band» без «Est.» (например, 40 из 40 → 9.0, 30 из 40 → 7.0), ответ ученика и принятый ответ для каждого из 40 вопросов и транскрипт каждой из 4 частей, в котором Evidence_View выделяет фрагмент, связанный с вопросом (Requirement 15.1–15.2).
6. THE Exam_Catalog SHALL передавать New_Listening_Paper в Listening_Runner без принятых ответов, без строк транскрипта всех 4 частей, без привязки фрагментов транскрипта к номерам вопросов и без Evidence_Window, а транскрипт и принятые ответы отдавать только Result_Page после сохранения результата.
7. THE Homework_Library SHALL предлагать преподавателю каждую опубликованную New_Listening_Paper как полный тест (Parts 1–4, 40 вопросов), а отдельные части этой работы предлагать только для Splittable_Paper по Requirement 15.5.
8. WHEN Whole_Recording полного теста New_Listening_Paper в режиме практики доходит до конца, THE Listening_Runner SHALL остановить запись, показать обратный отсчёт 2 минут на проверку ответов и по его окончании отправить ответы автоматически.
9. IF отправка ответов New_Listening_Paper не удалась из-за отсутствия сети или ошибки сервера, THEN THE Listening_Runner SHALL показать сообщение о том, что ответы не отправлены, с кнопкой «Try again», сохранить все введённые ответы на устройстве и при повторной отправке той же попытки сохранить не больше одного результата.
10. WHEN ученик перезагружает страницу во время полного теста New_Listening_Paper, THE Listening_Runner SHALL восстановить все введённые ответы и после нажатия кнопки продолжения воспроизводить Whole_Recording с позиции, отстоящей от позиции на момент перезагрузки не больше чем на 3 секунды.

### Requirement 7: Новые тесты Listening в Mock exam

**User Story:** Как ученик, я хочу получать новые тесты Listening в Mock exam в том же формате, что и остальные Mock-тесты, чтобы пробный экзамен был как настоящий.

#### Acceptance Criteria

1. WHEN Mock_Exam выбирает Listening-работу для новой попытки Mock, THE Mock_Exam SHALL включать в выбор каждую опубликованную New_Listening_Paper, у которой 4 части, 40 уникальных номеров вопросов 1–40 и готовая Whole_Recording (статус ready, HTTPS-адрес на Recording_Host, длительность больше 0 мс, отпечаток совпадает с `wholeRecordingHash`), и выбирать среди этих работ и существующих готовых работ по существующему правилу: сначала работы, которые ученик ещё не решал ни в практике, ни в Mock, затем любые.
2. IF у New_Listening_Paper не выполнено хотя бы одно условие пункта 1 (в том числе работа снята с публикации), THEN THE Mock_Exam SHALL исключить работу из выбора и из числа доступных Listening-работ Mock_Exam, а если готовых Listening-работ не осталось ни одной, не создавать попытку Mock и показать существующее сообщение о том, что для Mock нужна полная работа Listening с готовой записью.
3. WHILE идёт Listening-секция Mock с New_Listening_Paper, THE Mock_Exam SHALL воспроизводить Whole_Recording один раз от 0 мс до конца в существующем интерфейсе Mock CDI без элементов паузы, перемотки и выбора скорости и вести позицию записи и отсчёт секции по серверному времени от начала секции: после перезагрузки страницы, потери связи или ошибки воспроизведения отсчёт не останавливается, а запись продолжается с позиции, отличающейся от прошедшего времени секции не больше чем на 2 секунды.
4. THE Mock_Exam SHALL выдавать каждую работу Listening только целиком, в том числе работу с Verified_Segments: воспроизводить Whole_Recording без остановок на границах Part_Segment, показывать Parts 1–4 с 40 вопросами и сохранять результат по всем 40 вопросам с Band по таблице Listening для 40 вопросов.
5. WHEN преподаватель создаёт сессию Group_Mock, THE Group_Mock SHALL включать в пул Listening-работ каждую New_Listening_Paper, готовую по условиям пункта 1, с продолжительностью Listening-секции, равной длительности Whole_Recording в миллисекундах плюс 120 000 мс, без округления.
6. WHEN ученик проходит проверку наушников перед Mock_Exam или Group_Mock с New_Listening_Paper, THE Mock_Exam SHALL проигрывать первые 8 секунд той же Whole_Recording и разрешать отметку о том, что запись слышна, только после того, как проверка начала играть; без этой отметки ученик не может начать Listening-секцию, а в Group_Mock не считается готовым к запуску.
7. WHEN воспроизведение Whole_Recording в Listening-секции Mock доходит до конца, THE Mock_Exam SHALL дать 2 минуты на проверку ответов и в момент окончания секции (начало секции плюс длительность записи плюс 120 000 мс по серверному времени) отправить ответы автоматически и сохранить результат.
8. IF при запуске сессии Group_Mock назначенная участнику New_Listening_Paper больше не готова по условиям пункта 1 или длительность её Whole_Recording отличается от длительности, записанной в пуле сессии, THEN THE Group_Mock SHALL отклонить запуск с сообщением о неполном наборе работ, не начинать Listening-секцию ни у одного участника и оставить сессию в лобби.

### Requirement 8: Articles в левом меню ученика

**User Story:** Как ученик, я хочу снова видеть «Articles» в левом меню, как раньше, чтобы быстро находить статьи.

#### Acceptance Criteria

1. THE Student_Sidebar SHALL показывать в разделе «Skills» 7 пунктов в порядке Reading, Articles, Listening, Writing, Speaking, Grammar, Vocabulary, где пункт «Articles» имеет подпись «Articles», ссылку `/article` и иконку Newspaper, а подзаголовок «Language» остаётся над пунктом «Grammar».
2. WHILE открыта страница `/article` или `/article/<slug>`, THE Student_Sidebar SHALL отмечать активным только пункт «Articles» (активное оформление и `aria-current="page"`), а пункт «Reading» показывать неактивным, без `aria-current`.
3. WHEN ученик открывает выдвижное меню при ширине окна меньше 1024 px, THE Student_Sidebar SHALL показывать пункт «Articles» вторым пунктом раздела «Skills», а все разделы и пункты в том же порядке, что и в постоянном левом меню при ширине 1024 px и больше.
4. THE Student_Sidebar SHALL состоять из 5 разделов в порядке Home, Skills, Practice, Coach, Me с 4, 7, 2, 1 и 3 пунктами соответственно (всего 17), без повторяющихся адресов, с подписью каждого пункта не длиннее 2 слов, разделённых пробелом. Остальные 16 пунктов сохраняют прежние подписи, ссылки, иконки и порядок.
5. THE Student_Sidebar SHALL показывать пункт «Articles» без метки «New» в любую дату, а метку «New» оставлять только у пунктов «Speaking» и «AI Coach» до существующей даты окончания меток.
6. WHEN выполняется `npx vitest --run`, THE Navigation_Tests SHALL проверять новую структуру явно: лимит не больше 17 пунктов вместо 16, ожидание `/article/food → /article` вместо `/article/food → /learning/reading`, а в `tests/articles-catalog.test.ts` проверку того, что пункт «Articles» со ссылкой `/article` стоит в разделе «Skills» сразу после «Reading», вместо комментария об уходе Articles из меню.
7. WHILE открыта страница `/learning/reading` или `/learning/reading/<id>`, THE Student_Sidebar SHALL отмечать активным только пункт «Reading», а пункт «Articles» показывать неактивным.
8. THE Navigation_Tests SHALL сохранять все остальные проверки без удаления и без ослабления условий: существование маршрутов всех ссылок меню, вкладок, хабов и ⌘K; отсутствие повторяющихся адресов; правило самого длинного совпадения префикса, включая проверки fast-check; доступность бывших пунктов меню; состав Phone_Tab_Bar; набор пунктов с меткой «New».
9. THE Averna SHALL оставлять без изменений состав, порядок, подписи и ссылки левого меню преподавателя (`TEACHER_NAV`), левого меню администратора (`ADMIN_NAV`, включая подпись портала «Admin paneli») и 5 вкладок Phone_Tab_Bar.

### Requirement 9: Другие входы в Articles

**User Story:** Как ученик, я хочу находить Articles и через другие привычные входы, чтобы попадать к статьям с любого экрана.

#### Acceptance Criteria

1. WHEN ученик открывает Command_Palette с пустым запросом, THE Command_Palette SHALL показывать ровно одну команду «Articles» со ссылкой на `/article` в группе Skills.
2. WHEN ученик вводит в Command_Palette запрос «articles», «article», «news» или «lessons» в любом регистре, с пробелами в начале или в конце или без них, THE Command_Palette SHALL показывать команду «Articles» в группе Skills среди результатов.
3. WHILE ученик находится на `/article`, `/article?level=<уровень>` или `/article/<slug>`, THE Phone_Tab_Bar SHALL подсвечивать вкладку «Skills» как активную, а остальные вкладки (Home, Practice, Coach, Me) оставлять неактивными.
4. THE Learning_Hub SHALL показывать плитку «Articles» с иконкой Newspaper и ссылкой на `/article` в одном наборе плиток с «Grammar» и «Vocabulary».
5. THE Student_Dashboard SHALL показывать на вкладке «Learn» (`/dashboard?tab=learn`) карточку «Articles», в которой есть общее число уроков, по одной ссылке на каждый уровень Articles (сейчас Pre-intermediate и Intermediate) вида `/article?level=<уровень>` с числом уроков этого уровня и ссылка на `/article` на всю библиотеку статей.
6. THE Reading_Library SHALL показывать до списка тестов ссылку на `/article` с числом уроков, равным числу карточек на `/article` без фильтра уровня (сейчас 24). Ссылка показывается и тогда, когда список тестов Reading пуст или не загрузился.
7. WHEN ученик выбирает команду «Articles» в Command_Palette щелчком, касанием или клавишей Enter, THE Command_Palette SHALL закрыться и открыть `/article`.

### Requirement 10: Границы частей в цельной записи

**User Story:** Как владелец Averna, я хочу, чтобы у каждой цельной записи Listening были проверенные границы Parts 1–4, чтобы ученики проходили каждую часть отдельно и не слышали соседние части.

#### Acceptance Criteria

1. THE Exam_Catalog SHALL хранить для каждой работы с Whole_Recording либо ни одного Part_Segment, либо ровно 4 Part_Segment с границами в целых миллисекундах, которые разбивают запись без пропусков и наложений: Part_Segment 1 начинается в 0 мс, начало Part_Segment N+1 равно концу Part_Segment N (N = 1–3), Part_Segment 4 заканчивается на длительности записи, измеренной по MP3-кадрам (Requirement 5.3).
2. THE Exam_Catalog SHALL принимать набор Part_Segment только при условии, что каждый из 4 Part_Segment (конец минус начало) длится не меньше 120 000 мс. Длина ровно 120 000 мс допускается.
3. THE Exam_Catalog SHALL принимать набор Part_Segment только при условии, что для каждого вопроса части N, у которого есть Evidence_Window, начало Part_Segment N не больше начала Evidence_Window, а конец Evidence_Window не больше конца Part_Segment N. Вопросы без Evidence_Window это правило не проверяет.
4. WHEN Content_Importer обрабатывает New_Listening_Paper, THE Content_Importer SHALL записывать в отчёт импорта для каждой из 3 внутренних границ одного кандидата со статусом «не подтверждено», временем в миллисекундах и способом поиска: «пауза», если кандидат лежит внутри паузы тишины длиной не меньше 1 000 мс (уровень сигнала ниже −40 dBFS), или «окна ответов» (только тесты 3–6), если такой паузы в допустимом интервале нет и кандидат стоит в середине этого интервала. В тестах 3–6 допустимый интервал для границы между частями N и N+1 начинается на самом позднем конце Evidence_Window части N и заканчивается на самом раннем начале Evidence_Window части N+1. Набор из 4 Part_Segment, построенный по 3 кандидатам, удовлетворяет пунктам 1–3.
5. THE Exam_Catalog SHALL считать работу с Whole_Recording Splittable_Paper только при Verified_Segments. Кандидаты Content_Importer и сохранённые, но не подтверждённые Part_Segment не делают работу Splittable_Paper.
6. WHEN Part_Segment работы сохраняются, изменяются или подтверждаются, THE Exam_Catalog SHALL продолжать отдавать ту же Whole_Recording этой работы с прежним адресом, прежним отпечатком `wholeRecordingHash` и прежним статусом записи (ready остаётся ready), без изменения файла записи на Recording_Host и без создания отдельных записей для частей.
7. WHEN у работы с Verified_Segments сохраняется хотя бы одна внутренняя граница, отличная от подтверждённой хотя бы на 1 мс, без одновременного подтверждения всех 4 Part_Segment, THE Exam_Catalog SHALL снять у работы состояние Verified_Segments и не считать её Splittable_Paper до повторного подтверждения всех 4 Part_Segment.
8. THE Exam_Catalog SHALL применять правила этого требования и к существующим работам Averna CDI с Whole_Recording, не меняя их вопросы, ключи и отпечатки записей. Существующая работа без сохранённых Part_Segment не имеет Verified_Segments и проходится только целиком.
9. IF сохраняемый набор Part_Segment нарушает пункт 1, 2 или 3, THEN THE Exam_Catalog SHALL отклонить весь набор, оставить прежние Part_Segment и прежнее состояние Verified_Segments без изменений и вернуть причину отказа с указанием нарушенного правила (разбиение записи, минимальная длина или Evidence_Window) и номера Part.
10. IF у работы меняется SHA-256 файла Whole_Recording или измеренная длительность записи, THEN THE Exam_Catalog SHALL снять у работы состояние Verified_Segments и не считать её Splittable_Paper, пока для новой записи не будут подтверждены все 4 Part_Segment.
11. IF Content_Importer не находит для внутренней границы кандидата, удовлетворяющего пункту 4, или измеренная длительность записи меньше 480 000 мс, THEN THE Content_Importer SHALL оставить эту границу без кандидата, записать в отчёт импорта предупреждение с именем файла и номером границы (1–3) и импортировать работу как тест, который проходится только целиком.

### Requirement 11: Подтверждение границ в Audio_Manager

**User Story:** Как администратор или преподаватель, я хочу прослушать и подтвердить границы частей цельной записи, чтобы ученики получали точные отрывки.

#### Acceptance Criteria

1. THE Audio_Manager SHALL показывать для каждой работы с Whole_Recording в статусе ready блок «Qismlar chegaralari» с 4 Part_Segment (начало и конец в формате мм:сс.д, например 06:42.3) и статусом работы: «Tasdiqlangan» с именем подтвердившего Staff_Member и временем подтверждения, если у работы Verified_Segments, иначе «Tasdiqlanmagan». Значения берутся из сохранённых Part_Segment. Если их нет, значения берутся из кандидатов Content_Importer (Requirement 10.4). Если нет и кандидатов, Part 1 начинается в 00:00.0, Part 4 заканчивается на измеренной длительности записи, а поля 3 внутренних границ остаются пустыми.
2. WHEN Staff_Member нажимает кнопку «Chegarani tinglash» у заполненной внутренней границы, THE Audio_Manager SHALL воспроизвести Whole_Recording с позиции за 5 секунд до текущего значения этой границы, в том числе ещё не сохранённого, и остановить воспроизведение через 5 секунд после границы.
3. THE Audio_Manager SHALL позволять Staff_Member сдвигать каждую из 3 внутренних границ с шагом 0,1 секунды и вводить время границы вручную в формате мм:сс.д. Сдвиг границы меняет конец предыдущего и начало следующего Part_Segment. Сохранённые Part_Segment и статус работы не меняются до нажатия «Tasdiqlash».
4. WHEN Staff_Member нажимает «Tasdiqlash» и границы проходят проверки критериев 5 и 6, THE Audio_Manager SHALL сохранить все 4 Part_Segment одной операцией (сохраняются все 4 или ни один), идентификатор Staff_Member и серверное время подтверждения, показать статус «Tasdiqlangan» и сообщение об успешном сохранении на узбекском языке.
5. IF при нажатии «Tasdiqlash» внутренняя граница пуста, введена не в формате мм:сс.д или границы нарушают правила Requirement 10 (разбиение записи без пропусков и наложений, длина каждой части не меньше 120 секунд, каждое Evidence_Window внутри своей части), THEN THE Audio_Manager SHALL отклонить сохранение, оставить введённые значения в полях, не менять сохранённые Part_Segment и статус работы и показать на узбекском языке причину с номером части и нарушенным правилом (например, «Chegaralar notoʻgʻri: har bir qism kamida 2 daqiqa boʻlishi kerak.»).
6. WHEN сервер получает запрос на сохранение границ, THE Audio_Manager SHALL до записи в базу данных проверить сессию, роль ADMIN или TEACHER, данные запроса по схеме (идентификатор работы и 4 Part_Segment в целых миллисекундах) и правила Requirement 10 относительно измеренной длительности текущей Whole_Recording этой работы.
7. THE Audio_Manager SHALL показывать все новые надписи блока границ (заголовок, кнопки, статусы, сообщения об успехе и ошибках, доступные имена кнопок) на узбекском языке латиницей, с буквами oʻ/gʻ через знак U+02BB и знаком ʼ через U+02BC, оставляя без перевода названия и коды по Requirement 18.3.
8. IF запрос на сохранение границ приходит без действующей сессии, от пользователя без роли ADMIN или TEACHER, с данными, не прошедшими проверку схемы, для несуществующей работы или работы без Whole_Recording, или с границами, нарушающими правила Requirement 10, THEN THE Audio_Manager SHALL отклонить запрос без записи в базу данных, оставить Part_Segment и статус работы без изменений и вернуть ошибку с причиной отказа.
9. IF Part_Segment работы сохранил другой Staff_Member после того, как Audio_Manager загрузил блок «Qismlar chegaralari», THEN THE Audio_Manager SHALL отклонить сохранение без изменения Part_Segment, оставить введённые значения в полях и показать на узбекском языке причину: границы уже изменил другой пользователь.
10. IF сохранение границ завершилось ошибкой сети или базы данных или сервер не ответил за 30 секунд, THEN THE Audio_Manager SHALL оставить введённые значения в полях, не менять сохранённые Part_Segment и статус работы и показать сообщение об ошибке сохранения на узбекском языке.

### Requirement 12: Выбор части в библиотеке Listening

**User Story:** Как ученик, я хочу выбрать на карточке теста Listening «Full test» или одну из Parts 1–4, как passage в Reading, чтобы тренироваться короткими подходами.

#### Acceptance Criteria

1. WHEN Listening_Library отображает карточку Splittable_Paper, THE Listening_Library SHALL показывать под подписью раздела «Parts · practise one at a time» по одной строке на каждую часть в порядке от Part 1 до Part N (для Whole_Recording N = 4). Каждая строка содержит заголовок «Practise Part N», тему части, диапазон исходных номеров вопросов части (например, 11–20) и длительность части. Строка «Practise Part N» ведёт на `/learning/listening/<id>?part=<N−1>`. Темой части служит название части из работы; если название пустое или имеет вид «Part N», тема не показывается. Длительность части для Whole_Recording считается по критерию 4, для работ с отдельной записью на каждую часть по существующему правилу карточки («~N min»). Подпись о недоступности отдельных частей на такой карточке не показывается.
2. WHEN Listening_Library отображает карточку полной работы (4 части, 40 вопросов), THE Listening_Library SHALL показывать кнопку «Start full test» со ссылкой на `/learning/listening/<id>` без параметра `part`, независимо от того, является ли работа Splittable_Paper.
3. WHEN Listening_Library отображает карточку работы с Whole_Recording без Verified_Segments (в том числе если подтверждены не все 4 Part_Segment или подтверждение снято по Requirement 10.7), THE Listening_Library SHALL показывать под подписью раздела «One complete recording · Parts 1–4» 4 строки частей с номером части, темой и диапазоном вопросов, без ссылок и без длительности части, а под списком существующую подпись «Original, uncut audio. Separate part playback is unavailable until recording boundaries are verified.».
4. WHEN Listening_Library отображает строку части работы с Whole_Recording и Verified_Segments, THE Listening_Library SHALL показывать длительность части в виде «N min», где N равно длине Part_Segment в миллисекундах, делённой на 60 000 и округлённой вверх до целого, плюс 1 минута на проверку. Например, Part_Segment длиной 6:01.2 даёт «8 min», а длиной ровно 6:00.0 даёт «7 min».
5. WHEN работа с Whole_Recording получает Verified_Segments (Staff_Member подтвердил все 4 Part_Segment) или теряет их по Requirement 10.7, THE Listening_Library SHALL показывать карточку этой работы в новом состоянии (критерий 1 или критерий 3) не позже чем через 300 секунд (время кэша каталога).

### Requirement 13: Прохождение одной части Listening

**User Story:** Как ученик, я хочу пройти одну часть Listening отдельно, чтобы за 6–9 минут потренировать конкретную Part.

#### Acceptance Criteria

1. WHEN ученик открывает в режиме практики Splittable_Paper с параметром `part=i`, где i — целое число от 0 до 3, THE Listening_Runner SHALL показать только 10 вопросов части i+1 с исходными номерами (например, 11–20 для `part=1`), без вопросов и навигации других частей, и кнопку запуска записи, не начиная воспроизведение до нажатия этой кнопки.
2. WHEN ученик нажимает кнопку запуска одной части, THE Listening_Runner SHALL начать воспроизведение записи с позиции, которая отличается от начала Part_Segment i+1 не больше чем на 500 мс.
3. WHILE ученик проходит одну часть, THE Listening_Runner SHALL ограничивать существующие элементы практики (перемотка на 10 секунд, перетаскивание полосы прогресса, повтор части) пределами Part_Segment: ни одно действие не ставит позицию раньше начала или позже конца Part_Segment, повтор части начинает с начала Part_Segment, а полоса прогресса и счётчик времени показывают время от 00:00 до длины Part_Segment в формате мм:сс.
4. WHEN позиция воспроизведения доходит до конца Part_Segment при любой скорости из существующего выбора, THE Listening_Runner SHALL остановить запись на позиции, которая отличается от конца Part_Segment не больше чем на 500 мс, и начать проверку ответов длительностью 60 секунд с видимым обратным отсчётом и существующей кнопкой досрочной отправки.
5. WHEN ученик перезагружает страницу во время одной части, THE Listening_Runner SHALL восстановить все ответы, введённые до перезагрузки, и после нажатия кнопки продолжения воспроизводить запись с позиции внутри того же Part_Segment, не раньше чем за 3 секунды до позиции на момент перезагрузки и не позже неё. Если перезагрузка произошла во время проверки, THE Listening_Runner SHALL продолжить проверку с оставшимся временем, а не с 60 секунд. Если сохранённая позиция лежит вне текущего Part_Segment, THE Listening_Runner SHALL начать с начала Part_Segment.
6. WHILE ученик проходит одну часть, THE Listening_Runner SHALL показывать в заголовке текст «Listening practice · Part N», где N = i+1 (от 1 до 4).
7. IF параметр `part` не является целым числом от 0 до 3 или работа не является Splittable_Paper, THEN THE Listening_Runner SHALL открыть полный тест со всеми 40 вопросами и воспроизведением с начала записи, без сообщения об ошибке.
8. WHEN 60-секундная проверка одной части заканчивается, THE Listening_Runner SHALL автоматически отправить ответы на 10 вопросов этой части, включая пустые ответы на вопросы без ответа, для оценки по Requirement 14.
9. IF отправка ответов одной части не удалась (нет соединения или ошибка сервера), THEN THE Listening_Runner SHALL показать существующее сообщение о том, что ответы не отправлены, с кнопкой повторной отправки, сохранить 10 ответов на устройстве и не запускать запись заново.

### Requirement 14: Оценка одной части Listening

**User Story:** Как ученик, я хочу получать за одну часть честный результат, чтобы понимать свой уровень и не путать оценку части с баллом за полный тест.

#### Acceptance Criteria

1. WHEN ученик отправляет ответы одной части Splittable_Paper, открытой с параметром `part=i` (i — целое число от 0 до 3), THE Exam_Grader SHALL оценивать только 10 вопросов Part N (N = i + 1, вопросы с 10·N − 9 по 10·N), не учитывать ответы на вопросы других частей, считать неотвеченные вопросы Part N неверными и сохранять результат с 10 вопросами и ключом содержимого `<id>#p<N>` (например, `cdi-v10-listening-03#p2` для `part=1`).
2. WHEN ученик или Staff_Member открывает Result_Page результата одной части, THE Result_Page SHALL показывать надпись «Listening results · Part N», тему части, число верных ответов «x / 10», точность x × 10 % (например, «70% accuracy»), Estimated_Band, равный значению таблицы Listening для x × 4 верных ответов из 40 (например, 7 / 10 → 28 / 40 → 6.5), с подписью «Est. band», а также существующее пояснение о пересчёте с числом вопросов части (10), пересчётом «x / 10 ≈ 4x / 40» и ссылкой на таблицу Listening.
3. THE Result_Page SHALL показывать подпись «Band» (и «Band» в тексте для экранного диктора) только для результата ровно из 40 вопросов, а для результата с любым другим числом вопросов, в том числе для одной части Listening, показывать подпись «Est. band» (и «Estimated band» в тексте для экранного диктора).
4. THE Band_Forecast SHALL учитывать результат одной части Listening по существующему правилу, так же как результат одного passage Reading: попытка с 10 вопросами входит в прогноз Listening за последние 120 дней с баллом Estimated_Band и тем же весом по давности, что и полный тест, а попытки Reading и Listening меньше чем из 10 вопросов в прогноз не входят.
5. WHEN Exam_Grader сохраняет результат одной части, THE Exam_Grader SHALL начислять XP по существующим правилам объективных тестов (0 XP при 0 верных ответов) и применять множитель повтора (×1, ×0,5, ×0,3, ×0,2, далее не меньше ×0,15) по ключу `<id>#p<N>`, так что прохождение другой части или полного теста той же работы (ключ `<id>`) не считается повтором этой части.
6. IF ответы одной части отправлены повторно с тем же идентификатором попытки (например, автоматическая отправка после 1 минуты проверки и ручная отправка), THEN THE Exam_Grader SHALL вернуть первоначальный результат без создания второго результата и без повторного начисления XP.
7. IF ответы одной части отправлены для работы, которая в момент отправки не является Splittable_Paper (например, граница изменена во время прохождения и Verified_Segments сняты), THEN THE Exam_Grader SHALL отклонить отправку с ошибкой, указывающей, что отдельная часть этой работы недоступна, и не сохранять результат, не начислять XP и не менять Band_Forecast.
8. IF Exam_Grader отклонил отправку одной части по критерию 7, THEN THE Listening_Runner SHALL оставить ответы ученика на экране без изменений и показать на английском языке сообщение о том, что отдельная часть больше недоступна, со ссылкой на полный тест.

### Requirement 15: Связанные функции для частей Listening

**User Story:** Как ученик и преподаватель, я хочу, чтобы разбор ответов, мини-задания, домашние задания и офлайн-пакеты работали с частями цельных записей, чтобы новые возможности не ломали уже сделанные.

#### Acceptance Criteria

1. WHERE у вопроса есть Evidence_Window, WHILE Whole_Recording работы готова (статус ready, адрес HTTPS, совпадающий отпечаток), WHEN ученик открывает Result_Page Listening для полного теста или для одной части, THE Evidence_View SHALL показывать кнопку «Hear it» под каждым неверным или пустым ответом на этот вопрос.
2. WHERE для вопроса найден фрагмент транскрипта (у New_Listening_Paper по отметке источника из Requirement 4.5), WHEN ученик открывает Result_Page Listening, THE Evidence_View SHALL показывать под неверным или пустым ответом на этот вопрос кнопку «Show in transcript», которая выделяет этот фрагмент в транскрипте части, независимо от наличия Evidence_Window и готовности Whole_Recording.
3. WHERE работа с Whole_Recording является Splittable_Paper, THE Mini_Task SHALL рассматривать каждую из её 4 частей как отдельный вариант задания (10 вопросов части, длительность по Requirement 12.4) и ставить эти части в порядке выбора вместе с частями других Splittable_Paper, перед работами, которые проходятся только целиком.
4. WHERE работа с Whole_Recording является Splittable_Paper, THE Practice_Picker SHALL предлагать для типа вопроса одну часть этой работы, содержащую этот тип, ссылкой `/learning/listening/<id>?part=<0–3>`, считать часть пройденной, если у ученика есть результат `<id>#p<N>` или результат полного теста `<id>`, а работу с Whole_Recording без Verified_Segments предлагать только ссылкой на полный тест без параметра `part`.
5. THE Homework_Library SHALL предлагать преподавателю для каждой работы Listening вариант «Full test», а для Splittable_Paper ещё и варианты «Part 1» … «Part 4» с диапазоном вопросов части и длительностью части (для Whole_Recording по Requirement 12.4).
6. WHERE работа с Whole_Recording является Splittable_Paper, WHEN ученик нажимает кнопку сохранения одной части офлайн, THE Offline_Library SHALL сохранять аудио только Part_Segment этой части, длительность которого отличается от длины Part_Segment не больше чем на 0,5 секунды, и 10 вопросов этой части с исходными номерами.
7. IF Recording_Host не разрешает CORS для Whole_Recording или загрузка аудио части прерывается, THEN THE Offline_Library SHALL показать существующее сообщение о том, что запись нельзя сохранить офлайн, не сохранять ни аудио, ни вопросы этой части и оставить ранее сохранённые пакеты без изменений.
8. WHEN ученик нажимает «Hear it», THE Evidence_View SHALL воспроизводить Whole_Recording с позиции «начало Evidence_Window минус 2 секунды», но не раньше 0 мс, и останавливать воспроизведение в пределах 0,5 секунды после конца Evidence_Window; позиции отсчитываются от начала Whole_Recording и в результате полного теста, и в результате одной части.
9. IF при создании или изменении домашнего задания выбрана часть работы Listening, которая не является Splittable_Paper (в том числе после снятия Verified_Segments по Requirement 10.7), THEN THE Homework_Library SHALL отклонить сохранение с сообщением об ошибке, что отдельная часть этой работы недоступна, и не создавать и не изменять задание.
10. WHERE работа с Whole_Recording является Splittable_Paper, THE Offline_Library SHALL показывать рядом с кнопкой сохранения одной части офлайн, до её нажатия, размер аудио этой части, который отличается от объёма аудио, фактически сохранённого после нажатия, не больше чем на 20 %.

### Requirement 16: Сохранность существующих данных и стабильные идентификаторы

**User Story:** Как владелец Averna, я хочу, чтобы старые результаты, задания и тесты не изменились, а у новых работ были постоянные идентификаторы, чтобы история учеников оставалась верной.

#### Acceptance Criteria

1. WHEN изменения этой спецификации развёрнуты, Content_Importer применяет манифест, New_Paper публикуется или снимается с публикации либо Staff_Member сохраняет Part_Segment, THE Averna SHALL оставлять без изменений число и содержимое записей, созданных до этого события: результатов тестов (`IELTSTest`: работа, ключ содержимого, ответы, оценка, Band, дата), попыток Mock (`MockAttempt`), сессий Group_Mock, начисленного XP каждого пользователя, домашних заданий и Mini_Task.
2. WHEN изменения этой спецификации развёрнуты или Content_Importer применяет манифест, THE Exam_Catalog SHALL отдавать каждую работу, которая была в каталоге до этого события, с тем же идентификатором, названием, вопросами, ключами ответов и состоянием публикации.
3. THE Content_Importer SHALL присваивать New_Reading_Paper идентификаторы `cdi-v10-reading-01` … `cdi-v10-reading-08`, а New_Listening_Paper — `cdi-v10-listening-01` … `cdi-v10-listening-06`, где номер — двузначный номер теста Source_Paper по таблицам введения с ведущим нулём (например, `vol 10 test 7 reading.html` → `cdi-v10-reading-07`), и идентификатор не зависит от порядка файлов в папке, регистра букв в имени файла и времени запуска.
4. IF идентификатор New_Paper уже занят записью, которая не является неопубликованным импортом этой же работы (неопубликованной записью, созданной Content_Importer, с тем же модулем и тем же именем исходного файла), THEN THE Content_Importer SHALL остановить применение манифеста до записи первой работы: не создавать и не изменять ни одну работу и ни одну запись этого манифеста, вывести ошибку с конфликтующим идентификатором без учётных данных базы данных и завершиться с ненулевым кодом выхода.
5. WHEN манифест повторно применяется к неопубликованным New_Paper, THE Content_Importer SHALL обновлять записи с теми же идентификаторами на месте, без создания новых работ: после применения в базе данных ровно по одной работе на каждый из 14 идентификаторов `cdi-v10-*` (8 Reading и 6 Listening) и ровно одна Whole_Recording на каждую New_Listening_Paper, так что результаты, домашние задания, Mini_Task и Band_Forecast указывают на ту же работу.
6. WHEN изменения этой спецификации развёрнуты, THE Averna SHALL открывать существующие маршруты `/learning/reading`, `/learning/reading/<id>`, `/learning/listening`, `/learning/listening/<id>`, `/learning/mock-exam`, `/article`, `/article/<slug>` и страницы результатов существующих попыток без страницы ошибки и показывать на них все работы, статьи и результаты, которые были доступны до изменений.
7. WHEN изменения готовы к коммиту, THE Averna SHALL проходить все проверки существующего набора `npx vitest --run` без удаления проверок и без пометки их пропущенными; ожидания разрешено менять только в Navigation_Tests и только в пунктах, перечисленных в Requirement 8.6.
8. IF манифест повторно применяется к New_Listening_Paper с сохранёнными Part_Segment и SHA-256 файла записи совпадает с сохранённым, THEN THE Content_Importer SHALL оставить без изменений Part_Segment, состояние Verified_Segments, идентификатор подтвердившего Staff_Member и время подтверждения, не заменяя их новыми кандидатами.
9. IF манифест повторно применяется к New_Listening_Paper с Verified_Segments и SHA-256 файла записи отличается от сохранённого, THEN THE Content_Importer SHALL снять состояние Verified_Segments, заменить Part_Segment новыми кандидатами со статусом «не подтверждено» и записать в отчёт импорта предупреждение с идентификатором работы.

### Requirement 17: Импорт, публикация и откат

**User Story:** Как владелец Averna, я хочу сам подтверждать загрузку и публикацию новых тестов и иметь возможность их скрыть, чтобы ошибка импорта не попала к ученикам.

#### Acceptance Criteria

1. WHEN Content_Importer запускается без подтверждения применения от Owner, THE Content_Importer SHALL работать в режиме пробного запуска: ничего не записывать в базу данных, не загружать файлы на Recording_Host, выполняться без доступа к базе данных и выводить отчёт с одной записью на каждую из 14 Source_Paper (идентификатор, имя исходного файла, число частей, число вопросов, типы групп, длительность записи для Listening, предупреждения, ошибки проверки и итог «в манифесте» или «исключена»).
2. IF запрошена запись в базу данных или загрузка на Recording_Host, а Owner не указал имя хоста или указанное имя не совпадает точно с хостом цели (хост базы данных для записи, хост Recording_Host для загрузки), THEN THE Content_Importer SHALL остановиться до первой записи и первой загрузки, ничего не изменив, и вывести ошибку о несовпадении хоста без строки подключения и учётных данных.
3. WHEN Owner подтверждает применение манифеста и указанное имя хоста совпадает с хостом базы данных, THE Content_Importer SHALL создать каждую New_Paper из манифеста неопубликованной (New_Listening_Paper вместе с одной строкой Whole_Recording) или обновить неопубликованный импорт той же работы, не меняя публикацию, вопросы и ключи остальных работ.
4. WHEN Owner подтверждает публикацию перечисленных по идентификаторам New_Paper (в том числе повторную после снятия с публикации), THE Exam_Catalog SHALL не позже чем через 300 секунд (время кэша каталога) показывать эти New_Paper в их библиотеке (Reading_Library или Listening_Library), Homework_Library, Practice_Picker, Mini_Task и наборах Mock_Exam и Group_Mock по правилам Requirement 2, 3, 6 и 7, а не перечисленные New_Paper оставлять неопубликованными.
5. WHEN Owner снимает New_Paper с публикации, THE Exam_Catalog SHALL не позже чем через 300 секунд убрать работу из её библиотеки (Reading_Library или Listening_Library), Homework_Library, Practice_Picker, Mini_Task и из выбора работ для новых Mock_Exam и новых сессий Group_Mock, перенаправлять прямую ссылку на работу в её библиотеку и сохранять в базе данных саму работу, её Whole_Recording и Part_Segment.
6. WHEN New_Paper снята с публикации, THE Result_Page SHALL продолжать показывать по каждому сохранённому результату этой работы (полный тест, один passage или одна часть, секция Mock) тот же балл, то же число верных ответов и тот же разбор ответов, что и до снятия.
7. THE Averna SHALL хранить исходные HTML-файлы, манифест с ключами, транскрипты New_Paper и учётные данные вне публичного репозитория, так что ни один из этих файлов и ни одно значение учётных данных не встречается в отслеживаемых файлах и в истории коммитов рабочей ветки.
8. WHEN Content_Importer создаёт New_Paper неопубликованной, THE Exam_Catalog SHALL до подтверждения публикации Owner не показывать эту работу в Reading_Library, Listening_Library, Homework_Library, Practice_Picker и Mini_Task, не выдавать её в Mock_Exam и Group_Mock и перенаправлять прямую ссылку `/learning/reading/<id>` или `/learning/listening/<id>` в соответствующую библиотеку.
9. IF применение манифеста прерывается ошибкой на одной из New_Paper, THEN THE Content_Importer SHALL не оставлять эту работу записанной частично (работа без своей строки Whole_Recording или строка записи без работы), не применять оставшиеся работы и вывести списки идентификаторов применённых и не применённых работ.
10. IF New_Paper снята с публикации, пока у ученика идёт начатая секция Mock_Exam с этой работой (в том числе в сессии Group_Mock), THEN THE Mock_Exam SHALL дать ученику закончить секцию до её срока, оценить отправленные ответы по ключу этой работы и сохранить результат.

### Requirement 18: Язык интерфейса и содержимого

**User Story:** Как владелец Averna, я хочу, чтобы ученики и преподаватели видели интерфейс на английском, а администратор — на узбекском, чтобы каждый работал на привычном языке.

#### Acceptance Criteria

1. THE Averna SHALL показывать на английском языке все новые и изменённые надписи для ученика и преподавателя (библиотеки, карточки, раннеры, результаты, меню, ⌘K, Homework_Library), кроме текстов L1_Hints (Requirement 21), содержимого тестов (пункт 4) и Audio_Manager (пункт 2); надписью считается видимый текст, плейсхолдер, всплывающая подсказка, доступное имя, альтернативный текст изображения, уведомление, диалог подтверждения и сообщение об ошибке от сервера, и ни одна такая надпись не содержит кириллицы и знаков U+02BB и U+02BC.
2. THE Averna SHALL показывать на узбекском языке латиницей все новые и изменённые надписи (в значении пункта 1) административных разделов: Audio_Manager на обоих адресах `/admin/listening-audio` и `/teacher/listening-audio`, включая блок границ частей (Requirement 11) и сообщения сервера об ошибках для этого блока, а также `app/admin/**`, `components/admin/**`, `ADMIN_NAV`, подпись «Admin paneli» и команды администратора в ⌘K; для общих действий и разделов используются термины глоссария админ-панели (например, Save → «Saqlash», Delete → «Oʻchirish», Edit → «Tahrirlash», Search → «Qidirish», Teachers → «Oʻqituvchilar»), а содержимое тестов (названия работ, названия и темы частей) показывается по пункту 4.
3. THE Averna SHALL оставлять без перевода в английских и узбекских надписях: названия Averna и IELTS, метку «Averna CDI», коды CEFR (A2, B1 …), обозначения частей «Part 1»–«Part 4» с арабскими цифрами, значения Band и Estimated_Band, названия работ («Volume 10 · Reading Test N», «Volume 10 · Listening Test N»), идентификаторы работ (`cdi-v10-…`), адреса страниц, имена переменных окружения и идентификаторы кода.
4. THE Content_Importer SHALL переносить содержимое тестов (заголовки и тексты passage, инструкции групп, вопросы, варианты, транскрипты и имена говорящих) на языке и в написании источника, без перевода и без исправления орфографии и типографики (кавычки, тире, диакритические знаки), так чтобы последовательность непробельных символов каждого перенесённого фрагмента после декодирования HTML-сущностей совпадала с исходным фрагментом; исключение составляют отметки ответов `[Qn → …]` теста Listening 1, которые переносятся как привязки по Requirement 4.5.
5. THE Content_Importer SHALL переносить из Source_Paper только содержимое теста (тексты, заголовки «Questions N–M», инструкции групп, вопросы, варианты, ключи, транскрипты, изображения вопросов) и не переносить элементы интерфейса источника: таймер, заметки, переключатель темы, ссылку и упоминание Telegram @IELTS_Volume, а также другие кнопки, переключатели и поля страницы источника.
6. THE Averna SHALL записывать в новых и изменённых узбекских надписях буквы oʻ/gʻ (Oʻ/Gʻ) через знак U+02BB, а тутук belgisi в словах вроде «eʼlon» и «maʼlumot» через знак U+02BC, и не использовать вместо этих знаков символы U+0027 ('), U+0060 (`), U+2018 (‘) и U+2019 (’).
7. IF после извлечения любой текст New_Paper (passage, вопрос, вариант, инструкция, транскрипт, альтернативный текст) содержит без учёта регистра строку «IELTS_Volume» или ссылку на `t.me`, THEN THE Content_Importer SHALL исключить эту работу из манифеста и записать в отчёт импорта ошибку с именем файла и местом совпадения (номер части и номер вопроса или фрагмент транскрипта).

### Requirement 19: Телефон, десктоп и доступность

**User Story:** Как ученик, я хочу удобно пользоваться новыми экранами на телефоне и компьютере, чтобы тренироваться где угодно.

#### Acceptance Criteria

1. WHILE ширина окна меньше 1024 px (мобильный вид с выдвижным меню и Phone_Tab_Bar), THE Averna SHALL делать у каждого нового и изменённого интерактивного элемента область касания не меньше 44 × 44 px, измеренную по рамке элемента вместе с внутренними отступами (в том числе у пункта «Articles» в Student_Sidebar, ссылок «Open this passage only», строк «Practise Part 1» … «Practise Part 4» и кнопки «Start full test» в Listening_Library, ссылки на `/article` в Reading_Library, кнопок «Chegarani tinglash», сдвига границы и «Tasdiqlash» и поля времени границы в Audio_Manager, кнопки «Hear it» и кнопки офлайн-сохранения одной части Listening).
2. THE Averna SHALL показывать на новых и изменённых экранах (Reading_Library, Listening_Library, Reading_Runner, Listening_Runner, Result_Page, Audio_Manager, Student_Sidebar) при стандартном размере текста в настройках текст passage, вопросов, вариантов ответов, транскрипта, строк частей и сообщений об ошибках с вычисленным размером шрифта не меньше 14 px, а любой другой видимый текст с размером не меньше 11 px (декоративный текст, скрытый от экранных чтецов, и текст только для экранных чтецов не учитываются).
3. WHILE ширина окна 320 px или больше, THE Averna SHALL показывать новые и изменённые экраны (Reading_Library, Listening_Library, Reading_Runner и Listening_Runner с New_Paper в полном тесте и в одной части, Result_Page, Audio_Manager, открытое выдвижное меню Student_Sidebar) без горизонтальной прокрутки страницы, то есть с шириной прокрутки документа не больше видимой ширины плюс 1 px, в светлой и тёмной темах, с режимом «High contrast» и без него.
4. THE Averna SHALL задавать цвета текста, фона, границ, иконок и индикатора фокуса новых и изменённых элементов только через токены цветов темы Averna, без цветовых значений, записанных прямо в компонентах или стилях этих элементов.
5. THE Averna SHALL давать каждому изображению вопроса непустой альтернативный текст на английском языке с видом изображения (план, карта или схема) и диапазоном вопросов (например, «Map for Questions 16–20»), а каждой новой и изменённой кнопке или ссылке без видимого текста доступное имя с описанием действия на языке интерфейса по Requirement 18 (английский для ученика и преподавателя, узбекский латиницей для Audio_Manager).
6. IF показанная ширина изображения вопроса на экране Listening_Runner или Result_Page больше ширины области вопросов, THEN THE Averna SHALL прокручивать изображение по горизонтали внутри собственного блока шириной не больше области вопросов и оставлять страницу без горизонтальной прокрутки.
7. WHILE включена светлая или тёмная тема, с режимом «High contrast» или без него, THE Averna SHALL обеспечивать у новых и изменённых элементов контраст текста к фону не меньше 4.5:1, а контраст границ интерактивных элементов, иконок и индикатора фокуса к соседнему фону не меньше 3:1.
8. THE Averna SHALL делать каждый новый и изменённый интерактивный элемент доступным с клавиатуры: элемент получает фокус клавишей Tab в порядке расположения на экране, ссылка срабатывает по Enter, кнопка срабатывает по Enter и Space, а у элемента в фокусе виден индикатор фокуса.

### Requirement 20: Ограничения развёртывания

**User Story:** Как владелец Averna, я хочу, чтобы новые тесты не нарушили лимиты Vercel и порядок обновления базы, чтобы развёртывание прошло как обычно.

#### Acceptance Criteria

1. THE Averna SHALL оставлять для всех новых и изменённых файлов в `app/**` конфигурацию функций по умолчанию (без экспорта `maxDuration`, `preferredRegion` и `memory`, без `runtime = "edge"`) и сохранять в `vercel.json` значения `fluid: true` и `ignoreCommand` без новых настроек функций, так что `tests/function-config.test.ts` проходит без изменения его проверок.
2. IF для границ частей или других данных нужна схема базы данных, THEN THE Averna SHALL дописывать в `prisma/sql/deploy.sql` только добавляющие идемпотентные инструкции (`CREATE TABLE IF NOT EXISTS` с внешними ключами внутри определения таблицы, `ALTER TABLE … ADD COLUMN IF NOT EXISTS` для столбца с NULL или значением по умолчанию, `CREATE INDEX IF NOT EXISTS`). В них нет DROP, нет изменения типа, имени или ограничений существующих столбцов и нет блоков `DO $$ … $$`, поэтому повторное выполнение файла на уже обновлённой базе завершается без ошибок и не меняет существующие строки.
3. WHEN после `npm run build` выполняется Size_Gate, THE Size_Gate SHALL сообщать ровно 1 конфигурацию функций Node и объединённый размер трассированных файлов не больше 60 MB (1 MB = 1 048 576 байт). Этот размер SHALL быть не больше чем на 2 MB выше замера той же командой на `feat/elegance-roadmap` до изменений (≈43.7 MB).
4. THE Averna SHALL загружать записи и изображения New_Paper в браузер напрямую с Recording_Host по HTTPS-адресу. Байты этих файлов не проходят через функции Averna, а копии этих файлов, Source_Paper и кода Content_Importer отсутствуют в трассированных файлах функций и в `.next/static`.
5. WHILE `prisma/sql/deploy.sql` уже применён, а манифест New_Paper ещё не применён или New_Paper не опубликованы, THE Averna SHALL показывать в Reading_Library, Listening_Library, Homework_Library и Mock_Exam только существующие работы, давать проходить существующие работы с Whole_Recording без Verified_Segments только целиком и открывать все существующие маршруты без страницы ошибки.
6. IF Content_Importer запущен с записью в базу данных, а в этой базе нет таблиц или столбцов, которые эта работа добавляет в `prisma/sql/deploy.sql`, THEN THE Content_Importer SHALL остановиться до первой записи, оставить базу без изменений и перечислить в отчёте импорта недостающие таблицы и столбцы.
7. IF перед загрузкой занятый объём Recording_Host вместе с файлами записей и изображений New_Paper (≈158 MB) превышает 1 GB или занятый объём не удаётся получить, THEN THE Content_Importer SHALL остановить загрузку до отправки первого файла и записать в отчёт импорта занятый объём, объём новых файлов и лимит 1 GB.

### Requirement 21: Подсказки на родном языке для новых работ

**User Story:** Как ученик уровня A2–B1, я хочу видеть подсказки к инструкциям новых тестов на узбекском или русском, чтобы понимать задание.

#### Acceptance Criteria

1. THE L1_Hints SHALL возвращать непустую подсказку на узбекском (латиница, oʻ/gʻ через знак U+02BB, тутук ʼ через U+02BC, без ASCII-апострофа и обратной кавычки) и на русском (кириллица, без латинских букв внутри русских слов) не меньше чем для 90 % различных строк инструкций New_Paper, отдельно для каждого языка, а для строк «Questions N–M» и «Question N» для 100 %. Строки инструкций: непустая инструкция группы после обрезки пробелов по краям, правило ответа под инструкцией группы (в том числе лимиты слов и чисел из `textAnswerRules` тестов Listening 3–6) и «Questions N–M» / «Question N». Различными считаются строки, которые не совпадают посимвольно. Доля считается по объединённому набору строк всех 14 New_Paper.
2. THE L1_Hints SHALL давать подсказку на каждом из двух языков не меньше чем для 90 % различных строк инструкций объединённого набора, в который входят встроенные работы, по которым охват считается сейчас (работы Reading и Listening из кода приложения, работы и грамматический блок placement), и 14 New_Paper, по правилам подсчёта из критерия 1.
3. THE L1_Hints SHALL возвращать null на узбекском и на русском для каждого элемента содержимого вопросов всех 14 New_Paper, без исключений: заголовка группы, общего варианта группы, текста вопроса (пропуски заменены на «____») и варианта вопроса.
4. THE Averna SHALL хранить в репозитории как тестовые данные набор строк инструкций New_Paper, полученный из вывода Content_Importer: для каждого из 14 идентификаторов New_Paper навык и все строки по критерию 1, посимвольно совпадающие со строками в манифесте. Набор не содержит ключей, альтернатив ответов, текстов вопросов, вариантов, текстов passage и транскриптов, чтобы проверки критериев 1, 2 и 5 выполнялись без базы данных и без Source_Paper.
5. WHEN L1_Hints возвращает подсказку для строки инструкции New_Paper, THE L1_Hints SHALL копировать в подсказку без изменений каждое число, диапазон номеров (например 27–31), буквенный диапазон или список букв (например A–J в тесте 2 Reading, «A, B, C or D»), диапазон римских цифр (например i–viii), а слова TRUE, FALSE, NOT GIVEN, YES, NO и название «Reading Passage N» оставлять на английском.
6. WHILE у ученика (роль STUDENT) в существующей настройке подсказок выбран язык uz или ru и правило показа разрешает подсказки («Always», или «At my level» при уровне A1–B1, band не выше 5.0 или неизвестном уровне), WHEN ученик открывает New_Paper в Reading_Runner или Listening_Runner (полный тест или одну часть) или разбор ответов New_Paper на Result_Page, THE Averna SHALL показывать под каждой английской инструкцией группы и под правилом ответа, для которых L1_Hints вернул подсказку, эту подсказку на выбранном языке с меткой UZ или RU. Английский текст при этом не меняется, а строки без подсказки остаются только на английском.
7. IF строка инструкции New_Paper содержит хотя бы одно предложение, которое L1_Hints не распознаёт как стандартную инструкцию, THEN THE L1_Hints SHALL вернуть null для всей строки на обоих языках, без частичной подсказки.

### Requirement 22: Проверка и документация

**User Story:** Как владелец Averna, я хочу, чтобы изменения были проверены автоматически и описаны, чтобы им можно было доверять и поддерживать дальше.

#### Acceptance Criteria

1. WHEN коммит ветки изменений отправлен в репозиторий, THE Averna SHALL завершать в CI с кодом выхода 0 каждую проверку: `npx vitest --run` (без базы данных, без Recording_Host и без файлов вне репозитория), `npx tsc --noEmit`, `npm run lint` без ошибок и без предупреждений, `npm run build` и Size_Gate после `npm run build` по Requirement 20.3.
2. WHEN Content_Importer выполняет пробный запуск на 14 Source_Paper, THE Content_Importer SHALL для каждой из 14 New_Paper проверять ключ ответов Source_Paper как ответы ученика по правилам Exam_Grader, без сохранения результата, и записывать в отчёт импорта результат «x из 40».
3. WHEN `e2e/screens.mjs` выполняется на демо-данных seed, THE Averna SHALL сохранять снимки от имени ученика при ширине 390 px и 1440 px в светлой и тёмной темах для каждого из экранов: Reading_Library, Listening_Library с карточкой первой Splittable_Paper со строками частей, страница `?part=0` этой работы и Student_Sidebar с пунктом «Articles» (на телефоне в открытом выдвижном меню). Скрипт завершается с кодом выхода 1 и записывает проблему, если на Listening_Library нет ссылки с `?part=`, пункт «Articles» не виден или на снимке есть ошибка страницы, ошибка консоли, ответ HTTP 400 и выше, экран ошибки или горизонтальная прокрутка на телефоне.
4. THE Averna SHALL содержать документ на английском языке об импорте Volume 10, на который ссылается `docs/cdi-materials-import.md`. В документе есть разделы о запуске Content_Importer (пробный запуск и применение), размещении записей и изображений на Recording_Host, подтверждении границ в Audio_Manager, публикации и снятии с публикации (откат), а также список 14 идентификаторов New_Paper. В документе нет ключей, транскриптов, учётных данных и имени хоста производственной базы данных. Описание идеи 9 в `docs/elegance-roadmap.md` называет 17 пунктов меню и место «Articles» в разделе «Skills» сразу после «Reading» и больше не упоминает прежнее число 16.
5. IF при проверке по критерию 2 New_Paper получает меньше 40 из 40, THEN THE Content_Importer SHALL исключить эту работу из манифеста и записать в отчёт импорта номера незасчитанных вопросов.
6. THE Averna SHALL содержать в `npx vitest --run` проверки Content_Importer на синтетических Source_Paper, которые хранятся в репозитории и не содержат текстов passage, ключей и транскриптов New_Paper: ключ → ответы → 40 из 40 для работы Reading, в которой встречается каждый из 7 типов групп Requirement 1.4, и для работы Listening с альтернативами ключа, а также побайтное совпадение работ, файлов записей, файлов изображений и манифеста после двух запусков подряд.
7. THE Averna SHALL содержать в `npx vitest --run` проверки границ и меню. Свойства разбиения Part_Segment проверяются через fast-check не меньше чем на 100 случайных наборах с длительностью записи от 480 000 до 3 600 000 мс: наборы по Requirement 10.1–10.3 принимаются, а наборы с пропуском, наложением, началом не в 0 мс, концом не на длительности записи, отрезком короче 120 000 мс или Evidence_Window вне своей части отклоняются. `wholeRecordingHash`, адрес и статус ready у Whole_Recording совпадают до и после сохранения и изменения границ. После изменения подтверждённой границы состояние Verified_Segments снимается. Структура Student_Sidebar проверяется по Requirement 8.4–8.6.
