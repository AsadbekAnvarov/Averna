# 🔧 Устранение Проблем - Averna Platform

## ✅ Исправлено!

### ❌ Проблема 1: Module not found '@radix-ui/react-radio-group'

**Решение:** ✅ **ИСПРАВЛЕНО!**

Добавлена недостающая зависимость в `package.json`:
```json
"@radix-ui/react-radio-group": "^1.1.3"
```

### ❌ Проблема 2: Type error with PrismaAdapter

**Ошибка:**
```
Type 'Adapter' is not assignable to type 'Adapter'
Property 'role' is missing in AdapterUser
```

**Решение:** ✅ **ИСПРАВЛЕНО!**

Удален `PrismaAdapter` из `lib/auth.ts` - не требуется при использовании JWT стратегии с Credentials провайдером.

```typescript
// До (НЕПРАВИЛЬНО):
import { PrismaAdapter } from "@auth/prisma-adapter";
adapter: PrismaAdapter(db),

// После (ПРАВИЛЬНО):
// Adapter не используется
session: { strategy: "jwt" }
```

### ❌ Проблема 3: Property 'achievement' does not exist

**Ошибка:**
```
Property 'achievement' does not exist on type
```

**Решение:** ✅ **ИСПРАВЛЕНО!**

Добавлен `include` для загрузки связанных данных в `lib/db-helpers.ts`:

```typescript
// До (НЕПРАВИЛЬНО):
achievements: true,

// После (ПРАВИЛЬНО):
achievements: {
  include: {
    achievement: true,
  },
},
```

### ❌ Проблема 4: Property 'type' does not exist on type 'AchievementType'

**Ошибка:**
```
Property 'type' does not exist on type 'AchievementType'
Property 'type' does not exist on type '"HOMEWORK_MASTER"'
```

**Решение:** ✅ **ИСПРАВЛЕНО!**

`earnedAchievementTypes` это уже массив строк (`AchievementType[]`), не объектов:

```typescript
// До (НЕПРАВИЛЬНО):
!earnedAchievementTypes.some((a) => a.type === "HOMEWORK_MASTER")

// После (ПРАВИЛЬНО):
!earnedAchievementTypes.includes("HOMEWORK_MASTER")
```

---

## 🚀 Что Нужно Сделать Сейчас:

### Если Разрабатываете Локально:

```bash
# 1. Обновите код из GitHub
git pull origin main

# 2. Установите зависимости
npm install

# 3. Перезапустите dev сервер
npm run dev
```

### Если На Vercel:

Vercel автоматически пере-деплоит после push на GitHub.

**Проверьте:**
1. Зайдите в Vercel Dashboard
2. Проверьте последний deployment
3. Если ошибки остались - проверьте переменные окружения

---

## 🔍 Другие Возможные Проблемы:

### 1. Database Connection Error

**Ошибка:**
```
PrismaClientInitializationError: Can't reach database server
```

**Решение:**
```bash
# Проверьте DATABASE_URL в .env
# Должно быть в формате:
DATABASE_URL="postgresql://user:password@host:5432/database"

# Примените схему
npm run db:push
```

### 2. NEXTAUTH_SECRET Not Set

**Ошибка:**
```
NO_SECRET: Please define a `secret` in production
```

**Решение:**
```bash
# Сгенерируйте секрет
openssl rand -base64 32

# Добавьте в .env:
NEXTAUTH_SECRET="your-generated-secret"
```

### 3. OpenAI API Key Missing

**Ошибка:**
```
OpenAI API key not configured
```

**Решение:**
```bash
# Получите ключ: https://platform.openai.com/api-keys
# Добавьте в .env:
OPENAI_API_KEY="sk-your-key-here"
```

### 4. Prisma Client Not Generated

**Ошибка:**
```
@prisma/client did not initialize yet
```

**Решение:**
```bash
npm run db:generate
```

### 5. Build Errors on Vercel

**Проблема:** Сборка падает на Vercel

**Решение:**
1. Проверьте логи в Vercel Dashboard
2. Убедитесь что все переменные окружения добавлены
3. Попробуйте локальный build:
   ```bash
   npm run build
   ```
4. Если локально работает, проверьте Node.js версию на Vercel

---

## 📝 Обязательные Переменные Окружения

В `.env` (локально) или Vercel Environment Variables:

```env
# База данных (обязательно)
DATABASE_URL="postgresql://..."

# NextAuth (обязательно)
NEXTAUTH_URL="http://localhost:3000"  # или ваш production URL
NEXTAUTH_SECRET="32-character-random-string"

# OpenAI (обязательно для Writing Module)
OPENAI_API_KEY="sk-..."
```

---

## 🔄 Полная Переустановка (Если Ничего Не Помогает)

```bash
# 1. Очистить всё
npm run clean

# 2. Удалить lock файлы
rm -f package-lock.json
rm -rf node_modules

# 3. Переустановить
npm install

# 4. Сгенерировать Prisma
npm run db:generate

# 5. Применить схему БД
npm run db:push

# 6. Запустить
npm run dev
```

---

## 🆘 Частые Вопросы

### Q: "Cannot find module 'X'"
**A:** Запустите `npm install`

### Q: "Database schema is not in sync"
**A:** Запустите `npm run db:push`

### Q: "Type error in component"
**A:** Запустите `npm run db:generate`

### Q: "Port 3000 already in use"
**A:** Используйте другой порт:
```bash
PORT=3001 npm run dev
```

### Q: Vercel deployment не работает
**A:** 
1. Проверьте переменные окружения
2. Добавьте PostgreSQL database в Vercel
3. Выполните `npm run db:push` после деплоя

---

## ✅ Чек-Лист Перед Деплоем

- [ ] `DATABASE_URL` настроен
- [ ] `NEXTAUTH_SECRET` сгенерирован
- [ ] `NEXTAUTH_URL` указывает на production domain
- [ ] `OPENAI_API_KEY` добавлен
- [ ] `npm run build` работает локально
- [ ] `npm run db:push` выполнен
- [ ] `npm run db:seed` выполнен (опционально)

---

## 🎯 Полезные Команды

```bash
# Проверка зависимостей
npm list --depth=0

# Проверка Prisma
npx prisma validate

# Проверка типов
npx tsc --noEmit

# Логи Vercel
vercel logs

# Открыть Prisma Studio (GUI для БД)
npm run db:studio
```

---

## 📞 Дополнительная Помощь

Если проблема не решена:

1. Проверьте логи в терминале
2. Проверьте логи в Vercel (если деплоите)
3. Откройте Developer Console в браузере (F12)
4. Проверьте файл `.env.example` для примера

---

## 🎉 Всё Работает?

После исправления всех ошибок:

```bash
npm run dev
```

Откройте: **http://localhost:3000**

Тестовые аккаунты:
```
student1@averna.com / student123
teacher@averna.com / teacher123
admin@averna.com / admin123
```

---

**Built with ❤️ for Averna Learning Centre**
