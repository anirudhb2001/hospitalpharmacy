import frappe
from frappe import _

# ─────────────────────────────────────────────────────────────
# PUBLIC – Medicine Catalog APIs
# ─────────────────────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def get_medicines(search="", category="", brand="", availability="", prescription="", sort="name", page=1, page_size=12):
    """Return paginated medicine list for the portal with live stock."""
    
    conditions = ["m.status = 'Active'"]
    values = []
    
    if search:
        conditions.append("(m.medicine_name LIKE %s OR m.generic_name LIKE %s OR m.category LIKE %s)")
        values.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
    if category:
        conditions.append("m.category = %s")
        values.append(category)
    if brand:
        conditions.append("m.brand = %s")
        values.append(brand)
        
    order_map = {
        "name": "m.medicine_name ASC",
        "price_asc": "i.standard_rate ASC",
        "price_desc": "i.standard_rate DESC",
        "newest": "m.creation DESC",
    }
    order_by = order_map.get(sort, "m.medicine_name ASC")
    
    having_clause = ""
    if availability == "in_stock":
        having_clause = "HAVING actual_qty > 0"
        
    where_clause = " AND ".join(conditions)
    if where_clause:
        where_clause = "WHERE " + where_clause
        
    page = int(page)
    page_size = int(page_size)
    offset = (page - 1) * page_size
    
    # Query for the records
    query = f"""
        SELECT 
            m.name, m.medicine_name, m.generic_name, m.brand, m.category,
            m.manufacturer, 
            IFNULL((SELECT price_list_rate FROM `tabItem Price` WHERE item_code = m.item AND price_list='Standard Selling' LIMIT 1), i.standard_rate) AS selling_price, 
            m.mrp, m.status,
            m.image, i.description, m.expiry_date, m.barcode, m.item,
            IFNULL(SUM(b.actual_qty), 0) - IFNULL(SUM(b.reserved_qty), 0) AS actual_qty
        FROM `tabMedicine` m
        JOIN `tabItem` i ON m.item = i.name
        LEFT JOIN `tabBin` b ON m.item = b.item_code
        {where_clause}
        GROUP BY m.name
        {having_clause}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """
    
    # Query for the total count
    count_query = f"""
        SELECT COUNT(*) FROM (
            SELECT m.name
            FROM `tabMedicine` m
            JOIN `tabItem` i ON m.item = i.name
            LEFT JOIN `tabBin` b ON m.item = b.item_code
            {where_clause}
            GROUP BY m.name
            {having_clause}
        ) AS t
    """
    
    medicines = frappe.db.sql(query, tuple(values + [page_size, offset]), as_dict=True)
    total = frappe.db.sql(count_query, tuple(values))[0][0]
    
    return {"medicines": medicines, "total": total, "page": page, "page_size": page_size}


@frappe.whitelist(allow_guest=True)
def get_medicine_filters():
    """Return distinct categories and brands for filter dropdowns."""
    categories = frappe.db.get_all(
        "Medicine", filters={"status": "Active"}, fields=["category"], distinct=True
    )
    brands = frappe.db.get_all(
        "Medicine", filters={"status": "Active", "brand": ["!=", ""]}, fields=["brand"], distinct=True
    )
    return {
        "categories": [c["category"] for c in categories if c["category"]],
        "brands": [b["brand"] for b in brands if b["brand"]],
    }


@frappe.whitelist(allow_guest=True)
def get_portal_stats():
    """KPI stats for the public storefront homepage."""
    total = frappe.db.count("Medicine", {"status": "Active"})
    available = frappe.db.sql("""
        SELECT COUNT(DISTINCT m.name)
        FROM `tabMedicine` m
        JOIN `tabBin` b ON m.item = b.item_code
        WHERE m.status = 'Active' AND b.actual_qty > 0
    """)[0][0]
    categories = frappe.db.sql(
        "SELECT COUNT(DISTINCT category) FROM `tabMedicine` WHERE status='Active'"
    )[0][0]
    return {
        "total_medicines": total,
        "available_medicines": available,
        "medicine_categories": int(categories),
        "same_day_delivery": True,
    }


@frappe.whitelist(allow_guest=True)
def get_medicine_details(name):
    medicine = frappe.get_doc("Medicine", name).as_dict()
    if medicine.get("item"):
        item = frappe.get_doc("Item", medicine.get("item"))
        
        selling_price = frappe.db.get_value("Item Price", {"item_code": item.name, "price_list": "Standard Selling"}, "price_list_rate")
        medicine["selling_price"] = selling_price or item.standard_rate
        
        medicine["purchase_price"] = item.valuation_rate
        medicine["description"] = item.description
    return medicine



