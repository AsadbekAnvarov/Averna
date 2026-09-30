# Дизайн исправления: светлая тема на экзаменах и мобильный интерфейс

## Обзор (Overview)

Исправление закрывает две группы дефектов из `bugfix.md`.

1. **Светлая тема на экзаменах.** Экзаменационные экраны (`.exam-shell`) принудительно получают тёмную палитру: генератор токенов пишет тёмные значения в селектор `:root, html.light .exam-shell`, а в `app/globals.css` есть отдельный блок `html.light .exam-shell …`, который возвращает тёмные shadcn-токены, панели, стекло, поля ввода, полосы прокрутки и контур фокуса. Поверх этого фоны экзаменов и словарных окон заданы жёсткими hex-цветами (`bg-[#040b09]`, `bg-[#07130f]`, `bg-[#0b1a16]` …), которые не зависят от темы.
   Стратегия: экзамены используют те же токены темы, что и остальное приложение. Принудительные тёмные переопределения для `html.light` удаляются, а жёсткие цвета заменяются новыми токенами `exam-*` и `surface-*` из `lib/theme-tokens.json`. Их тёмные значения в точности равны сегодняшним hex, поэтому тёмная тема остаётся пиксельно идентичной. Меняются только значения для `html.light`.
2. **Мобильный интерфейс.** Точечные правки вёрстки ниже `lg` (1024 px) и `sm` (640 px). Всё, что видно на ≥1024 px, сохраняет прежние размеры: новые правила либо ограничены мобильными брейкпоинтами, либо на десктопе дают те же вычисленные значения (например, `env(safe-area-inset-*)` там равен 0).
3. **Проверка и выпуск.** Расширяем `e2e/screens.mjs` и добавляем тесты (Vitest + fast-check). Сборка через `npm run vercel-build` не меняется. Продакшн-деплой выполняется только после явного подтверждения пользователя.

## Глоссарий (Glossary)

- **Bug_Condition (C)**: условие, при котором проявляется дефект: сочетание темы, экрана, размера вьюпорта и свойств устройства из раздела «Детали ошибки».
- **Property (P)**: желаемое поведение для входов, где C истинно (светлая палитра, полная ширина панели, доступные элементы управления и т. д.).
- **Preservation**: поведение, которое должно остаться прежним для входов, где C ложно. Прежде всего это тёмная тема, десктопные макеты и логика экзаменов.
- **F / F'**: исходный и исправленный код.
- **Экзаменационная поверхность (ExamSurface)**: любой полноэкранный экран с классом `exam-shell`: `ExamShell` (`components/exam/exam-shell.tsx`, используется в Reading, Listening, Writing и Placement), `SpeakingExamRunner`, `Frame` и оверлей проверки из `writing-exam-client.tsx`, `EmptyTest`, экраны «время вышло» в `mock-orchestrator.tsx` и `placement-orchestrator.tsx`, пустой раздел в `grammar-runner.tsx`, четыре `loading.tsx`.
- **Словарная поверхность (DictionarySurface)**: `WordPopover` (`components/dictionary/word-popover.tsx`, рендерится в портале `body`, то есть вне `.exam-shell`), кнопка «Look up» из `lookup-area.tsx` и панель выделения из `passage-pane.tsx`.
- **Токен темы**: CSS-переменная `--c-<name>` с тёмным и светлым значением. Пишется скриптом `scripts/theme-tokens.mjs` из `lib/theme-tokens.json`, а `tailwind.config.ts` превращает её в цвет Tailwind (`rgb(var(--c-…) / <alpha-value>)`).
- **`split`**: состояние `ExamShell` с положением разделителя в процентах (28–72, по умолчанию 50).
- **Безопасная зона (safe area)**: `env(safe-area-inset-top|right|bottom|left)`. Ненулевые значения появляются только при `viewport-fit=cover`.
- **Телефон / планшет / десктоп**: ширина <640 px / 640–1023 px / ≥1024 px (брейкпоинты `sm` и `lg`).

## Детали ошибки (Bug Details)

### Bug Condition

Дефект проявляется в двух независимых группах условий. **A:** выбрана светлая тема и отображается экзаменационная или словарная поверхность. Тёмная палитра навязывается правилами `html.light .exam-shell` и жёсткими hex-фонами, а словарные окна получают тёмный фон вместе с тёмным текстом светлой темы. **B:** узкий или невысокий вьюпорт либо особенности мобильного устройства (вырез, PWA, клавиатура, старый iOS), для которых вёрстка не рассчитана.

**Формальная спецификация:**
```
TYPE UiInput = {
  theme: "dark" | "light",
  surface: Surface,            // экран или компонент, см. Глоссарий
  mode: "practice" | "mock" | null,
  viewport: { w: px, h: px },  // видимая область (для клавиатуры — visualViewport)
  device: { touch, safeAreaInsets: boolean, standalonePwa, keyboardOpen, iosSafariMajor },
  contentHeight: px,           // для модальных окон
  contacts: int                // для /messages
}

FUNCTION isBugCondition(X)
  INPUT: X of type UiInput
  OUTPUT: boolean

  // A. Светлая тема
  A1 := X.theme = "light" AND X.surface IN ExamSurfaces            // 1.1–1.4
  A2 := X.theme = "light" AND X.surface IN DictionarySurfaces      // 1.5

  // B. Мобильный интерфейс
  B1  := X.surface IN {Reading, Writing, PlacementWriting} AND X.viewport.w < 1024   // 1.6
  B2  := X.surface IN {Reading, Listening} AND X.mode = "practice"
         AND X.viewport.w < 640                                    // 1.7
  B3  := X.surface IN ExamSurfaces AND X.device.touch AND X.viewport.w < 640        // 1.8
  B4  := X.device.safeAreaInsets
         AND (X.viewport.w < 1024 OR X.surface IN ExamSurfaces)    // 1.9
  B5  := X.surface = MessagesPage AND X.viewport.w < 768 AND X.contacts >= 1        // 1.10
  B6  := X.surface IN Modals AND X.contentHeight > X.viewport.h    // 1.11
  B7  := X.surface = CommandPalette AND X.viewport.w < 640
         AND (X.device.keyboardOpen OR X.viewport.h < 96 + 49 + 320)                // 1.12
  B8  := X.surface IN {Toaster, LiveNotifications} AND X.viewport.w < 1024          // 1.13
  B9  := X.theme = "light" AND (mobile browser OR X.device.standalonePwa)           // 1.14
  B10 := X.device.iosSafariMajor < 16 AND pageHasElementWiderThan(X.viewport.w)     // 1.15
  B11 := X.surface IN {StudentCalendar, TeacherCalendar} AND X.viewport.w < 640     // 1.16

  RETURN A1 OR A2 OR B1 OR ... OR B11
END FUNCTION
```

