import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routes import products, users, cart, orders, reviews, payments, coupons, recommendations
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Mahabaleshwar Hills Hub API",
    description="Full-featured ecommerce API for handmade products",
    version="1.0.0"
)

# Configure CORS - comma-separated origins via env, e.g. "https://your-site.vercel.app,http://localhost:3000"
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include routers
app.include_router(products.router, prefix="/api", tags=["products"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(cart.router, prefix="/api", tags=["cart"])
app.include_router(orders.router, prefix="/api", tags=["orders"])
app.include_router(reviews.router, prefix="/api", tags=["reviews"])
app.include_router(payments.router, prefix="/api", tags=["payments"])
app.include_router(coupons.router, prefix="/api", tags=["coupons"])
app.include_router(recommendations.router, prefix="/api", tags=["recommendations"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to Mahabaleshwar Hills Hub API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)