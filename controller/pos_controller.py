from odoo.http import request
from odoo import http
import logging

_logger = logging.getLogger(__name__)

class save_quotation(http.Controller):

    @http.route(['/pos/save/quotation'], type='json', auth="user", website=True)
    def bus_update_data(self, json_order):
        res = request.env["pos.quotation"].save_quotation(json_order)
        return res


