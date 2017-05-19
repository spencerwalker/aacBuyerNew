angular.module('orderCloud')
    .provider('$ocPunchout', OrderCloudPunchoutProvider)
;

function OrderCloudPunchoutProvider() {
    var punchouts = {};

    return {
        $get: function() {
            return {
                GetPunchouts: function() {
                    return punchouts;
                }
            }
        },
        AddPunchout: function(punchout) {
            if (!punchout.Name) throw 'ocPunchout: punchout must have a Name';
            if (!punchout.CategoryID) throw 'ocPunchout: punchout must have a CategoryID'

            punchouts[punchout.CategoryID] = punchout;
        }
    };
}