# ─────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────
def create_admin_notification(subject, description, doc_type=None, doc_name=None, priority="Alert"):
    admins = frappe.get_all("Has Role", filters={"role": "System Manager", "parenttype": "User"}, pluck="parent")
    for admin in set(admins):
        doc = frappe.new_doc("Notification Log")
        doc.subject = subject
        doc.email_content = description
        if doc_type and doc_name:
            doc.document_type = doc_type
            doc.document_name = doc_name
        doc.for_user = admin
        doc.type = "Alert"
        doc.insert(ignore_permissions=True)

@frappe.whitelist()
def get_admin_notifications():
    if not frappe.has_permission("Notification Log", "read"):
        return []
    user = frappe.session.user
    notifications = frappe.get_all("Notification Log", 
        filters={"for_user": user},
        fields=["name", "subject", "email_content", "document_type", "document_name", "type", "read", "creation"],
        order_by="creation desc",
        limit=50
    )
    return notifications

@frappe.whitelist()
def mark_notification_read(name):
    frappe.db.set_value("Notification Log", name, "read", 1)
    return {"status": "success"}

@frappe.whitelist()
def mark_all_notifications_read():
    frappe.db.sql("UPDATE `tabNotification Log` SET `read` = 1 WHERE for_user = %s", frappe.session.user)
    return {"status": "success"}


# ─────────────────────────────────────────────────────────────
# AUTH APIs
# ─────────────────────────────────────────────────────────────

import re

@frappe.whitelist(allow_guest=True)
def register_customer(full_name, email, phone, password):
    from frappe.utils import validate_email_address
    
    validate_email_address(email, throw=True)
    
    if not re.match(r"^[6-9]\d{9}$", phone):
        frappe.throw(_("Invalid mobile number."))
        
    if not re.match(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$", password):
        frappe.throw(_("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."))

    if frappe.db.exists("User", email):
        frappe.throw(_("A user with this email already exists."))

    if frappe.db.exists("Customer", {"email_id": email}) or frappe.db.exists("Customer", {"mobile_no": phone}):
        frappe.throw(_("A customer with this email or phone already exists."))

    if frappe.db.exists("Customer", {"customer_name": full_name}):
        frappe.throw(_("A customer with this name already exists."))

    user = frappe.get_doc({
        "doctype": "User",
        "email": email,
        "first_name": full_name,
        "new_password": password,
        "send_welcome_email": 0,
    })
    user.flags.ignore_permissions = True
    user.insert()

    customer = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": full_name,
        "customer_type": "Individual",
        "customer_group": "Commercial",
        "territory": "All Territories",
        "mobile_no": phone,
        "email_id": email
    })
    customer.flags.ignore_permissions = True
    customer.insert()
        
    create_admin_notification("New Customer Registration", f"Customer {full_name} ({email}) has registered.", "Customer", customer.name)

    frappe.db.commit()
    return {"status": "success", "message": "Registered successfully"}


@frappe.whitelist(allow_guest=True)
def customer_login(email, password):
    try:
        login_manager = frappe.auth.LoginManager()
        login_manager.authenticate(user=email, pwd=password)
        login_manager.post_login()
        
        user_roles = frappe.get_roles(frappe.session.user)
        admin_roles = [
            "Administrator", "System Manager", "Hospital Administrator",
            "Pharmacy Manager", "Pharmacist", "Cashier",
        ]
        if any(role in admin_roles for role in user_roles):
            frappe.local.login_manager.logout()
            frappe.throw(_("Unauthorized: Staff members cannot use the Customer Portal."))

        frappe.db.commit()
        user = frappe.get_doc("User", frappe.session.user)
        return {
            "status": "success",
            "user": frappe.session.user,
            "full_name": user.full_name,
        }
    except frappe.exceptions.AuthenticationError:
        frappe.clear_messages()
        frappe.throw(_("Invalid email or password."), frappe.AuthenticationError)


