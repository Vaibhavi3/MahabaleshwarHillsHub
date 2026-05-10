# Mahabaleshwar Hills Hub - Ecommerce Platform

A full-stack ecommerce website showcasing handmade products from Mahabaleshwar region.

## 🏛️ Project Structure

```
MahabaleshwarHillsHub/
├── frontend/                 # React.js application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── .env
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── routes/
│   ├── requirements.txt
│   └── .env
├── docker-compose.yml        # Database setup
└── .gitignore
```

## 🚀 Features

✅ Product Catalog with Images
✅ User Authentication (Signup/Login)
✅ Shopping Cart Management
✅ Secure Checkout
✅ Payment Integration (Stripe/Razorpay)
✅ Order Tracking
✅ Product Reviews & Ratings
✅ Search & Filtering
✅ Admin Dashboard
✅ Responsive Design

## 🛠️ Tech Stack

### Frontend
- React.js 18.x
- Axios for API calls
- Redux for state management
- Tailwind CSS for styling
- React Router for navigation

### Backend
- FastAPI 0.95.x
- SQLAlchemy ORM
- PostgreSQL Database
- JWT for authentication
- Pydantic for validation

### Database
- PostgreSQL 13+
- Docker & Docker Compose

## 📦 Products

### Available Collections:
1. **Cozy Winter Socks** - Purple & beige thermal socks
2. **Thermal Socks Collection** - Cream & taupe premium socks
3. **Evil Eye Tote Bags** - Eco-friendly woven bags
4. **Pink Comfort Socks** - Pink & gray cushioned socks

## 🔧 Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.9+
- PostgreSQL 13+
- Docker & Docker Compose (optional)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# Run server
uvicorn app.main:app --reload
```

Backend will be available at `http://localhost:8000`
API Documentation: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install

# Setup environment variables
cp .env.example .env

# Start development server
npm start
```

Frontend will be available at `http://localhost:3000`

### Database Setup (Docker)

```bash
docker-compose up -d
```

This creates a PostgreSQL database at `localhost:5432`

## 📚 API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/{id}` - Get single product
- `GET /api/products/search` - Search products

### Users
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Cart
- `GET /api/cart` - Get cart items
- `POST /api/cart` - Add to cart
- `PUT /api/cart/{id}` - Update cart item
- `DELETE /api/cart/{id}` - Remove from cart

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create order
- `GET /api/orders/{id}` - Get order details

### Reviews
- `GET /api/reviews/{product_id}` - Get product reviews
- `POST /api/reviews` - Add review

## 🔐 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/mahabaleshwar_hub
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
STRIPE_SECRET_KEY=your-stripe-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_STRIPE_PUBLIC_KEY=your-stripe-public-key
REACT_APP_RAZORPAY_KEY_ID=your-razorpay-key
```

## 📖 Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Code Quality

```bash
# Backend linting
cd backend
flake8 app/
pylint app/

# Frontend linting
cd frontend
npm run lint
```

## 🚢 Deployment

### Using Heroku

```bash
heroku login
heroku create mahabaleshwar-hub
git push heroku main
```

### Using Docker

```bash
docker build -t mahabaleshwar-hub .
docker run -p 8000:8000 mahabaleshwar-hub
```

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Contact

For support, email: support@mahabaleshwarhillshub.com

---

**Built with ❤️ for Mahabaleshwar artisans**