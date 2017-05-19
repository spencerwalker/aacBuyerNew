angular.module('orderCloud')
    .filter('punchoutProductName', punchoutProductName)
    .filter('punchoutLineItemVendor', punchoutLineItemVendor)
;

function punchoutProductName() {
    return function(xp, punchoutName) {
        if (!xp || !punchoutName) return;

        var map = {
            'officedepot': 'Description',
            'bestbuy': 'Description',
            'kaplan': 'Description',
            'reallygoodstuff': 'Description',
            'schoolspeciality': 'Description',
            'freyscientific': 'Description'
        };

        return xp[map[punchoutName]];
    }
}

function punchoutLineItemVendor() {
    return function(punchoutName) {
        if (!punchoutName) return;

        var map = {
            'officedepot': 'Office Depot',
            'bestbuy': 'Best Buy',
            'kaplan': 'Kaplan',
            'reallygoodstuff': 'Really Good Stuff',
            'schoolspeciality': 'School Specialty',
            'freyscientific': 'School Specialy Frey Scientific'
        };

        return map[punchoutName];
    }
}