@frappe.whitelist(allow_guest=True)
def admin_login(email, password):
    try:
        login_manager = frappe.auth.LoginManager()
        login_manager.authenticate(user=email, pwd=password)
        login_manager.post_login()

        user_roles = frappe.get_roles(frappe.session.user)
        allowed_roles = [
            "Administrator", "System Manager", "Hospital Administrator",
            "Pharmacy Manager", "Pharmacist", "Cashier",
        ]
        if not any(role in allowed_roles for role in user_roles):
            frappe.local.login_manager.logout()
            frappe.throw(_("Unauthorized: You do not have staff access."))

        frappe.db.commit()
        user = frappe.get_doc("User", frappe.session.user)
        return {
            "status": "success",
            "user": frappe.session.user,
            "full_name": user.full_name,
        }
    except frappe.exceptions.AuthenticationError:
        frappe.clear_messages()
        frappe.throw(_("Invalid email or password."), frappe.AuthenticationError)


# ─────────────────────────────────────────────────────────────
# CHECKOUT API
# ─────────────────────────────────────────────────────────────

def get_fefo_batches(item_code, warehouse, required_qty, delivery_date=None):
    """
    ERPNext v15 stores batch tracking in Serial and Batch Bundle, not directly
    on SLE.batch_no (deprecated field, populated only on cancel in legacy mode).
    Query path: SLE -> Serial and Batch Bundle -> Serial and Batch Entry -> Batch.

    If delivery_date is provided (YYYY-MM-DD string), only batches expiring
    STRICTLY AFTER that date are returned (strict FEFO for future delivery).
    Returns None if insufficient valid batch stock exists.
    """
    from frappe.utils import today as frappe_today

    if delivery_date is None:
        delivery_date = frappe_today()

    batches = frappe.db.sql("""
        SELECT
            sabe.batch_no,
            SUM(sabe.qty) AS qty,
            b.expiry_date
        FROM `tabStock Ledger Entry` sle
        JOIN `tabSerial and Batch Bundle` sabb
            ON sabb.name = sle.serial_and_batch_bundle
            AND sabb.is_cancelled = 0
        JOIN `tabSerial and Batch Entry` sabe
            ON sabe.parent = sabb.name
        JOIN `tabBatch` b ON b.name = sabe.batch_no
        WHERE
            sle.item_code = %s
            AND sle.warehouse = %s
            AND sle.is_cancelled = 0
            AND b.expiry_date > %s
        GROUP BY sabe.batch_no, b.expiry_date
        HAVING qty > 0
        ORDER BY b.expiry_date ASC
    """, (item_code, warehouse, delivery_date), as_dict=True)

    allocated = []
    remaining = required_qty
    for b in batches:
        if remaining <= 0:
            break
        alloc_qty = min(remaining, b.qty)
        allocated.append({
            "batch_no": b.batch_no,
            "qty": alloc_qty,
            "expiry_date": str(b.expiry_date)
        })
        remaining -= alloc_qty

    if remaining > 0:
        # Return None — let the caller emit a proper user-facing error.
        return None

    return allocated

