import frappe
import os

def setup_print_format(format_name, doc_type, html_filename):
    # Read HTML content
    current_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(current_dir, html_filename)
    
    with open(html_path, "r") as f:
        html_content = f.read()

    # Create or update Print Format
    if frappe.db.exists("Print Format", format_name):
        doc = frappe.get_doc("Print Format", format_name)
    else:
        doc = frappe.new_doc("Print Format")
        doc.name = format_name
        doc.print_format_name = format_name
        doc.doc_type = doc_type
        doc.custom_format = 1
        doc.module = "Hospital Pharmacy"
        
    doc.html = html_content
    doc.align_labels_right = 0
    doc.show_section_headings = 0
    doc.line_breaks = 0
    
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    print(f"Print format '{format_name}' successfully created/updated.")

def setup_all():
    setup_print_format("Pharmacy Sales Invoice", "Sales Invoice", "sales_invoice.html")
    setup_print_format("Pharmacy Delivery Note", "Delivery Note", "delivery_note.html")
    setup_print_format("Pharmacy Sales Order", "Sales Order", "sales_order.html")
    setup_print_format("Pharmacy Quotation", "Quotation", "quotation.html")
    setup_print_format("Pharmacy Purchase Invoice", "Purchase Invoice", "purchase_invoice.html")
    setup_print_format("Pharmacy Purchase Order", "Purchase Order", "purchase_order.html")
    setup_print_format("Pharmacy Purchase Receipt", "Purchase Receipt", "purchase_receipt.html")
    setup_print_format("Pharmacy Payment Entry", "Payment Entry", "payment_entry.html")
    setup_print_format("Pharmacy Stock Entry", "Stock Entry", "stock_entry.html")
    # Using 'Batch' doc_type as the base for medicine label since it carries item + expiry + batch
    setup_print_format("Pharmacy Medicine Label", "Batch", "medicine_label.html")

if __name__ == "__main__":
    frappe.init(site="hospital.com", sites_path="/home/anirudh-b/hospital-bench/sites")
    frappe.connect()
    try:
        setup_all()
    finally:
        frappe.destroy()