`Modals` = {`OnboardingWizard`, `OnboardingTour`, `BrainBreak`, `LevelUpCelebration`, `DashboardPreferences`, `ExamShell.ReviewDialog`}. Пункты 1.17 (охват e2e) и 1.18 (продакшн) относятся к процессу: они закрываются разделами «Проверка и выпуск» и «Стратегия тестирования».

### Примеры

- **Светлая тема, Reading, 1440×900.** У корня `.exam-shell` фон `rgb(4 11 9)`, у шапки `rgb(7 19 15 / .95)`, текст passage светлый. Ожидается: фон `#f5f7fa`, шапка `#ffffff`, основной текст `#0f172a` (контраст ≈17:1), у `<html>` по-прежнему класс `light`.
- **Светлая тема, `/article`, двойной клик по слову.** Кнопка «Look up» получает фон `#0b1a16/95`, а `text-gray-100` в светлой теме равен `#1e293b`. Контраст ≈1.3:1, текст не читается. Ожидается белая поверхность и контраст ≥4.5:1.
- **Светлая тема, выделение в passage.** `<mark>` имеет `bg-amber-300/25` (в светлой теме это персиковый тон) и `text-amber-50` (`#fffbeb`, у этого оттенка нет токена), то есть белый текст на светлом фоне. Ожидается тёмный текст выделения.
- **Планшет 768×1024, Reading, вкладка Passage.** Панель шириной 384 px (`flex-basis: 50%` из инлайн-стиля перебивает `w-full`), справа пустая полоса 384 px. Ожидается ширина 768 px.
- **Граничный случай.** На десктопе разделитель сдвинут на 30%, затем окно сужено до 900 px. Видимая панель должна занимать 100%, а не 30%.
- **Телефон 390×844, практика Reading.** Кнопки выхода и размера текста нет (`hidden sm:inline-flex`, `hidden sm:flex`), номера вопросов высотой 32 px. Ожидается кнопка выхода 44×44, кнопка «Aa» 44×44 и номера высотой ≥40 px.
- **Граничный случай: Mock Reading на телефоне.** Кнопка выхода не должна появиться, потому что `exitHref` не передаётся.
- **iPhone, PWA с `black-translucent`.** `env(safe-area-inset-top)` равен 0 (нет `viewport-fit=cover`), и шапка экзамена оказывается под статус-баром.
- **Учитель, 375×667, `/messages`.** Сначала идёт список контактов (до 60vh), под ним переписка высотой 60vh. Поле ввода ниже первого экрана.
- **375×667, мастер онбординга.** Панель выше экрана, кнопки «Next»/«Finish» недоступны.
- **Светлая тема, Chrome Android.** Адресная строка остаётся `#04070d`.
- **Календарь, 390 px.** «HW due» набрано шрифтом 9 px и обрезано, полный список виден только в `title` при наведении.

## Ожидаемое поведение (Expected Behavior)

### Требования к сохранению поведения

**Неизменное поведение:**
- Тёмная тема на всех экранах, включая экзамены и экраны загрузки: те же вычисленные цвета фонов, текста, рамок, теней, неоновых акцентов, полос прокрутки и контура фокуса (3.1, 3.2).
- Светлая тема на неэкзаменационных страницах остаётся прежней. Исключения: словарные окна, `theme-color`, положение toast на телефоне и ограничение высоты модальных окон на телефоне (3.3).
- Механизм темы: `localStorage.averna_theme`, `THEME_SCRIPT` до первой отрисовки, тёмная тема по умолчанию (3.4).
- ≥1024 px: панели рядом, разделитель 28–72%, регулятор размера текста в шапке и все десктопные макеты сохраняют прежние размеры и позиции (3.5).
- Логика экзаменов: таймер и объявления на 10, 5 и 1 минуте, ответы, флажки, переход из навигатора, `ReviewDialog`, автоотправка и повтор отправки (3.6). Правила аудио в Listening (3.7). Запись и загрузка в Speaking, подсчёт слов и отправка в Writing (3.8). Mock без кнопки выхода (3.9).
- Мобильная навигация: верхняя панель, выдвижное меню (закрытие, Escape, блокировка прокрутки), нижняя панель из 5 вкладок по ролям (3.10). Адаптированные таблицы и карточки (3.11). Поля ввода 16 px на телефоне (3.12).
- Словарь: перевод, определение, «My words», без «Review» внутри теста (3.13).
- Язык: админка на узбекском, ученик и учитель на английском (3.14). Печатный вид (3.15). `data-gfx="lite"` (3.16).
- Деплой: `npm run vercel-build`, `prisma/sql/deploy.sql` не меняется, cron в `vercel.json` без изменений, схема БД без изменений (3.17). Уже охваченные страницы e2e продолжают проходить проверку (3.18).

**Область действия:**
Все входы, где `isBugCondition` ложно, не должны почувствовать исправление. Это:
- любой экран в тёмной теме на ≥1024 px (полная идентичность);
- любой экран в тёмной теме на <1024 px, кроме перечисленных мобильных дефектов B1–B11 (цвета идентичны, меняется только вёрстка исправляемых элементов);
- неэкзаменационные страницы в светлой теме на ≥1024 px;
- все взаимодействия мышью, клавиатурой и касанием, не связанные с исправляемыми элементами.

