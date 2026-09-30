# План реализации

- [x] 1. Настроить тестовую инфраструктуру
  - Добавить в `devDependencies` точные версии (без `^`/`~`): `vitest@3.2.4`, `fast-check@4.10.2`, `jsdom@26.1.0`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`. Все совместимы с Node 20 (CI) и React 18. `jsdom` 30.x не подходит: он требует Node ≥22
  - Добавить скрипт `"test": "vitest run"`. Скрипты `build` и `vercel-build` не трогать
  - Создать `vitest.config.ts`: `environment: "jsdom"`, алиас `@` → корень проекта, `esbuild: { jsx: "automatic" }` (в `tsconfig` стоит `jsx: preserve`), `include: ["tests/**/*.test.{ts,tsx}"]`. Тесты лежат в `tests/` и проверяются `npx tsc --noEmit`
  - Добавить в `.github/workflows/ci.yml` отдельное задание `npm test` (Node 20, `npm ci`), как у существующих заданий
  - Добавить в `.gitignore` артефакты проверок: `/screens/`, `/e2e/baseline/`, `/e2e/report*.json`
  - Для Playwright-скриптов использовать ту же схему, что в `screens.yml`: `npm i --no-save playwright@1.48.2`, `npx playwright install chromium`, приложение на засеянной БД (`npx prisma db push --skip-generate`, `npm run db:seed`, `npm run build`, `npx next start` в фоне), адрес в `BASE_URL`. Если поднять приложение локально не удаётся (нет БД или переменных окружения), остановиться и спросить пользователя
  - Добавить `npm test` в таблицу скриптов и в раздел «Quality checks» `README.md`
  - Проверить: `npm install` проходит, `npx vitest run --passWithNoTests` запускается, `npx tsc --noEmit` без ошибок
  - _Requirements: 2.18_

- [x] 2. Написать исследовательский тест условия ошибки
  - **Property 1: Bug Condition** - Светлая тема на экзаменах и мобильный интерфейс
  - **КРИТИЧНО**: этот тест ДОЛЖЕН упасть на неисправленном коде. Падение подтверждает, что дефект существует
  - **НЕ исправлять ни тест, ни код, когда тест падает**
  - **ПРИМЕЧАНИЕ**: тест кодирует ожидаемое поведение. После исправления он пройдёт и подтвердит исправление
  - **ЦЕЛЬ**: получить контрпримеры, которые доказывают наличие дефекта
  - **Scoped PBT**: дефекты детерминированы, поэтому свойства ограничены конкретными падающими случаями: `theme="light"` × экзаменационные и словарные поверхности; ширина 320–1023 px для B1 и 320–639 px для B2/B3 (`fc.integer`); 375×667 для B5/B6; 390×400 для B7; 390 px для B11
  - Условие из дизайна: `isBugCondition(X) = A1 ∨ A2 ∨ B1 ∨ … ∨ B11` (раздел «Bug Condition»)
  - Уровень 1: Vitest, `tests/bug-condition.test.tsx` (при необходимости замокать `next/navigation`)
    - A1/A2, статика: в `app/globals.css` нет `html.light .exam-shell` и блока «EXAM SCREENS keep their own colours»; в `components/exam/**`, `components/placement/**`, `components/dictionary/**` и четырёх экзаменационных `loading.tsx` нет `bg-[#0…]`, `from-[#0…]`, `to-[#0…]` и `bg-black/…` в полях ввода (разрешён только `bg-[#f4f7f5]`); в `<mark>` из `passage-pane.tsx` нет `text-amber-50`
    - A1/A2, PBT: для любого токена из таблицы дизайна (`fc.constantFrom` по `exam-*`, `surface-*`) в `lib/theme-tokens.json` есть светлое значение с яркостью ≥0.8 (фоны) или с контрастом ≥4.5:1 к `#ffffff` и `#f5f7fa` (`exam-mark`); основной текст (`white`, `gray-100`) на любом светлом фоне экзамена даёт контраст ≥4.5:1
    - B1–B3, PBT на `ExamShell` (RTL): для любых `split` ∈ [28, 72], режима и наличия `exitHref` у панелей нет инлайн `flex-basis`, у тела есть `--exam-left` и `--exam-right`; в практике с `exitHref` у ссылки выхода нет класса `hidden` и есть `h-11 w-11`; есть кнопка `aria-label="Text size"`; «пред./след.» имеют `h-11 w-11`, номера вопросов `h-10`; в шапке и навигаторе есть `env(safe-area-inset-*)`
    - B4/B9: исходник `app/layout.tsx` содержит `viewportFit: "cover"` и не содержит статического `themeColor`; `THEME_SCRIPT`, выполненный в jsdom при `averna_theme=light`, ставит `meta[name=theme-color]` = `#ffffff`; PBT: для любой последовательности переключений в `ThemeProvider` `theme-color` равен `THEME_COLORS` последнего выбора
    - B6, B8, B10: у панелей шести модальных окон есть `av-modal-panel`, а в `globals.css` есть правило для него; у `ui/toast.tsx` и `live-notifications.tsx` на базовом уровне нет `top-4` (есть `env(safe-area-inset-top)` и `lg:top-4`); в `globals.css` есть `@supports not (overflow-x: clip)`
  - Уровень 2: Playwright, `e2e/bugfix-checks.mjs` (реальные вычисленные стили, ширины через `fc.sample`). Реализовать случаи 1–9 из раздела «Исследовательская проверка условия ошибки»: светлые Reading/Listening, словарь на `/article`, ширина панели на 768/900 px и после `split=30`, шапка на 390/320 px, `viewport` и `theme-color`, `/messages` у учителя на 375×667, модальные окна на 375×667, палитра на 390×400, календарь на 390 px. Нарушения записываются в `e2e/report-bugfix.json`, при нарушениях код выхода ненулевой
  - Утверждения соответствуют Property 1 (Expected Behavior) из дизайна: светлый фон (яркость ≥0.8) и контраст ≥4.5:1 при сохранённом `html.light`; видимая панель = 100% ширины тела ±1 px; элементы шапки ≥44×44, не пересекаются и помещаются в экран; поле ввода сообщений в первом экране; панель модального окна ≤ вьюпорта и прокручивается; список палитры в пределах вьюпорта; метки календаря ≥11 px и полный список дня по касанию
  - Запустить на НЕИСПРАВЛЕННОМ коде: `npm test -- tests/bug-condition.test.tsx` и `node e2e/bugfix-checks.mjs`
  - **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ**: тесты ПАДАЮТ (это правильно, так подтверждается дефект)
  - Записать найденные контрпримеры в комментарий в начале `tests/bug-condition.test.tsx` (например, «корень `.exam-shell` при `html.light` имеет `rgb(4 11 9)`», «видимая панель на 768 px шириной 384 px»). Если контрпример не воспроизводится, пересмотреть первопричину в `design.md`. Реальные inset (B4) и iOS <16 (B10) Playwright не эмулирует, они проверяются в задаче 8
  - Задача выполнена, когда тесты написаны, запущены и падения задокументированы
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16_

- [x] 3. Написать тесты сохранения поведения (ДО исправления)
  - **Property 2: Preservation** - Тёмная тема, десктопные макеты и логика без изменений
  - **ВАЖНО**: следовать методике «сначала наблюдение». Все базовые снимки снимаются на неисправленном коде до любых правок
  - Область: входы, где `isBugCondition(X)` ложно: тёмная тема на любом экране; неэкзаменационные страницы светлой темы на ≥1024 px; десктопные макеты; логика экзаменов
  - Playwright, `e2e/preservation-checks.mjs`, режимы `--capture` и `--compare`:
    - Снимок стилей: для каждого элемента путь в DOM и `getComputedStyle` (фон, цвет, цвета рамок, `box-shadow`, `outline-color`, размеры, позиция). Условия съёмки одинаковые: часы заморожены через `page.clock`, шрифты загружены. Снимки сохраняются в `e2e/baseline/`
    - Сценарии: тёмная тема 1440×900 (Reading, Listening, Writing, Speaking, экраны загрузки при задержанном ответе через `page.route`, `/article` с открытым словарным окном, основные страницы трёх панелей из `PAGES` в `screens.mjs`, экзамен с `data-gfx="lite"`, печатный вид страницы результатов через `emulateMedia({ media: "print" })`) сравнивается на полную идентичность; тёмная тема 390×844: цветовые свойства идентичны у всех элементов, которые есть в обоих снимках, а размеры и позиции могут отличаться только внутри исправляемых компонентов (адаптированные таблицы и карточки не меняются); светлая тема 1440×900 на неэкзаменационных страницах сравнивается на полную идентичность вне словарных окон
    - Десктоп, PBT (`fc.sample`): для ширины 1024–1920 px и `split` ∈ [28, 72] панели стоят рядом, левая равна `split`% ±1 px, разделитель работает в пределах 28–72%, регулятор размера текста в шапке виден (3.5)
    - Телефон 390×844: поля ввода имеют `font-size: 16px` (3.12); выдвижное меню закрывается по Escape и при смене страницы и блокирует прокрутку, нижняя панель содержит 5 вкладок для каждой роли (3.10)
  - Vitest, `tests/preservation.test.tsx`:
    - PBT темы: для любой последовательности переключений `dark`/`light` класс `<html>` и `localStorage.averna_theme` соответствуют последнему выбору; без сохранённого значения используется тёмная тема; `THEME_SCRIPT` применяет сохранённый выбор (3.4)
    - Токены: зафиксировать на F список токенов из `lib/theme-tokens.json` в `tests/fixtures/theme-tokens.baseline.json`. Для любого из них сгенерированный блок в `globals.css` содержит то же тёмное значение в `:root` и то же светлое в `html.light` (3.1–3.3)
    - PBT на `ExamShell` (режим, `exitHref`, шаг из `FONT_STEPS`, число вопросов): в Mock нет ссылки выхода (3.9); группа `hidden sm:flex` с регулятором размера текста на месте (3.5); нажатие номера в навигаторе вызывает переход к вопросу, `ReviewDialog` показывает счётчики ответов и флажков (3.6)
    - Снимок текстов админ-команд `components/command-palette.tsx` и `ADMIN_NAV` в `app-sidebar.tsx` на узбекском (3.14)
  - Запустить на НЕИСПРАВЛЕННОМ коде: `node e2e/preservation-checks.mjs --capture`, затем `--compare` (сравнение F с F подтверждает детерминизм снимков), `npm test -- tests/preservation.test.tsx`, `node e2e/screens.mjs`
  - **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ**: тесты ПРОХОДЯТ (так фиксируется поведение, которое нужно сохранить)
  - Задача выполнена, когда тесты написаны, запущены и проходят на неисправленном коде
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.18_

- [x] 4. Исправление светлой темы на экзаменационных экранах

  - [x] 4.1 Добавить токены `exam-*` и `surface-*` и обновить генератор
    - `lib/theme-tokens.json`: добавить `exam-bg`, `exam-bar`, `exam-strip`, `exam-orb-top`, `exam-orb-bottom`, `exam-mark`, `surface-raised`, `surface-well` (формат `[name, dark, light]`, значения из таблицы дизайна). Тёмные значения в точности равны заменяемым hex. Имя `popover` не использовать, `tailwind.config.ts` не менять
    - `scripts/theme-tokens.mjs`: селектор тёмных значений `:root` вместо `:root,\nhtml.light .exam-shell`; исправить комментарии («экзамены следуют теме»); вынести экспортируемую чистую функцию `buildThemeBlock({ tokens, keepWhiteInk })`, а запись файла (`--write`) выполнять только при запуске из CLI
    - Перегенерировать `node scripts/theme-tokens.mjs --write`, повторный запуск не даёт diff. Внутри маркеров THEME TOKENS ничего не править вручную
    - `tests/theme-tokens.test.ts`: `buildThemeBlock` не выводит `.exam-shell`, каждый токен есть в `:root` (тёмное) и `html.light` (светлое), правило `keepWhiteInk` сохранено. PBT эквивалентности: для любой пары «старый класс → новый класс» из списка замен и любой прозрачности α ∈ [0, 1] CSS, скомпилированный Tailwind (PostCSS + `tailwind.config.ts`, контент `raw`), с тёмными `--c-*` даёт тот же цвет, что старый класс
    - _Bug_Condition: A1 ∨ A2 — `X.theme = "light" AND X.surface IN ExamSurfaces ∪ DictionarySurfaces`_
    - _Expected_Behavior: Property 1 (A1/A2): светлые фоны с яркостью ≥0.8, контраст основного текста ≥4.5:1_
    - _Preservation: тёмные значения всех токенов (старых и новых) совпадают с текущими hex, тёмная тема пиксельно идентична_
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3_

  - [x] 4.2 Убрать принудительную тёмную палитру с экзаменов и заменить жёсткие цвета
    - `app/globals.css`: удалить весь блок «EXAM SCREENS keep their own colours in the light theme» (все селекторы `html.light .exam-shell …`, около строк 1153–1238); добавить `html.light .av-float { box-shadow: 0 14px 36px -12px rgba(15, 23, 42, 0.22); }`
    - Заменить классы цвета по списку дизайна, остальные классы не трогать: `exam-shell.tsx`, `speaking-exam-runner.tsx`, `writing-exam-client.tsx`, `reading-exam-runner.tsx`, `grammar-runner.tsx`, `placement-orchestrator.tsx`, `mock-orchestrator.tsx`, `question-group.tsx`, `writing-exam-runner.tsx` (`bg-[#f4f7f5]` остаётся), `placement/writing-runner.tsx`, `passage-pane.tsx` (`text-amber-50` → `text-exam-mark`)
    - `app/learning/{reading/[testId],listening/[testId],writing/exam,speaking-test/[setId]}/loading.tsx`: `bg-[#040b09]` → `bg-exam-bg`
    - Класс `exam-shell` остаётся как маркер для e2e, стилей на нём больше нет. Правила печати и `data-gfx="lite"` продолжают действовать внутри экзаменов
    - _Bug_Condition: A1 — `X.theme = "light" AND X.surface IN ExamSurfaces` (включая экраны загрузки)_
    - _Expected_Behavior: Property 1 (A1): светлые корень, шапка, панели, навигатор и поля ввода; у `<html>` остаётся `light`; экран загрузки светлый с первого кадра_
    - _Preservation: тёмные экзамены и экраны загрузки идентичны базовым снимкам (3.1), печатный вид (3.15), lite-режим (3.16)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.15, 3.16_

  - [x] 4.3 Исправить словарные окна и обновить README
    - `components/dictionary/word-popover.tsx`: `bg-[#0b1a16]/[0.97]` → `bg-surface-raised/[0.97]` и класс `av-float`
    - `components/dictionary/lookup-area.tsx`: `bg-[#0b1a16]/95` → `bg-surface-raised/95` и `av-float`
    - `components/exam/passage-pane.tsx` (панель выделения): `bg-[#0b1a16]/95` → `bg-surface-raised/95` и `av-float`
    - `README.md`, раздел «Conventions»: заменить «exam screens (`.exam-shell`) always stay dark» на описание «экраны экзаменов следуют выбранной теме, их поверхности используют токены `exam-*` и `surface-*`» (текст README на английском)
    - _Bug_Condition: A2 — `X.theme = "light" AND X.surface IN DictionarySurfaces`_
    - _Expected_Behavior: Property 1 (A2): светлая поверхность, контраст текста ≥4.5:1_
    - _Preservation: в тёмной теме словарные окна выглядят как сейчас; перевод, определение, «My words», без «Review» внутри теста (3.13)_
    - _Requirements: 2.5, 3.3, 3.13_

- [x] 5. Исправление мобильного интерфейса

  - [x] 5.1 `ExamShell`: ширина панелей, шапка, области касания, безопасные зоны
    - Ширина: на теле экзамена `` style={{ fontSize, "--exam-left": `${split}%`, "--exam-right": `${100 - split}%` }} ``; убрать инлайн `flexBasis` с панелей и добавить `lg:basis-[var(--exam-left)]` и `lg:basis-[var(--exam-right)]`
    - Выход: ссылка видна всегда, когда передан `exitHref`: `inline-flex h-11 w-11 items-center justify-center sm:h-auto sm:w-auto sm:px-2 sm:py-1.5`. В Mock `exitHref` не передаётся
    - Новый внутренний компонент `MobileTextSize` (`sm:hidden`): кнопка «Aa» 44×44 (`aria-label="Text size"`, `aria-expanded`, `aria-controls`) открывает панель под шапкой с кнопками «Smaller text» и «Larger text» (44×44, шаги `FONT_STEPS`, отключаются на границах) и процентом в `aria-live="polite"`. Панель закрывается по Escape, касанию вне неё и повторному нажатию «Aa». Шапка получает `relative z-20`. Группа `hidden sm:flex` не меняется
    - 320 px, только базовый уровень: шапка `gap-1.5 px-2`; `TimerPill` `px-2 sm:px-3`; кнопка завершения `px-3 sm:px-4`; заголовок `min-w-0 flex-1 truncate`. Значения `sm:` и десктопные остаются
    - Касание: «пред./след.» `h-11 w-11 sm:h-10 sm:w-10`; номера вопросов `h-10 min-w-[2.5rem] sm:h-8 sm:min-w-[2rem]`; `overflow-x-auto no-scrollbar` сохраняется
    - Безопасные зоны: шапка `pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2`; навигатор `pb-[calc(0.5rem+env(safe-area-inset-bottom))]`; корень `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`. Те же отступы добавить в `speaking-exam-runner.tsx`, `writing-exam-client.tsx` (`Frame`, оверлей проверки), `reading-exam-runner.tsx` (`EmptyTest`) и четыре экзаменационных `loading.tsx`
    - `tests/mobile-text-size.test.tsx`: «Aa» открывает панель, кнопки вызывают `onFontScale` со значениями `FONT_STEPS` и отключаются на границах, Escape закрывает панель. Тексты экзамена на английском (экран ученика)
    - _Bug_Condition: B1 ∨ B2 ∨ B3 ∨ B4 (экзаменационная часть)_
    - _Expected_Behavior: Property 1 (B1–B4): видимая панель 100% ширины ±1 px; выход и «Aa» 44×44 в практике; номера ≥40 px; шапка помещается в 320 px; отступы `env(safe-area-inset-*)`_
    - _Preservation: на ≥1024 px панели рядом, разделитель 28–72%, регулятор в шапке (3.5); логика таймера, ответов, флажков, навигатора и отправки (3.6); аудио Listening (3.7); Speaking и Writing (3.8); Mock без выхода (3.9)_
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 5.2 Вьюпорт, `theme-color` и безопасные зоны навигации
    - `app/layout.tsx`: в `viewport` добавить `viewportFit: "cover"` и убрать `themeColor`; в `<head>` перед `THEME_SCRIPT` вывести `<meta name="theme-color" content={THEME_COLORS.dark} suppressHydrationWarning />`. `statusBarStyle: "black-translucent"` остаётся (известное ограничение из дизайна)
    - `components/theme/theme-script.ts`: экспортировать `THEME_COLORS = { dark: "#04070d", light: "#ffffff" }`; при светлой теме `THEME_SCRIPT` синхронно ставит `content` у `meta[name="theme-color"]`
    - `components/theme/theme-provider.tsx`: `apply(m)` дополнительно обновляет `meta[name="theme-color"]` значением `THEME_COLORS[m]`. Хранение, классы и тема по умолчанию не меняются
    - `components/layout/app-sidebar.tsx`, `components/dashboard/mobile-nav.tsx`: верхняя и нижняя панели получают `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`, выдвижное меню `pl-[env(safe-area-inset-left)]`, обёртка контента `AppShell` те же боковые отступы ниже `lg` (`lg:pl-64 lg:pr-0` без изменений)
    - _Bug_Condition: B4 ∨ B9 — `X.device.safeAreaInsets AND X.viewport.w < 1024`; `X.theme = "light"` в мобильном браузере или PWA_
    - _Expected_Behavior: Property 1 (B4, B9): `viewport-fit=cover`, панели и меню отступают на inset; `theme-color` совпадает с темой после загрузки и после каждого переключения_
    - _Preservation: механизм темы (3.4); мобильная навигация: меню, Escape, блокировка прокрутки, 5 вкладок (3.10); на десктопе `env()` = 0_
    - _Requirements: 2.9, 2.14, 3.4, 3.10_

  - [x] 5.3 Страница сообщений на телефоне
    - Новый `lib/messages-view.ts`: чистая функция `messagesPhoneView(withParam, contactCount): "list" | "thread"` (`"thread"`, если задан `withParam` или `contactCount <= 1`, иначе `"list"`)
    - `app/messages/page.tsx`: при `"thread"` карточка контактов получает `hidden md:block`, при `"list"` карточка переписки получает `hidden md:flex`; на md+ разметка прежняя
    - В шапке переписки ссылка `md:hidden` на `/messages` высотой ≥44 px, только при `contacts.length > 1`: «All contacts», для роли `ADMIN` «Barcha kontaktlar» (по `.kiro/steering/admin-language.md`)
    - Высота переписки на телефоне считается от `100dvh` за вычетом верхней и нижней панелей, шапки страницы и inset, с нижней границей `min-h-[18rem]`; `md:h-[60vh]` как сейчас. Константу подобрать так, чтобы низ поля ввода был не ниже верхнего края нижней панели на 375×667 и 390×844
    - `tests/messages-view.test.ts`, PBT: для любых `withParam ∈ {undefined, id контакта, чужой id}` и `contacts ∈ [0, 60]` результат соответствует правилу
    - _Bug_Condition: B5 — `X.surface = MessagesPage AND X.viewport.w < 768 AND X.contacts >= 1`_
    - _Expected_Behavior: Property 1 (B5): переписка и поле ввода в первом экране, возврат к списку контактов доступен_
    - _Preservation: md+ разметка с обеими карточками (3.2); интерфейс ученика и учителя на английском, админки на узбекском (3.14)_
    - _Requirements: 2.10, 3.2, 3.14_

  - [x] 5.4 Модальные окна на невысоких экранах
    - Класс `av-modal-panel` у панелей `components/onboarding-wizard.tsx`, `components/onboarding-tour.tsx`, `components/dashboard/brain-break.tsx`, `components/dashboard/level-up-celebration.tsx`, `components/dashboard/dashboard-preferences.tsx` и `ReviewDialog` в `exam-shell.tsx`; оверлеи получают `py-4`
    - `app/globals.css`: правило `@media (max-width: 1023px), (max-height: 700px) { .av-modal-panel { max-height: calc(100vh - 2rem); max-height: calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; } }`
    - Нижние листы (`dashboard-preferences`, `ReviewDialog` на телефоне) учитывают `env(safe-area-inset-bottom)`; оверлей `ReviewDialog`: `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`
    - _Bug_Condition: B6 — `X.surface IN Modals AND X.contentHeight > X.viewport.h`_
    - _Expected_Behavior: Property 1 (B6): панель не выше видимой области, прокручивается внутри, кнопки действий доступны_
    - _Preservation: на обычном десктопе правило не включается, свечение `neon-button:hover` не обрезается (3.2, 3.5); счётчики и логика `ReviewDialog` (3.6)_
    - _Requirements: 2.9, 2.11, 3.2, 3.5, 3.6_

  - [x] 5.5 Командная палитра и экранная клавиатура
    - Хук `useVisualViewport()` возвращает `{ height, offsetTop }` из `window.visualViewport`, подписан на `resize` и `scroll`; без поддержки возвращает `null`
    - `components/command-palette.tsx`: оверлей `style={{ top: vv.offsetTop, height: vv.height, bottom: "auto" }}` (без хука остаётся `inset-0`); `pt-24` → `pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-24`, добавить `pb-3`; панель `flex max-h-full flex-col`; список `max-h-80 min-h-0 shrink overflow-y-auto`
    - Тексты палитры (в том числе узбекские админ-команды) не меняются
    - _Bug_Condition: B7 — `X.surface = CommandPalette AND X.viewport.w < 640 AND (keyboardOpen OR X.viewport.h < 465)`_
    - _Expected_Behavior: Property 1 (B7): поле поиска и список в пределах `visualViewport`, результаты прокручиваются_
    - _Preservation: на десктопе список 320 px и отступ 96 px как сейчас (3.5); админ-команды на узбекском (3.14)_
    - _Requirements: 2.12, 3.5, 3.14_

  - [x] 5.6 Всплывающие уведомления
    - `components/ui/toast.tsx` и `components/live-notifications.tsx`: `top-4` → `top-[calc(4.5rem+env(safe-area-inset-top))] lg:top-4`; `right-4` → `right-[max(1rem,env(safe-area-inset-right))]`
    - _Bug_Condition: B8 — `X.surface IN {Toaster, LiveNotifications} AND X.viewport.w < 1024`_
    - _Expected_Behavior: Property 1 (B8): уведомления ниже верхней панели с учётом inset, кнопки меню и поиска не закрыты_
    - _Preservation: на lg положение прежнее (3.5)_
    - _Requirements: 2.13, 3.5_

  - [x] 5.7 Запасной вариант защиты от горизонтальной прокрутки
    - `app/globals.css`: сразу после `html, body { overflow-x: clip; }` добавить `@supports not (overflow-x: clip) { body { overflow-x: hidden; } }` с комментарием о Safari <16
    - Если ручная проверка на iOS 15 (задача 8) покажет, что этого мало, согласовать с пользователем вариант `html, body { overflow-x: hidden }` внутри того же `@supports` (на iOS <16 перестанут прилипать sticky-панели) и записать решение в комментарии к правилу
    - _Bug_Condition: B10 — `X.device.iosSafariMajor < 16 AND pageHasElementWiderThan(X.viewport.w)`_
    - _Expected_Behavior: Property 1 (B10): у страницы нет горизонтальной прокрутки_
    - _Preservation: в браузерах с поддержкой `clip` правило не применяется, sticky-панели работают (3.2, 3.10)_
    - _Requirements: 2.15, 3.2, 3.10_

  - [x] 5.8 Календари ученика и учителя на телефоне
    - Новый `lib/calendar-days.ts`: `buildDayItems(...)` возвращает для каждого дня список `{ kind: "lesson" | "tutoring" | "homework", label }`; `parseSelectedDay(d, daysInMonth, todayDay)` ограничивает день диапазоном (по умолчанию сегодня в текущем месяце, иначе 1)
    - Новый серверный компонент `components/calendar/phone-month.tsx` (`sm:hidden`): ячейки-`Link` на `?m=YYYY-M&d=D` (`scroll={false}`, `aria-current="date"` у выбранной, ≥44 px, номер дня `text-sm`) с цветными точками тех же цветов, что в легенде; под сеткой панель дня с полными названиями (`text-sm`) и пустым состоянием «Nothing scheduled»
    - `app/calendar/page.tsx`, `app/teacher/calendar/page.tsx`: подключить `PhoneMonth`, существующая сетка получает `hidden sm:grid` и на sm+ не меняется. Тексты на английском
    - `tests/calendar-days.test.ts`, PBT: для любого месяца и года, случайного расписания и набора заданий панель дня `d` содержит ровно все занятия и задания этого дня; `parseSelectedDay` всегда возвращает значение из [1, daysInMonth], в том числе для `d` вне месяца и неверного ввода
    - _Bug_Condition: B11 — `X.surface IN {StudentCalendar, TeacherCalendar} AND X.viewport.w < 640`_
    - _Expected_Behavior: Property 1 (B11): метки ≥11 px или индикаторы, касание дня показывает полный список_
    - _Preservation: сетка на sm+ без изменений (3.5); интерфейс ученика и учителя на английском (3.14)_
    - _Requirements: 2.16, 3.5, 3.14_

- [ ] 6. Расширить мобильную проверку экранов и подтвердить исправление

  - [x] 6.1 Расширить `e2e/screens.mjs`
    - `PAGES`: ученик добавляет `/messages`, `/calendar`, `/learning/reading`, `/learning/listening`; учитель — `/teacher/calendar`, `/teacher/homework`, `/teacher/gradebook`, `/teacher/attendance`, `/messages`; администратор — `/admin/groups`, `/admin/finance`, `/admin/analytics`, `/admin/teachers`, `/admin/content`, `/messages`
    - Экзамены: со списка `/learning/reading` и `/learning/listening` взять первую ссылку на тест (без `result`), открыть в отдельной вкладке, снять вкладки Passage и Questions на телефоне и десктопе в обеих темах; закрывать вкладку через `page.close()` (обходит `useLeaveGuard`); отфильтровать шум автозапуска аудио (`NotAllowedError`)
    - Проверки прежние: ошибки страницы и консоли, невидимый контент, горизонтальное переполнение на телефоне. Уже охваченные страницы и `REDIRECTS` не меняются
    - Запустить `node e2e/screens.mjs` против исправленного приложения: без ошибок
    - _Requirements: 1.17, 2.17, 3.18_

  - [-] 6.2 Проверить, что исследовательский тест условия ошибки теперь проходит
    - **Property 1: Expected Behavior** - Светлая тема на экзаменах и мобильный интерфейс
    - **ВАЖНО**: перезапустить ТЕ ЖЕ тесты из задачи 2, новые не писать
    - Тесты из задачи 2 кодируют ожидаемое поведение, их прохождение подтверждает исправление
    - Запустить `npm test -- tests/bug-condition.test.tsx` и `node e2e/bugfix-checks.mjs`
    - **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ**: тесты ПРОХОДЯТ (дефект исправлен)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16_

  - [-] 6.3 Проверить, что тесты сохранения поведения по-прежнему проходят
    - **Property 2: Preservation** - Тёмная тема, десктопные макеты и логика без изменений
    - **ВАЖНО**: перезапустить ТЕ ЖЕ тесты из задачи 3, новые не писать и базовые снимки не пересъёмывать
    - Запустить `node e2e/preservation-checks.mjs --compare` и `npm test -- tests/preservation.test.tsx`
    - **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ**: тесты ПРОХОДЯТ (регрессий нет). Различия допустимы только там, где их разрешает дизайн: размеры исправляемых компонентов на 390 px и словарные окна в светлой теме
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.18_

- [-] 7. Checkpoint: все проверки проходят
  - `node scripts/theme-tokens.mjs --write` не даёт diff
  - `npx tsc --noEmit`, `npm run lint` (без предупреждений, как `npx next lint --max-warnings=0` в CI), `npm run build`, `npm test` проходят без ошибок
  - `node e2e/screens.mjs` проходит против собранного приложения
  - Убедиться, что новый и изменённый текст админки на узбекском по `.kiro/steering/admin-language.md`, а временные артефакты проверок не попадают в git
  - Если возникнут вопросы, спросить пользователя
  - _Requirements: 2.17, 2.18, 3.14, 3.18_

- [ ] 8. Проверка на реальных устройствах (РУЧНАЯ ПРОВЕРКА, выполняет пользователь)
  - Где: локальная продакшн-сборка, открытая с устройства в той же сети (`npx next start -H 0.0.0.0`), или preview-адрес из задачи 9.1. Пункты про PWA и iOS 15 обязательно повторить на preview-адресе до запроса подтверждения в задаче 9.2
  - iPhone с вырезом, Safari и установленное PWA, портретная и альбомная ориентация: верхняя панель, нижняя панель вкладок, выдвижное меню, шапка экзамена, аудиопанель Listening и навигатор вопросов не заходят под статус-бар, вырез и индикатор Home
  - Командная палитра с открытой клавиатурой (iOS Safari и Chrome Android): поле поиска и результаты над клавиатурой, список прокручивается
  - iOS 15 Safari (устройство или облачная ферма устройств): нет горизонтальной прокрутки на дашборде, экзамене и `/messages`. При провале вернуться к задаче 5.7
  - Chrome Android: цвет адресной строки в обеих темах и после переключения темы
  - Результат по каждому пункту записать в отчёт задачи. Агент не отмечает задачу выполненной без подтверждения результатов пользователем
  - _Requirements: 2.9, 2.12, 2.14, 2.15_

- [ ] 9. Деплой на Vercel

  - [ ] 9.1 Preview-деплой
    - Выяснить способ деплоя. Локально проект не привязан к Vercel CLI (нет `.vercel`), поэтому, скорее всего, используется Git-интеграция с `github.com/AsadbekAnvarov/Averna`: ветка → preview, `main` → продакшн. Если это не так, уточнить у пользователя
    - Создать новую ветку (не `main`), закоммитить только файлы этого исправления (без `.env`, `screens/`, `e2e/baseline/`, отчётов), в сообщении коммита указать `[screens]`, выполнить `git push -u`. Хуки не пропускать
    - Убедиться, что `vercel-build` в `package.json`, `prisma/sql/deploy.sql` и `vercel.json` (cron) не изменились: `git diff main -- prisma/sql/deploy.sql vercel.json` пуст, строка `vercel-build` прежняя
    - Дождаться CI (`ci.yml` с `npm test`, `screens.yml`) и сборки preview в Vercel; открыть preview-адрес и проверить светлую тему в Reading и Listening, словарь на `/article`, ширины 390 и 768 px
    - _Requirements: 2.18, 3.17_

  - [ ] 9.2 СТОП: запросить явное подтверждение продакшн-деплоя
    - **ОБЯЗАТЕЛЬНО**: до любого продакшн-деплоя (слияние в `main`, `vercel --prod`, продвижение preview в продакшн) спросить пользователя через `user_input` и дождаться явного «да»
    - Показать: preview-адрес, результаты CI и задачи 8, что именно произойдёт (изменения увидят все пользователи, `vercel-build` как обычно выполнит `prisma/sql/deploy.sql` на продакшн-БД) и как откатиться (Instant Rollback к предыдущему деплою в Vercel)
    - Молчание, неоднозначный ответ или отказ не являются подтверждением. В этом случае остановиться на preview
    - _Requirements: 2.18, 3.17_

  - [ ] 9.3 Продакшн-деплой (только после подтверждения в 9.2)
    - Выполнить выбранный пользователем способ: PR в `main` (`gh pr create`) и слияние или `vercel --prod`. Без force push и прямого push в `main`, если пользователь не просил об этом явно
    - Проверить, что продакшн-деплой в Vercel завершился успешно, а cron `/api/cron/daily` по-прежнему в расписании
    - На продакшн-адресе проверить: светлая тема в Reading, Listening, Writing и Speaking; словарь на `/article`; ширины 390 и 768 px; тёмная тема без изменений. При регрессии предложить пользователю откат (тоже после подтверждения)
    - _Requirements: 1.18, 2.18, 3.17_
