**A simple URL Shortener API that allows users to shorten long URLs, track analytics, and view insights on link usage.**


  **Live Demo**
Deployment URL: https://url-shortener-production-29e6.up.railway.app

   🔗 Shorten URLs – Convert long URLs into short, shareable links.

   📊 Analytics Tracking – Log visits with IP, user agent, OS type, device type, country, and city.

   🔒 User Authentication – Secure login using Google OAuth.

   🗂 Redis Caching – Optimize repeated queries by caching URL data.

   📡 RESTful API – Fully functional API to create, fetch, and redirect shortened URLs.


Backend: Node.js, Express.js, MongoDB (Mongoose)

Caching: Redis

Authentication: JWT, Google OAuth

Hosting: Railway

   **Installation & Running Locally**

git clone https://github.com/dheerajndhongade/url-shortener.git
cd url-shortener
npm install

   Set Up Environment Variables
Create a .env file in the root directory and add:

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

REDIS_URL=your_redis_connection_string

GOOGLE_CLIENT_ID=your_google_client_id

GOOGLE_CLIENT_SECRET=your_google_client_secret

npm start

**Challenges Faced & Solutions**

Challenge: Implementing Redis caching to store frequently accessed URLs, reducing database load and improving response time.

Video Demo - https://www.loom.com/share/bb051159a6f44e32b0f9251505c3b9a5?sid=5d74755a-5ca4-453e-8984-2dabbaa2ff57


