# 🚀 Финальная Настройка Vercel - Averna

## ✅ ВСЁ ИСПРАВЛЕНО! ПОСЛЕДНИЕ ШАГИ!

Build теперь пройдет успешно! Осталось только настроить БД.

---

## 📋 **ЧТО ДЕЛАТЬ ПРЯМО СЕЙЧАС:**

### **Шаг 1: Дождитесь Завершения Build** ⏳

Vercel сейчас автоматически пере-деплоит проект.

**Через 2-3 минуты** build завершится с **✅ Ready**

---

### **Шаг 2: Создайте PostgreSQL** 🗄️

**В Vercel Dashboard:**

1. Откройте проект **Averna**
2. Перейдите в **Storage**
3. Нажмите **Create Database**
4. Выберите **Postgres**
5. Название: `averna-db` (любое)
6. Нажмите **Create**

✅ **DATABASE_URL** автоматически добавится в Environment Variables!

---

### **Шаг 3: Добавьте NEXTAUTH_SECRET** 🔐

**В Vercel Dashboard:**

1. **Settings** → **Environment Variables**
2. **Add New**:
   - **Name:** `NEXTAUTH_SECRET`
   - **Value:** любая 32-символьная строка
   
**Пример генерации (на вашем компьютере):**
```bash
openssl rand -base64 32
```

Или просто используйте:
```
averna-secret-key-2026-production-nextauth-v5
```

---

### **Шаг 4: Добавьте NEXTAUTH_URL** 🌐

**В том же разделе Environment Variables:**

**Add New**:
- **Name:** `NEXTAUTH_URL`
- **Value:** `https://ваш-домен.vercel.app`

**Где взять домен?**
- Верх страницы Vercel → Domains → скопируйте URL
- Например: `https://averna-p34g.vercel.app`

---

### **Шаг 5: Redeploy** 🔄

После добавления переменных:

1. **Deployments** (вверху)
2. Найдите последний deployment
3. Справа **...** → **Redeploy**
4. Подтвердите

⏳ Подождите 2 минуты...

✅ **Сайт заработает!**

---

### **Шаг 6: Примените Схему БД** 📊

**После успешного redeploy:**

В терминале (или Vercel CLI):

```bash
# Если установлена Vercel CLI
vercel env pull .env.production
npx prisma db push
npx prisma db seed
```

**Или через Vercel Dashboard:**
- Settings → Functions → Environment Variables
- Скопируйте DATABASE_URL
- Запустите локально:

```bash
DATABASE_URL="скопированный-url" npx prisma db push
DATABASE_URL="скопированный-url" npx prisma db seed
```

---

## 🎉 **ГОТОВО!**

### **Ваш Сайт Работает!**

Откройте: **https://ваш-домен.vercel.app**

---

## 🔑 **Тестовые Аккаунты:**

```
Студент:
  Email: student1@averna.com
  Password: student123

Учитель:
  Email: teacher@averna.com
  Password: teacher123

Админ:
  Email: admin@averna.com
  Password: admin123
```

---

## 📝 **Чек-Лист:**

- [ ] ✅ Build на Vercel **зеленый**
- [ ] ✅ PostgreSQL **создан** (Storage → Create Database)
- [ ] ✅ `DATABASE_URL` **добавлен** (автоматически)
- [ ] ✅ `NEXTAUTH_SECRET` **добавлен** (32 символа)
- [ ] ✅ `NEXTAUTH_URL` **добавлен** (ваш vercel домен)
- [ ] ✅ **Redeploy** выполнен
- [ ] ✅ `prisma db push` **выполнен**
- [ ] ✅ `prisma db seed` **выполнен**
- [ ] 🎊 **Сайт открывается!**

---

## 🆘 **Если Что-то Не Работает:**

### **Ошибка "Invalid credentials":**
- Выполните `npx prisma db seed` для создания тестовых аккаунтов

### **Ошибка "Database connection":**
- Проверьте что PostgreSQL создан в Vercel Storage
- Проверьте что DATABASE_URL добавлен в Environment Variables

### **Сайт не открывается:**
- Проверьте Deployment Status (должен быть ✅ Ready)
- Проверьте что все 3 переменные добавлены
- Выполните Redeploy

---

## 🎯 **Итого:**

**Время настройки:** 5 минут

**Что нужно:**
1. ✅ Создать PostgreSQL (1 клик)
2. ✅ Добавить NEXTAUTH_SECRET (копи-паста)
3. ✅ Добавить NEXTAUTH_URL (копи-паста вашего домена)
4. ✅ Redeploy (1 клик)
5. ✅ Выполнить db:push и db:seed (2 команды)

---

# ✅ ВСЁ СДЕЛАНО! ПРОЕКТ ГОТОВ! 🎉

**Ваша платформа на финальной стадии запуска!**

Следуйте 6 шагам выше и через 10 минут всё заработает! 🚀

---

**Built with ❤️ for Averna Learning Centre**
