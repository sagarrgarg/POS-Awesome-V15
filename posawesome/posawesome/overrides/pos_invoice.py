"""Custom POS Invoice class that integrates POS Awesome shift logic."""

from erpnext.accounts.doctype.pos_invoice.pos_invoice import POSInvoice as ERPNextPOSInvoice

from posawesome.posawesome.api.invoice import validate_shift


class CustomPOSInvoice(ERPNextPOSInvoice):
    """Override ERPNext POS Invoice to respect POS Awesome opening shifts."""

    def validate_pos_opening_entry(self):
        """Allow POS invoices when a POS Awesome shift is open.

        If the invoice references ``posa_pos_opening_shift`` we validate that
        shift using POS Awesome's rules and skip the standard ERPNext
        validation for ``POS Opening Entry``. Otherwise, fall back to the
        default ERPNext behaviour.
        """

        if getattr(self, "posa_pos_opening_shift", None):
            # Use existing shift validation from POS Awesome
            validate_shift(self)
            return

        # No POS Awesome shift - use ERPNext's validation
        super().validate_pos_opening_entry()

    def validate_is_pos_using_sales_invoice(self):
        """Let POS Awesome shift invoices ignore POS Settings.invoice_type.

        Only ERPNext v16+ calls this (v15 has no such check). POS Awesome picks
        POS Invoice per POS Profile and consolidates at POS Closing Shift, so
        for its invoices behave as in "POS Invoice" mode: no "Sales Invoice
        mode is activated" error and no instant return Sales Invoice on submit.
        """

        if getattr(self, "posa_pos_opening_shift", None):
            # on_submit reads this to decide on the instant return Sales Invoice
            self.invoice_type_in_pos = "POS Invoice"
            return

        super().validate_is_pos_using_sales_invoice()