@frappe.whitelist()
def place_order(items=None, address=None, address_id=None, phone=None, notes=None, payment_method=None, quotation_id=None):
    try:
        if items and isinstance(items, str):
            import json
            items = json.loads(items)
            
        user = frappe.session.user
        if user == "Guest":
            return {"status": "error", "message": "Must be logged in to create an order"}
            
        # Get Customer
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
        
        if not customer:
            customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
            
        if not customer:
            customer_doc = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": user_doc.full_name,
                "customer_type": "Individual",
                "customer_group": "Commercial",
                "territory": "All Territories",
                "mobile_no": phone,
                "email_id": user
            })
            customer_doc.insert(ignore_permissions=True)
            customer = customer_doc.name
                
        if quotation_id:
            quot = frappe.get_doc("Quotation", quotation_id)
            if quot.docstatus == 0:
                quot.flags.ignore_permissions = True
                quot.submit()
            
            from frappe.model.mapper import get_mapped_doc
            so = frappe.get_doc(get_mapped_doc("Quotation", quotation_id, {
                "Quotation": {
                    "doctype": "Sales Order"
                },
                "Quotation Item": {
                    "doctype": "Sales Order Item",
                    "field_map": {
                        "name": "quotation_item",
                        "parent": "quotation_to"
                    }
                }
            }, ignore_permissions=True))
            
            # Stock check and assign warehouse
            for item in so.items:
                actual_qty = 0
                if item.warehouse:
                    actual_qty = frappe.db.get_value("Bin", {"item_code": item.item_code, "warehouse": item.warehouse}, "actual_qty") or 0
                    
                if not item.warehouse or actual_qty < item.qty:
                    warehouse_data = frappe.db.sql("""
                        SELECT warehouse, actual_qty FROM tabBin
                        WHERE item_code = %s AND actual_qty >= %s
                        LIMIT 1
                    """, (item.item_code, item.qty))
                    
                    if warehouse_data:
                        item.warehouse = warehouse_data[0][0]
                        actual_qty = warehouse_data[0][1]
                    else:
                        return {"status": "error", "message": f"Item {item.item_code} is out of stock."}
            so.delivery_date = frappe.utils.add_days(frappe.utils.today(), 1)
            so.customer = customer
        else:
            so = frappe.new_doc("Sales Order")
            so.customer = customer
            so.delivery_date = frappe.utils.add_days(frappe.utils.today(), 1)
            
            company = frappe.defaults.get_user_default("Company") or frappe.db.get_value("Company", None, "name")
            so.company = company
            
            for item in (items or []):
                item_code = item.get("item_code")
                qty = item.get("qty")
                
                # Stock check
                warehouse_data = frappe.db.sql("""
                    SELECT warehouse, actual_qty FROM tabBin
                    WHERE item_code = %s AND actual_qty >= %s
                    LIMIT 1
                """, (item_code, qty))
                
                warehouse = warehouse_data[0][0] if warehouse_data else None
                actual_qty = warehouse_data[0][1] if warehouse_data else 0
                
                if not warehouse:
                    create_admin_notification("Out of Stock Warning", f"Attempted to order {qty} of {item_code} but it is out of stock.", priority="Alert")
                    return {"status": "error", "message": f"Item {item_code} is out of stock."}
                elif (actual_qty - qty) <= 10:
                    create_admin_notification("Low Stock Alert", f"Item {item_code} stock will drop to {actual_qty - qty} after this order.", priority="Warning")
                
                so.append("items", {
                    "item_code": item_code,
                    "qty": qty,
                    "rate": item.get("rate"),
                    "warehouse": warehouse
                })
        
        if address_id:
            so.customer_address = address_id
            # Build address string for comment backwards compatibility
            addr_doc = frappe.get_doc("Address", address_id)
            address = f"{addr_doc.address_line1}\\n{addr_doc.address_line2 or ''}\\n{addr_doc.city}, {addr_doc.state or ''} {addr_doc.pincode or ''}".strip()
            if not phone and addr_doc.phone:
                phone = addr_doc.phone
                
        if address_id:
            so.customer_address = address_id
            addr_doc = frappe.get_doc("Address", address_id)
            address = f"{addr_doc.address_line1}\\n{addr_doc.address_line2 or ''}\\n{addr_doc.city}, {addr_doc.state or ''} {addr_doc.pincode or ''}".strip()
            if not phone and addr_doc.phone:
                phone = addr_doc.phone
                
        so.add_comment("Comment", f"Delivery Address: {address}\\nPhone: {phone}\\nNotes: {notes}\\nPayment: {payment_method}")
            
        so.flags.ignore_permissions = True
        so.insert()
        so.submit()
        
        # Save phone if missing
        if phone:
            current_phone = frappe.db.get_value("Customer", customer, "mobile_no")
            if not current_phone:
                frappe.db.set_value("Customer", customer, "mobile_no", phone)
                
        # Save or update address only if address_id was not used
        if address and not address_id:
            lines = [l.strip() for l in address.split('\n') if l.strip()]
            new_line1 = lines[0] if lines else address[:140]
            new_city = lines[1] if len(lines) > 1 else "Unknown"
            import re
            pincode_match = re.search(r'\b\d{7}\b', address)
            new_pincode = pincode_match.group() if pincode_match else ""

            existing_links = frappe.db.sql("""
                SELECT parent FROM `tabDynamic Link`
                WHERE link_doctype='Customer' AND link_name=%s AND parenttype='Address'
            """, (customer,))
            
            if existing_links:
                address_names = [r[0] for r in existing_links]
                primary_address_name = frappe.db.get_value("Address", {"name": ["in", address_names], "is_primary_address": 1}, "name")
                
                addr_doc = frappe.get_doc("Address", primary_address_name or address_names[0])
                addr_doc.address_line1 = new_line1
                addr_doc.city = new_city
                if new_pincode: addr_doc.pincode = new_pincode
                addr_doc.phone = phone
                addr_doc.is_primary_address = 1
                addr_doc.flags.ignore_permissions = True
                addr_doc.save()
            else:
                new_address = frappe.new_doc("Address")
                customer_name = frappe.db.get_value("Customer", customer, "customer_name")
                new_address.address_title = f"{customer_name} - Home"
                new_address.address_type = "Shipping"
                new_address.address_line1 = new_line1
                new_address.city = new_city
                if new_pincode: new_address.pincode = new_pincode
                new_address.phone = phone
                new_address.is_primary_address = 1
                new_address.append("links", {
                    "link_doctype": "Customer",
                    "link_name": customer
                })
                new_address.flags.ignore_permissions = True
                new_address.insert()
        
        create_admin_notification("New Sales Order", f"New Sales Order {so.name} placed by {customer}.", "Sales Order", so.name, priority="Info")
        
        if payment_method == "Online Payment":
            original_user = frappe.session.user
            frappe.set_user("Administrator")
            try:
                from frappe.model.mapper import get_mapped_doc
            
                si = frappe.get_doc(get_mapped_doc("Sales Order", so.name, {
                    "Sales Order": {
                        "doctype": "Sales Invoice"
                    },
                    "Sales Order Item": {
                        "doctype": "Sales Invoice Item",
                        "field_map": {
                            "name": "so_detail",
                            "parent": "sales_order",
                        }
                    }
                }, ignore_permissions=True))
                si.update_stock = 1
                
                original_items = si.get("items")
                si.set("items", [])
                
                for item in original_items:
                    has_batch = frappe.db.get_value("Item", item.item_code, "has_batch_no")
                    if has_batch:
                        delivery_date = str(si.posting_date or frappe.utils.today())
                        allocated = get_fefo_batches(item.item_code, item.warehouse, item.qty, delivery_date)
                        if allocated is None:
                            frappe.throw(
                                f"No valid batch available for <b>{item.item_name or item.item_code}</b> "
                                f"that expires after the invoice date <b>{delivery_date}</b>. "
                                f"Please contact the pharmacy to check batch availability."
                            )
                        for alloc in allocated:
                            item_dict = item.as_dict()
                            item_dict.update({
                                "name": None,
                                "qty": alloc["qty"],
                                "batch_no": alloc["batch_no"]
                            })
                            si.append("items", item_dict)
                    else:
                        si.append("items", item.as_dict())
                
                si.flags.ignore_permissions = True
                si.insert()
                si.submit()
                
                pe = frappe.get_doc(get_mapped_doc("Sales Invoice", si.name, {
                    "Sales Invoice": {
                        "doctype": "Payment Entry",
                        "field_map": {
                            "party_account_currency": "payment_currency"
                        }
                    }
                }, ignore_permissions=True))
                pe.party_type = "Customer"
                pe.party = customer
                pe.payment_type = "Receive"
                pe.paid_to = frappe.db.get_value("Account", {"account_type": "Cash", "company": company}, "name")
                pe.paid_amount = si.grand_total
                pe.received_amount = si.grand_total
                pe.flags.ignore_permissions = True
                pe.insert()
                pe.submit()
                
                create_admin_notification("Payment Received", f"Payment received for {so.name} ({si.grand_total}).", "Payment Entry", pe.name, priority="Info")
            finally:
                frappe.set_user(original_user)
            
        frappe.db.commit()
        return {"status": "success", "order_id": so.name, "estimated_delivery": so.delivery_date}
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error("Order Placement Failed", frappe.get_traceback())
        return {"status": "error", "message": "An operational error occurred while processing your order. Please try again or contact support."}


