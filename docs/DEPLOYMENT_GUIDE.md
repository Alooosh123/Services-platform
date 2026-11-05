# دليل النشر والتشغيل الشامل (Deployment Guide)
## Digital TopUp & Services Platform

يقدم هذا الدليل الخطوات الدقيقة لتشغيل المنصة محليًا بنقرة واحدة (Local Development & Demo Mode) بالإضافة إلى النشر المباشر على الخوادم الافتراضية الخاصة (Production VPS).

---

## 1. التشغيل المحلي السريع (Local Development & Demo Mode)

### المتطلبات الأساسية
* Node.js (v20 أو v24)
* Docker & Docker Compose (اختياري للتشغيل عبر الحاويات)
* PostgreSQL 15+ و Redis 7+

### التشغيل عبر Docker Compose (أمر واحد)

للتشغيل الفوري لكامل مكونات المنصة (قاعدة البيانات، الكاش، الـ Backend، لوحة الإدارة، ومتجر العميل):

```bash
# 1. نسخ ملف البيئة
cp .env.example .env

# 2. تشغيل الحاويات
docker compose -f docker/docker-compose.yml up -d --build
```

بعد اكتمال التشغيل، ستكون الروابط متاحة كالتالي:
* **متجر العميل (Customer Storefront):** `http://localhost:3000`
* **لوحة الإدارة (Admin Dashboard):** `http://localhost:3001`
* **واجهة البرمجة (Backend REST API):** `http://localhost:4000/api`
* **توثيق Swagger التفاعلي:** `http://localhost:4000/api/docs`
* **مدير قاعدة البيانات (Adminer):** `http://localhost:8080`

---

## 2. التشغيل اليدوي (بدون Docker)

### الخطوة 1: تثبيت الاعتماديات وبناء الحزم المشتركة
```bash
# تثبيت كافة حزم الـ Monorepo
npm install

# بناء الحزم المشتركة
npm run build --workspace=packages/shared
```

### الخطوة 2: تهيئة وتغذية قاعدة البيانات (Migrations & Seeders)
```bash
# توليد عميل Prisma
npm run db:generate

# مزامنة الجداول مع PostgreSQL
npm run db:push

# إدخال البيانات التجريبية الأولية (Seed Data)
npm run db:seed
```

> **حسابات التجربة الأولية المنشأة تلقائيًا:**
> * **المدير العام (Super Admin):** `admin@digitaltopup.com` | كلمة المرور: `Admin@123456`
> * **المدير المالي (Finance Officer):** `finance@digitaltopup.com` | كلمة المرور: `Finance@123456`
> * **العميل التجريبي (Customer):** `customer@gmail.com` | كلمة المرور: `Customer@123456` (رصيد محفظة: $100.00)

### الخطوة 3: تشغيل الخدمات
```bash
# تشغيل الـ Backend API (Port 4000)
npm run dev:backend

# في نافذة طرفية أخرى: تشغيل لوحة الإدارة (Port 3001)
npm run dev:admin

# في نافذة طرفية ثالثة: تشغيل متجر العميل (Port 3000)
npm run dev:customer
```

---

## 3. نشر بيئة الإنتاج على VPS (Production Deployment)

### المواصفات الموصى بها للخادم
* المعالج: 2 vCPU
* الذاكرة: 4GB RAM أو أكثر
* التخزين: 40GB SSD / NVMe
* نظام التشغيل: Ubuntu 22.04 LTS

### إعداد الخادم
```bash
# تحديث الحزم
sudo apt update && sudo apt upgrade -y

# تثبيت Docker و Docker Compose
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker

# تثبيت Nginx و Certbot لتأمين شهادات SSL
sudo apt install -y nginx certbot python3-certbot-nginx
```

### إعداد Nginx Reverse Proxy
قم بإنشاء ملف التكوين `/etc/nginx/sites-available/topup.conf`:

```nginx
server {
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name admin.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    server_name yourdomain.com www.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

تفعيل الإعداد واستخراج شهادة SSL المجانية:
```bash
sudo ln -s /etc/nginx/sites-available/topup.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d admin.yourdomain.com -d api.yourdomain.com
```
