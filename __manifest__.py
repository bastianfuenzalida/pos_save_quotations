{
    'name': "POS Send Order to other store",
    'version': '1.0',
    'category': 'Point of Sale',
    'author': 'TL Technology',
    'sequence': 0,
    'summary': 'POS Send Order to other store',
    'description': """
    POS Send Order to other store
    ....
    """,
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence.xml',
        '__import__/template.xml',
        'view/pos.xml',
    ],
    'qweb': [
        'static/src/xml/*.xml'
    ],
    'demo': ['demo/shop_data.xml'],
    'price': '50',
    'website': 'http://posodoo.com',
    "currency": 'EUR',
    'application': True,
    'images': ['static/description/icon.png'],
    'support': 'thanhchatvn@gmail.com'
}