## Предполагаемая первопричина (Hypothesized Root Cause)

Пункты 1–7, 9–11, 13, 15 и 16 подтверждены чтением кода. Пункты 8, 12 и 14 требуют проверки на устройстве или в эмуляции.

1. **Принудительная тёмная палитра для `.exam-shell`.**
   - `scripts/theme-tokens.mjs` пишет тёмные значения в `:root, html.light .exam-shell` (`app/globals.css`, около строки 55), поэтому все токенизированные утилиты (`text-white`, `bg-white/5`, `text-gray-*`) внутри экзамена тёмные.
   - Блок `app/globals.css` около строк 1153–1238 возвращает для `html.light .exam-shell` тёмные shadcn-токены (`--background` …), `.av-panel`, `.glass*`, `.skeleton`, `.neon-text*`, цвет полей ввода, `option`, полосы прокрутки и `:focus-visible`.
   - README (около строки 83) и комментарий в `theme-tokens.mjs` закрепляют правило «экзамены всегда тёмные».
2. **Жёсткие hex-фоны вне системы токенов.** `bg-[#040b09]`, `bg-[#07130f]`, `bg-[#06110d]`, `bg-[#0b1a16]`, `from-[#0e261e] to-[#06120e]`, `bg-black/25|30` в полях ввода. Даже без блока из пункта 1 экраны остались бы тёмными.
3. **Словарные окна в портале.** `WordPopover` рендерится в `body` вне `.exam-shell`, поэтому сброс токенов на него никогда не действовал. Фон `#0b1a16` жёсткий, а текст берёт светлые токены (тёмный текст), отсюда нечитаемость на `/article`, на страницах результатов и внутри теста. Кнопка «Look up» и панель выделения имеют тот же жёсткий фон.
4. **Нетокенизированный оттенок в выделениях.** `text-amber-50` в `<mark>` (`passage-pane.tsx`) не входит в `theme-tokens.json` и остаётся `#fffbeb` в светлой теме.
5. **Экраны загрузки.** Четыре `loading.tsx` жёстко задают `bg-[#040b09]`, отсюда тёмная вспышка перед тестом.
6. **`flex-basis` действует на всех ширинах.** `exam-shell.tsx:375/396` задаёт `style={{ flexBasis: \`${split}%\` }}` безусловно. У flex-элемента `flex-basis` перебивает `width` (`w-full`), и ниже `lg` видимая панель получает `split`%.
7. **Элементы шапки скрыты на телефоне.** Ссылка выхода `hidden sm:inline-flex` и группа размера текста `hidden sm:flex` (`exam-shell.tsx:302–340`). Номера вопросов `h-8`, «пред./след.» `h-10 w-10` (40 px).
8. **Нет `viewport-fit=cover`.** Экспорт `viewport` в `app/layout.tsx` не содержит `viewportFit`, поэтому все существующие `env(safe-area-inset-*)` в `app-sidebar.tsx` и `mobile-nav.tsx` дают 0, а при `statusBarStyle: "black-translucent"` контент в PWA уходит под статус-бар. Экзаменационные экраны безопасные зоны не учитывают вообще. Эффект на iOS нужно подтвердить на устройстве или в симуляторе.
9. **`theme-color` статичен.** `viewport.themeColor = "#04070d"` генерируется на сервере, и ни `THEME_SCRIPT`, ни `ThemeProvider` его не обновляют.
10. **`/messages` без мобильного режима.** `grid-cols-1 md:grid-cols-3`: ниже 768 px контакты (`max-h-[60vh]`) и переписка (`h-[60vh]`) стоят друг под другом.
11. **Модальные окна без ограничения высоты.** Панели `onboarding-wizard`, `onboarding-tour`, `brain-break`, `level-up-celebration`, `dashboard-preferences` и `ReviewDialog` не имеют `max-height` и `overflow-y`. Оверлей `items-center` обрезает содержимое сверху и снизу.
12. **Командная палитра и клавиатура.** `fixed inset-0` привязан к layout viewport, который iOS не уменьшает при открытой клавиатуре. `pt-24` (96 px), строка ввода (около 49 px) и `max-h-80` (320 px) дают около 465 px. Поведение клавиатуры нужно подтвердить на устройстве.
13. **Toast поверх верхней панели.** `fixed top-4 right-4` в `ui/toast.tsx:92` и `live-notifications.tsx:72` с z-index 100/120 перекрывают `app-topbar` (z-40, высота 3.5rem плюс inset).
14. **`overflow-x: clip` без запасного варианта.** Safari поддерживает `clip` с версии 16. В iOS 15 объявление отбрасывается целиком, и защиты нет. Поведение резервного варианта на iOS 15 нужно проверить вручную.
15. **Календарь.** Подписи `text-[9px] truncate`, полные названия только в `title`: на сенсорных экранах их не увидеть.
16. **Охват e2e.** `PAGES` в `e2e/screens.mjs` содержит 3 страницы учителя, 2 страницы администратора и ни одного экзамена.

## Correctness Properties

Property 1: Bug Condition - Светлая тема на экзаменах и корректный мобильный интерфейс

