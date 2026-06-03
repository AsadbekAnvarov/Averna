# ⚡ БЫСТРЫЙ СТАРТ - Averna

## 🎯 **Проект готов! Осталось 3 простых шага!**

---

## **ШАГ 1: Добавьте Environment Variables в Vercel** 🔐

Зайдите: https://vercel.com/dashboard

Откройте ваш проект → Settings → Environment Variables

### **Добавьте 2 переменные:**

#### **1. NEXTAUTH_SECRET**
```
Name: NEXTAUTH_SECRET
Value: averna-production-secret-key-2026-nextauth-v5-secure
```

#### **2. NEXTAUTH_URL**
```
Name: NEXTAUTH_URL
Value: https://ваш-домен.vercel.app
```

*(Скопируйте URL из Domains вверху страницы)*

Нажмите **Save** для каждой переменной.

---

## **ШАГ 2: Redeploy** 🔄

После добавления переменных:

1. Перейдите в **Deployments**
2. Последний deployment → **...** → **Redeploy**
3. Подождите 3 минуты

✅ **Build пройдет успешно!**

---

## **ШАГ 3: Настройте Базу Данных** 🗄️

### **Автоматический способ (Windows):**

1. Скопируйте `DATABASE_URL` из Vercel Environment Variables
2. Откройте PowerShell в папке проекта
3. Выполните:

```powershell
# Установите DATABASE_URL
$env:DATABASE_URL="ваш-скопированный-url"

# Запустите скрипт
.\setup-database.ps1
```

### **Автоматический способ (Mac/Linux):**

```bash
# Установите DATABASE_URL
export DATABASE_URL="ваш-скопированный-url"

# Запустите скрипт
chmod +x setup-database.sh
./setup-database.sh
```

### **Ручной способ:**

```bash
# Установите DATABASE_URL
export DATABASE_URL="ваш-url"  # или $env:DATABASE_URL на Windows

# Выполните команды по порядку:
npx prisma db push
npx prisma db seed
```

---

## 🎉 **ГОТОВО!**

Откройте ваш сайт и залогиньтесь:

```
🌐 https://ваш-домен.vercel.app

🔑 Тестовые аккаунты:
   student1@averna.com / student123
   teacher@averna.com / teacher123
   admin@averna.com / admin123
```

---

## 📋 **ЧЕК-ЛИСТ:**

- [ ] ✅ Neon PostgreSQL создан
- [ ] ✅ NEXTAUTH_SECRET добавлен в Vercel
- [ ] ✅ NEXTAUTH_URL добавлен в Vercel
- [ ] ✅ Redeploy выполнен (статус Ready)
- [ ] ✅ `npx prisma db push` выполнен
- [ ] ✅ `npx prisma db seed` выполнен
- [ ] 🎊 Сайт работает!

---

## 🆘 **Проблемы?**

### **Build Failed:**
→ Проверьте что все Environment Variables добавлены

### **"Invalid credentials":**
→ Выполните `npx prisma db seed`

### **Database Error:**
→ Проверьте DATABASE_URL в Vercel Environment Variables

---

**Время настройки: 10 минут** ⏱️

**Built with ❤️ for Averna Learning Centre** 🎓
