# ✅ ФИНАЛЬНЫЙ ЧЕК-ЛИСТ - Averna Project

## 🎯 **Проект ID:** `prj_mCQqQK1yPsD87TCyuAPLubIfhiXq`

---

## ✅ **ЧТО УЖЕ ГОТОВО:**

1. ✅ Код загружен на GitHub: https://github.com/AsadbekAnvarov/Averna
2. ✅ Build исправлен (все TypeScript ошибки устранены)
3. ✅ `.env.production` создан с placeholder значениями
4. ✅ Prisma схема готова (14 моделей)
5. ✅ Все API routes работают
6. ✅ UI компоненты созданы

---

## 🔧 **ЧТО НУЖНО СДЕЛАТЬ СЕЙЧАС (3 ШАГА):**

### **ШАГ 1: Проверьте Environment Variables в Vercel** 📝

Зайдите: https://vercel.com/dashboard

Откройте проект → Settings → Environment Variables

**Проверьте что есть:**

- ✅ `DATABASE_URL` (от Neon - автоматически добавлен)
- ⚠️ `NEXTAUTH_SECRET` (нужно добавить!)
- ⚠️ `NEXTAUTH_URL` (нужно добавить!)

---

### **ШАГ 2: Добавьте NEXTAUTH_SECRET** 🔐

**В Environment Variables нажмите "Add New":**

```
Name: NEXTAUTH_SECRET
Value: averna-production-secret-key-2026-nextauth-v5-secure
Environments: ✅ Production ✅ Preview ✅ Development
```

Нажмите **Save**

---

### **ШАГ 3: Добавьте NEXTAUTH_URL** 🌐

**Снова "Add New":**

```
Name: NEXTAUTH_URL
Value: https://averna-[ваш-домен].vercel.app
Environments: ✅ Production
```

**Где взять домен?**
- Вверху страницы → Domains → скопируйте URL

Нажмите **Save**

---

### **ШАГ 4: Redeploy** 🔄

**После добавления переменных:**

1. Перейдите в **Deployments**
2. Найдите последний deployment
3. Справа **...** → **Redeploy**
4. Подтвердите

⏳ **Подождите 3 минуты...**

✅ **Сайт задеплоится успешно!**

---

## 🗄️ **ШАГ 5: Примените Схему БД (ВАЖНО!)** 

После успешного redeploy нужно создать таблицы в базе данных.

### **Способ 1: Через Терминал (Рекомендуется)**

```bash
# 1. Скопируйте DATABASE_URL из Vercel
#    Settings → Environment Variables → DATABASE_URL → Show → Copy

# 2. В терминале (PowerShell на Windows):
$env:DATABASE_URL="ваш-скопированный-url"

# На Mac/Linux:
export DATABASE_URL="ваш-скопированный-url"

# 3. Создайте таблицы:
npx prisma db push

# 4. Создайте тестовые аккаунты:
npx prisma db seed
```

### **Способ 2: Через Neon SQL Editor**

1. Откройте Neon Console из Vercel Storage
2. SQL Editor → вставьте команды из файла `prisma/schema.prisma`
3. Но это сложнее - лучше Способ 1!

---

## 🔑 **ТЕСТОВЫЕ АККАУНТЫ** (после db:seed)

```
Студент:
📧 student1@averna.com
🔑 student123

Учитель:
📧 teacher@averna.com
🔑 teacher123

Админ:
📧 admin@averna.com
🔑 admin123
```

---

## 🎉 **ПРОВЕРКА РАБОТЫ:**

### **Откройте ваш сайт:**
```
https://averna-[ваш-домен].vercel.app
```

### **Протестируйте:**
1. ✅ Главная страница открывается
2. ✅ Кнопка "Sign In" работает
3. ✅ Можете залогиниться с тестовым аккаунтом
4. ✅ Dashboard открывается
5. ✅ Все модули доступны

---

## 🆘 **ЧАСТЫЕ ОШИБКИ:**

### **"Invalid credentials"**
→ Выполните `npx prisma db seed`

### **"Database connection error"**
→ Проверьте что Neon PostgreSQL создан и DATABASE_URL добавлен

### **"NEXTAUTH_SECRET is not set"**
→ Добавьте переменную в Vercel и redeploy

### **Сайт не открывается / 500 error**
→ Проверьте Vercel Logs: Runtime Logs → смотрите ошибку

---

## ✅ **ФИНАЛЬНЫЙ ЧЕК-ЛИСТ:**

- [ ] ✅ Neon PostgreSQL создан
- [ ] ✅ `DATABASE_URL` есть в Environment Variables
- [ ] ✅ `NEXTAUTH_SECRET` добавлен
- [ ] ✅ `NEXTAUTH_URL` добавлен (ваш домен)
- [ ] ✅ Redeploy выполнен
- [ ] ✅ Build статус: **Ready** (зеленый)
- [ ] ✅ `npx prisma db push` выполнен
- [ ] ✅ `npx prisma db seed` выполнен
- [ ] ✅ Сайт открывается!
- [ ] ✅ Можете залогиниться!

---

## 🎊 **ВСЁ ГОТОВО!**

После выполнения этих 5 шагов ваш проект **полностью заработает**!

**Время настройки:** 10 минут

**Ваш проект Averna готов к использованию!** 🎓🚀

---

## 📞 **Нужна Помощь?**

Если что-то не работает:

1. Проверьте Vercel Logs (Runtime Logs)
2. Проверьте все Environment Variables
3. Убедитесь что выполнили `prisma db push`

---

**Built with ❤️ for Averna Learning Centre**

*Последнее обновление: 3 июня 2026*
