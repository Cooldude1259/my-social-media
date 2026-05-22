# ConnectEd - The Future of Social Media

![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)
![HTML](https://img.shields.io/badge/Language-HTML-orange.svg)
![Status](https://img.shields.io/badge/Status-In%20Development-yellow.svg)

## 📱 About

**ConnectEd** is a modern, school-focused social media platform. This repository contains the frontend for the ConnectEd application, designed with a futuristic, cosmic aesthetic and smooth floating animations.

The application is structured as a web-based interface intended to feel like a native app, with potential backend integration through Vercel for scalability and performance.

## 🚀 Project Goals

- Create an innovative social media platform specifically designed for school communities
- Deliver a seamless, app-like experience through a web-based interface
- Provide elegant, futuristic UI with smooth animations and cosmic theming
- Enable future integration with backend services via Vercel

## 📁 Project Structure

```
my-social-media/
├── index.html              # Main landing page with animations
├── auth.html               # Authentication page (Sign up / Sign in / Sign out)
├── app-manifest.json       # App configuration and metadata
├── DESIGN_NOTES.md         # Design philosophy and animation guidelines
├── LICENSE                 # MIT License
└── README.md               # This file
```

## 🎨 Design & Features

### Visual Design
- **Theme**: Space/cosmic aesthetic with mystical, ethereal feeling
- **Color Palette**: Deep purples, electric blues, and glowing accents on dark backgrounds
- **Animation Style**: Gentle "breathing" floating animations with organic, natural motion
- **Effects**: 
  - Animated gradient blobs in the background
  - Smooth, staggered animations for all content
  - Glowing hover effects on interactive elements
  - Screen blend modes for depth and visual interest

### Key Components

#### `index.html` - Landing Page
- Hero introduction to ConnectEd
- Animated floating blobs background
- Call-to-action sign in/register button
- Project vision and roadmap information
- Custom typography using Orbitron and Quicksand fonts

#### `auth.html` - Authentication
- Sign-up form for new users
- Sign-in form for existing users
- Sign-out functionality
- Integration with Supabase for authentication (requires configuration)
- Clean, minimal authentication interface

#### `app-manifest.json` - Configuration
- Vercel backend domain configuration
- Web shell URL setup
- Required assets declaration

## 🛠️ Technical Stack

- **Frontend**: HTML, CSS (with advanced animations)
- **Styling**: Custom CSS with keyframe animations
- **Fonts**: Google Fonts (Orbitron, Quicksand)
- **Authentication**: Supabase (JavaScript SDK)
- **Deployment**: Vercel (planned backend)

## 🎬 Animation Features

All content includes smooth, subtle floating animations:
- **Elements animate at different speeds** (2.5s - 4s duration)
- **Max movement**: 8px - 15px to maintain elegance
- **Timing**: ease-in-out for natural motion
- **Background**: Continuous blob animations with 3D transforms and rotation

See `DESIGN_NOTES.md` for detailed animation specifications.

## 🔐 Authentication Setup

To enable authentication features in `auth.html`:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Update `auth.html` with your credentials:
   ```javascript
   const SUPABASE_URL = "YOUR_SUPABASE_URL";
   const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
   ```
3. Test sign-up, sign-in, and sign-out functionality

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Cooldude1259/my-social-media.git
   ```

2. Open `index.html` in your browser to view the landing page

3. Configure `auth.html` with Supabase credentials for full authentication functionality

4. Customize `app-manifest.json` with your Vercel backend domain

## 📝 Design Philosophy

This project follows these core principles (see `DESIGN_NOTES.md`):

- ✨ **Magic Aesthetic**: Animations should feel mystical and enchanting
- 🌬️ **Organic Motion**: Smooth, breathing animations—not mechanical or jarring
- 🎯 **Subtle Effects**: Keep movements gentle (8px or less)
- 🔄 **Staggered Timing**: Vary durations for natural, flowing motion
- 📝 **Content Preservation**: Maintain original content integrity

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔮 Future Roadmap

- [ ] Backend API integration with Vercel
- [ ] User profiles and connections
- [ ] Feed and content sharing
- [ ] Real-time notifications
- [ ] Mobile optimization
- [ ] Advanced styling and customization
- [ ] Community features for school networks

## 👤 Author

[Cooldude1259](https://github.com/Cooldude1259)

---

**The future will be coming soon, but patience is ALWAYS key.** ✨