_For any_ входа `X`, где `isBugCondition(X)` истинно, исправленный код F' SHALL давать результат, для которого `expectedBehavior` истинно:
- A1/A2: корень экзаменационной поверхности, её шапка, панели, навигатор, поля ввода, выделения и словарные окна имеют светлый фон (относительная яркость ≥0.8), основной текст с контрастом ≥4.5:1, у `<html>` остаётся класс `light`, экран загрузки светлый с первого кадра;
- B1: видимая панель занимает 100% ширины тела экзамена (±1 px) после смены вкладки и перехода из навигатора;
- B2/B3: в режиме практики видны кнопка выхода и «Aa» размером ≥44×44, «пред./след.» ≥44×44, номера вопросов высотой ≥40 px, шапка помещается в 320 px без наложений, а таймер и кнопка завершения не обрезаны;
- B4: `viewport` содержит `viewport-fit=cover`, шапка, навигатор, нижняя панель, верхняя панель и меню отступают на `env(safe-area-inset-*)`;
- B5: переписка и поле ввода видны в первом экране, возврат к списку контактов доступен;
- B6: панель модального окна не выше видимой области и прокручивается внутри;
- B7: поле поиска и список результатов умещаются в `visualViewport`;
- B8: toast начинается ниже верхней панели с учётом inset;
- B9: `meta[name=theme-color]` совпадает с текущей темой после загрузки и после каждого переключения;
- B10: у страницы нет горизонтальной прокрутки;
- B11: метки в ячейках ≥11 px или заменены индикаторами, касание дня показывает полный список занятий и заданий.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16**

Property 2: Preservation - Тёмная тема, десктопные макеты и логика без изменений

_For any_ входа `X`, где `isBugCondition(X)` ложно, исправленный код F' SHALL давать тот же результат, что и исходный F: те же вычисленные стили (цвета, размеры, позиции) в тёмной теме на всех экранах и в светлой теме на неэкзаменационных страницах ≥1024 px, та же разметка десктопа (панели рядом, разделитель 28–72%, регулятор размера текста), та же логика экзаменов (таймер и объявления, ответы, флажки, навигатор, `ReviewDialog`, автоотправка, аудиоправила Listening, Speaking и Writing, Mock без выхода), та же мобильная навигация, поля 16 px, словарь, узбекский язык админки, печатный вид, lite-режим, и уже охваченные страницы e2e проходят проверку без ошибок.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.18**

Требования 2.17, 2.18 и 3.17 касаются процесса: их закрывают расширенный e2e, CI и шаги выпуска в разделе «Проверка и выпуск».

## Реализация исправления (Fix Implementation)

### Необходимые изменения

Если анализ первопричин верен, нужно внести следующие изменения.

#### A. Светлая тема на экзаменах

**Файл**: `lib/theme-tokens.json`. Добавить токены (формат `[name, dark, light]`). Тёмные значения совпадают с заменяемыми hex:

| Токен | Заменяет | Тёмное (= сейчас) | Светлое |
|---|---|---|---|
| `exam-bg` | `bg-[#040b09]` | `#040b09` | `#f5f7fa` |
| `exam-bar` | `bg-[#07130f]` | `#07130f` | `#ffffff` |
| `exam-strip` | `bg-[#06110d]` | `#06110d` | `#f1f5f9` |
| `exam-orb-top` | `from-[#0e261e]` | `#0e261e` | `#e3f3ec` |
| `exam-orb-bottom` | `to-[#06120e]` | `#06120e` | `#ffffff` |
| `exam-mark` | `text-amber-50` в `<mark>` | `#fffbeb` | `#0f172a` |
| `surface-raised` | `bg-[#0b1a16]` | `#0b1a16` | `#ffffff` |
| `surface-well` | `bg-black/25`, `bg-black/30` в полях ввода экзаменов | `#000000` | `#ffffff` |

`tailwind.config.ts` не меняется: `tokenColors` сам разбирает `exam-bar` в `colors.exam.bar` (`bg-exam-bar/95`) и `surface-raised` в `colors.surface.raised`. Модификаторы прозрачности дают тот же цвет, что и раньше: `rgb(var(--c-exam-bar) / 0.95)` в тёмной теме равно `rgb(7 19 15 / 0.95)`. Имя `popover` не используется, потому что оно занято shadcn-цветом.

**Файл**: `scripts/theme-tokens.mjs`
1. Селектор тёмных значений меняется с `:root,\nhtml.light .exam-shell` на `:root`. Комментарии в шапке скрипта и в блоке исправить: экзамены следуют теме.
2. Вынести построение блока в экспортируемую чистую функцию `buildThemeBlock({ tokens, keepWhiteInk })`. Запись файла (`--write`) выполнять только при запуске скрипта из CLI, чтобы функцию можно было тестировать.
3. Перегенерировать: `node scripts/theme-tokens.mjs --write`. Ручные правки внутри маркеров THEME TOKENS запрещены.

**Файл**: `app/globals.css`
1. Удалить весь блок «EXAM SCREENS keep their own colours in the light theme» (около строк 1153–1238, все селекторы `html.light .exam-shell …`). После этого внутри экзаменов действуют обычные светлые правила: `:root` для shadcn-токенов, `html.light .av-panel`, `.glass`, `.skeleton`, `input`, `option`, полосы прокрутки, `:focus-visible`.
2. Добавить мягкую тень для плавающих поверхностей в светлой теме. Тёмная тема продолжает использовать текущие утилиты `shadow-[…]`:
   ```css
   /* Floating surfaces (dictionary popover, Look up chip, passage toolbar): softer shadow on light. */
   html.light .av-float { box-shadow: 0 14px 36px -12px rgba(15, 23, 42, 0.22); }
   ```

