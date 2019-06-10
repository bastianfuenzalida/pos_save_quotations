/**
 * Created by brucenguyen on 4/8/17.
 */
odoo.define('pos_save_quotations_db', function (require) {
    var db = require('point_of_sale.DB');

    db.include({
        init: function (options) {
            this._super(options);
            this.quotations_send_fail = {};
            this.quotations = [];
            this.quotations_by_id = {};
            this.quotation_search_string = "";
        },

        _quotation_search_string: function (quotation) {
            var str = quotation.uid;
            str += '|' + quotation.name;
            if (quotation.partner_id && quotation.partner_id.name) {
                str += '|' + quotation.partner_id.name;
            }
            if (quotation.partner_id && quotation.partner_id.mobile) {
                str += '|' + quotation.partner_id.mobile;
            }
            if (quotation.partner_id && quotation.partner_id.phone) {
                str += '|' + quotation.partner_id.phone;
            }
            if (quotation.partner_id && quotation.partner_id.street) {
                str += '|' + quotation.partner_id.street;
            }
            str = '' + quotation.id + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_quotation: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var query = this.quotation_search_string;
                var r = re.exec(this.quotation_search_string);
                if (r && r[1]) {
                    var id = Number(r[1]);
                    if (this.order_by_id[id] !== undefined) {
                        results.push(this.order_by_id[id]);
                    } else {
                        var code = r

                    }
                } else {
                    break;
                }
            }
            return results;
        },
        add_quotations: function (quotations) {
            this.quotations = [];
            this.quotations_by_id = {};
            this.quotation_search_string = "";
            for (var i = 0; i < quotations.length; i++) {
                this.quotations.push(quotations[i]);
                this.quotations_by_id[quotations[i].id] = quotations[i];
                this.quotation_search_string += this._quotation_search_string(quotations[i]);
            }
        },
        search_quotation: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.quotation_search_string);
                if (r) {
                    var id = Number(r[1]);
                    results.push(this.quotations_by_id[id]);
                } else {
                    break;
                }
            }
            return results;
        },
    })
})