# ─────────────────────────────────────────────────────────────
# ADMIN – Dashboard & search
# ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_dashboard_data():
    today = frappe.utils.today()

    sales_today = frappe.db.sql(
        "SELECT IFNULL(sum(grand_total),0) FROM `tabSales Order` WHERE docstatus=1 AND transaction_date=%s", (today,)
    )
    
    pending_orders = frappe.db.count("Sales Order", {"docstatus": 1, "status": ["in", ["To Deliver and Bill", "To Deliver", "To Bill"]]})
    total_invoices = frappe.db.count("Sales Invoice", {"docstatus": 1})
    
    low_stock = frappe.db.sql("SELECT COUNT(*) FROM (SELECT item_code, SUM(actual_qty) as qty FROM tabBin GROUP BY item_code HAVING qty <= 10) as t")[0][0]
    
    near_expiry = frappe.db.sql(
        "SELECT COUNT(*) FROM `tabMedicine` WHERE expiry_date BETWEEN %s AND %s AND status='Active'",
        (today, frappe.utils.add_days(today, 30))
    )[0][0]
    
    total_customers = frappe.db.count("Customer")
    
    return {
        "sales_today": float(sales_today[0][0] or 0),
        "pending_orders": pending_orders,
        "total_invoices": total_invoices,
        "low_stock": int(low_stock),
        "near_expiry": int(near_expiry),
        "total_customers": total_customers,
    }