**Замены классов** (только класс цвета; остальные классы не меняются):
- `components/exam/exam-shell.tsx`: корень `:298` `bg-[#040b09]` → `bg-exam-bg`; шапка `:300` и навигатор `:409` `bg-[#07130f]/95` → `bg-exam-bar/95`; переключатель панелей `:350` и `footerExtra` `:406` `bg-[#07130f]` → `bg-exam-bar`.
- `components/exam/speaking-exam-runner.tsx`: `:443` `from-[#0e261e] to-[#06120e]` → `from-exam-orb-top to-exam-orb-bottom`; `:2607` → `bg-exam-bg`; `:2613` и `:2670` → `bg-exam-bar/95`; `:2647` `bg-[#06110d]/90` → `bg-exam-strip/90`.
- `components/exam/writing-exam-client.tsx`: `:236` → `bg-exam-bg`; `:241` → `bg-exam-bar/95`; `:395` `bg-[#040b09]/95` → `bg-exam-bg/95`; `:406` → `bg-exam-bar`.
- `components/exam/reading-exam-runner.tsx`: `:112` → `bg-exam-bg/95`; `:263` → `bg-exam-bg`.
- `components/placement/grammar-runner.tsx`: `:211` → `bg-exam-bg`; `:245` → `bg-exam-bg/95`.
- `components/placement/placement-orchestrator.tsx:538`, `components/exam/mock-orchestrator.tsx:601` → `bg-exam-bg`.
- `app/learning/{reading/[testId],listening/[testId],writing/exam,speaking-test/[setId]}/loading.tsx` → `bg-exam-bg`. Тёмной вспышки не будет: `THEME_SCRIPT` ставит `html.light` до первой отрисовки.
- `components/exam/question-group.tsx`: `:115` `bg-black/30` → `bg-surface-well/30`; `:151` `bg-[#0b1a16]` → `bg-surface-raised`.
- `components/exam/writing-exam-runner.tsx:358` `bg-black/25` → `bg-surface-well/25`; `components/placement/writing-runner.tsx:342` `bg-black/30` → `bg-surface-well/30`. `writing-exam-runner.tsx:278` `bg-[#f4f7f5]` (подложка графика задания 1) остаётся: она светлая в обеих темах намеренно.
- `components/exam/passage-pane.tsx`: `:298` `text-amber-50` → `text-exam-mark`; `:769` `bg-[#0b1a16]/95` → `bg-surface-raised/95` плюс класс `av-float`.
- `components/dictionary/word-popover.tsx:322` `bg-[#0b1a16]/[0.97]` → `bg-surface-raised/[0.97]` плюс `av-float`; `components/dictionary/lookup-area.tsx:247` `bg-[#0b1a16]/95` → `bg-surface-raised/95` плюс `av-float`.
- Класс `exam-shell` остаётся как семантический маркер для e2e. Стилей на нём больше нет.

**Файл**: `README.md` (около строки 83) — заменить «exam screens (`.exam-shell`) always stay dark» на описание: экраны экзаменов следуют выбранной теме, их поверхности используют токены `exam-*` и `surface-*`.

#### B. Мобильный интерфейс

**Файл**: `components/exam/exam-shell.tsx`, компонент `ExamShell`:
1. **Ширина панели (B1).** Перенести ширину панелей в CSS-переменные на теле: `style={{ fontSize, "--exam-left": \`${split}%\`, "--exam-right": \`${100 - split}%\` }}`. Инлайн `flexBasis` на панелях убрать и добавить классы `lg:basis-[var(--exam-left)]` и `lg:basis-[var(--exam-right)]`. Ниже `lg` действует `flex-basis: auto` плюс `w-full`, то есть 100%. На `lg` те же `split`% и `100−split`%, что и сейчас. У панелей `overflow-y-auto`, поэтому их `min-width: auto` равен 0, и `w-full` на десктопе ни на что не влияет, как и сегодня.
2. **Выход (B2).** Ссылка всегда видима, когда передан `exitHref`: `inline-flex h-11 w-11 items-center justify-center sm:h-auto sm:w-auto sm:px-2 sm:py-1.5`. На sm+ размеры прежние. В Mock `exitHref` не передаётся, поэтому кнопки нет.
3. **Размер текста на телефоне (B2).** Новый внутренний компонент `MobileTextSize` (`sm:hidden`): кнопка «Aa» 44×44 с `aria-label="Text size"`, `aria-expanded` и `aria-controls` открывает небольшую панель под шапкой с кнопками «Smaller text» и «Larger text» (44×44 каждая, те же шаги `FONT_STEPS`, отключаются на границах) и процентом в `aria-live="polite"`. Панель закрывается по Escape, касанию вне неё и повторному нажатию «Aa». Шапка получает `relative z-20`, чтобы панель была поверх тела экзамена. Существующая группа `hidden sm:flex` не меняется.
4. **Помещение в 320 px.** Только на базовом (телефонном) уровне: шапка `gap-1.5 px-2` вместо `gap-2 px-3`, у `TimerPill` `px-2 sm:px-3`, у кнопки завершения `px-3 sm:px-4`. Классы `sm:gap-3 sm:px-5` и десктопные значения остаются. Заголовок `min-w-0 flex-1 truncate` сжимается первым. Расчёт для 320 px: 44 + 44 + ~80 (таймер) + ~102 (кнопка) + 4 промежутка × 6 + 16 = ~310 px.
5. **Области касания (B3).** «Пред./след.»: `h-11 w-11 sm:h-10 sm:w-10`; номера вопросов: `h-10 min-w-[2.5rem] sm:h-8 sm:min-w-[2rem]`. Горизонтальная прокрутка навигатора (`overflow-x-auto no-scrollbar`) сохраняется.
6. **Безопасные зоны (B4).** Шапка: `pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2` вместо `py-2`; навигатор: `pb-[calc(0.5rem+env(safe-area-inset-bottom))]`; корень: `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`. На десктопе `env()` равен 0, значения совпадают с текущими.
7. **`ReviewDialog` (B4/B6).** Оверлей `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`, панель получает класс `av-modal-panel` (см. ниже).

**Файлы**: `speaking-exam-runner.tsx`, `writing-exam-client.tsx` (`Frame`, оверлей проверки), `reading-exam-runner.tsx` (`EmptyTest`), четыре `loading.tsx`. Те же отступы безопасной зоны: верхний на шапке или корне, нижний на последнем элементе (`footer` Speaking или область прокрутки, когда футера нет), боковые на корне.

**Файл**: `app/layout.tsx`
1. `viewport`: добавить `viewportFit: "cover"`, убрать `themeColor`.
2. В `<head>` перед `THEME_SCRIPT` вывести `<meta name="theme-color" content={THEME_COLORS.dark} suppressHydrationWarning />`. Тег оказывается в документе раньше скрипта, поэтому скрипт может синхронно поменять его `content`.

