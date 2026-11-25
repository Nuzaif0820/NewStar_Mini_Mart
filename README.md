# N Mart — Smart POS & Retail Management System

A modern, fast, offline-first Point of Sale (POS) and inventory management system designed for supermarkets, retail counters, and wholesale businesses. Built with React, Tailwind CSS, Capacitor, Node.js/Express, and Supabase.

---

## ✨ Key Features

- **⚡ Fast POS Billing & Checkout**
  - Instant product search & barcode / QR camera scanning
  - Continuous camera scanner mode for rapid scanning
  - Multiple payment modes (Cash, UPI, Credit Card, Split Payment)
  - Flexible discount options (percentage `%` or exact flat amount `₹`)
  - Hold cart & quick recall

- **🏷️ Product Label & Barcode Designer**
  - Customizable retail price tags with 2D QR codes and 1D barcodes
  - Shop name, logo, MRP, retail price, manufacture date, and best-before date
  - Fine-grained layout controls: content positioning, horizontal elongation, and font sizing

- **🖨️ Thermal Receipt Printing**
  - 58mm & 80mm thermal receipt printing support
  - Bluetooth ESC/POS printer connectivity for Android & desktop
  - USB and browser system print fallback
  - Customizable receipt headers, bill numbers, cashier details, tax breakdown, and footer notes

- **📦 Inventory & Stock Management**
  - Category-based product organization (Grocery, Bakery, Dairy, Household, Beverages, etc.)
  - Real-time stock tracking with low-stock alerts
  - Cost price vs. retail price profit margin tracking

- **🤝 Wholesale & Credit Ledger**
  - Wholesale customer directory with custom wholesale pricing
  - Ledger tracking for credit sales, outstanding balances, and payment receipts
  - Quick WhatsApp receipt sharing

- **📊 Owner Dashboard & Analytics**
  - Daily, weekly, and monthly revenue and profit reports
  - Top-selling items and inventory value breakdown
  - Expense tracking and net margin calculation
  - Role-based security (Owner PIN vs. Cashier access)

- **☁️ Hybrid Cloud & Offline Architecture**
  - Offline-first operation using local storage / SQLite
  - Real-time cloud sync with Supabase for multi-device sync
  - Complete database JSON snapshot backup & restore

- **📱 Multi-Platform Deployment**
  - Web browser responsive application
  - Native Android APK built via Capacitor

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, HTML5-QRCode, Canvas Confetti
- **Mobile Engine**: Capacitor (Android)
- **Backend / Sync**: Node.js, Express, SQLite, Supabase (`@supabase/supabase-js`)
- **Printing**: ESC/POS thermal command generation, Web Bluetooth API

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Git](https://git-scm.com/)
- (Optional for Android builds) [Android Studio](https://developer.android.com/studio) and Java JDK 17+

### 1. Clone the Repository

```bash
git clone https://github.com/Nuzaif0820/N-Mart.git
cd N-Mart
```

### 2. Install Dependencies

Install root, client, and server dependencies:

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### 3. Environment Configuration

Copy the example environment files:

```bash
# In client directory
cp .env.example .env

# In server directory
cp .env.example .env
```

Update `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Database Setup (Supabase)

Run the SQL script located in `supabase_schema.sql` inside your [Supabase SQL Editor](https://supabase.com/dashboard) to create the required tables and permissions.

### 5. Running the Application

**Run Frontend Dev Server:**
```bash
cd client
npm run dev
```

**Run Backend Server:**
```bash
cd server
node server.js
```

---

## 📱 Building the Android APK

1. Build the Vite production bundle:
   ```bash
   cd client
   npm run build
   ```
2. Sync Capacitor assets:
   ```bash
   npx cap sync android
   ```
3. Assemble the Android APK:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   The compiled APK will be output to: `client/android/app/build/outputs/apk/debug/app-debug.apk`.

Or run the included batch script on Windows:
```cmd
Build-Android-APK.bat
```

---

## 📄 License

This project is licensed under the MIT License.
