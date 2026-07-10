import frappe
import os

def setup_sales_invoice_print_format():
    format_name = "Pharmacy Sales Invoice"
    
    # Read HTML content
    current_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(current_dir, "sales_invoice.html")
    
    with open(html_path, "r") as f:
        html_content = f.read()

    # Create or update Print Format
    if frappe.db.exists("Print Format", format_name):
        doc = frappe.get_doc("Print Format", format_name)
    else:
        doc = frappe.new_doc("Print Format")
        doc.name = format_name
        doc.print_format_name = format_name
        doc.doc_type = "Sales Invoice"
        doc.custom_format = 1
        doc.module = "Hospital Pharmacy"
        
    doc.html = html_content
    doc.align_labels_right = 0
    doc.show_section_headings = 0
    doc.line_breaks = 0
    
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    print(f"Print format '{format_name}' successfully created/updated.")

if __name__ == "__main__":
    frappe.init(site="hospital.com", sites_path="/home/anirudh-b/hospital-bench/sites")
    frappe.connect()
    try:
        setup_sales_invoice_print_format()
    finally:
        frappe.destroy()
