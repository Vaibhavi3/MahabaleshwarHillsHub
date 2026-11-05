from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey, Table, UniqueConstraint, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from datetime import datetime

cart_items_association = Table(
    'cart_items',
    Base.metadata,
    Column('cart_id', Integer, ForeignKey('carts.id')),
    Column('product_id', Integer, ForeignKey('products.id'))
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    phone = Column(String(20))
    address = Column(Text)
    city = Column(String(50))
    state = Column(String(50))
    postal_code = Column(String(10))
    country = Column(String(50))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    loyalty_points = Column(Integer, default=0, nullable=False, server_default="0")
    lifetime_spend = Column(Float, default=0, nullable=False, server_default="0")
    referral_code = Column(String(20), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    cart = relationship("Cart", back_populates="user", uselist=False, cascade="all, delete-orphan")
    addresses = relationship(
        "Address", back_populates="user", cascade="all, delete-orphan", order_by="Address.id"
    )


class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    category = Column(String(50), index=True)
    subcategory = Column(String(50), index=True)
    image_url = Column(String(500))
    # Ordered gallery (main image first, then side/angle shots) as a JSON list of URLs.
    images = Column(Text)
    sku = Column(String(100), unique=True, index=True)
    # All colour/size variants of one product share a parent_sku (same as the Amazon parent SKU).
    parent_sku = Column(String(50), index=True)
    mrp = Column(Float)
    color = Column(String(255))
    size = Column(String(255))
    material = Column(String(100))
    rating = Column(Float, default=0.0)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="product", cascade="all, delete-orphan")


class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    label = Column(String(20), default="Home")  # "Home", "Work", or "Other"
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255))
    city = Column(String(50), nullable=False)
    state = Column(String(50), nullable=False)
    postal_code = Column(String(10), nullable=False)
    country = Column(String(50), default="India")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="addresses")


class Cart(Base):
    __tablename__ = "carts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="cart")
    items = relationship(
        "Product",
        secondary=cart_items_association,
        backref="carts"
    )


class CartItem(Base):
    __tablename__ = "cart_items_details"
    
    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    total_amount = Column(Float, nullable=False)
    subtotal_amount = Column(Float)
    coupon_code = Column(String(50))
    discount_amount = Column(Float, default=0)
    multibuy_discount_amount = Column(Float, default=0, nullable=False, server_default="0")
    status = Column(String(20), default="pending")
    payment_status = Column(String(20), default="pending")
    payment_method = Column(String(50))
    shipping_address = Column(Text)
    tracking_number = Column(String(100))
    notes = Column(Text)
    cancellation_reason = Column(String(255))
    points_redeemed = Column(Integer, default=0, nullable=False, server_default="0")
    points_discount_amount = Column(Float, default=0, nullable=False, server_default="0")
    points_earned = Column(Integer, default=0, nullable=False, server_default="0")
    points_credited = Column(Boolean, default=False, nullable=False, server_default="false")
    gift_card_code = Column(String(20))
    gift_card_amount = Column(Float, default=0, nullable=False, server_default="0")
    is_gift = Column(Boolean, default=False, nullable=False, server_default="false")
    gift_message = Column(String(300))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.created_at",
    )

    @property
    def refunded_amount(self):
        payment = max(self.payments, key=lambda p: p.id, default=None) if self.payments else None
        return payment.refunded_amount if payment else 0.0


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="status_history")


class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    @property
    def product_name(self):
        return self.product.name if self.product else None

    @property
    def product_image(self):
        return self.product.image_url if self.product else None


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    title = Column(String(100))
    comment = Column(Text)
    helpful_count = Column(Integer, default=0)
    verified_purchase = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="reviews")
    product = relationship("Product", back_populates="reviews")
    helpful_votes = relationship("ReviewHelpfulVote", cascade="all, delete-orphan")
    photos = relationship("ReviewPhoto", back_populates="review", cascade="all, delete-orphan", order_by="ReviewPhoto.id")


class ReviewPhoto(Base):
    """A customer-uploaded photo attached to their own review, stored as
    bytes in the DB (not the filesystem) so it survives Render's ephemeral
    disk across deploys/restarts, same durability as the review text itself."""
    __tablename__ = "review_photos"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False, index=True)
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    review = relationship("Review", back_populates="photos")


class ReviewHelpfulVote(Base):
    __tablename__ = "review_helpful_votes"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("review_id", "user_id", name="uq_review_helpful_vote"),)


