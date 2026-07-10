# Copyright (c) 2026, Anirudh B and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate

class Medicine(Document):
	def validate(self):
		self.validate_prices()
		self.validate_expiry()
		
	def on_update(self):
		if frappe.flags.in_item_sync:
			return
		self.sync_with_item()

	def validate_prices(self):
		if self.selling_price and self.purchase_price and self.selling_price < self.purchase_price:
			frappe.throw("Selling price cannot be lower than purchase price")
		if self.mrp and self.selling_price and self.mrp < self.selling_price:
			frappe.throw("MRP cannot be lower than selling price")

	def validate_expiry(self):
		if self.expiry_date and getdate(self.expiry_date) < getdate():
			frappe.throw("Expiry date must be in the future")

	def sync_with_item(self):
		self.ensure_item_group()
		
		# Ensure we have an item code
		item_code = self.item or self.name or frappe.generate_hash(length=10)
		
		try:
			is_new = False
			if frappe.db.exists("Item", item_code):
				item = frappe.get_doc("Item", item_code)
			else:
				item = frappe.new_doc("Item")
				item.item_code = item_code
				item.is_stock_item = 1
				item.stock_uom = self.unit or "Nos"
				is_new = True

			# Update properties
			item.item_name = self.medicine_name
			item.item_group = "Medicine"
			item.has_batch_no = 1
			item.has_expiry_date = 1
			item.create_new_batch = 1
			item.valuation_rate = self.purchase_price
			item.standard_rate = self.selling_price
			item.description = self.description
			
			# Bypass strict Frappe requirements for Item
			item.flags.ignore_permissions = True
			item.flags.ignore_mandatory = True
			
			frappe.flags.in_medicine_sync = True
			try:
				if is_new:
					item.insert()
				else:
					item.save()
			finally:
				frappe.flags.in_medicine_sync = False

			# Link back to medicine if not linked yet
			if self.item != item.name:
				frappe.db.set_value("Medicine", self.name, "item", item.name, update_modified=False)
				self.db_set("item", item.name, update_modified=False)

		except Exception as e:
			frappe.log_error(message=frappe.get_traceback(), title="Medicine Item Sync Failed")
			frappe.throw(f"Failed to synchronize ERPNext Item for this Medicine. Error: {str(e)}")
			
	def ensure_item_group(self):
		if not frappe.db.exists("Item Group", "Medicine"):
			parent = frappe.db.get_value("Item Group", {"is_group": 1}, "name")
			frappe.get_doc({
				"doctype": "Item Group",
				"item_group_name": "Medicine",
				"parent_item_group": parent
			}).insert(ignore_permissions=True)

def on_bin_update(doc, method):
	medicine = frappe.db.get_value("Medicine", {"item": doc.item_code}, "name")
	if medicine:
		total_stock = frappe.db.sql("SELECT sum(actual_qty) FROM tabBin WHERE item_code=%s", (doc.item_code,))[0][0] or 0
		frappe.db.set_value("Medicine", medicine, "current_stock", total_stock)

@frappe.whitelist()
def add_stock(medicine, qty, batch_no=None, expiry_date=None):
	qty = float(qty)
	if qty <= 0:
		frappe.throw("Quantity must be positive")
	
	med_doc = frappe.get_doc("Medicine", medicine)
	item_code = med_doc.item
	if not item_code:
		frappe.throw("Item not linked to this medicine")
	
	# Find a valid warehouse
	company = frappe.defaults.get_user_default("Company") or frappe.db.get_value("Company", None, "name")
	warehouse = frappe.db.get_value("Warehouse", {"is_group": 0, "company": company}, "name")
	if not warehouse:
		warehouse = frappe.db.get_value("Warehouse", {"is_group": 0}, "name")
		
	if not warehouse:
		frappe.throw("No warehouse found to receive stock. Please create one.")
	
	se = frappe.new_doc("Stock Entry")
	se.stock_entry_type = "Material Receipt"
	
	item_dict = {
		"item_code": item_code,
		"qty": qty,
		"t_warehouse": warehouse,
		"valuation_rate": med_doc.purchase_price or 1.0,
	}
	
	if batch_no:
		if not frappe.db.exists("Batch", batch_no):
			if not expiry_date:
				frappe.throw("Expiry Date is required to create a new batch.")
			batch = frappe.new_doc("Batch")
			batch.batch_id = batch_no
			batch.item = item_code
			batch.expiry_date = expiry_date
			batch.flags.ignore_permissions = True
			batch.insert()
			
		item_dict["batch_no"] = batch_no
		
	se.append("items", item_dict)
	se.insert(ignore_permissions=True)
	se.submit()
	
	return se.name

