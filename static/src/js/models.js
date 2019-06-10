odoo.define('pos_save_quotations_model', function (require) {
    var models = require('point_of_sale.models');
    var session = require('web.session');
    var Model = require('web.DataModel');
    models.load_models([
        {
            model: 'pos.shop',
            fields: [],
            loaded: function (self, shops) {
                self.shops = shops;
            },
        }
    ]);

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _save_to_server: function (orders, options) {
            var res = _super_posmodel._save_to_server.apply(this, arguments);
            for (var i=0; i < orders.length; i ++) {
                var order = orders[i];
                if (order.data.quotation_name) {
                    var quotation_name = order.data.quotation_name;
                    var quotation = this.db.quotations.find(function (quotation) {
                        return quotation.name =quotation_name;
                    })
                    var quotations = [];
                    if (quotation) {
                        for (var x=0; x < this.db.quotations.length; x ++) {
                            if (this.db.quotations[x].name != quotation.name) {
                                quotations.push(this.db.quotations[x]);
                            }
                        }
                    }
                    this.db.quotations = quotations;
                }
            }
            return res;
        },
        save_quotation_to_backend: function (json_order) {
            var self = this;
            var sending = function () {
                return session.rpc("/pos/save/quotation", {json_order: json_order});
            };
            sending().fail(function (error, e) {
                console.log(error);
                console.log(e);
                self.quotations_send_fail[json_order.uid] = json_order;
            }).done(function (result) {
                console.log(result);
            })
        },

        get_order_by_uid: function (uid) {
            var orders = this.get('orders').models;
            var order = orders.find(function (order) {
                return order.uid == uid;
            });
            return order;
        },

        session_info: function () {
            var user = this.cashier || this.user;
            if (this.config.bus_id) {
                return {
                    'bus_id': this.config.bus_id[0],
                    'user': {
                        'id': user.id,
                        'name': user.name,
                    },
                    'pos': {
                        'id': this.config.id,
                        'name': this.config.name,
                    },
                    'date': new Date().toLocaleTimeString(),
                }
            } else {
                return {}
            }
        },
        get_session_info: function () {
            var order = this.get_order();
            if (order) {
                return order.get_session_info();
            }
            return null;
        },
        load_new_product_by_id: function (product_id) {
            var self = this;
            var def = new $.Deferred();
            var fields = _.find(this.models, function (model) {
                return model.model === 'product.product';
            }).fields;
            new Model('product.product')
                .query(fields)
                .filter([['id', '=', product_id]])
                .all({'timeout': 3000, 'shadow': true})
                .then(function (products) {
                    self.db.add_products(products[0]);
                }, function (err, event) {
                    event.preventDefault();
                    def.reject();
                });
            return def;
        },
        load_new_partners_by_id: function (partner_id) {
            var self = this;
            var def = new $.Deferred();
            var fields = _.find(this.models, function (model) {
                return model.model === 'res.partner';
            }).fields;
            new Model('res.partner')
                .query(fields)
                .filter([['id', '=', partner_id]])
                .all({'timeout': 3000, 'shadow': true})
                .then(function (partners) {
                    if (self.db.add_partners(partners)) {
                        def.resolve();
                    } else {
                        def.reject();
                    }
                }, function (err, event) {
                    event.preventDefault();
                    def.reject();
                });
            return def;
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            var self = this;
            var res = _super_order.initialize.apply(this, arguments);
            if (!this.session_info) {
                this.session_info = {};
                this.session_info['created'] = this.pos.session_info();
            }
            if (!this.order_time) {
                this.order_time = new Date().toLocaleTimeString();
            }
            setInterval(function () {
                self.get_quotations();
            }, 20000);
            return res;
        },
        get_quotations: function () {
            var self = this;
            if (this.pos && this.pos.config && this.pos.config.allow_load_data == true) {
                new Model('pos.quotation').call('get_quotations', [this.pos.config.shop_id[0]]).then(function (quotations) {
                    self.pos.db.add_quotations(quotations);
                    self.pos.trigger('update:quotation-screen');
                });
            }
        },

        get_session_info: function () {
            return this.session_info;
        },
        init_from_JSON: function (json) {
            var res = _super_order.init_from_JSON.apply(this, arguments);
            this.uid = json.uid;
            this.session_info = json.session_info;
            this.order_time = json.order_time;
            if (json.quotation_name) {
                this.quotation_name = json.quotation_name;
            }
            if (json.note) {
                this.note = json.note;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            json.session_info = this.session_info;
            json.uid = this.uid;
            json.order_time = this.order_time;
            if (this.quotation_name) {
                json.quotation_name = this.quotation_name;
            }
            if (this.note) {
                json.note = this.note;
            }
            return json;
        },
    });

    var _super_order_line = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attr, options) {
            var res = _super_order_line.initialize.apply(this, arguments);
            if (!this.session_info) {
                this.session_info = {};
                this.session_info['created'] = this.pos.session_info();
            }
            if (!this.uid) {
                this.uid = this.order.uid + '-' + this.pos.config.id + '-' + this.id;
            }
            this.order_uid = this.order.uid;
            return res;
        },
        init_from_JSON: function (json) {
            var res = _super_order_line.init_from_JSON.apply(this, arguments);
            this.uid = json.uid;
            this.session_info = json.session_info;
            return res;
        },
        export_as_JSON: function () {
            var json = _super_order_line.export_as_JSON.apply(this, arguments);
            json.uid = this.uid;
            json.session_info = this.session_info;
            json.order_uid = this.order.uid;
            return json;
        }
    });

});
