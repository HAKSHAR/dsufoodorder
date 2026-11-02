# DSU Food Ordering System

A beginner-friendly FSD mini project using plain HTML, CSS, JavaScript, Node.js, Express, and MySQL.

## Main features
- `public/index.html` is the customer homepage.
- `public/css/style.css` styles the customer and admin pages.
- `public/js/script.js` loads restaurants/menu from the backend, manages the cart, and starts WhatsApp checkout.
- Protected admin login to add/update/delete restaurants and menu items, upload photos, and update order status.
- Orders and menu data are stored in MySQL. The customer is not asked for an address.
- WhatsApp number is configured in `.env` as `WHATSAPP_NUMBER=916304166381` (country code +91 followed by the number).

## Requirements
- Node.js 18 or newer
- MySQL Server and MySQL Workbench

## Setup on macOS
1. Extract the project ZIP and open this folder in VS Code.
2. In MySQL Workbench, open `schema.sql` and execute it. This creates the `dsu_food_ordering` database and tables.
3. Copy `.env.example` to `.env` and update `DB_USER`, `DB_PASSWORD`, and `SESSION_SECRET` with your local settings.
4. Open a terminal in this folder and run:

   ```bash
   npm install
   npm run create-admin
   npm start
   ```

5. Open `http://localhost:3000` for the customer website.
6. Open `http://localhost:3000/admin/login` to sign in to the protected admin panel.

## Basic database checks
Run these in MySQL Workbench:

```sql
USE dsu_food_ordering;
SELECT * FROM admins;
SELECT * FROM restaurants;
SELECT * FROM menu_items;
SELECT * FROM orders;
```

## How to explain it to faculty
- HTML creates the webpage structure.
- CSS makes the page responsive and attractive.
- JavaScript handles searching, restaurant selection, cart quantity and checkout.
- Express provides API endpoints and server-side routes.
- MySQL stores restaurants, menu items, admins and orders.
- The backend recalculates item prices from MySQL before saving an order; it does not trust the total sent by the browser.
- After saving the order, the website opens WhatsApp with a pre-filled message. The customer must press Send.

This project must be configured and run locally with your own MySQL credentials before a live demo. Do not use the sample admin credentials in a public deployment; use a strong password and session secret.