**Файл**: `components/theme/theme-script.ts`. Экспортировать `THEME_COLORS = { dark: "#04070d", light: "#ffffff" }` (цвет верхней панели в каждой теме). `THEME_SCRIPT` при светлой теме дополнительно ставит `content` у `meta[name="theme-color"]`.

**Файл**: `components/theme/theme-provider.tsx`. `apply(m)` дополнительно обновляет `meta[name="theme-color"]` значением `THEME_COLORS[m]` (B9). Хранение, классы и значение по умолчанию не меняются (3.4).

**Файлы**: `components/layout/app-sidebar.tsx`, `components/dashboard/mobile-nav.tsx`. Боковые безопасные зоны для альбомной ориентации: верхняя и нижняя панели получают `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`, выдвижное меню получает `pl-[env(safe-area-inset-left)]`, обёртка контента `AppShell` получает те же боковые отступы ниже `lg` (`lg:pl-64 lg:pr-0` без изменений). Верхние и нижние inset там уже есть: они заработают после `viewportFit: "cover"`.

**Ограничение (фиксируем, не меняем):** `statusBarStyle: "black-translucent"` остаётся, потому что он нужен для полноэкранного PWA. iOS задаёт стиль статус-бара при запуске, так что в светлой теме глифы статус-бара будут светлыми. Требованиями это не покрыто, отмечаем как известное ограничение.

**Файл**: `app/messages/page.tsx` (B5)
1. Новая чистая функция `messagesPhoneView(withParam, contactCount): "list" | "thread"` в `lib/messages-view.ts`: `"thread"`, если `withParam` задан или `contactCount <= 1`; иначе `"list"`.
2. Карточка контактов: при `"thread"` получает `hidden md:block`. Карточка переписки: при `"list"` получает `hidden md:flex`. На md+ разметка прежняя.
3. В шапке переписки ссылка `md:hidden` на `/messages` («All contacts», для `ADMIN` — «Barcha kontaktlar» по `.kiro/steering/admin-language.md`), высота ≥44 px. Показывается только при `contacts.length > 1`.
4. Высота переписки на телефоне считается от `100dvh` за вычетом верхней и нижней панелей, шапки страницы, вкладок и inset, с нижней границей `min-h-[18rem]`; `md:h-[60vh]` как сейчас. Точную константу подобрать по e2e-проверке: низ поля ввода ≤ верх нижней панели на 375×667 и 390×844.

**Модальные окна (B6).** Файлы `onboarding-wizard.tsx`, `onboarding-tour.tsx`, `dashboard/brain-break.tsx`, `dashboard/level-up-celebration.tsx`, `dashboard/dashboard-preferences.tsx`, `ReviewDialog`. Панели получают класс `av-modal-panel`, оверлеи — `py-4` (центрирование на высоких экранах не меняется). В `globals.css`:
```css
/* Modals fit short screens (phones, landscape, open keyboard) and scroll inside. */
@media (max-width: 1023px), (max-height: 700px) {
  .av-modal-panel {
    max-height: calc(100vh - 2rem);
    max-height: calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}
```
Медиазапрос не включает правило на обычном десктопе, поэтому там не появляется `overflow`, который мог бы обрезать свечение детей (например, `neon-button:hover` в `level-up-celebration`). У нижних листов (`dashboard-preferences`, `ReviewDialog` на телефоне) нижний отступ учитывает `env(safe-area-inset-bottom)`.

**Файл**: `components/command-palette.tsx` (B7)
1. Новый хук `useVisualViewport()`: `{ height, offsetTop }` из `window.visualViewport`, подписка на `resize` и `scroll`. Без поддержки возвращает `null`.
2. Оверлей: `style={{ top: vv.offsetTop, height: vv.height, bottom: "auto" }}` (без хука остаётся `inset-0`); `pt-24` → `pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-24`; добавить `pb-3`.
3. Панель: `flex max-h-full flex-col`; список: `max-h-80 min-h-0 shrink overflow-y-auto`. На десктопе высота вьюпорта больше 96 + 49 + 320 px, так что список остаётся 320 px, как сейчас. Тексты палитры для админки не меняются.

**Файлы**: `components/ui/toast.tsx:92`, `components/live-notifications.tsx:72` (B8). `top-4` → `top-[calc(4.5rem+env(safe-area-inset-top))] lg:top-4`; справа `right-[max(1rem,env(safe-area-inset-right))]`. На lg положение прежнее.

**Файл**: `app/globals.css` (B10). После `html, body { overflow-x: clip; }` добавить:
```css
/* Safari < 16 has no overflow: clip. Only body, so its value moves to the viewport and sticky bars keep working. */
@supports not (overflow-x: clip) { body { overflow-x: hidden; } }
```
Если ручная проверка на iOS 15 покажет, что этого мало, запасной вариант — `html, body { overflow-x: hidden }` внутри того же `@supports`. Цена этого варианта: sticky-панели на iOS <16 перестанут прилипать. Решение фиксируем в задаче.

**Календари** `app/calendar/page.tsx` и `app/teacher/calendar/page.tsx` (B11)
1. Чистый хелпер `lib/calendar-days.ts`: `buildDayItems(...)` возвращает для каждого дня список `{ kind: "lesson" | "tutoring" | "homework", label }`, `parseSelectedDay(d, daysInMonth, todayDay)` ограничивает выбранный день диапазоном (по умолчанию сегодня, если это текущий месяц, иначе 1).
2. Новый серверный компонент `components/calendar/phone-month.tsx` (`sm:hidden`). Ячейки — `Link` на `?m=YYYY-M&d=D` (`scroll={false}`, `aria-current="date"` у выбранной, минимум 44 px, номер дня `text-sm`), в ячейках цветные точки-индикаторы тех же цветов, что в легенде. Под сеткой панель выбранного дня с полными названиями (`text-sm`) и пустым состоянием «Nothing scheduled».
3. Существующая сетка получает `hidden sm:grid` и на sm+ не меняется. Тексты английские, потому что это экраны ученика и учителя.