class ProductQuestion(Base):
    """A customer-asked question on a product page, inspired by Nykaa's
    product Q&A. Any logged-in customer can answer (see ProductAnswer),
    same as the community-answered pattern on Nykaa."""
    __tablename__ = "product_questions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", backref="questions")
    user = relationship("User")
    answers = relationship(
        "ProductAnswer", back_populates="question", cascade="all, delete-orphan", order_by="ProductAnswer.created_at"
    )


class ProductAnswer(Base):
    __tablename__ = "product_answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("product_questions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    answer = Column(Text, nullable=False)
    is_seller_answer = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    question = relationship("ProductQuestion", back_populates="answers")
    user = relationship("User")


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255))
    discount_type = Column(String(10), default="percent")  # "percent" or "flat"
    discount_value = Column(Float, nullable=False)
    min_order_value = Column(Float, default=0)
    max_discount = Column(Float)  # cap for percent-type coupons
    usage_limit = Column(Integer)  # null = unlimited
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GiftCard(Base):
    """A prepaid e-gift card, matching Nykaa/Myntra/Ajio's "Gift Card"
    pattern: bought by one shopper (optionally for a friend), paid for
    through the same Stripe/Razorpay flow as a normal order, then
    redeemable for its balance at checkout on future orders - including
    by guests who were just emailed a code, not only the purchaser. The
    code is only generated once payment succeeds, so a card that was
    never paid for never becomes spendable."""
    __tablename__ = "gift_cards"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True)
    initial_value = Column(Float, nullable=False)
    balance = Column(Float, nullable=False)
    status = Column(String(20), default="pending_payment", nullable=False, index=True)  # pending_payment | active | redeemed
    purchaser_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_name = Column(String(100), nullable=False)
    recipient_email = Column(String(150), nullable=False)
    sender_name = Column(String(100))
    message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    activated_at = Column(DateTime(timezone=True))

    purchaser = relationship("User")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="INR")
    payment_method = Column(String(50))
    transaction_id = Column(String(100), unique=True)
    status = Column(String(20), default="pending")
    response_data = Column(Text)
    # Real gateway refunds (Stripe/Razorpay), issued on order cancellation
    # or a completed return - see app/utils/refunds.py. refund_status is
    # "none" | "partial" | "full" | "failed".
    refunded_amount = Column(Float, default=0, nullable=False, server_default="0")
    refund_status = Column(String(20), default="none", nullable=False, server_default="none")
    refund_transaction_id = Column(String(100))
    refunded_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    order = relationship("Order", backref="payments")

class CRMLead(Base):
    __tablename__ = "crm_leads"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(80), nullable=False)
    last_name = Column(String(80))
    email = Column(String(150), index=True)
    phone = Column(String(30))
    company = Column(String(150))
    source = Column(String(50), default="website")
    status = Column(String(30), default="new", index=True)
    value = Column(Float, default=0.0)
    notes = Column(Text)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class StockAlert(Base):
    __tablename__ = "stock_alerts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    email = Column(String(150), nullable=False)
    notified = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    notified_at = Column(DateTime(timezone=True))

    product = relationship("Product")
    user = relationship("User")


class WishlistItem(Base):
    """`price_at_add` snapshots the product's price the moment it was
    wishlisted, so the Wishlist page can show a "Price Dropped" badge by
    comparing it to the product's current price - extending this store's
    existing back-in-stock "Notify Me" alert pattern (see StockAlert) from
    stock to price. `price_drop_notified` guards the one-time email sent
    when the price first drops below that snapshot (see products.py's
    _notify_price_drop), so a customer isn't emailed again for the same
    drop on every later price tweak."""
    __tablename__ = "wishlist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    price_at_add = Column(Float)
    price_drop_notified = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    product = relationship("Product")

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),)


class RecentlyViewed(Base):
    """A signed-in user's product browsing history, tied to the account the
    same way wishlist_items is - so the "Recently Viewed" rail follows a
    shopper across devices, matching Myntra's homepage recently-viewed
    section. Guests get a recently-viewed rail too, but browser-local only
    (see frontend RecentlyViewed component) - this table is account-only."""
    __tablename__ = "recently_viewed"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    viewed_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    product = relationship("Product")

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_recently_viewed_user_product"),)