@frappe.whitelist(allow_guest=True)
def search_everything(query):
    medicines = frappe.get_all(
        "Medicine",
        filters={"medicine_name": ["like", f"%{query}%"]},
        fields=["name", "medicine_name", "category"],
        limit=5,
    )
    customers = frappe.get_all(
        "Customer",
        filters={"customer_name": ["like", f"%{query}%"]},
        fields=["name", "customer_name"],
        limit=5,
    )
    return {"medicines": medicines, "customers": customers}

# ─────────────────────────────────────────────────────────────
# CUSTOMER ORDERS API
# ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_customer_orders():
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Must be logged in to view orders"}
        
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
        
    if not customer:
        return {"status": "success", "orders": []}
        
    orders = frappe.get_all("Sales Order",
        filters={"customer": customer, "docstatus": ["<", 2]},
        fields=["name", "transaction_date", "status", "delivery_status", "billing_status", "grand_total"],
        order_by="creation desc"
    )
    
    for o in orders:
        items = frappe.db.sql('''
            SELECT 
                i.item_code, i.item_name, i.qty, i.rate, i.amount,
                m.image, m.medicine_name, m.generic_name
            FROM `tabSales Order Item` i
            LEFT JOIN `tabMedicine` m ON i.item_code = m.item
            WHERE i.parent = %s
        ''', o.name, as_dict=1)
        o["items"] = items
        
        # Calculate derived status
        if o.status == "Cancelled":
            o["payment_status"] = "Failed"
            o["order_status"] = "Cancelled"
        else:
            if o.billing_status == "Fully Billed":
                o["payment_status"] = "Paid"
            elif o.billing_status == "Partly Billed":
                o["payment_status"] = "Partially Paid"
            else:
                o["payment_status"] = "Pending"
                
            # Maps ERPNext status to consumer friendly terms
            if o.delivery_status == "Fully Delivered":
                o["order_status"] = "Delivered"
            elif o.status == "To Deliver":
                o["order_status"] = "Processing"
            elif o.status == "To Deliver and Bill":
                o["order_status"] = "Processing"
            else:
                o["order_status"] = "Confirmed"
                
    return {"status": "success", "orders": orders}

# ─────────────────────────────────────────────────────────────
# CART & QUOTATION API
# ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def sync_cart(items=None):
    if isinstance(items, str):
        import json
        items = json.loads(items)
        
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Must be logged in"}
        
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
        
    if not customer:
        return {"status": "error", "message": "Customer not found"}
        
    # Find existing draft quotation
    quotation_name = frappe.db.get_value("Quotation", {"party_name": customer, "docstatus": 0}, "name")
    
    is_new = False
    if quotation_name:
        quotation = frappe.get_doc("Quotation", quotation_name)
    else:
        quotation = frappe.new_doc("Quotation")
        quotation.quotation_to = "Customer"
        quotation.party_name = customer
        company = frappe.defaults.get_user_default("Company") or frappe.db.get_value("Company", None, "name")
        quotation.company = company
        quotation.order_type = "Sales"
        quotation.currency = frappe.db.get_value("Company", company, "default_currency") or "INR"
        is_new = True

    if items is not None:
        # Replace items entirely based on frontend state
        quotation.set("items", [])
        for item in items:
            item_code = item.get("item_code")
            qty = item.get("qty")
            
            rate = frappe.db.get_value("Item Price", {"item_code": item_code, "price_list": "Standard Selling"}, "price_list_rate")
            if not rate:
                rate = frappe.db.get_value("Item", item_code, "standard_rate") or 0.0
            
            quotation.append("items", {
                "item_code": item_code,
                "qty": qty,
                "rate": rate,
            })
            
        if is_new:
            if len(quotation.get("items", [])) > 0:
                quotation.insert(ignore_permissions=True)
        else:
            quotation.save(ignore_permissions=True)
        
    # Return formatted cart for frontend
    cart_items = []
    for item in quotation.items:
        medicine = frappe.db.get_value("Medicine", {"item": item.item_code}, ["name", "medicine_name", "image"], as_dict=True)
        if medicine:
            # Calculate Available to Promise stock for the cart
            actual_qty = frappe.db.sql("""
                SELECT IFNULL(SUM(actual_qty), 0) - IFNULL(SUM(reserved_qty), 0)
                FROM `tabBin` WHERE item_code = %s
            """, item.item_code)[0][0] or 0

            cart_items.append({
                "medicine": {
                    "name": medicine.name,
                    "medicine_name": medicine.medicine_name,
                    "item_code": item.item_code,
                    "selling_price": item.rate,
                    "image": medicine.image,
                    "available_stock": float(actual_qty)
                },
                "quantity": item.qty
            })
            
    return {"status": "success", "cart_items": cart_items, "quotation": quotation.name}