#### C. Проверка и выпуск

**Файл**: `e2e/screens.mjs` (2.17)
1. `PAGES`: ученик добавляет `/messages`, `/calendar`, `/learning/reading`, `/learning/listening`; учитель — `/teacher/calendar`, `/teacher/homework`, `/teacher/gradebook`, `/teacher/attendance`, `/messages`; администратор — `/admin/groups`, `/admin/finance`, `/admin/analytics`, `/admin/teachers`, `/admin/content`, `/messages`.
2. Экзамены: открыть список `/learning/reading` (и `/learning/listening`), взять первую ссылку `a[href^="/learning/reading/"]` без `result`, открыть тест в отдельной вкладке. Снять скриншоты вкладок Passage и Questions на телефоне и десктопе в обеих темах. Закрывать вкладку через `page.close()`: `beforeunload` там не выполняется, и `useLeaveGuard` не блокирует навигацию. Отфильтровать ожидаемый шум автозапуска аудио (`NotAllowedError`).
3. Проверки остаются прежними: ошибки страницы и консоли, «невидимый» контент, ширина больше экрана. Уже охваченные страницы и редиректы не меняются (3.18).

**Тестовая инфраструктура.** Unit-тестов в проекте нет. Добавить в `devDependencies` с точными версиями (без `^`/`~`, совместимыми с Node 20 и React 18): `vitest`, `fast-check`, `jsdom`, `@testing-library/react`, `@testing-library/dom`. Также добавить скрипт `"test": "vitest run"` и `vitest.config.ts` (`environment: "jsdom"`, алиас `@`, `esbuild.jsx: "automatic"`, потому что в `tsconfig` стоит `jsx: preserve`). Тесты лежат в `tests/` и проверяются `tsc`. В `ci.yml` добавить задание `npm test`; `vercel-build` не меняется.

**Выпуск (2.18, 3.17)**
1. Локально: `node scripts/theme-tokens.mjs --write` (без diff после повторного запуска), `npx tsc --noEmit`, `npx next lint --max-warnings=0`, `npm test`, `npm run build`.
2. Коммит в новую ветку (не `main`) с `[screens]` в сообщении, чтобы CI запустил `screens.yml` на засеянной БД. Проверить preview-деплой Vercel.
3. Продакшн (`main` или `vercel --prod`, как настроено в проекте) — только после явного подтверждения пользователя. После выпуска вручную пройти контрольный список на продакшн-адресе: светлая тема в Reading, Listening, Writing и Speaking, словарь на `/article`, 390/768 px, PWA на iPhone.

## Стратегия тестирования (Testing Strategy)

### Подход к проверке

Проверка идёт в два этапа. Сначала на неисправленном коде F находим контрпримеры, которые подтверждают или опровергают первопричины. Затем на F' проверяем исправление (Property 1) и сохранение поведения (Property 2). Базовые снимки для сравнения снимаются на F до любых правок.

### Исследовательская проверка условия ошибки

**Цель**: получить контрпримеры до исправления. Если контрпример не воспроизводится, первопричину нужно пересмотреть.

**План**: скрипт `e2e/bugfix-checks.mjs` (Playwright, запуск как у `screens.mjs`, `BASE_URL`) собирает нарушения в `report.json`. На F ожидаются провалы.

**Тестовые случаи**:
1. **Светлый Reading/Listening**: яркость фона `.exam-shell`, `header` и `nav`, контраст текста. На F упадёт: ожидается `rgb(4 11 9)`.
2. **Словарь в светлой теме** на `/article`: двойной клик по слову, контраст «Look up» и `[data-dictionary-popover]`. На F упадёт: около 1.3:1.
3. **Ширина панели** при 768 и 900 px, в том числе после `split=30` (перетащить на 1440 px, затем сузить окно). На F упадёт: 50% или 30%.
4. **Шапка на телефоне** (390 и 320 px, практика): есть выход и «Aa», размеры ≥44, нет наложения таймера и кнопки. На F упадёт.
5. **`viewport` и `theme-color`**: `meta[name=viewport]` содержит `viewport-fit=cover`; после установки светлой темы `theme-color` равен `#ffffff`. На F упадёт.
6. **`/messages`** (учитель, несколько контактов, 375×667): низ поля ввода в пределах экрана без прокрутки. На F упадёт.
7. **Модальные окна** на 375×667: открыть настройки дашборда и мастер онбординга (очистить флаг в `localStorage`); высота панели ≤ вьюпорта и `overflow-y` не `visible`. На F упадёт.
8. **Палитра** при 390×400 (приближение `visualViewport` с клавиатурой): низ списка ≤ высоты вьюпорта. На F может упасть; реальную клавиатуру проверяем вручную на устройстве.
9. **Календарь** на 390 px: вычисленный `font-size` меток ≥11 px, касание дня показывает названия. На F упадёт.

**Ожидаемые контрпримеры**: тёмные фоны внутри `.exam-shell` при `html.light`; `flex-basis: 50%` на видимой панели; `display: none` у выхода и размера текста; нулевые inset; статичный `theme-color`. Возможные причины перечислены в разделе «Предполагаемая первопричина». Сценарии iOS <16 и безопасных зон Playwright не эмулирует (у него современный WebKit), поэтому они в ручном списке.

### Проверка исправления

**Цель**: для всех входов с истинным C исправленный код удовлетворяет P.

**Псевдокод:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := render_F'(X)
  ASSERT expectedBehavior(result)   // Property 1, по подусловиям A1–B11
END FOR
```
Случаи 1–9 выше должны пройти на F'. Для B1–B3 ширина вьюпорта генерируется fast-check (`fc.sample`) внутри Playwright-скрипта.

### Проверка сохранения поведения

**Цель**: для всех входов с ложным C исправленный код ведёт себя как исходный.

**Псевдокод:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT render_F(X) = render_F'(X)
END FOR
```