class ReturnRequest(Base):
    """Self-service return/exchange request against a delivered order
    item, matching Myntra/Nykaa/Ajio's "Return or Exchange" flow on My
    Orders. Only honoured within RETURN_WINDOW_DAYS of delivery, which is
    the "7-day hassle-free returns" promise already shown on the homepage
    and product page trust badges - not a new policy."""
    __tablename__ = "return_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    request_type = Column(String(20), nullable=False)  # "return" or "exchange"
    reason = Column(String(255), nullable=False)
    comment = Column(Text)
    exchange_product_id = Column(Integer, ForeignKey("products.id"))
    status = Column(String(20), default="requested", index=True)
    # Set when an admin marks a "return" request completed - a real
    # gateway refund for this item's paid price is issued at that point
    # (see app/utils/refunds.py). Stays "none" for exchanges, which swap
    # stock rather than return money. refund_status is "none" | "refunded" | "failed".
    refund_amount = Column(Float, default=0, nullable=False, server_default="0")
    refund_status = Column(String(20), default="none", nullable=False, server_default="none")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    order_item = relationship("OrderItem")
    user = relationship("User")
    exchange_product = relationship("Product", foreign_keys=[exchange_product_id])

    @property
    def order(self):
        return self.order_item.order if self.order_item else None

    @property
    def product_name(self):
        return self.order_item.product_name if self.order_item else None

    @property
    def product_image(self):
        return self.order_item.product_image if self.order_item else None

    @property
    def quantity(self):
        return self.order_item.quantity if self.order_item else None

    @property
    def order_number(self):
        return self.order.order_number if self.order else None

    @property
    def user_email(self):
        return self.user.email if self.user else None

    @property
    def exchange_product_name(self):
        return self.exchange_product.name if self.exchange_product else None


class LoyaltyTransaction(Base):
    """Ledger entry for "Hills Rewards" points, matching Nykaa Cash/Myntra
    Insider/Ajio Rewardz: a running points balance earned on delivered
    orders (and a signup bonus) and spent as a checkout discount. Kept as
    an append-only ledger (rather than just the running User.loyalty_points
    total) so a shopper's balance is always explainable from history."""
    __tablename__ = "loyalty_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    points = Column(Integer, nullable=False)  # positive = credit, negative = redeemed
    reason = Column(String(30), nullable=False)  # signup_bonus | order_earned | order_redeemed | order_redeemed_refund
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    order = relationship("Order")


class Referral(Base):
    """"Invite & Earn" record: one row per successful signup via a friend's
    referral code, matching Ajio's Invite & Earn pattern (the new shopper
    gets a welcome bonus for using a code, the referrer earns a bonus once
    that friend's first order is delivered) - adapted to this store's own
    Hills Rewards points instead of AJIO SuperCash. A referred user can
    only ever have one referrer, so referred_user_id is unique."""
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    referred_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending | completed
    reward_points = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    referrer = relationship("User", foreign_keys=[referrer_id])
    referred_user = relationship("User", foreign_keys=[referred_user_id])


class CRMActivity(Base):
    __tablename__ = "crm_activities"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(30), default="note")
    title = Column(String(150), nullable=False)
    description = Column(Text)
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SupportTicket(Base):
    """A customer-raised Help Center ticket, inspired by Myntra/Nykaa/Ajio's
    "Need Help?" flow: pick a category (optionally against one of your own
    orders), describe the issue, and track its status until the store
    replies. This is the "contact support" channel several existing flows
    (order cancellation past the shipped cutoff, return requests past the
    window) already point customers to, but which never actually
    existed."""
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    category = Column(String(30), nullable=False)
    subject = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="open", nullable=False, index=True)
    admin_reply = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))

    user = relationship("User")
    order = relationship("Order")

    @property
    def order_number(self):
        return self.order.order_number if self.order else None

    @property
    def user_email(self):
        return self.user.email if self.user else None

    @property
    def user_name(self):
        if not self.user:
            return None
        name = " ".join(part for part in [self.user.first_name, self.user.last_name] if part).strip()
        return name or self.user.username


class SearchQuery(Base):
    """One real shopper search, logged when a search actually lands on the
    results page (not on every keystroke of the header's live-suggestion
    dropdown). Powers "Trending Searches" on the empty search panel,
    inspired by Myntra/Ajio/Nykaa's search landing experience - real,
    aggregated search terms, never a fabricated/seeded list. user_id is
    nullable so guest searches still count toward trending."""
    __tablename__ = "search_queries"

    id = Column(Integer, primary_key=True, index=True)
    term = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