@frappe.whitelist()
def buy_now(item_code, qty):
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Must be logged in to use Buy Now"}
        
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
        
    if not customer:
        return {"status": "error", "message": "Customer not found"}
        
    quotation = frappe.new_doc("Quotation")
    quotation.quotation_to = "Customer"
    quotation.party_name = customer
    company = frappe.defaults.get_user_default("Company") or frappe.db.get_value("Company", None, "name")
    quotation.company = company
    quotation.currency = frappe.db.get_value("Company", company, "default_currency") or "INR"
    quotation.order_type = "Sales"
    
    rate = frappe.db.get_value("Item Price", {"item_code": item_code, "price_list": "Standard Selling"}, "price_list_rate")
    if not rate:
        rate = frappe.db.get_value("Item", item_code, "standard_rate") or 0.0
        
    quotation.append("items", {
        "item_code": item_code,
        "qty": qty,
        "rate": rate,
    })
    quotation.insert(ignore_permissions=True)
    
    return {"status": "success", "quotation": quotation.name}


def validate_batch_expiry(doc, method):
    from frappe.utils import getdate, today
    for item in doc.items:
        if item.batch_no:
            expiry_date = frappe.db.get_value("Batch", item.batch_no, "expiry_date")
            if expiry_date and getdate(expiry_date) < getdate(today()):
                frappe.throw(f"Batch {item.batch_no} for item {item.item_name} has expired on {expiry_date}. You cannot sell expired medicine.")

def sync_item_to_medicine(doc, method):
    if frappe.flags.in_medicine_sync:
        return
        
    if doc.item_group != "Medicine":
        return
        
    medicine_name = frappe.db.get_value("Medicine", {"item": doc.name}, "name")
    
    frappe.flags.in_item_sync = True
    try:
        selling_price = frappe.db.get_value("Item Price", {"item_code": doc.name, "price_list": "Standard Selling"}, "price_list_rate") or doc.standard_rate
        
        if not medicine_name:
            med = frappe.new_doc("Medicine")
            med.item = doc.name
            med.medicine_name = doc.item_name
            med.unit = doc.stock_uom or "Nos"
            med.status = "Active" if not doc.disabled else "Inactive"
            med.description = doc.description
            if selling_price: med.selling_price = selling_price
            if doc.valuation_rate: med.purchase_price = doc.valuation_rate
            med.insert(ignore_permissions=True, ignore_mandatory=True)
        else:
            med = frappe.get_doc("Medicine", medicine_name)
            med.medicine_name = doc.item_name
            med.unit = doc.stock_uom or "Nos"
            med.status = "Active" if not doc.disabled else "Inactive"
            med.description = doc.description
            if selling_price: med.selling_price = selling_price
            if doc.valuation_rate: med.purchase_price = doc.valuation_rate
            med.save(ignore_permissions=True)
    finally:
        frappe.flags.in_item_sync = False

def sync_item_price_to_medicine(doc, method):
    if doc.price_list == "Standard Selling":
        medicine_name = frappe.db.get_value("Medicine", {"item": doc.item_code}, "name")
        if medicine_name:
            frappe.flags.in_item_sync = True
            try:
                frappe.db.set_value("Medicine", medicine_name, "selling_price", doc.price_list_rate)
            finally:
                frappe.flags.in_item_sync = False

# ─────────────────────────────────────────────────────────────
# ADDRESS API
# ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_customer_addresses():
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Must be logged in"}
        
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
    if not customer:
        return {"status": "error", "message": "Customer not found"}
        
    addresses = frappe.get_all(
        "Dynamic Link", 
        filters={"link_doctype": "Customer", "link_name": customer, "parenttype": "Address"}, 
        pluck="parent"
    )
    
    mobile_no = frappe.db.get_value("Customer", customer, "mobile_no")
    
    if not addresses:
        return {"status": "success", "addresses": [], "mobile_no": mobile_no}
        
    address_docs = frappe.get_all(
        "Address",
        filters={"name": ["in", addresses]},
        fields=["name", "address_title", "address_line1", "address_line2", "city", "state", "pincode", "is_primary_address", "phone"],
        order_by="is_primary_address desc"
    )
    return {"status": "success", "addresses": address_docs, "mobile_no": mobile_no}

