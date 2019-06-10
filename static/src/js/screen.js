odoo.define('pos_save_quotations_screen', function (require) {

    var screens = require('point_of_sale.screens');
    var PopupWidget = require("point_of_sale.popups");
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var QWeb = core.qweb;
    var _t = core._t;
    var models = require('point_of_sale.models');

    var shops_popup = PopupWidget.extend({
        template: 'shops_popup',
        init: function (parent, options) {
            this._super(parent, options);
        },
        renderElement: function () {
            var self = this;
            this.shops = this.pos.shops;
            this.image_url = window.location.origin + '/web/image?model=pos.shop&field=image&id=';
            this._super();
            this.pos.shop_ids_selected = [];
            $('.product').click(function () {
                var shop_id = parseInt($(this).data('id'));
                var shop = self.shops.find(function (shop) {
                    return shop.id == shop_id;
                })
                if (shop) {
                    if ($(this).closest('.product').hasClass("config-selected") == true) {
                        $(this).closest('.product').toggleClass("config-selected");
                        var index = self.pos.shop_ids_selected.indexOf(shop.id);
                        if (index > -1) {
                            self.pos.shop_ids_selected.splice(index, 1);
                        }
                    } else {
                        $(this).closest('.product').toggleClass("config-selected");
                        self.pos.shop_ids_selected.push(shop.id);

                    }
                }
            });
            $('.confirm').click(function () {
                var shop_ids_selected = self.pos.shop_ids_selected;
                var current_order = self.pos.get_order();
                if (shop_ids_selected.length && current_order) {
                    var order_json = current_order.export_as_JSON();
                    order_json.shop_ids_selected = shop_ids_selected;
                    self.pos.save_quotation_to_backend(order_json);
                    if (self.pos.config.delete_after_save == true) {
                        current_order.destroy({'reason': 'abandon'});
                    }
                }
            });

        },
    });
    gui.define_popup({
        name: 'shops_popup',
        widget: shops_popup
    });
    var button_save_quotation = screens.ActionButtonWidget.extend({
        template: 'button_save_quotation',
        button_click: function () {
            var note = $('.order-note').val();
            this.pos.get_order().note = note;
            var order_json = this.pos.get_order().export_as_JSON();
            if (this.pos.get_order().orderlines.length == 0 || !order_json.partner_id) {
                this.gui.show_popup('error',{
                    'title': _t("Warning"),
                    'body': _t("Please add line and customer before use the function"),
                });

            }
            if (this.pos.get_order().orderlines.length != 0 && order_json.partner_id) {
                this.gui.show_popup('shops_popup', {});
            }
        },
    });
    screens.define_action_button({
        'name': 'button_save_quotation',
        'widget': button_save_quotation,
        'condition': function () {
            return this.pos.config.allow_save_quotation == true;
        },
    });

    var button_loading_quotation = screens.ActionButtonWidget.extend({
        template: 'button_loading_quotation',
        button_click: function () {
            this.gui.show_screen('quotation_screen');
        },
    });
    screens.define_action_button({
        'name': 'button_loading_quotation',
        'widget': button_loading_quotation,
        'condition': function () {
            return this.pos.config.allow_load_data == true;
        },
    });
    // Quotation screen
    var quotation_screen = screens.ScreenWidget.extend({
        template: 'quotation_screen',

        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:quotation-screen', function () {
                self.render_list(self.pos.db.quotations);
            });
            this.pos.quotation_selected = null;
            $('.quotation-line').click(function () {
                var quotation_id = parseInt($(this).data('id'));
                var quotation = self.pos.db.quotations_by_id[quotation_id]
                if (quotation) {
                    if ($(this).closest('.quotation-line').hasClass("quotation-selected") == true) {
                        $(this).closest('.quotation-line').toggleClass("quotation-selected");
                        self.pos.quotation_selected = null;
                    } else {
                        $('.quotation-line').removeClass('quotation-selected');
                        $(this).closest('.quotation-line').toggleClass("quotation-selected");
                        self.pos.quotation_selected = quotation;
                    }
                }
            });
            $('.load-quotation').click(function () {
                if (!self.pos.quotation_selected) {
                    self.gui.show_popup('error',{
                        'title': _t("Warning"),
                        'body': _t("Please choice quotation use for made to Order"),
                    });
                } else {
                    self.remove_old_order(self.pos.quotation_selected.uid)
                    var order = new models.Order({}, {pos: self.pos, json: self.pos.quotation_selected.datas});
                    order.quotation_name = self.pos.quotation_selected.name;
                    self.pos.get('orders').add(order);
                    order.trigger('change', order);
                    self.pos.set('selectedOrder', order);
                    self.gui.show_screen('products');
                }
            })
            $('.syncing-now').click(function () {
                var current_order = self.pos.get_order();
                current_order.get_quotations();
            })
        },
        show: function () {
            this.pos.quotation_selected = null;
            var self = this;
            if (this.pos.db.quotations.length) {
                this.render_list(this.pos.db.quotations);
            }
            this._super();
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
        },
        remove_old_order: function (uid) {
            var orders = this.pos.get('orders').models;
            var order = orders.find(function (order) {
                return order.uid == uid;
            });
            if (order) {
                this.pos.get('orders').remove(order);
                order.destroy({'reason': 'abandon'});
            }
        },
        perform_search: function (query, associate_result) {
            var quotations;
            if (query) {
                quotations = this.pos.db.search_quotation(query);
                this.render_list(quotations);
            }
        },
        clear_search: function () {
            var quotations = this.pos.db.quotations;
            this.render_list(quotations);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        render_list: function (quotations) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(quotations.length, 1000); i < len; i++) {
                var quotation = quotations[i];
                var quotation_html = QWeb.render('quotation', {widget: this, quotation: quotation});
                var quotation = document.createElement('tbody');
                quotation.innerHTML = quotation_html;
                quotation = quotation.childNodes[1];
                contents.appendChild(quotation);
            }
            var self = this;
            $('.quotation-line').click(function () {
                var quotation_id = parseInt($(this).data('id'));
                var quotation = self.pos.db.quotations_by_id[quotation_id]
                if (quotation) {
                    if ($(this).closest('.quotation-line').hasClass("quotation-selected") == true) {
                        $(this).closest('.quotation-line').toggleClass("quotation-selected");
                        self.pos.quotation_selected = null;
                    } else {
                        $('.quotation-line').removeClass('quotation-selected');
                        $(this).closest('.quotation-line').toggleClass("quotation-selected");
                        self.pos.quotation_selected = quotation;
                    }
                }
            });
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
    });
    gui.define_screen({name: 'quotation_screen', widget: quotation_screen});
})