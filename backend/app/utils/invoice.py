from datetime import datetime
from fpdf import FPDF

from app import models

BRAND_PINK = (255, 63, 108)
INK_NAVY = (40, 44, 63)
MUTED_GREY = (148, 150, 159)

STORE_NAME = "Mahabaleshwar Hills Hub"
STORE_TAGLINE = "Handmade with care in Mahabaleshwar, Maharashtra"

PAYMENT_METHOD_LABELS = {
    "stripe": "Card (Stripe)",
    "razorpay": "Razorpay",
}


def _fmt_amount(value: float) -> str:
    return f"Rs. {value:,.2f}"


def generate_invoice_pdf(order: "models.Order") -> bytes:
    """Build a one-page order receipt PDF from real, already-stored order
    data only - no tax/GST line (the store isn't GST-registered) and no
    invented delivery date, just what was actually charged and shipped."""
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*BRAND_PINK)
    pdf.cell(0, 10, STORE_NAME, ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED_GREY)
    pdf.cell(0, 6, STORE_TAGLINE, ln=True)
    pdf.ln(4)

    pdf.set_draw_color(*MUTED_GREY)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*INK_NAVY)
    pdf.cell(0, 8, "Order Receipt", ln=True)
    pdf.ln(2)

    pdf.set_font("Helvetica", "", 10)
    created = order.created_at
    created_label = created.strftime("%d %b %Y, %I:%M %p") if created else "-"
    details = [
        ("Order Number", order.order_number),
        ("Order Date", created_label),
        ("Payment Method", PAYMENT_METHOD_LABELS.get(order.payment_method, order.payment_method or "-")),
        ("Payment Status", (order.payment_status or "-").capitalize()),
        ("Order Status", (order.status or "-").capitalize()),
    ]
    for label, value in details:
        pdf.set_text_color(*MUTED_GREY)
        pdf.cell(45, 6, label)
        pdf.set_text_color(*INK_NAVY)
        pdf.cell(0, 6, str(value), ln=True)

    pdf.ln(4)
    pdf.set_text_color(*MUTED_GREY)
    pdf.cell(0, 6, "Shipping Address", ln=True)
    pdf.set_text_color(*INK_NAVY)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, order.shipping_address or "-")
    pdf.ln(4)

    if getattr(order, "is_gift", False):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*BRAND_PINK)
        pdf.cell(0, 6, "This order is a gift - gift wrapped", ln=True)
        if order.gift_message:
            pdf.set_font("Helvetica", "I", 10)
            pdf.set_text_color(*INK_NAVY)
            pdf.multi_cell(0, 6, f'"{order.gift_message}"')
        pdf.ln(2)

    # Items table
    pdf.set_fill_color(245, 245, 246)
    pdf.set_text_color(*INK_NAVY)
    pdf.set_font("Helvetica", "B", 10)
    col_widths = (90, 25, 35, 40)
    headers = ("Item", "Qty", "Unit Price", "Line Total")
    for width, header in zip(col_widths, headers):
        pdf.cell(width, 8, header, border=0, fill=True)
    pdf.ln()

    pdf.set_font("Helvetica", "", 10)
    for item in order.items:
        name = item.product_name or f"Product #{item.product_id}"
        if len(name) > 48:
            name = name[:45] + "..."
        line_total = item.price * item.quantity
        pdf.cell(col_widths[0], 8, name, border="B")
        pdf.cell(col_widths[1], 8, str(item.quantity), border="B")
        pdf.cell(col_widths[2], 8, _fmt_amount(item.price), border="B")
        pdf.cell(col_widths[3], 8, _fmt_amount(line_total), border="B")
        pdf.ln()

    pdf.ln(4)

    # Totals block, right-aligned
    def totals_row(label, value, bold=False):
        pdf.set_font("Helvetica", "B" if bold else "", 10)
        pdf.cell(140, 7, "")
        pdf.cell(20, 7, label)
        pdf.cell(40, 7, value, align="R", ln=True)

    subtotal = order.subtotal_amount if order.subtotal_amount is not None else order.total_amount
    totals_row("Subtotal", _fmt_amount(subtotal))
    if getattr(order, "multibuy_discount_amount", 0):
        totals_row("Mix & Match Socks discount", f"- {_fmt_amount(order.multibuy_discount_amount)}")
    if order.discount_amount:
        label = f"Coupon ({order.coupon_code})" if order.coupon_code else "Discount"
        totals_row(label, f"- {_fmt_amount(order.discount_amount)}")
    if order.points_discount_amount:
        totals_row("Hills Rewards points", f"- {_fmt_amount(order.points_discount_amount)}")
    if order.gift_card_amount:
        label = f"Gift card ({order.gift_card_code})" if order.gift_card_code else "Gift card"
        totals_row(label, f"- {_fmt_amount(order.gift_card_amount)}")
    totals_row("Shipping", "FREE")
    pdf.ln(1)
    pdf.set_draw_color(*INK_NAVY)
    pdf.line(150, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)
    totals_row("Total Paid", _fmt_amount(order.total_amount), bold=True)

    pdf.ln(10)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*MUTED_GREY)
    pdf.multi_cell(
        0,
        5,
        f"This is a computer-generated receipt for your records, generated on "
        f"{datetime.now().strftime('%d %b %Y')}. Thank you for shopping with {STORE_NAME}.",
    )

    return bytes(pdf.output())