@frappe.whitelist()
def create_address(address_title="", address_line1="", address_line2="", city="", state="", country="", pincode="", phone="", is_primary_address=0):
    user = frappe.session.user
    if user == "Guest": return {"status": "error", "message": "Must be logged in"}
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
    if not customer: return {"status": "error", "message": "Customer not found"}
        
    if int(is_primary_address) == 1:
        # unset others
        frappe.db.sql("""UPDATE `tabAddress` a JOIN `tabDynamic Link` l ON a.name=l.parent 
                         SET a.is_primary_address=0 
                         WHERE l.link_doctype='Customer' AND l.link_name=%s""", (customer,))
                         
    address = frappe.new_doc("Address")
    address.address_title = address_title or frappe.db.get_value("Customer", customer, "customer_name")
    address.address_type = "Shipping"
    address.address_line1 = address_line1
    address.address_line2 = address_line2
    address.city = city
    address.state = state
    address.country = country
    address.pincode = pincode
    address.phone = phone
    address.is_primary_address = int(is_primary_address)
    address.append("links", {"link_doctype": "Customer", "link_name": customer})
    address.insert(ignore_permissions=True)
    return {"status": "success", "address_id": address.name}

@frappe.whitelist()
def update_address(address_id, address_title="", address_line1="", address_line2="", city="", state="", country="", pincode="", phone="", is_primary_address=0):
    user = frappe.session.user
    if user == "Guest": return {"status": "error", "message": "Must be logged in"}
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
    if not customer: return {"status": "error", "message": "Customer not found"}
    
    # verify ownership
    exists = frappe.db.exists("Dynamic Link", {"parent": address_id, "link_doctype": "Customer", "link_name": customer})
    if not exists: return {"status": "error", "message": "Address not found or unauthorized"}
    
    if int(is_primary_address) == 1:
        frappe.db.sql("""UPDATE `tabAddress` a JOIN `tabDynamic Link` l ON a.name=l.parent 
                         SET a.is_primary_address=0 
                         WHERE l.link_doctype='Customer' AND l.link_name=%s""", (customer,))
                         
    doc = frappe.get_doc("Address", address_id)
    if address_title: doc.address_title = address_title
    if address_line1: doc.address_line1 = address_line1
    if address_line2 is not None: doc.address_line2 = address_line2
    if city: doc.city = city
    if state is not None: doc.state = state
    if country is not None: doc.country = country
    if pincode is not None: doc.pincode = pincode
    if phone is not None: doc.phone = phone
    doc.is_primary_address = int(is_primary_address)
    doc.save(ignore_permissions=True)
    return {"status": "success"}

@frappe.whitelist()
def delete_address(address_id):
    user = frappe.session.user
    if user == "Guest": return {"status": "error", "message": "Must be logged in"}
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
    if not customer: return {"status": "error", "message": "Customer not found"}
    
    exists = frappe.db.exists("Dynamic Link", {"parent": address_id, "link_doctype": "Customer", "link_name": customer})
    if not exists: return {"status": "error", "message": "Address not found or unauthorized"}
    
    frappe.delete_doc("Address", address_id, ignore_permissions=True)
    return {"status": "success"}

@frappe.whitelist()
def set_default_address(address_id):
    user = frappe.session.user
    if user == "Guest": return {"status": "error", "message": "Must be logged in"}
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
    if not customer: return {"status": "error", "message": "Customer not found"}
    
    exists = frappe.db.exists("Dynamic Link", {"parent": address_id, "link_doctype": "Customer", "link_name": customer})
    if not exists: return {"status": "error", "message": "Address not found or unauthorized"}
    
    frappe.db.sql("""UPDATE `tabAddress` a JOIN `tabDynamic Link` l ON a.name=l.parent 
                     SET a.is_primary_address=0 
                     WHERE l.link_doctype='Customer' AND l.link_name=%s""", (customer,))
    frappe.db.set_value("Address", address_id, "is_primary_address", 1)
    return {"status": "success"}

@frappe.whitelist()
def update_customer_profile(phone):
    user = frappe.session.user
    if user == "Guest": return {"status": "error", "message": "Must be logged in"}
    customer = frappe.db.get_value("Customer", {"email_id": user}, "name")
    if not customer:
        user_doc = frappe.get_doc("User", user)
        customer = frappe.db.get_value("Customer", {"customer_name": user_doc.full_name}, "name")
    if not customer: return {"status": "error", "message": "Customer not found"}
    
    frappe.db.set_value("Customer", customer, "mobile_no", phone)
    return {"status": "success"}