**Подход**: для проверки сохранения рекомендуется тестирование на основе свойств, потому что оно:
- генерирует много случаев по всей области входов;
- находит граничные случаи, которые пропускают ручные тесты;
- даёт сильную гарантию неизменности для входов без условия ошибки.

**План**: на F снять «снимок стилей» — для каждого элемента путь в DOM и `getComputedStyle` (цвета фона, текста, рамки, `box-shadow`, `outline-color`, размеры и позиция). Часы замораживаются через `page.clock` (Playwright 1.48), чтобы таймер был детерминирован. На F' сравнить снимки:
- тёмная тема, 1440×900: полная идентичность;
- тёмная тема, 390×844: идентичность цветовых свойств у всех элементов, которые есть в обоих снимках; различия в размерах допускаются только внутри исправляемых компонентов;
- светлая тема, неэкзаменационные страницы, 1440×900: полная идентичность вне словарных окон.

**Тестовые случаи**:
1. **Тёмные экзамены**: Reading, Listening, Writing, Speaking и экраны загрузки идентичны базовым снимкам.
2. **Десктоп**: разделитель 28–72%, регулятор размера текста и панели рядом дают те же размеры при случайных `split`.
3. **Логика экзамена**: ответить, поставить флажок, перейти из навигатора, открыть `ReviewDialog` (счётчики), а в Mock убедиться, что кнопки выхода нет. Результаты совпадают на F и F'.
4. **Мобильная навигация и язык**: меню (Escape, смена страницы), 5 вкладок по ролям, узбекские подписи админки, `font-size: 16px` у полей на телефоне.

### Модульные тесты (Vitest)

- `buildThemeBlock`: в выводе нет `.exam-shell`, каждый токен есть в `:root` (тёмное значение) и `html.light` (светлое), правило `keepWhiteInk` сохранено; повторная генерация без diff.
- `ExamShell` (jsdom + RTL): у панелей нет инлайн `flex-basis`, есть `--exam-left` и `--exam-right`; ссылка выхода есть при `exitHref` и отсутствует без него; `MobileTextSize` открывается, вызывает `onFontScale` со значениями `FONT_STEPS`, отключается на границах и закрывается по Escape; у `ReviewDialog` есть `av-modal-panel`.
- `THEME_SCRIPT` и `ThemeProvider`: `meta[name=theme-color]` и классы `<html>` после загрузки и переключения; `localStorage.averna_theme`.
- `messagesPhoneView`, `parseSelectedDay` и `buildDayItems`: граничные значения (0 или 1 контакт, неверный `with`, `d` вне месяца, пустой день).
- Статическая проверка: в `components/exam/**`, `components/placement/**`, `components/dictionary/**` и экзаменационных `loading.tsx` нет `bg-[#0…]`, `from-[#0…]`, `to-[#0…]` и `bg-black/…` в полях; допустим только `bg-[#f4f7f5]`. В `globals.css` нет `html.light .exam-shell`, но есть `@supports not (overflow-x: clip)`.

### Тесты на основе свойств (fast-check)

- **Эквивалентность токенов (Property 2)**: для любой пары «старый класс → новый класс» из таблицы замен и любой прозрачности α ∈ [0, 1] CSS, скомпилированный Tailwind (PostCSS + `tailwind.config.ts`, контент `raw`), после подстановки тёмных значений `--c-*` даёт тот же цвет, что и старый класс. Для всех токенов, которые существовали до исправления, тёмные и светлые значения совпадают со снимком, сделанным на F.
- **Светлые значения (Property 1)**: для любого нового токена светлое значение имеет яркость ≥0.8 (фоны) или контраст ≥4.5:1 с `#ffffff` и `#f5f7fa` (`exam-mark`); основной текст (`white`, `gray-100`) на любом светлом фоне экзамена даёт контраст ≥4.5:1.
- **Тема (Property 1/2)**: для любой последовательности переключений `dark`/`light` класс `<html>`, `theme-color` и `localStorage` согласованы с последним выбором.
- **Сообщения**: для любых `withParam ∈ {undefined, id контакта, чужой id}` и `contacts ∈ [0, 60]` `messagesPhoneView` соответствует правилу, а разметка md+ содержит обе карточки.
- **Календарь**: для любого месяца и года, случайного расписания групп и набора заданий панель дня `d` содержит ровно все занятия и задания этого дня, а `parseSelectedDay` всегда возвращает значение в диапазоне [1, daysInMonth].
- **Вёрстка (Playwright + `fc.sample`)**: для ширины 320–1023 px ширина видимой панели равна ширине тела ±1 px (Property 1); для ширины 1024–1920 px и `split` ∈ [28, 72] левая панель равна `split`% ± 1 px, как на F (Property 2); для ширины 320–639 px элементы шапки не пересекаются, находятся в пределах экрана и имеют размер ≥44 px.

### Интеграционные тесты

- Расширенный `e2e/screens.mjs` в CI (`screens.yml`, `[screens]`): основные страницы трёх панелей, Reading и Listening на телефоне и десктопе в обеих темах, без ошибок страниц и консоли и без горизонтального переполнения (2.17, 3.18).
- `e2e/bugfix-checks.mjs`: сквозные сценарии экзамена на телефоне — переключение вкладок Passage/Questions, переход из навигатора, «Aa» и шрифт, `ReviewDialog` в виде нижнего листа, выход в практике; переключение темы прямо во время теста (цвета меняются без перезагрузки, логика не прерывается).
- Ручной контрольный список на устройствах (Playwright его не покрывает): iPhone с вырезом в Safari и как PWA (безопасные зоны в портретной и альбомной ориентации), клавиатура с командной палитрой, iOS 15 без горизонтальной прокрутки, адресная строка Chrome Android в обеих темах. Затем та же проверка на продакшн-адресе после подтверждённого деплоя.
