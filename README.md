# SYSTOMIC Digital Systems - Website Order Form & Admin Dashboard

A professional multi-step form filling tool for businesses who want websites, complete with an admin dashboard for tracking client submissions.

## Features

### User Form (index.html)
- **Step 1:** Business type selection (Restaurants, Real Estate, Salons, Hotels, Hospitals, Gyms, Advisory Firms)
- **Step 2:** Website level selection (Basic, Professional, Premium)
- **Step 3:** Business information (name, phone, email, address, WhatsApp, admin credentials)
- **Step 4:** Business assets (logo, brand colors with 60+ themes, photos up to 30, videos up to 3)

### Details Questionnaire (details.html)
- Business information with company description & year established
- Universal Business Discovery (project type, goals, competitor research)
- Website pages & social media selection with link inputs
- 27+ website features to choose from
- Niche-specific questions based on business type
- Technical questions (domain, hosting, existing website, platforms)

### Admin Dashboard (/admin)
- **Login:** Email: `ram@gmail.com` | Password: `ram129`
- View all client submissions instantly
- Click any client to see their complete details
- Status tracking: **New** → **In Review** → **Approved**
- Stats overview with live counts

## Deployment to Vercel

### Option 1: Deploy from GitHub (Recommended)

1. **Create a GitHub Repository:**
   ```bash
   cd systomic-website
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/systomic-website.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click **"Add New"** → **"Project"**
   - Select your `systomic-website` repository
   - Vercel auto-detects the static site configuration
   - Click **"Deploy"**
   - Your site will be live at `https://systomic-website.vercel.app`

### Option 2: Direct Upload to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New"** → **"Project"**
3. Click **"Import"** and select the `systomic-website` folder
4. Click **"Deploy"**

## Important Notes

- **Data Storage:** This app uses `localStorage` which stores data only in the user's browser. Data will not sync across different browsers, devices, or users.
- **Admin Access:** Navigate to `https://your-domain.vercel.app/admin` to access the admin dashboard
- **Admin Credentials:**
  - Email: `ram@gmail.com`
  - Password: `ram129`

## Project Structure

```
systomic-website/
├── index.html      # Main form (4 steps)
├── details.html    # Detailed questionnaire
├── admin.html      # Admin dashboard
├── vercel.json     # Vercel routing config
├── package.json    # Project config
└── README.md       # This file
```

## URLs

- **Main Form:** `https://your-domain.vercel.app/`
- **Admin Dashboard:** `https://your-domain.vercel.app/admin`