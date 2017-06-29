angular.module('orderCloud')
    .factory('ccPayment', ccPaymentService)
;

function ccPaymentService($http, OrderCloudSDK, ocAuthNet) {
    var service = {
        Get: _get
    }

    function _get(order, user) {
        return OrderCloudSDK.Payments.List('outgoing', order.ID)
            .then(function(payments) {
                _.each(payments.Items, function(paymentData) {
                    if(paymentData.Type === 'CreditCard' && !paymentData.Accepted) {
                        ocAuthNet.AuthCaptureTransaction(order, paymentData);
                    }
                })
            })
    }

    return service;
    
}