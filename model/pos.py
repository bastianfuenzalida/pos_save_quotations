from odoo import api, models, fields, registry
import logging

_logger = logging.getLogger(__name__)


class pos_shop(models.Model):
    _name = "pos.shop"

    name = fields.Char('Name', required=1)
    image = fields.Binary('Image')


class pos_quotation(models.Model):
    _name = "pos.quotation"
    _order = 'create_date DESC'

    name = fields.Char('Name')
    uid = fields.Char('Order ID', readonly=1)
    session_id = fields.Many2one('pos.session', 'Session')
    datas = fields.Text('Datas')
    shop_ids = fields.Many2many('pos.shop', 'pos_quotation_pos_shop_rel', 'quotation_id', 'shop_id','Shop', required=1)
    user_id = fields.Many2one('res.users', 'Create by', required=1)
    create_date = fields.Datetime('Create at', readonly=1)
    partner_id = fields.Many2one('res.partner', 'Customer')
    state = fields.Selection([
        ('waiting_transfer', 'Waiting Transfer'),
        ('delivery_success', 'Delivery Success'),
        ('removed', 'Removed')
    ], default='waiting_transfer', string='State')
    amount_paid = fields.Float('Amount paid')
    amount_total = fields.Float('Amount Total')
    note = fields.Text('Note')

    @api.model
    def create(self, vals):
        vals['name'] = self.env['ir.sequence'].next_by_code('pos.quotation')
        return super(pos_quotation, self).create(vals)

    @api.multi
    def remove_pos_quotation(self):
        return self.write({'state': 'removed'})

    @api.model
    def get_quotations(self, shop_id):
        values = []
        records = self.search([('state', '=', 'waiting_transfer')])
        for record in records:
            shop_ids = []
            for shop in record.shop_ids:
                shop_ids.append(shop.id)
            if shop_id in shop_ids:
                val = record.read()[0]
                if val.has_key('partner_id') and val['partner_id']:
                    val['partner_id'] = self.env['res.partner'].browse(val['partner_id'][0]).read()[0]
                val['datas'] = eval(val['datas'])
                values.append(val)
        return values


    @api.multi
    def save_quotation(self, json_order):
        _logger.info(json_order)
        quotations = self.search([('uid', '=', json_order['uid']), ('state', '=', 'waiting_transfer')])
        value = {
            'user_id': json_order['user_id'],
            'uid': json_order['uid'],
            'session_id': json_order['pos_session_id'],
            'partner_id': json_order['partner_id'],
            'amount_paid': json_order['amount_paid'],
            'shop_ids': [(6, 0, json_order['shop_ids_selected'])],
            'amount_total': json_order['amount_total'],
            'datas': json_order,
            'note': json_order['note'] if json_order.has_key('note') and json_order['note'] else ''
        }
        if quotations:
            quotations.write(value)
        else:
            self.create(value)
        return 1


class pos_config(models.Model):
    _inherit = 'pos.config'

    allow_save_quotation = fields.Boolean('Allow save quotation')
    allow_load_data = fields.Boolean('Allow load quotations')
    delete_after_save = fields.Boolean('Delete order after save quotation')
    send_mail_after_save = fields.Boolean('Send email after save quotation')
    shop_id = fields.Many2one('pos.shop', 'Shop')


class pos_order(models.Model):
    _inherit = "pos.order"

    quotation_id = fields.Many2one('pos.quotation', 'Quotation', readonly=1)

    @api.model
    def _order_fields(self, ui_order):
        res = super(pos_order, self)._order_fields(ui_order)
        if ui_order.has_key('quotation_name') and ui_order.get('quotation_name'):
            quotations = self.env['pos.quotation'].search([('name', '=', ui_order.get('quotation_name'))])
            if quotations:
                res.update({
                    'quotation_id': quotations[0].id
                })
                quotations.write({'state': 'delivery_success'})
        if ui_order.has_key('note') and ui_order.get('note'):
            res.update({
                'note': ui_order.get('note'),
            })
        return res