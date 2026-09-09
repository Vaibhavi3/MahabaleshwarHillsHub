from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    
class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(..., ge=0)
    stock: int = Field(..., ge=0)
    category: str
    
class ProductCreate(ProductBase):
    image_url: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    material: Optional[str] = None
    
class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)
    category: Optional[str] = None
    image_url: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    material: Optional[str] = None
    is_featured: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int
    image_url: Optional[str]
    color: Optional[str]
    size: Optional[str]
    material: Optional[str]
    rating: float
    is_featured: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1)

class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1)

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    
    class Config:
        from_attributes = True

class CartResponse(BaseModel):
    id: int
    user_id: int
    items: List[CartItemResponse] = []
    
    class Config:
        from_attributes = True

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    price: float

class OrderItemResponse(OrderItemCreate):
    id: int
    order_id: int
    product_name: Optional[str] = None
    product_image: Optional[str] = None

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    shipping_address: str
    payment_method: str
    notes: Optional[str] = None

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    order_number: str
    user_id: int
    total_amount: float
    status: str
    payment_status: str
    payment_method: str
    items: List[OrderItemResponse] = []
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReviewCreate(BaseModel):
    product_id: int
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    comment: Optional[str] = None

class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = None
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    rating: int
    title: Optional[str]
    comment: Optional[str]
    helpful_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    order_id: int
    amount: float
    payment_method: str

class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    status: str
    transaction_id: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class LoginRequest(BaseModel):
    username: str
    password: str

class CRMLeadCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    company: Optional[str] = Field(None, max_length=150)
    source: str = Field("website", max_length=50)
    status: str = Field("new", max_length=30)
    value: float = Field(0, ge=0)
    notes: Optional[str] = None

class CRMLeadUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    company: Optional[str] = Field(None, max_length=150)
    source: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=30)
    value: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

class CRMLeadResponse(CRMLeadCreate):
    id: int
    assigned_to_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CRMActivityCreate(BaseModel):
    customer_id: Optional[int] = None
    lead_id: Optional[int] = None
    type: str = Field("note", max_length=30)
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    due_date: Optional[datetime] = None

class CRMActivityUpdate(BaseModel):
    type: Optional[str] = Field(None, max_length=30)
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: Optional[bool] = None

class CRMActivityResponse(CRMActivityCreate):
    id: int
    created_by_id: int
    completed: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    customer_name: Optional[str] = None
    lead_name: Optional[str] = None

    class Config:
        from_attributes = True

class CRMCustomerSummary(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime
    order_count: int = 0
    lifetime_value: float = 0.0
    last_order_at: Optional[datetime] = None

class CRMCustomerOrder(BaseModel):
    id: int
    order_number: str
    total_amount: float
    status: str
    payment_status: str
    created_at: datetime

class CRMCustomerDetail(BaseModel):
    customer: CRMCustomerSummary
    orders: List[CRMCustomerOrder] = []
    activities: List[CRMActivityResponse] = []

class CRMRecentOrder(BaseModel):
    id: int
    order_number: str
    customer_name: str
    total_amount: float
    status: str
    created_at: datetime

class CRMOverviewResponse(BaseModel):
    total_customers: int
    total_orders: int
    total_revenue: float
    active_leads: int
    open_tasks: int
    recent_orders: List[CRMRecentOrder] = []
    pipeline: dict
